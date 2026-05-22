import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';

export function useReceipts(user) {
  const [allReceipts, setAllReceipts] = useState([]);
  const [loadingReceipts, setLoadingReceipts] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) {
      const q = query(
        collection(db, "receipts"),
        where("userId", "==", user.uid)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Client-side sort to avoid requiring a composite index
        data.sort((a, b) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        });
        setAllReceipts(data);
        setLoadingReceipts(false);
      }, (err) => {
        console.error("Failed to fetch receipts:", err);
        setError("Failed to load receipts.");
        setLoadingReceipts(false);
      });

      return () => unsubscribe();
    } else {
      setAllReceipts([]);
      setLoadingReceipts(false);
    }
  }, [user]);

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
      return true;
    } catch (err) {
      console.error("Error deleting document: ", err);
      setError("Failed to delete receipt.");
      return false;
    }
  };

  return { allReceipts, loadingReceipts, error, deleteReceipt };
}
