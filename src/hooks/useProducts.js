import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { getCategoryInfo, localizeCategory } from '../utils/categoryMap';
import { trToLower } from '../utils/stringUtils';

export function useProducts(user, currency, language) {
  const [products, setProducts] = useState([]);
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
        const productMap = {};

        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.items && Array.isArray(data.items)) {
            data.items.forEach(item => {
              // Skip items with negative prices (discounts/sales)
              const itemPrice = Number(item.price) || 0;
              if (itemPrice < 0) return;

              // Marka veya isim yoksa undefined olmasını engelle
              const safeBrand = item.brand || 'Unknown Brand';
              const safeName = item.name || 'Unnamed Product';
              const uniqueKey = trToLower(`${safeBrand}-${safeName}`);

              if (!productMap[uniqueKey]) {
                productMap[uniqueKey] = {
                  id: uniqueKey,
                  name: safeName,
                  brand: safeBrand,
                  type: localizeCategory(item.type || 'Other', language),
                  latestPrice: Number(item.price) || 0,
                  latestPriceCurrency: data.currency || currency?.code || 'USD',
                  latestDate: data.date,
                  createdAt: data.createdAt,
                  historyCount: 1
                };
              } else {
                if (data.createdAt > productMap[uniqueKey].createdAt) {
                  productMap[uniqueKey].latestPrice = Number(item.price) || 0;
                  productMap[uniqueKey].latestPriceCurrency = data.currency || currency?.code || 'USD';
                  productMap[uniqueKey].latestDate = data.date;
                  productMap[uniqueKey].createdAt = data.createdAt;
                }
                productMap[uniqueKey].historyCount += 1;
              }
            });
          }
        });

        setProducts(Object.values(productMap));
        setLoading(false);
      });

      return () => unsubscribe();
    } else {
      setProducts([]);
      setLoading(false);
    }
  }, [user, currency?.code, language]);

  return { products, loading };
}
