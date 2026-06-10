import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useCurrency } from './CurrencyContext';
import { useLanguage } from './LanguageContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc, setDoc, orderBy } from 'firebase/firestore';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { parseDate } from '../utils/dateFormatter';
import { getCategoryInfo, getStringColor, localizeCategory } from '../utils/categoryMap';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

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

  // EXCEL EXPORT — Generates an Excel 2003 XML Spreadsheet (.xls)
  // Uses XML format which natively supports Unicode (all Turkish chars render perfectly)
  // No external dependencies needed — works with zero npm packages
  const exportAllDataToCSV = useCallback(async () => {
    if (!user) return;
    setIsGenerating(true);

    try {
      // 1. Fetch all receipts
      const q = query(
        collection(db, "receipts"),
        where("userId", "==", user.uid)
      );
      const querySnapshot = await getDocs(q);

      // 2. Fetch all subscriptions
      const subsQuery = query(
        collection(db, "subscriptions"),
        where("userId", "==", user.uid)
      );
      const subsSnapshot = await getDocs(subsQuery);

      if (querySnapshot.empty && subsSnapshot.empty) {
        alert(t('common.no_data_period'));
        setIsGenerating(false);
        return;
      }

      // Parse and sort receipts by date descending
      const allReceipts = [];
      querySnapshot.forEach((docSnap) => {
        allReceipts.push({
          ...docSnap.data(),
          price: Number(docSnap.data().price) || 0
        });
      });
      allReceipts.sort((a, b) => {
        const dateA = a.createdAt ? parseDate(a.createdAt) : new Date(0);
        const dateB = b.createdAt ? parseDate(b.createdAt) : new Date(0);
        return dateB - dateA;
      });

      const allSubs = [];
      subsSnapshot.forEach((docSnap) => {
        allSubs.push(docSnap.data());
      });

      // ─── Helper: format date for Excel ───
      const formatExcelDate = (dateVal) => {
        if (!dateVal) return "-";
        const dateObj = parseDate(dateVal);
        if (!dateObj || isNaN(dateObj.getTime())) return "-";
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return language === 'tr' ? `${d}.${m}.${y}` : `${y}-${m}-${d}`;
      };

      // ─── Helper: escape XML special characters ───
      const escXml = (val) => {
        if (val == null) return '';
        return String(val)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');
      };

      // ─── Helper: generate an XML row ───
      const makeRow = (cells, isHeader = false) => {
        const styleId = isHeader ? 'header' : 'default';
        const numStyle = isHeader ? 'header' : 'number';
        let row = '   <Row ss:AutoFitHeight="0">\n';
        cells.forEach(cell => {
          const isNum = !isHeader && typeof cell === 'number';
          const sid = isNum ? numStyle : styleId;
          if (isNum) {
            row += `    <Cell ss:StyleID="${sid}"><Data ss:Type="Number">${cell}</Data></Cell>\n`;
          } else {
            row += `    <Cell ss:StyleID="${sid}"><Data ss:Type="String">${escXml(cell)}</Data></Cell>\n`;
          }
        });
        row += '   </Row>\n';
        return row;
      };

      // ─── Localized labels ───
      const labels = {
        date: t('common.date'),
        store: t('common.store') || t('common.store_name'),
        totalPrice: t('common.total_price'),
        currency: t('settings.currency'),
        entryType: t('common.entry_type'),
        itemName: t('common.item_name'),
        brand: t('common.brand'),
        category: t('common.category') || t('common.type'),
        size: t('common.size'),
        price: t('common.price'),
        manualEntry: t('common.manual_entry_badge'),
        scannedReceipt: t('common.scanned_receipt_badge'),
        noStore: t('common.pdf_no_store'),
        subscriptionName: t('pdf_sub_name') || (language === 'tr' ? 'Abonelik Adı' : 'Subscription Name'),
        renewalDay: language === 'tr' ? 'Yenileme Günü' : 'Renewal Day',
        subscriptions: t('nav.subscriptions'),
        receiptsSheet: language === 'tr' ? 'Harcamalar' : 'Expenses',
        subsSheet: t('nav.subscriptions'),
        summarySheet: language === 'tr' ? 'Özet' : 'Summary',
        categoryBreakdown: t('common.category_breakdown'),
        storeBreakdown: t('common.store_breakdown'),
        brandBreakdown: t('common.brand_breakdown'),
        totalAmount: t('common.total_amount'),
        totalSpent: t('common.total_spent'),
        numberOfReceipts: t('common.number_of_receipts'),
        numberOfSubs: language === 'tr' ? 'Abonelik Sayısı' : 'Number of Subscriptions',
        generalSummary: language === 'tr' ? 'Genel Özet' : 'General Summary',
        amount: t('common.amount'),
        percentage: language === 'tr' ? 'Yüzde' : 'Percentage',
        count: language === 'tr' ? 'Adet' : 'Count',
      };

      // ─── Sheet 1: All Expenses (itemized) ───
      let sheet1Rows = '';
      const sheet1Headers = [
        labels.date, labels.store, labels.totalPrice, labels.currency,
        labels.entryType, labels.itemName, labels.brand, labels.category,
        labels.size, labels.price
      ];
      sheet1Rows += makeRow(sheet1Headers, true);

      allReceipts.forEach((receipt) => {
        const dateStr = formatExcelDate(receipt.createdAt || receipt.date);
        const storeName = receipt.fileName || receipt.title || labels.noStore;
        const entryType = receipt.isManual ? labels.manualEntry : labels.scannedReceipt;
        const receiptTotal = receipt.price;
        const currencyCode = receipt.currency || "TRY";

        if (receipt.items && Array.isArray(receipt.items) && receipt.items.length > 0) {
          receipt.items.forEach((item) => {
            sheet1Rows += makeRow([
              dateStr,
              storeName,
              receiptTotal,
              currencyCode,
              entryType,
              item.name || "-",
              item.brand || "-",
              item.type ? localizeCategory(item.type, language) : "-",
              item.size || "-",
              Number(item.price) || 0
            ]);
          });
        } else {
          sheet1Rows += makeRow([
            dateStr, storeName, receiptTotal, currencyCode, entryType,
            "-", "-", "-", "-", receiptTotal
          ]);
        }
      });

      // ─── Sheet 2: Subscriptions ───
      let sheet2Rows = '';
      const sheet2Headers = [
        labels.subscriptionName || labels.itemName,
        labels.price,
        labels.currency,
        labels.renewalDay
      ];
      sheet2Rows += makeRow(sheet2Headers, true);

      allSubs.forEach((sub) => {
        sheet2Rows += makeRow([
          sub.name || "-",
          Number(sub.price) || 0,
          sub.currency || "TRY",
          sub.renewalDay ? `${sub.renewalDay}` : "-"
        ]);
      });

      // ─── Sheet 3: Summary ───
      // Build aggregations
      const categoryTotals = {};
      const storeTotals = {};
      const brandTotals = {};
      let grandTotal = 0;

      allReceipts.forEach((receipt) => {
        const price = receipt.price;
        grandTotal += price;

        // Store
        const storeName = receipt.fileName || receipt.title || labels.noStore;
        storeTotals[storeName] = (storeTotals[storeName] || 0) + price;

        // Category & Brand from items
        if (receipt.items && Array.isArray(receipt.items) && receipt.items.length > 0) {
          receipt.items.forEach(item => {
            const itemPrice = Number(item.price) || 0;
            // Category
            const cat = item.type ? localizeCategory(item.type, language) : (receipt.isManual ? labels.manualEntry : labels.scannedReceipt);
            categoryTotals[cat] = (categoryTotals[cat] || 0) + itemPrice;
            // Brand
            const brand = item.brand && item.brand.trim() ? item.brand.trim() : (language === 'tr' ? 'Bilinmeyen Marka' : 'Unknown Brand');
            brandTotals[brand] = (brandTotals[brand] || 0) + itemPrice;
          });
        } else {
          const cat = receipt.isManual ? labels.manualEntry : labels.scannedReceipt;
          categoryTotals[cat] = (categoryTotals[cat] || 0) + price;
        }
      });

      // Add subscription totals
      let subsTotal = 0;
      allSubs.forEach(sub => {
        const subPrice = Number(sub.price) || 0;
        subsTotal += subPrice;
      });
      if (subsTotal > 0) {
        categoryTotals[labels.subscriptions] = (categoryTotals[labels.subscriptions] || 0) + subsTotal;
        grandTotal += subsTotal;
      }

      const sortedCats = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
      const sortedStores = Object.entries(storeTotals).sort((a, b) => b[1] - a[1]);
      const sortedBrands = Object.entries(brandTotals).sort((a, b) => b[1] - a[1]);

      let sheet3Rows = '';

      // General summary section
      sheet3Rows += makeRow([labels.generalSummary, ''], true);
      sheet3Rows += makeRow([labels.totalSpent, grandTotal]);
      sheet3Rows += makeRow([labels.numberOfReceipts, allReceipts.length]);
      sheet3Rows += makeRow([labels.numberOfSubs, allSubs.length]);
      sheet3Rows += makeRow(['', '']); // blank row

      // Category breakdown
      sheet3Rows += makeRow([labels.categoryBreakdown, labels.amount, labels.percentage], true);
      sortedCats.forEach(([name, amount]) => {
        const pct = grandTotal > 0 ? `${((amount / grandTotal) * 100).toFixed(1)}%` : '0%';
        sheet3Rows += makeRow([name, amount, pct]);
      });
      sheet3Rows += makeRow(['', '']); // blank row

      // Store breakdown
      sheet3Rows += makeRow([labels.storeBreakdown, labels.amount, labels.percentage], true);
      sortedStores.forEach(([name, amount]) => {
        const receiptGrandTotal = grandTotal - subsTotal; // stores don't include subscriptions
        const pct = receiptGrandTotal > 0 ? `${((amount / receiptGrandTotal) * 100).toFixed(1)}%` : '0%';
        sheet3Rows += makeRow([name, amount, pct]);
      });
      sheet3Rows += makeRow(['', '']); // blank row

      // Brand breakdown
      sheet3Rows += makeRow([labels.brandBreakdown, labels.amount, labels.percentage], true);
      sortedBrands.forEach(([name, amount]) => {
        const receiptGrandTotal = grandTotal - subsTotal;
        const pct = receiptGrandTotal > 0 ? `${((amount / receiptGrandTotal) * 100).toFixed(1)}%` : '0%';
        sheet3Rows += makeRow([name, amount, pct]);
      });

      // ─── Build Excel 2003 XML Spreadsheet ───
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="default">
   <Alignment ss:Vertical="Center" ss:WrapText="0"/>
   <Font ss:FontName="Calibri" ss:Size="11"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
   </Borders>
  </Style>
  <Style ss:ID="header">
   <Alignment ss:Vertical="Center" ss:WrapText="0"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#4472C4" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#2F5496"/>
   </Borders>
  </Style>
  <Style ss:ID="number">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11"/>
   <NumberFormat ss:Format="#,##0.00"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="${escXml(labels.receiptsSheet)}">
  <Table ss:DefaultRowHeight="18">
   <Column ss:Width="90"/>
   <Column ss:Width="120"/>
   <Column ss:Width="90"/>
   <Column ss:Width="55"/>
   <Column ss:Width="100"/>
   <Column ss:Width="160"/>
   <Column ss:Width="100"/>
   <Column ss:Width="100"/>
   <Column ss:Width="70"/>
   <Column ss:Width="80"/>
${sheet1Rows}  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <FreezePanes/>
   <FrozenNoSplit/>
   <SplitHorizontal>1</SplitHorizontal>
   <TopRowBottomPane>1</TopRowBottomPane>
  </WorksheetOptions>
 </Worksheet>
 <Worksheet ss:Name="${escXml(labels.subsSheet)}">
  <Table ss:DefaultRowHeight="18">
   <Column ss:Width="200"/>
   <Column ss:Width="90"/>
   <Column ss:Width="70"/>
   <Column ss:Width="90"/>
${sheet2Rows}  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <FreezePanes/>
   <FrozenNoSplit/>
   <SplitHorizontal>1</SplitHorizontal>
   <TopRowBottomPane>1</TopRowBottomPane>
  </WorksheetOptions>
 </Worksheet>
 <Worksheet ss:Name="${escXml(labels.summarySheet)}">
  <Table ss:DefaultRowHeight="18">
   <Column ss:Width="180"/>
   <Column ss:Width="120"/>
   <Column ss:Width="80"/>
${sheet3Rows}  </Table>
 </Worksheet>
</Workbook>`;

      const dateStamp = new Date().toISOString().slice(0, 10);
      const fileName = language === 'tr'
        ? `Harcama_Raporu_${dateStamp}.xls`
        : `Expense_Report_${dateStamp}.xls`;

      if (Capacitor.isNativePlatform()) {
        const base64Data = btoa(unescape(encodeURIComponent(xml)));
        try {
          const result = await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Cache
          });
          await Share.share({
            title: fileName,
            url: result.uri
          });
          setTimeout(() => alert(t('common.msg_export_success')), 300);
        } catch (e) {
          console.error("Native Excel Share Error:", e);
          if (!e.message || (!e.message.includes('canceled') && !e.message.includes('Share canceled'))) {
            alert(t('common.msg_export_failed') + `: ${e.message}`);
          }
        }
      } else {
        const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setTimeout(() => alert(t('common.msg_export_success')), 300);
      }

    } catch (error) {
      console.error("Excel Export Error:", error);
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
      const drawDonutChart = (pdf, cx, cy, r, data, isCategory = false) => {
        if (!data || data.length === 0) return;
        const total = data.reduce((sum, d) => sum + d.amount, 0);
        if (total === 0) return;

        let currentAngle = -90; // Start at 12 o'clock
        data.forEach(item => {
          const pct = item.amount / total;
          const angleDelta = pct * 360;
          const endAngle = currentAngle + angleDelta;
          const color = isCategory ? getCategoryInfo(item.name).color : getStringColor(item.name);
          drawPieSector(pdf, cx, cy, r, currentAngle, endAngle, color);
          currentAngle = endAngle;
        });

        // Center white cutout
        pdf.setFillColor('#ffffff');
        pdf.circle(cx, cy, r * 0.55, 'F');
      };

      // Chart Section helper with Legend
      const drawChartSection = (pdf, title, cx, cy, r, data, isCategory = false) => {
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

        drawDonutChart(pdf, cx, cy, r, data, isCategory);

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
          const color = isCategory ? getCategoryInfo(item.name).color : getStringColor(item.name);
          
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
      drawChartSection(pdfDoc, t('common.category_breakdown') || "Category Breakdown", 45, 90, 18, sortedCategoryData, true);
      drawChartSection(pdfDoc, t('common.store_breakdown') || "Store Breakdown", 136, 90, 18, sortedStoreData, false);

      // Draw Row 2: Brand chart & Insights
      drawChartSection(pdfDoc, t('common.brand_breakdown') || "Brand Breakdown", 45, 165, 18, sortedBrandData, false);

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
      
      if (Capacitor.isNativePlatform()) {
        const pdfBase64 = pdfDoc.output('datauristring').split(',')[1];
        try {
          const result = await Filesystem.writeFile({
            path: safeFileName,
            data: pdfBase64,
            directory: Directory.Cache
          });
          await Share.share({
            title: safeFileName,
            url: result.uri
          });
          setTimeout(() => alert(t('common.msg_export_success')), 300);
        } catch (e) {
          console.error("Native PDF Share Error:", e);
          if (!e.message || (!e.message.includes('canceled') && !e.message.includes('Share canceled'))) {
            alert(t('common.msg_export_failed') + `: ${e.message}`);
          }
        }
      } else {
        pdfDoc.save(safeFileName);
        setTimeout(() => alert(t('common.msg_export_success')), 300);
      }

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