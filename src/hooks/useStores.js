import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { cleanStoreName } from '../utils/stringUtils';

export function useStores(user, currency, convertPrice) {
  const [rawReceipts, setRawReceipts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      setLoading(true);
      const q = query(
        collection(db, "receipts"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(200)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        setRawReceipts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      }, (error) => {
        console.error("Error fetching stores receipts:", error);
        setLoading(false);
      });

      return () => unsubscribe();
    } else {
      setRawReceipts([]);
      setLoading(false);
    }
  }, [user]);

  const stores = useMemo(() => {
    const storeMap = {};

    rawReceipts.forEach((data) => {
      // 🔥 OPTİMİZASYON: Veritabanında hazır storeNameCleaned varsa onu kullan, yoksa anlık temizle
      const rawName = data.fileName || data.title || "Unknown Store";
      const storeName = data.storeNameCleaned || cleanStoreName(rawName);

      if (!storeMap[storeName]) {
        storeMap[storeName] = {
          id: storeName,
          name: storeName,
          totalSpent: 0,
          visitCount: 0
        };
      }

      const rawPrice = Number(data.price) || 0;
      const price = convertPrice(rawPrice, data.currency || currency?.code || 'USD', currency?.code || 'USD');
      storeMap[storeName].totalSpent += price;
      storeMap[storeName].visitCount += 1;
    });

    // 🔥 UX GELİŞTİRMESİ: A-Z yerine En Çok Para Harcanan Mağazayı en üste koy! (Premium His)
    return Object.values(storeMap).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [rawReceipts, currency?.code, convertPrice]);

  return { stores, loading };
}
