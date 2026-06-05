import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useCurrency } from './CurrencyContext';
import { useLanguage } from './LanguageContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc, setDoc, orderBy } from 'firebase/firestore';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { parseDate } from '../utils/dateFormatter';
import { getCategoryInfo, localizeCategory } from '../utils/categoryMap';

const ReportContext = createContext(null);

export const ReportProvider = ({ children }) => {
  const { user } = useAuth();
  const { formatPrice, currency, convertPrice } = useCurrency();
  const { t, language } = useLanguage();

  const [hasNotification, setHasNotification] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportMonthText, setReportMonthText] = useState("");

  // BİLDİRİM KONTROLÜ
  useEffect(() => {
    if (user) {
      const checkNotificationStatus = async () => {
        try {
          const today = new Date();
          const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);

          const currentReportKey = `${prevMonthDate.getFullYear()}-${prevMonthDate.getMonth() + 1}`;
          const monthName = prevMonthDate.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { month: 'long', year: 'numeric' });

          setReportMonthText(monthName);

          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);

          let lastSeenReportKey = "";
          if (userDocSnap.exists()) {
            lastSeenReportKey = userDocSnap.data().lastSeenReport || "";
          }

          setHasNotification(lastSeenReportKey !== currentReportKey);
        } catch (error) {
          console.error("Bildirim kontrolü hatası:", error);
        }
      };

      checkNotificationStatus();
    }
  }, [user, language]);

  // Font Yükleme (Timeout ile)
  const loadFile = async (url) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 saniye zaman aşımı

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.arrayBuffer();

      let binary = '';
      const bytes = new Uint8Array(data);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return window.btoa(binary);
    } catch (e) {
      console.warn("Font indirilemedi veya zaman aşımına uğradı:", e);
      return null;
    }
  };

  // CSV DIŞA AKTARMA (Geliştirme: useCallback eklendi)
  const exportAllDataToCSV = useCallback(async () => {
    if (!user) return;
    setIsGenerating(true);

    try {
      const q = query(
        collection(db, "receipts"),
        where("userId", "==", user.uid)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        alert(t('common.no_data_period'));
        setIsGenerating(false);
        return;
      }

      // Client-side sorting to avoid composite index requirement
      const allDocs = [];
      querySnapshot.forEach((doc) => allDocs.push(doc.data()));
      
      allDocs.sort((a, b) => {
        const dateA = a.createdAt ? parseDate(a.createdAt) : new Date(0);
        const dateB = b.createdAt ? parseDate(b.createdAt) : new Date(0);
        return dateB - dateA;
      });

      let csvContent = `${t('common.date')};${t('common.store_name')};${t('common.type')};${t('common.price')};${t('settings.currency')};${t('common.details')}\n`;

      allDocs.forEach((data) => {

        let dateStr = data.date || "";
        if (data.createdAt) {
          dateStr = parseDate(data.createdAt).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US');
        }

        const description = `"${(data.fileName || data.title || "No Title").replace(/"/g, '""')}"`;
        const type = data.isManual ? t('common.manual_entry_badge') : t('common.scanned_receipt_badge');

        const rawPrice = Number(data.price) || 0;
        const priceStr = rawPrice.toFixed(2);

        let details = "";
        if (data.items && Array.isArray(data.items)) {
          const itemNames = data.items.map(i => i.name).join(", ");
          details = `"${itemNames.replace(/"/g, '""')}"`;
        }

        const curStr = data.currency || "TRY";
        csvContent += `${dateStr};${description};${type};${priceStr};${curStr};${details}\n`;
      });

      const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Expense_Tracker_All_Data_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Kullanıcıya indirme başarılı bildirimi veriyoruz
      setTimeout(() => alert(t('common.msg_export_success')), 300);

    } catch (error) {
      console.error("CSV Export Error:", error);
      alert(t('common.msg_export_failed'));
    } finally {
      setIsGenerating(false);
    }
  }, [user, t, language]);

  // OKUNDU OLARAK İŞARETLEME (Geliştirme: useCallback eklendi, yukarı alındı)
  const markAsRead = useCallback(async () => {
    if (!user) return;
    setHasNotification(false);
    try {
      const today = new Date();
      const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const currentReportKey = `${prevMonthDate.getFullYear()}-${prevMonthDate.getMonth() + 1}`;

      await setDoc(doc(db, "users", user.uid), {
        lastSeenReport: currentReportKey
      }, { merge: true });
    } catch (error) {
      console.error("Error marking report as read:", error);
    }
  }, [user]);

  // PDF OLUŞTURMA (Geliştirme: useCallback eklendi ve pdfDoc isimlendirmesi yapıldı)
  const generateAndDownloadPDF = useCallback(async (selectedYearAndMonth = null) => {
    if (!user) return;
    setIsGenerating(true);

    try {
      let startOfMonth, endOfMonth;

      if (selectedYearAndMonth) {
        const [year, month] = selectedYearAndMonth.split('-').map(Number);
        startOfMonth = new Date(year, month - 1, 1);
        endOfMonth = new Date(year, month, 0, 23, 59, 59);
      } else {
        const now = new Date();
        startOfMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endOfMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      }

      const monthName = startOfMonth.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { month: 'long', year: 'numeric' });

      // 1. Fetch Receipts
      const q = query(
        collection(db, "receipts"),
        where("userId", "==", user.uid),
        where("createdAt", ">=", startOfMonth),
        where("createdAt", "<=", endOfMonth),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(q);
      const receipts = [];
      let totalSpent = 0;

      querySnapshot.forEach((firestoreDoc) => {
        const data = firestoreDoc.data();
        const safeData = {
          ...data,
          price: Number(data.price) || 0,
        };
        receipts.push(safeData);
        totalSpent += convertPrice(safeData.price, safeData.currency || currency.code || 'USD', currency.code);
      });

      // Client-side sorting
      receipts.sort((a, b) => {
        const dateA = a.createdAt ? parseDate(a.createdAt) : new Date(0);
        const dateB = b.createdAt ? parseDate(b.createdAt) : new Date(0);
        return dateB - dateA;
      });

      if (receipts.length === 0) {
        alert(t('common.no_data_period'));
        setIsGenerating(false);
        return;
      }

      // 2. Fetch Subscriptions to include
      const subsQuery = query(
        collection(db, "subscriptions"),
        where("userId", "==", user.uid)
      );
      const subsSnapshot = await getDocs(subsQuery);
      const subscriptions = [];
      let subsTotal = 0;
      subsSnapshot.forEach((doc) => {
        const sub = doc.data();
        subscriptions.push(sub);
        const rawSubPrice = Number(sub.price) || 0;
        const subPrice = convertPrice(rawSubPrice, sub.currency || currency.code || 'USD', currency.code);
        subsTotal += subPrice;
      });

      // 3. Aggregate Categories, Stores, and Brands
      const categoryMap = {};
      const storeMap = {};
      const brandMap = {};

      receipts.forEach((data) => {
        const rawPrice = Number(data.price) || 0;
        const price = convertPrice(rawPrice, data.currency || currency.code || 'USD', currency.code);

        // Store aggregation
        const storeName = data.fileName || data.title || t('common.unknown_store');
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
            const catLabel = data.isManual ? t('common.manual_entry') : t('common.scanned');
            const catName = localizeCategory(catLabel, language);
            if (!categoryMap[catName]) categoryMap[catName] = 0;
            categoryMap[catName] += price;
          }
        } else {
          const catLabel = data.isManual ? t('common.manual_entry') : t('common.scanned');
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
            const brandLabel = t('common.unknown_brand');
            if (!brandMap[brandLabel]) brandMap[brandLabel] = 0;
            brandMap[brandLabel] += price;
          }
        } else {
          const brandLabel = t('common.unknown_brand');
          if (!brandMap[brandLabel]) brandMap[brandLabel] = 0;
          brandMap[brandLabel] += price;
        }
      });

      // Subscription aggregation
      subscriptions.forEach(sub => {
        const rawSubPrice = Number(sub.price) || 0;
        const subPrice = convertPrice(rawSubPrice, sub.currency || currency.code || 'USD', currency.code);
        const subName = sub.name || t('nav.subscriptions') || "Subscriptions";
        const cleanSubName = subName.trim().charAt(0).toUpperCase() + subName.trim().slice(1);

        if (!storeMap[cleanSubName]) storeMap[cleanSubName] = 0;
        storeMap[cleanSubName] += subPrice;

        if (!brandMap[cleanSubName]) brandMap[cleanSubName] = 0;
        brandMap[cleanSubName] += subPrice;
      });

      if (subsTotal > 0) {
        totalSpent += subsTotal;
        const subsLabel = t('nav.subscriptions') || "Subscriptions";
        const localizedSubsLabel = localizeCategory(subsLabel, language);
        if (!categoryMap[localizedSubsLabel]) categoryMap[localizedSubsLabel] = 0;
        categoryMap[localizedSubsLabel] += subsTotal;
      }

      // Convert to sorted arrays
      const sortedCategoryData = Object.keys(categoryMap)
        .map(key => ({ name: key, amount: categoryMap[key] }))
        .sort((a, b) => b.amount - a.amount);

      const sortedStoreData = Object.keys(storeMap)
        .map(key => ({ name: key, amount: storeMap[key] }))
        .sort((a, b) => b.amount - a.amount);

      const sortedBrandData = Object.keys(brandMap)
        .map(key => ({ name: key, amount: brandMap[key] }))
        .sort((a, b) => b.amount - a.amount);

      // 4. Initialize PDF Document
      const pdfDoc = new jsPDF();
      let fontUsed = 'helvetica';

      const regularFontUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf';
      const boldFontUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf';

      const [fontBase64Regular, fontBase64Bold] = await Promise.all([
        loadFile(regularFontUrl),
        loadFile(boldFontUrl)
      ]);

      if (fontBase64Regular && fontBase64Bold) {
        try {
          pdfDoc.addFileToVFS('Roboto-Regular.ttf', fontBase64Regular);
          pdfDoc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');

          pdfDoc.addFileToVFS('Roboto-Bold.ttf', fontBase64Bold);
          pdfDoc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');

          pdfDoc.setFont('Roboto');
          fontUsed = 'Roboto';
        } catch (e) {
          console.error("Font ekleme hatası:", e);
        }
      }

      // 5. Draw Page 1: Header, Stats and Vector Charts
      pdfDoc.setFontSize(20);
      pdfDoc.setTextColor(40);
      pdfDoc.setFont(fontUsed, 'bold');
      pdfDoc.text(t('common.pdf_report_title'), 14, 22);

      pdfDoc.setFont(fontUsed, 'normal');
      pdfDoc.setFontSize(11);
      pdfDoc.setTextColor(100);
      pdfDoc.text(`${t('common.pdf_period')} ${monthName}`, 14, 32);

      const totalFormatted = formatPrice(totalSpent);
      pdfDoc.setFont(fontUsed, 'bold');
      pdfDoc.text(`${t('common.pdf_total_spent')} ${totalFormatted}`, 14, 39);

      pdfDoc.setFont(fontUsed, 'normal');
      pdfDoc.setFontSize(9.5);
      pdfDoc.setTextColor(120);
      pdfDoc.text(`${t('common.pdf_receipts_logged')} ${receipts.length}  |  ${t('common.pdf_subscriptions')} ${subscriptions.length}`, 14, 45);

      // Line Divider
      pdfDoc.setDrawColor(220, 224, 230);
      pdfDoc.setLineWidth(0.5);
      pdfDoc.line(14, 50, 196, 50);

      // Sector drawing helper using triangles
      const drawPieSector = (pdf, cx, cy, r, startAngle, endAngle, color) => {
        const steps = 30;
        pdf.setFillColor(color);
        for (let i = 0; i < steps; i++) {
          const angle1 = startAngle + (endAngle - startAngle) * (i / steps);
          const angle2 = startAngle + (endAngle - startAngle) * ((i + 1) / steps);
          const rad1 = (angle1 * Math.PI) / 180;
          const rad2 = (angle2 * Math.PI) / 180;
          const x1 = cx + r * Math.cos(rad1);
          const y1 = cy + r * Math.sin(rad1);
          const x2 = cx + r * Math.cos(rad2);
          const y2 = cy + r * Math.sin(rad2);
          pdf.triangle(cx, cy, x1, y1, x2, y2, 'F');
        }
      };

      // Donut chart drawing helper
      const drawDonutChart = (pdf, cx, cy, r, data) => {
        if (!data || data.length === 0) return;
        const total = data.reduce((sum, d) => sum + d.amount, 0);
        if (total === 0) return;

        let currentAngle = -90; // Start at 12 o'clock
        data.forEach(item => {
          const pct = item.amount / total;
          const angleDelta = pct * 360;
          const endAngle = currentAngle + angleDelta;
          const color = getCategoryInfo(item.name).color;
          drawPieSector(pdf, cx, cy, r, currentAngle, endAngle, color);
          currentAngle = endAngle;
        });

        // Center white cutout
        pdf.setFillColor('#ffffff');
        pdf.circle(cx, cy, r * 0.55, 'F');
      };

      // Chart Section helper with Legend
      const drawChartSection = (pdf, title, cx, cy, r, data) => {
        pdf.setFont(fontUsed, 'bold');
        pdf.setFontSize(10.5);
        pdf.setTextColor(40);
        pdf.text(title, cx - r - 6, cy - r - 8);

        if (!data || data.length === 0) {
          pdf.setFont(fontUsed, 'normal');
          pdf.setFontSize(9);
          pdf.setTextColor(150);
          pdf.text(t('common.pdf_no_data'), cx - 8, cy);
          return;
        }

        drawDonutChart(pdf, cx, cy, r, data);

        const total = data.reduce((sum, d) => sum + d.amount, 0);
        let legendY = cy - r + 3;
        const legendX = cx + r + 6;
        pdf.setFontSize(7.5);

        // Group minor slices into Others for the legend
        const major = [];
        let othersAmount = 0;
        data.forEach((item) => {
          const pct = (item.amount / total) * 100;
          if (pct >= 4) {
            major.push(item);
          } else {
            othersAmount += item.amount;
          }
        });
        if (othersAmount > 0) {
          major.push({ name: t('common.others_combined') || "Others", amount: othersAmount });
        }

        major.slice(0, 7).forEach((item) => {
          const pct = ((item.amount / total) * 100).toFixed(1);
          const color = getCategoryInfo(item.name).color;
          
          pdf.setFillColor(color);
          pdf.rect(legendX, legendY - 2, 2.5, 2.5, 'F');
          
          pdf.setFont(fontUsed, 'bold');
          pdf.setTextColor(50);
          const label = item.name.length > 15 ? item.name.slice(0, 13) + ".." : item.name;
          pdf.text(`${label}:`, legendX + 4, legendY);
          
          pdf.setFont(fontUsed, 'normal');
          pdf.setTextColor(100);
          const textOffset = legendX + 4 + pdf.getTextWidth(`${label}: `);
          pdf.text(`${pct}% (${formatPrice(item.amount)})`, textOffset, legendY);
          
          legendY += 5;
        });
      };

      // Draw Row 1: Category & Store charts
      drawChartSection(pdfDoc, t('common.category_breakdown') || "Category Breakdown", 45, 90, 18, sortedCategoryData);
      drawChartSection(pdfDoc, t('common.store_breakdown') || "Store Breakdown", 136, 90, 18, sortedStoreData);

      // Draw Row 2: Brand chart & Insights
      drawChartSection(pdfDoc, t('common.brand_breakdown') || "Brand Breakdown", 45, 165, 18, sortedBrandData);

      // Draw insights in the Row 2 Right slot
      pdfDoc.setFont(fontUsed, 'bold');
      pdfDoc.setFontSize(10.5);
      pdfDoc.setTextColor(40);
      pdfDoc.text(t('common.pdf_report_insights'), 112, 142);
      
      pdfDoc.setFontSize(8.5);
      pdfDoc.setTextColor(80);
      let insightY = 152;
      
      const topCategory = sortedCategoryData[0]?.name ? localizeCategory(sortedCategoryData[0].name, language) : t('common.pdf_no_data');
      const topStore = sortedStoreData[0]?.name || t('common.pdf_no_data');
      const topBrand = sortedBrandData[0]?.name || t('common.pdf_no_data');
      
      pdfDoc.setFont(fontUsed, 'bold');
      pdfDoc.text(t('common.pdf_top_category'), 112, insightY);
      pdfDoc.setFont(fontUsed, 'normal');
      pdfDoc.text(topCategory, 112 + pdfDoc.getTextWidth(t('common.pdf_top_category') + "  "), insightY);
      
      insightY += 7;
      pdfDoc.setFont(fontUsed, 'bold');
      pdfDoc.text(t('common.pdf_top_store'), 112, insightY);
      pdfDoc.setFont(fontUsed, 'normal');
      pdfDoc.text(topStore, 112 + pdfDoc.getTextWidth(t('common.pdf_top_store') + "  "), insightY);
      
      insightY += 7;
      pdfDoc.setFont(fontUsed, 'bold');
      pdfDoc.text(t('common.pdf_top_brand'), 112, insightY);
      pdfDoc.setFont(fontUsed, 'normal');
      pdfDoc.text(topBrand, 112 + pdfDoc.getTextWidth(t('common.pdf_top_brand') + "  "), insightY);
      
      insightY += 7;
      pdfDoc.setFont(fontUsed, 'bold');
      pdfDoc.text(t('common.pdf_subs_active'), 112, insightY);
      pdfDoc.setFont(fontUsed, 'normal');
      pdfDoc.text(`${subscriptions.length} (${formatPrice(subsTotal)})`, 112 + pdfDoc.getTextWidth(t('common.pdf_subs_active') + "  "), insightY);

      // 6. Draw Page 2 onwards: Detailed Receipts & Items Breakdown
      pdfDoc.addPage();
      let currentY = 20;

      pdfDoc.setFont(fontUsed, 'bold');
      pdfDoc.setFontSize(14);
      pdfDoc.setTextColor(40);
      pdfDoc.text(t('common.pdf_detailed_breakdown'), 14, currentY);
      currentY += 12;

      receipts.forEach((receipt, index) => {
        // Prevent layout overflow: if space left is less than 50mm, start a new page
        if (currentY > 230) {
          pdfDoc.addPage();
          currentY = 20;
        }

        let dateStr = "N/A";
        if (receipt.createdAt) {
          dateStr = parseDate(receipt.createdAt).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US');
        } else if (receipt.date) {
          dateStr = receipt.date;
        }

        const storeName = receipt.fileName || receipt.title || t('common.pdf_no_store');
        const formattedTotal = formatPrice(receipt.price, receipt.currency);

        pdfDoc.setFont(fontUsed, 'bold');
        pdfDoc.setFontSize(10.5);
        pdfDoc.setTextColor(13, 110, 253);
        pdfDoc.text(`${index + 1}. ${storeName} (${dateStr}) - ${t('common.total')} ${formattedTotal}`, 14, currentY);
        currentY += 4;

        // Draw items table
        const itemColumns = [
          t('common.pdf_item_name'),
          t('common.pdf_brand'),
          t('common.pdf_category'),
          t('common.pdf_size'),
          t('common.pdf_price')
        ];
        const itemRows = [];

        if (receipt.items && Array.isArray(receipt.items) && receipt.items.length > 0) {
          receipt.items.forEach(item => {
            itemRows.push([
              item.name || "-",
              item.brand || "-",
              item.type ? localizeCategory(item.type, language) : "-",
              item.size || "-",
              formatPrice(item.price, receipt.currency)
            ]);
          });
        } else {
          itemRows.push([
            storeName,
            "-",
            receipt.items?.[0]?.type ? localizeCategory(receipt.items[0].type, language) : "-",
            "-",
            formattedTotal
          ]);
        }

        autoTable(pdfDoc, {
          head: [itemColumns],
          body: itemRows,
          startY: currentY,
          theme: 'striped',
          headStyles: { fillColor: [80, 80, 80], font: fontUsed, fontStyle: 'bold', fontSize: 8.5 },
          bodyStyles: { font: fontUsed, fontStyle: 'normal', fontSize: 8 },
          styles: { cellPadding: 2, font: fontUsed },
          margin: { left: 14, right: 14 },
          didDrawPage: (data) => {
            currentY = data.cursor.y;
          }
        });

        currentY = pdfDoc.lastAutoTable.finalY + 10;
      });

      // 7. Draw Subscriptions table if any exist
      if (subscriptions.length > 0) {
        if (currentY > 230) {
          pdfDoc.addPage();
          currentY = 20;
        }

        pdfDoc.setFont(fontUsed, 'bold');
        pdfDoc.setFontSize(11);
        pdfDoc.setTextColor(13, 110, 253);
        pdfDoc.text(t('common.pdf_monthly_subs'), 14, currentY);
        currentY += 4;

        const subColumns = [t('common.pdf_sub_name'), t('common.pdf_price')];
        const subRows = [];
        subscriptions.forEach(sub => {
          subRows.push([
            sub.name || "-",
            formatPrice(sub.price, sub.currency)
          ]);
        });

        autoTable(pdfDoc, {
          head: [subColumns],
          body: subRows,
          startY: currentY,
          theme: 'striped',
          headStyles: { fillColor: [80, 80, 80], font: fontUsed, fontStyle: 'bold', fontSize: 8.5 },
          bodyStyles: { font: fontUsed, fontStyle: 'normal', fontSize: 8 },
          styles: { cellPadding: 2, font: fontUsed },
          margin: { left: 14, right: 14 }
        });
      }

      const safeFileName = `Expense_Report_${monthName.replace(/\s/g, '_')}.pdf`;
      pdfDoc.save(safeFileName);

      // Kullanıcıya indirme başarılı bildirimi veriyoruz
      setTimeout(() => alert(t('common.msg_export_success')), 300);

      markAsRead();

    } catch (error) {
      console.error("PDF Generation Error (Critical):", error);
      alert(t('common.msg_export_failed') + `: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  }, [user, formatPrice, markAsRead, currency?.code, convertPrice, t, language]); // Bağımlılıklar güncellendi

  // Geliştirme: Context value objesini useMemo ile sarmalayarak gereksiz renderları kestik
  const contextValue = useMemo(() => ({
    hasNotification,
    reportMonthText,
    isGenerating,
    generateAndDownloadPDF,
    exportAllDataToCSV,
    markAsRead
  }), [hasNotification, reportMonthText, isGenerating, generateAndDownloadPDF, exportAllDataToCSV, markAsRead]);

  return (
    <ReportContext.Provider value={contextValue}>
      {children}
    </ReportContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useReport = () => useContext(ReportContext);