import React from 'react';
import { Link } from 'react-router-dom';
import { FaFileAlt, FaReceipt, FaFileCsv } from 'react-icons/fa';
import { useReport } from '../context/ReportContext';

function Reports() {
  const { exportAllDataToCSV, isGenerating } = useReport();

  return (
    <div className="dashboard-page-wrapper p-4">
      <div className="container">
        <div className="mb-5 text-center">
          <h1 className="display-5 fw-bold mb-3">View Reports</h1>
          <p className="text-muted fs-5">Select a category below to view details or export data.</p>
        </div>

        <div className="row justify-content-center g-4">
          
          {/* Scanned Receipts Butonu */}
          <div className="col-lg-4 col-md-6">
            <Link to="/receipts#scanned-section" className="text-decoration-none text-dark">
              <div className="card border-0 shadow-sm h-100 p-5 text-center quick-link-card">
                <div className="mb-4 d-flex justify-content-center">
                   <div className="quick-link-icon" style={{ width: '80px', height: '80px', fontSize: '2.5rem' }}>
                      <FaReceipt />
                   </div>
                </div>
                <h3 className="h4 fw-bold mb-3">All Scanned Receipts</h3>
                <p className="text-muted">View all receipts you have uploaded via image scanning.</p>
                <button className="btn btn-outline-primary mt-3">View Receipts</button>
              </div>
            </Link>
          </div>

          {/* Manual Entries Butonu */}
          <div className="col-lg-4 col-md-6">
            <Link to="/texts#manual-section" className="text-decoration-none text-dark">
              <div className="card border-0 shadow-sm h-100 p-5 text-center quick-link-card">
                <div className="mb-4 d-flex justify-content-center">
                   <div className="quick-link-icon" style={{ width: '80px', height: '80px', fontSize: '2.5rem' }}>
                      <FaFileAlt />
                   </div>
                </div>
                <h3 className="h4 fw-bold mb-3">All Manual Entries</h3>
                <p className="text-muted">View all expenses you have entered manually via the text form.</p>
                <button className="btn btn-outline-primary mt-3">View Entries</button>
              </div>
            </Link>
          </div>

          {/* EXPORT DATA */}
          <div className="col-lg-4 col-md-6">
            <div 
                className="card border-0 shadow-sm h-100 p-5 text-center quick-link-card"
                style={{ cursor: 'pointer' }}
                onClick={exportAllDataToCSV}
            >
                <div className="mb-4 d-flex justify-content-center">
                   <div className="quick-link-icon text-success" style={{ width: '80px', height: '80px', fontSize: '2.5rem' }}>
                      <FaFileCsv />
                   </div>
                </div>
                <h3 className="h4 fw-bold mb-3">Export All Data</h3>
                <p className="text-muted">Download all your expense history as a CSV file for Excel.</p>
                
                <button 
                    className="btn btn-success mt-3"
                    disabled={isGenerating}
                >
                    {isGenerating ? 'Exporting...' : 'Download CSV'}
                </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Reports;