import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, orderBy, limit, startAfter, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';

export function useReceipts(user) {
  const [allReceipts, setAllReceipts] = useState([]);
  const [loadingReceipts, setLoadingReceipts] = useState(true);
  const [error, setError] = useState(null);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchInitialReceipts = useCallback(async () => {
    if (!user) {
      setAllReceipts([]);
      setLoadingReceipts(false);
      return;
    }
    setLoadingReceipts(true);
    setError(null);
    try {
      const q = query(
        collection(db, "receipts"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(20)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllReceipts(data);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === 20);
    } catch (err) {
      console.error("Failed to fetch receipts:", err);
      setError("Failed to load receipts.");
    } finally {
      setLoadingReceipts(false);
    }
  }, [user]);

  useEffect(() => {
    fetchInitialReceipts();
  }, [fetchInitialReceipts]);

  const loadMoreReceipts = async () => {
    if (!user || !lastDoc || !hasMore) return;
    try {
      const q = query(
        collection(db, "receipts"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc"),
        startAfter(lastDoc),
        limit(20)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (data.length > 0) {
        setAllReceipts(prev => [...prev, ...data]);
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      }
      setHasMore(snapshot.docs.length === 20);
    } catch (err) {
      console.error("Failed to load more receipts:", err);
      setError("Failed to load more receipts.");
    }
  };

  const deleteReceipt = async (receiptId) => {
    try {
      const receiptToDelete = allReceipts.find(r => r.id === receiptId);
      if (receiptToDelete?.storagePath) {
        try {
          await deleteObject(ref(storage, receiptToDelete.storagePath));
        } catch (storageErr) {
          console.warn("Could not delete storage file:", storageErr);
        }
      }
      await deleteDoc(doc(db, "receipts", receiptId));
      setAllReceipts(prev => prev.filter(r => r.id !== receiptId));
      return true;
    } catch (err) {
      console.error("Error deleting document: ", err);
      setError("Failed to delete receipt.");
      return false;
    }
  };

  return {
    allReceipts,
    setAllReceipts,
    loadingReceipts,
    error,
    hasMore,
    loadMoreReceipts,
    deleteReceipt,
    refreshReceipts: fetchInitialReceipts
  };
}

