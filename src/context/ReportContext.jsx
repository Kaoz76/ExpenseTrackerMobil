import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useCurrency } from './CurrencyContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, doc, getDoc, setDoc } from 'firebase/firestore';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const ReportContext = createContext(null);

export const ReportProvider = ({ children }) => {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();

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
          const monthName = prevMonthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

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
  }, [user]);

  // Font Yükleme (Bunu dışarı aktarmadığımız için useCallback içine almadım, içeride durabilir)
  const loadFile = async (url) => {
    try {
      const response = await fetch(url);
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
      console.warn("Font indirilemedi:", e);
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
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        alert("No data found to export.");
        setIsGenerating(false);
        return;
      }

      let csvContent = "Date;Market/Title;Type;Price;Currency;Details\n";

      // Geliştirme: Parametre ismini firestoreDoc yaparak karışıklığı önledik
      querySnapshot.forEach((firestoreDoc) => {
        const data = firestoreDoc.data();

        let dateStr = data.date || "";
        if (data.createdAt && typeof data.createdAt.toDate === 'function') {
          dateStr = data.createdAt.toDate().toLocaleDateString('tr-TR');
        }

        const description = `"${(data.fileName || data.title || "No Title").replace(/"/g, '""')}"`;
        const type = data.isManual ? "Manual Entry" : "Scanned Receipt";

        const rawPrice = Number(data.price) || 0;
        const priceStr = rawPrice.toFixed(2).replace('.', ',');

        let details = "";
        if (data.items && Array.isArray(data.items)) {
          const itemNames = data.items.map(i => i.name).join(", ");
          details = `"${itemNames.replace(/"/g, '""')}"`;
        }

        csvContent += `${dateStr};${description};${type};${priceStr};TRY;${details}\n`;
      });

      const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Expense_Tracker_All_Data_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (error) {
      console.error("CSV Export Error:", error);
      alert("Failed to export data.");
    } finally {
      setIsGenerating(false);
    }
  }, [user]);

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
  const generateAndDownloadPDF = useCallback(async () => {
    if (!user) return;
    setIsGenerating(true);

    try {
      const now = new Date();
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

      const monthName = startOfLastMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });

      const q = query(
        collection(db, "receipts"),
        where("userId", "==", user.uid),
        where("createdAt", ">=", startOfLastMonth),
        where("createdAt", "<=", endOfLastMonth),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(q);
      const receipts = [];
      let totalSpent = 0;

      // Geliştirme: firestoreDoc olarak isimlendirildi
      querySnapshot.forEach((firestoreDoc) => {
        const data = firestoreDoc.data();
        const safeData = {
          ...data,
          price: Number(data.price) || 0,
        };
        receipts.push(safeData);
        totalSpent += safeData.price;
      });

      if (receipts.length === 0) {
        alert(`No expenses found for ${monthName}. PDF cannot be generated.`);
        setIsGenerating(false);
        return;
      }

      // Geliştirme: jsPDF nesnesi "pdfDoc" olarak adlandırıldı
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

      pdfDoc.setFontSize(18);
      pdfDoc.setTextColor(40);
      pdfDoc.setFont(fontUsed, 'bold');
      pdfDoc.text("Monthly Expense Report", 14, 22);

      pdfDoc.setFont(fontUsed, 'normal');
      pdfDoc.setFontSize(11);
      pdfDoc.setTextColor(100);
      pdfDoc.text(`Period: ${monthName}`, 14, 32);

      const totalFormatted = formatPrice(totalSpent);
      pdfDoc.text(`Total Spent: ${totalFormatted}`, 14, 38);

      const tableColumn = ["Date", "Description", "Type", "Amount"];
      const tableRows = [];

      receipts.forEach(receipt => {
        let dateStr = "N/A";
        try {
          if (receipt.createdAt && typeof receipt.createdAt.toDate === 'function') {
            dateStr = receipt.createdAt.toDate().toLocaleDateString('tr-TR');
          } else if (receipt.date) {
            dateStr = receipt.date;
          }
        } catch {
          dateStr = "-";
        }

        const description = receipt.fileName || receipt.title || "No Description";
        const type = receipt.isManual ? "Manual Entry" : "Scanned Receipt";
        const price = formatPrice(receipt.price);

        tableRows.push([dateStr, description, type, price]);
      });

      autoTable(pdfDoc, {
        head: [tableColumn],
        body: tableRows,
        startY: 45,
        theme: 'striped',
        headStyles: { fillColor: [13, 110, 253], font: fontUsed, fontStyle: 'bold' },
        bodyStyles: { font: fontUsed, fontStyle: 'normal' },
        styles: { fontSize: 10, cellPadding: 3, font: fontUsed },
      });

      const safeFileName = `Expense_Report_${monthName.replace(/\s/g, '_')}.pdf`;
      pdfDoc.save(safeFileName);

      markAsRead();

    } catch (error) {
      console.error("PDF Generation Error (Critical):", error);
      alert(`Error generating PDF: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  }, [user, formatPrice, markAsRead]); // Bağımlılıklar güncellendi

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