import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import { localizeCategory } from '../utils/categoryMap';
import { parseDate } from '../utils/dateFormatter';

export function useExpenseAnalysis(user, timeRange) {
  const { currency, convertPrice } = useCurrency();
  const { language, t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [totalSpent, setTotalSpent] = useState(0);

  useEffect(() => {
    if (user) {
      setLoading(true);

      const now = new Date();
      let startDate = null;

      if (timeRange === 'this_week') {
        startDate = new Date(now);
        const dayOfWeek = startDate.getDay(); // 0=Sun, 1=Mon...
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Start from Monday
        startDate.setDate(startDate.getDate() - diff);
        startDate.setHours(0, 0, 0, 0);
      } else if (timeRange === 'this_month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (timeRange === 'last_3_months') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      } else if (timeRange === 'this_year') {
        startDate = new Date(now.getFullYear(), 0, 1);
      }

      const useDailyGrouping = (timeRange === 'this_week' || timeRange === 'this_month');

      let receiptsQuery;
      if (startDate) {
        receiptsQuery = query(
          collection(db, "receipts"),
          where("userId", "==", user.uid),
          where("createdAt", ">=", startDate),
          orderBy("createdAt", "desc")
        );
      } else {
        receiptsQuery = query(
          collection(db, "receipts"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        );
      }

      const subsQuery = query(
        collection(db, "subscriptions"),
        where("userId", "==", user.uid)
      );

      let receiptsData = null;
      let subsData = null;
      let receiptsLoaded = false;
      let subsLoaded = false;

      const mergeAndUpdate = () => {
        if (!receiptsLoaded || !subsLoaded) return;

        const monthlyMap = {};
        const categoryMap = {};
        let total = 0;

        if (timeRange === 'this_week') {
          const start = new Date(startDate);
          for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            if (d > now) break;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            monthlyMap[key] = 0;
          }
        } else if (timeRange === 'this_month') {
          const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          for (let i = 1; i <= daysInMonth; i++) {
            if (i > now.getDate()) break;
            const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            monthlyMap[key] = 0;
          }
        } else if (timeRange === 'last_3_months') {
          for (let i = 2; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthlyMap[key] = 0;
          }
        } else if (timeRange === 'this_year') {
          for (let i = 1; i <= 12; i++) {
            if (i > now.getMonth() + 1) break;
            const key = `${now.getFullYear()}-${String(i).padStart(2, '0')}`;
            monthlyMap[key] = 0;
          }
        }

        let minYear = now.getFullYear();
        let maxYear = now.getFullYear();

        if (receiptsData) {
          receiptsData.forEach((doc) => {
            const data = doc.data();
            const rawPrice = Number(data.price) || 0;
            const price = convertPrice(rawPrice, data.currency || currency.code || 'USD', currency.code);

            if (startDate && data.createdAt) {
              const docDate = parseDate(data.createdAt);
              if (docDate < startDate) return;
            }

            total += price;

            let groupKey = "Unknown";
            if (data.createdAt) {
              const date = parseDate(data.createdAt);
              const y = date.getFullYear();
              
              if (y < minYear) minYear = y;
              if (y > maxYear) maxYear = y;

              if (timeRange === 'all_time') {
                groupKey = `${y}`;
              } else if (useDailyGrouping) {
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                groupKey = `${y}-${month}-${day}`;
              } else {
                const month = String(date.getMonth() + 1).padStart(2, '0');
                groupKey = `${y}-${month}`;
              }
            }

            if (!monthlyMap[groupKey]) monthlyMap[groupKey] = 0;
            monthlyMap[groupKey] += price;

            if (data.items && Array.isArray(data.items) && data.items.length > 0) {
              let hasTypedItems = false;
              data.items.forEach(item => {
                const type = item.type || "";
                const rawItemPrice = Number(item.price) || 0;
                const itemPrice = convertPrice(rawItemPrice, data.currency || currency.code || 'USD', currency.code);
                if (type.trim()) {
                  hasTypedItems = true;
                  const localizedType = localizeCategory(type, language);
                  if (!categoryMap[localizedType]) categoryMap[localizedType] = 0;
                  categoryMap[localizedType] += itemPrice;
                }
              });
              if (!hasTypedItems) {
                const catLabel = data.isManual 
                  ? (language === 'tr' ? 'Manuel Giriş' : 'Manual Entry') 
                  : (language === 'tr' ? 'Taranmış' : 'Scanned');
                const catName = localizeCategory(catLabel, language);
                if (!categoryMap[catName]) categoryMap[catName] = 0;
                categoryMap[catName] += price;
              }
            } else {
              const catLabel = data.isManual 
                ? (language === 'tr' ? 'Manuel Giriş' : 'Manual Entry') 
                : (language === 'tr' ? 'Taranmış' : 'Scanned');
              const catName = localizeCategory(catLabel, language);
              if (!categoryMap[catName]) categoryMap[catName] = 0;
              categoryMap[catName] += price;
            }
          });
        }

        if (timeRange === 'all_time') {
          for (let y = minYear; y <= maxYear; y++) {
            if (monthlyMap[`${y}`] === undefined) {
              monthlyMap[`${y}`] = 0;
            }
          }
        }

        if (subsData && subsData.length > 0) {
          let subsKey = "Unknown";
          if (timeRange === 'all_time') {
            subsKey = `${now.getFullYear()}`;
          } else if (useDailyGrouping) {
            subsKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          } else {
            subsKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          }

          let subsTotal = 0;

          subsData.forEach(sub => {
            const rawSubPrice = Number(sub.price) || 0;
            const subPrice = convertPrice(rawSubPrice, sub.currency || currency.code || 'USD', currency.code);
            subsTotal += subPrice;
          });

          if (subsTotal > 0) {
            total += subsTotal;
            if (!monthlyMap[subsKey]) monthlyMap[subsKey] = 0;
            monthlyMap[subsKey] += subsTotal;

            const subsLabel = t('nav.subscriptions') || "Subscriptions";
            const localizedSubsLabel = localizeCategory(subsLabel, language);
            if (!categoryMap[localizedSubsLabel]) categoryMap[localizedSubsLabel] = 0;
            categoryMap[localizedSubsLabel] += subsTotal;
          }
        }

        const formattedChartData = Object.keys(monthlyMap)
          .sort()
          .map(key => {
            if (key === "Unknown") return { name: "Unknown", amount: monthlyMap[key] };

            if (timeRange === 'all_time') {
              return { name: key, amount: monthlyMap[key] };
            } else if (useDailyGrouping) {
              const [y, m, d] = key.split('-');
              const dateObj = new Date(y, m - 1, d);
              const displayDay = dateObj.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short' });
              return { name: displayDay, amount: monthlyMap[key] };
            } else {
              const [y, m] = key.split('-');
              const dateObj = new Date(y, m - 1);
              const displayMonth = dateObj.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { month: 'short', year: 'numeric' });
              return { name: displayMonth, amount: monthlyMap[key] };
            }
          });

        const formattedCategoryData = Object.keys(categoryMap)
          .map(key => ({ name: key, amount: categoryMap[key] }))
          .sort((a, b) => b.amount - a.amount);

        setChartData(formattedChartData);
        setCategoryData(formattedCategoryData);
        setTotalSpent(total);
        setLoading(false);
      };

      const unsubReceipts = onSnapshot(receiptsQuery, (snapshot) => {
        receiptsData = snapshot;
        receiptsLoaded = true;
        mergeAndUpdate();
      }, (error) => {
        console.error("Error analyzing expenses:", error);
        receiptsLoaded = true;
        mergeAndUpdate();
      });

      const unsubSubs = onSnapshot(subsQuery, (snapshot) => {
        subsData = snapshot.docs.map(doc => doc.data());
        subsLoaded = true;
        mergeAndUpdate();
      }, (error) => {
        console.error("Error fetching subscriptions:", error);
        subsLoaded = true;
        mergeAndUpdate();
      });

      return () => {
        unsubReceipts();
        unsubSubs();
      };
    } else {
      setChartData([]);
      setCategoryData([]);
      setTotalSpent(0);
      setLoading(false);
    }
  }, [user, timeRange, currency?.code, convertPrice, language, t]);

  return { loading, chartData, categoryData, totalSpent };
}
