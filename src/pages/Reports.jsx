import React, { useState, useMemo, useEffect } from 'react';
import { FaFileExcel, FaFilePdf } from 'react-icons/fa';
import { useReport } from '../context/ReportContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { parseDate } from '../utils/dateFormatter';
function Reports() {
  const { user } = useAuth();
  // Unutulan generateAndDownloadPDF context'ten çekildi!
  const { exportAllDataToCSV, generateAndDownloadPDF, isGenerating } = useReport();
  const { t, language } = useLanguage();

  const [availableMonths, setAvailableMonths] = useState([]);
  const [loadingMonths, setLoadingMonths] = useState(true);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    if (!user) return;
    setLoadingMonths(true);

    const q = query(
      collection(db, "receipts"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const monthsSet = new Set();
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.createdAt) {
          const date = parseDate(data.createdAt);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          monthsSet.add(key);
        } else if (data.date) {
          const date = new Date(data.date);
          if (!isNaN(date.getTime())) {
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthsSet.add(key);
          }
        }
      });

      const sortedMonths = Array.from(monthsSet).sort().reverse();
      setAvailableMonths(sortedMonths);
      setLoadingMonths(false);

      if (sortedMonths.length > 0) {
        setSelectedMonth(prev => sortedMonths.includes(prev) ? prev : sortedMonths[0]);
      }
    }, (error) => {
      console.error("Error loading available months:", error);
      setLoadingMonths(false);
    });

    return () => unsubscribe();
  }, [user]);

  const monthOptions = useMemo(() => {
    if (availableMonths.length === 0) {
      // Fallback: show current month if there's no data
      const d = new Date();
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { month: 'long', year: 'numeric' });
      return [{ value, label }];
    }

    return availableMonths.map(monthStr => {
      const [year, month] = monthStr.split('-').map(Number);
      const date = new Date(year, month - 1, 1);
      const label = date.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { month: 'long', year: 'numeric' });
      return { value: monthStr, label };
    });
  }, [availableMonths, language]);

  return (
    <div className="dashboard-page-wrapper p-4 enlarge-web-8">
      <div className="container">
        <div className="mb-5 text-center">
          <h1 className="display-5 fw-bold mb-3">{t('common.view_reports')}</h1>
          <p className="text-muted fs-5">{t('common.select_category_below')}</p>
        </div>

        {/* 2x2 Izgara sistemi (col-md-6) ile mükemmel simetri sağlandı */}
        <div className="row justify-content-center g-4">

          {/* EXPORT EXCEL */}
          <div className="col-6 col-md-6">
            <div
              className={`card border-0 shadow-sm h-100 p-3 p-md-5 text-center quick-link-card card-hover-effect d-flex flex-column ${isGenerating ? 'opacity-50' : ''}`}
              style={{ cursor: isGenerating ? 'wait' : 'pointer' }}
              onClick={() => !isGenerating && exportAllDataToCSV()}
            >
              <div className="mb-3 mb-md-4 d-flex justify-content-center">
                <div className="bg-success-subtle text-success rounded-circle d-flex align-items-center justify-content-center" style={{ width: '60px', height: '60px', fontSize: '2rem' }}>
                  <FaFileExcel />
                </div>
              </div>
              <h3 className="h6 fw-bold mb-2 mb-md-3">{t('common.export_all_data')}</h3>
              <p className="text-muted mb-3 mb-md-4 d-none d-sm-block" style={{ fontSize: '0.85rem' }}>{t('common.download_all_expense_history')}</p>

              <div className="mt-auto w-100">
                <button
                  className="btn btn-sm btn-success rounded-pill w-100"
                  disabled={isGenerating}
                  style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                >
                  <span className="d-none d-sm-inline">{isGenerating ? t('common.exporting') : t('common.download_excel')}</span>
                  <span className="d-sm-none">{isGenerating ? t('common.exporting') : "Excel"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* YENİ EKLENEN: EXPORT PDF */}
          <div className="col-6 col-md-6">
            <div
              className={`card border-0 shadow-sm h-100 p-3 p-md-5 text-center quick-link-card card-hover-effect d-flex flex-column ${isGenerating ? 'opacity-50' : ''}`}
              style={{ cursor: isGenerating ? 'wait' : 'default' }}
            >
              <div className="mb-3 mb-md-4 d-flex justify-content-center">
                <div className="bg-danger-subtle text-danger rounded-circle d-flex align-items-center justify-content-center" style={{ width: '60px', height: '60px', fontSize: '2rem' }}>
                  <FaFilePdf />
                </div>
              </div>
              <h3 className="h6 fw-bold mb-2 mb-md-3">{t('common.monthly_pdf_report')}</h3>
              <p className="text-muted mb-3 mb-md-4 d-none d-sm-block" style={{ fontSize: '0.85rem' }}>{t('common.generate_beautifully_formatted')}</p>

              <div className="mb-3 mb-md-4 w-100 mx-auto">
                <label className="form-label text-muted fw-bold text-uppercase d-none d-sm-block mb-2" style={{ fontSize: '0.75rem' }}>
                  {t('common.select_month')}
                </label>
                <select
                  className="form-select form-select-sm text-center rounded-pill"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  disabled={isGenerating || loadingMonths}
                  style={{ cursor: (isGenerating || loadingMonths) ? 'wait' : 'pointer', textAlignLast: 'center', fontSize: '0.8rem' }}
                >
                  {loadingMonths ? (
                    <option>{t('common.loading')}</option>
                  ) : (
                    monthOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="mt-auto w-100">
                <button
                  className="btn btn-sm btn-danger rounded-pill w-100"
                  disabled={isGenerating}
                  onClick={() => !isGenerating && generateAndDownloadPDF(selectedMonth)}
                  style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                >
                  <span className="d-none d-sm-inline">{isGenerating ? t('common.generating') : t('common.download_pdf')}</span>
                  <span className="d-sm-none">{isGenerating ? t('common.generating') : "PDF"}</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Reports;