import React from 'react';
import { Link } from 'react-router-dom';
import { FaFileAlt, FaReceipt, FaFileCsv, FaFilePdf } from 'react-icons/fa'; // FaFilePdf eklendi
import { useReport } from '../context/ReportContext';

function Reports() {
  // Unutulan generateAndDownloadPDF context'ten çekildi!
  const { exportAllDataToCSV, generateAndDownloadPDF, isGenerating } = useReport();

  return (
    <div className="dashboard-page-wrapper p-4">
      <div className="container">
        <div className="mb-5 text-center">
          <h1 className="display-5 fw-bold mb-3">View Reports</h1>
          <p className="text-muted fs-5">Select a category below to view details or export data.</p>
        </div>

        {/* 2x2 Izgara sistemi (col-md-6) ile mükemmel simetri sağlandı */}
        <div className="row justify-content-center g-4">

          {/* Scanned Receipts Butonu */}
          <div className="col-md-6">
            <Link to="/receipts#scanned-section" className="text-decoration-none text-dark h-100 d-block">
              <div className="card border-0 shadow-sm h-100 p-5 text-center quick-link-card card-hover-effect">
                <div className="mb-4 d-flex justify-content-center">
                  <div className="bg-primary-subtle text-primary rounded-circle d-flex align-items-center justify-content-center" style={{ width: '80px', height: '80px', fontSize: '2.5rem' }}>
                    <FaReceipt />
                  </div>
                </div>
                <h3 className="h4 fw-bold mb-3">Scanned Receipts</h3>
                <p className="text-muted mb-4">View all receipts you have uploaded via image scanning.</p>
                <div className="mt-auto">
                  <span className="btn btn-outline-primary rounded-pill px-4">View Receipts</span>
                </div>
              </div>
            </Link>
          </div>

          {/* Manual Entries Butonu */}
          <div className="col-md-6">
            <Link to="/texts#manual-section" className="text-decoration-none text-dark h-100 d-block">
              <div className="card border-0 shadow-sm h-100 p-5 text-center quick-link-card card-hover-effect">
                <div className="mb-4 d-flex justify-content-center">
                  <div className="bg-info-subtle text-info-emphasis rounded-circle d-flex align-items-center justify-content-center" style={{ width: '80px', height: '80px', fontSize: '2.5rem' }}>
                    <FaFileAlt />
                  </div>
                </div>
                <h3 className="h4 fw-bold mb-3">Manual Entries</h3>
                <p className="text-muted mb-4">View all expenses you have entered manually via the text form.</p>
                <div className="mt-auto">
                  <span className="btn btn-outline-info rounded-pill px-4">View Entries</span>
                </div>
              </div>
            </Link>
          </div>

          {/* EXPORT CSV */}
          <div className="col-md-6">
            <div
              className={`card border-0 shadow-sm h-100 p-5 text-center quick-link-card card-hover-effect ${isGenerating ? 'opacity-50' : ''}`}
              style={{ cursor: isGenerating ? 'wait' : 'pointer' }}
              onClick={() => !isGenerating && exportAllDataToCSV()}
            >
              <div className="mb-4 d-flex justify-content-center">
                <div className="bg-success-subtle text-success rounded-circle d-flex align-items-center justify-content-center" style={{ width: '80px', height: '80px', fontSize: '2.5rem' }}>
                  <FaFileCsv />
                </div>
              </div>
              <h3 className="h4 fw-bold mb-3">Export All Data</h3>
              <p className="text-muted mb-4">Download all your expense history as an Excel-compatible CSV file.</p>

              <div className="mt-auto">
                <button
                  className="btn btn-success rounded-pill px-4"
                  disabled={isGenerating}
                >
                  {isGenerating ? 'Exporting...' : 'Download CSV'}
                </button>
              </div>
            </div>
          </div>

          {/* YENİ EKLENEN: EXPORT PDF */}
          <div className="col-md-6">
            <div
              className={`card border-0 shadow-sm h-100 p-5 text-center quick-link-card card-hover-effect ${isGenerating ? 'opacity-50' : ''}`}
              style={{ cursor: isGenerating ? 'wait' : 'pointer' }}
              onClick={() => !isGenerating && generateAndDownloadPDF()}
            >
              <div className="mb-4 d-flex justify-content-center">
                <div className="bg-danger-subtle text-danger rounded-circle d-flex align-items-center justify-content-center" style={{ width: '80px', height: '80px', fontSize: '2.5rem' }}>
                  <FaFilePdf />
                </div>
              </div>
              <h3 className="h4 fw-bold mb-3">Monthly PDF Report</h3>
              <p className="text-muted mb-4">Generate a beautifully formatted PDF summary of your last month's expenses.</p>

              <div className="mt-auto">
                <button
                  className="btn btn-danger rounded-pill px-4"
                  disabled={isGenerating}
                >
                  {isGenerating ? 'Generating...' : 'Download PDF'}
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