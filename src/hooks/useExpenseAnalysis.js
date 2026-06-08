import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import { localizeCategory } from '../utils/categoryMap';
import { parseDate } from '../utils/dateFormatter';

export function useExpenseAnalysis(user, timeRange) {
  const { currency, convertPrice } = useCurrency();
  const { language, t } = useLanguage();

  const [rawReceipts, setRawReceipts] = useState([]);
  const [rawSubs, setRawSubs] = useState([]);
  const [receiptsLoaded, setReceiptsLoaded] = useState(false);
  const [subsLoaded, setSubsLoaded] = useState(false);

  useEffect(() => {
    if (user) {
      setReceiptsLoaded(false);
      setSubsLoaded(false);

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

      const unsubReceipts = onSnapshot(receiptsQuery, (snapshot) => {
        setRawReceipts(snapshot.docs.map(doc => doc.data()));
        setReceiptsLoaded(true);
      }, (error) => {
        console.error("Error analyzing expenses:", error);
        setReceiptsLoaded(true);
      });

      const unsubSubs = onSnapshot(subsQuery, (snapshot) => {
        setRawSubs(snapshot.docs.map(doc => doc.data()));
        setSubsLoaded(true);
      }, (error) => {
        console.error("Error fetching subscriptions:", error);
        setSubsLoaded(true);
      });

      return () => {
        unsubReceipts();
        unsubSubs();
      };
    } else {
      setRawReceipts([]);
      setRawSubs([]);
      setReceiptsLoaded(false);
      setSubsLoaded(false);
    }
  }, [user, timeRange]);

  const analysisResult = useMemo(() => {
    if (!receiptsLoaded || !subsLoaded) {
      return { chartData: [], categoryData: [], storeData: [], brandData: [], totalSpent: 0 };
    }

    const monthlyMap = {};
    const categoryMap = {};
    const storeMap = {};
    const brandMap = {};
    let total = 0;

    const now = new Date();
    
    // First pass to find minDate for all_time dynamic grouping
    let minDate = new Date(now);
    rawReceipts.forEach(data => {
      if (data.createdAt) {
        const d = parseDate(data.createdAt);
        if (d < minDate) minDate = d;
      }
    });
    rawSubs.forEach(sub => {
       let subStart = new Date(now);
       if (sub.startDate) {
          const parts = sub.startDate.split('-');
          if (parts.length === 3) subStart = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
       } else if (sub.createdAt) {
          subStart = parseDate(sub.createdAt);
       }
       if (subStart < minDate) minDate = subStart;
    });

    const monthsDiff = (now.getFullYear() - minDate.getFullYear()) * 12 + now.getMonth() - minDate.getMonth();
    let allTimeGrouping = 'year';
    if (monthsDiff <= 24) allTimeGrouping = 'month';
    else if (monthsDiff <= 60) allTimeGrouping = 'quarter';

    const useDailyGrouping = (timeRange === 'this_week' || timeRange === 'this_month');

    let startDate = null;
    if (timeRange === 'this_week') {
      startDate = new Date(now);
      const dayOfWeek = startDate.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startDate.setDate(startDate.getDate() - diff);
      startDate.setHours(0, 0, 0, 0);
    } else if (timeRange === 'this_month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (timeRange === 'last_3_months') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    } else if (timeRange === 'this_year') {
      startDate = new Date(now.getFullYear(), 0, 1);
    }

    if (timeRange === 'this_week') {
      const start = new Date(startDate);
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        monthlyMap[key] = 0;
      }
    } else if (timeRange === 'this_month') {
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      for (let i = 1; i <= daysInMonth; i++) {
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
        const key = `${now.getFullYear()}-${String(i).padStart(2, '0')}`;
        monthlyMap[key] = 0;
      }
    } else if (timeRange === 'all_time') {
      if (allTimeGrouping === 'month') {
        let curr = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
        const endMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        while(curr <= endMonth) {
           const key = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}`;
           monthlyMap[key] = 0;
           curr.setMonth(curr.getMonth() + 1);
        }
      } else if (allTimeGrouping === 'quarter') {
        let currY = minDate.getFullYear();
        let currQ = Math.floor(minDate.getMonth() / 3) + 1;
        const endY = now.getFullYear();
        const endQ = Math.floor(now.getMonth() / 3) + 1;
        while (currY < endY || (currY === endY && currQ <= endQ)) {
           monthlyMap[`${currY}-Q${currQ}`] = 0;
           currQ++;
           if (currQ > 4) { currQ = 1; currY++; }
        }
      } else {
        for(let y = minDate.getFullYear(); y <= now.getFullYear(); y++) {
           monthlyMap[`${y}`] = 0;
        }
      }
    }

    rawReceipts.forEach((data) => {
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
        
        if (timeRange === 'all_time') {
          if (allTimeGrouping === 'month') {
             groupKey = `${y}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          } else if (allTimeGrouping === 'quarter') {
             const q = Math.floor(date.getMonth() / 3) + 1;
             groupKey = `${y}-Q${q}`;
          } else {
             groupKey = `${y}`;
          }
        } else if (useDailyGrouping) {
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          groupKey = `${y}-${month}-${day}`;
        } else {
          const month = String(date.getMonth() + 1).padStart(2, '0');
          groupKey = `${y}-${month}`;
        }
      }

      if (monthlyMap[groupKey] === undefined) monthlyMap[groupKey] = 0;
      monthlyMap[groupKey] += price;

      // Store aggregation
      const storeName = data.fileName || data.title || (language === 'tr' ? 'Bilinmeyen Mağaza' : 'Unknown Store');
      const cleanStore = storeName.trim().charAt(0).toUpperCase() + storeName.trim().slice(1);
      if (!storeMap[cleanStore]) storeMap[cleanStore] = 0;
      storeMap[cleanStore] += price;

      // Category aggregation
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

      // Brand aggregation
      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        let hasTypedBrands = false;
        data.items.forEach(item => {
          const brand = item.brand || "";
          const rawItemPrice = Number(item.price) || 0;
          const itemPrice = convertPrice(rawItemPrice, data.currency || currency.code || 'USD', currency.code);
          if (brand.trim()) {
            hasTypedBrands = true;
            const cleanBrand = brand.trim().charAt(0).toUpperCase() + brand.trim().slice(1);
            if (!brandMap[cleanBrand]) brandMap[cleanBrand] = 0;
            brandMap[cleanBrand] += itemPrice;
          }
        });
        if (!hasTypedBrands) {
          const brandLabel = language === 'tr' ? 'Bilinmeyen Marka' : 'Unknown Brand';
          if (!brandMap[brandLabel]) brandMap[brandLabel] = 0;
          brandMap[brandLabel] += price;
        }
      } else {
        const brandLabel = language === 'tr' ? 'Bilinmeyen Marka' : 'Unknown Brand';
        if (!brandMap[brandLabel]) brandMap[brandLabel] = 0;
        brandMap[brandLabel] += price;
      }
    });

    if (rawSubs && rawSubs.length > 0) {
      const localizedSubsLabel = localizeCategory(t('nav.subscriptions') || "Subscriptions", language);

      rawSubs.forEach(sub => {
        const rawSubPrice = Number(sub.price) || 0;
        const subPrice = convertPrice(rawSubPrice, sub.currency || currency.code || 'USD', currency.code);

        const subName = sub.name || t('nav.subscriptions') || "Subscriptions";
        const cleanSubName = subName.trim().charAt(0).toUpperCase() + subName.trim().slice(1);
        
        let subStart = new Date(now.getFullYear(), now.getMonth(), 1);
        if (sub.startDate) {
          const parts = sub.startDate.split('-'); // YYYY-MM-DD
          if (parts.length === 3) {
             subStart = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
          }
        } else if (sub.createdAt) {
          const d = parseDate(sub.createdAt);
          subStart = new Date(d.getFullYear(), d.getMonth(), 1);
        }

        let iterMonth = new Date(subStart);
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        let subEndDateObj = null;
        if (sub.endDate) {
           subEndDateObj = new Date(sub.endDate);
        }

        while (iterMonth <= currentMonthStart) {
          const y = iterMonth.getFullYear();
          const m = iterMonth.getMonth();
          const mStr = String(m + 1).padStart(2, '0');
          
          let paymentDate = new Date(y, m, sub.dayOfMonth || 1);

          // If the payment date is after the subscription's end date, we don't charge for this month or future months
          if (subEndDateObj && paymentDate > subEndDateObj) {
             break;
          }
          
          // If payment date is in the future relative to 'now', skip this month
          if (paymentDate > now) {
             iterMonth.setMonth(iterMonth.getMonth() + 1);
             continue;
          }

          let key = null;
          if (timeRange === 'all_time') {
            if (allTimeGrouping === 'month') {
               key = `${y}-${mStr}`;
            } else if (allTimeGrouping === 'quarter') {
               const q = Math.floor(m / 3) + 1;
               key = `${y}-Q${q}`;
            } else {
               key = `${y}`;
            }
          } else if (timeRange === 'this_year') {
            if (y === now.getFullYear()) key = `${y}-${mStr}`;
          } else if (timeRange === 'last_3_months') {
            const minMonth = new Date(now.getFullYear(), now.getMonth() - 2, 1);
            if (iterMonth >= minMonth) key = `${y}-${mStr}`;
          } else if (timeRange === 'this_month') {
            if (y === now.getFullYear() && m === now.getMonth()) {
               key = `${y}-${mStr}-${String(paymentDate.getDate()).padStart(2, '0')}`;
            }
          } else if (timeRange === 'this_week') {
            if (paymentDate >= startDate && paymentDate <= now) {
               key = `${y}-${mStr}-${String(paymentDate.getDate()).padStart(2, '0')}`;
            }
          }

          if (key && monthlyMap[key] !== undefined) {
             monthlyMap[key] += subPrice;
             total += subPrice;
             
             if (!storeMap[cleanSubName]) storeMap[cleanSubName] = 0;
             storeMap[cleanSubName] += subPrice;

             if (!brandMap[cleanSubName]) brandMap[cleanSubName] = 0;
             brandMap[cleanSubName] += subPrice;

             if (!categoryMap[localizedSubsLabel]) categoryMap[localizedSubsLabel] = 0;
             categoryMap[localizedSubsLabel] += subPrice;
          }
          
          iterMonth.setMonth(iterMonth.getMonth() + 1);
        }
      });
    }

    const formattedChartData = Object.keys(monthlyMap)
      .sort()
      .map(key => {
        if (key === "Unknown") return { name: "Unknown", amount: monthlyMap[key], timeStatus: 'past' };

        let timeStatus = 'past';

        if (timeRange === 'all_time') {
          if (allTimeGrouping === 'month') {
            const [y, m] = key.split('-');
            const dateObj = new Date(y, m - 1);
            const displayMonth = dateObj.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { month: 'short', year: 'numeric' });
            
            const targetMonth = new Date(parseInt(y), parseInt(m) - 1, 1);
            const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            if (targetMonth.getTime() === currentMonth.getTime()) timeStatus = 'current';
            else if (targetMonth < currentMonth) timeStatus = 'past';
            else timeStatus = 'future';
            
            return { name: displayMonth, amount: monthlyMap[key], timeStatus };
          } else if (allTimeGrouping === 'quarter') {
            const [y, qStr] = key.split('-');
            const q = parseInt(qStr.replace('Q', ''));
            const currentQ = Math.floor(now.getMonth() / 3) + 1;
            
            if (parseInt(y) === now.getFullYear() && q === currentQ) timeStatus = 'current';
            else if (parseInt(y) < now.getFullYear() || (parseInt(y) === now.getFullYear() && q < currentQ)) timeStatus = 'past';
            else timeStatus = 'future';
            
            return { name: key, amount: monthlyMap[key], timeStatus };
          } else {
            const y = parseInt(key);
            if (y === now.getFullYear()) timeStatus = 'current';
            else if (y < now.getFullYear()) timeStatus = 'past';
            else timeStatus = 'future';
            return { name: key, amount: monthlyMap[key], timeStatus };
          }
        } else if (useDailyGrouping) {
          const [y, m, d] = key.split('-');
          const dateObj = new Date(y, m - 1, d);
          const displayDay = dateObj.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short' });
          
          const targetDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          
          if (targetDate.getTime() === today.getTime()) timeStatus = 'current';
          else if (targetDate < today) timeStatus = 'past';
          else timeStatus = 'future';

          return { name: displayDay, amount: monthlyMap[key], timeStatus };
        } else {
          const [y, m] = key.split('-');
          const dateObj = new Date(y, m - 1);
          const displayMonth = dateObj.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { month: 'short', year: 'numeric' });
          
          const targetMonth = new Date(parseInt(y), parseInt(m) - 1, 1);
          const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

          if (targetMonth.getTime() === currentMonth.getTime()) timeStatus = 'current';
          else if (targetMonth < currentMonth) timeStatus = 'past';
          else timeStatus = 'future';

          return { name: displayMonth, amount: monthlyMap[key], timeStatus };
        }
      });

    const formattedCategoryData = Object.keys(categoryMap)
      .map(key => ({ name: key, amount: categoryMap[key] }))
      .sort((a, b) => b.amount - a.amount);

    const formattedStoreData = Object.keys(storeMap)
      .map(key => ({ name: key, amount: storeMap[key] }))
      .sort((a, b) => b.amount - a.amount);

    const formattedBrandData = Object.keys(brandMap)
      .map(key => ({ name: key, amount: brandMap[key] }))
      .sort((a, b) => b.amount - a.amount);

    return {
      chartData: formattedChartData,
      categoryData: formattedCategoryData,
      storeData: formattedStoreData,
      brandData: formattedBrandData,
      totalSpent: total
    };
  }, [rawReceipts, rawSubs, receiptsLoaded, subsLoaded, timeRange, currency?.code, convertPrice, language, t]);

  const loading = !receiptsLoaded || !subsLoaded;
  const chartData = analysisResult.chartData;
  const categoryData = analysisResult.categoryData;
  const storeData = analysisResult.storeData;
  const brandData = analysisResult.brandData;
  const totalSpent = analysisResult.totalSpent;

  return { loading, chartData, categoryData, storeData, brandData, totalSpent };
}
