import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaPlus } from 'react-icons/fa';
import { useLanguage } from '../../context/LanguageContext';
import { useCurrency } from '../../context/CurrencyContext';
import { formatDate } from '../../utils/dateFormatter';

function ReceiptList({
  user,
  loadingReceipts,
  allReceipts,
  filteredReceipts,
  displayedReceipts,
  hasMore,
  loadMoreReceipts,
  handleDeleteReceipt
}) {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();

  return (
    <div className="card shadow-sm border-0">
      <div className="list-group list-group-flush">
        <div className="list-group-item bg-body-tertiary text-body-secondary fw-bold small text-uppercase d-flex align-items-center">
          <div style={{ flex: 2 }}>{t('common.store_name')}</div>
          <div style={{ flex: 1 }}>{t('common.date')}</div>
          <div style={{ flex: 1, textAlign: 'right' }}>{t('common.total_price_ocr')}</div>
          <div style={{ width: '40px' }}></div>
        </div>

        {loadingReceipts && <div className="p-4 text-center text-muted">{t('common.loading_receipts')}</div>}
        {!user && !loadingReceipts && <div className="p-5 text-center text-muted"><Link to="/login">{t('common.log_in')}</Link> {t('common.please_log_in_receipts')}</div>}
        {user && !loadingReceipts && allReceipts.length === 0 && <div className="p-5 text-center text-muted">{t('common.no_receipts_uploaded')}</div>}
        {user && !loadingReceipts && allReceipts.length > 0 && filteredReceipts.length === 0 && (
          <div className="p-5 text-center text-muted">{t('common.no_products_matched')}</div>
        )}

        {user && !loadingReceipts && displayedReceipts.length > 0 && (
          <>
            {displayedReceipts.map(receipt => (
              <div
                key={receipt.id}
                className="list-group-item list-group-item-action d-flex align-items-center p-3"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/receipts/${receipt.id}`)}
              >
                <div style={{ flex: 2, minWidth: 0 }} className="d-flex align-items-center pe-2">
                  <span className="fw-bold text-truncate">{receipt.fileName}</span>
                </div>
                <div style={{ flex: 1 }} className="text-muted small">{formatDate(receipt.createdAt)}</div>
                <div style={{ flex: 1, textAlign: 'right' }} className="fw-bold text-primary">{formatPrice(receipt.price, receipt.currency)}</div>
                <div style={{ width: '50px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    className="delete-entry-btn"
                    onClick={(e) => handleDeleteReceipt(e, receipt.id)}
                    title="Delete Receipt"
                  >
                    <svg viewBox="0 0 448 512" className="delete-entry-svgIcon">
                      <path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"></path>
                    </svg>
                  </button>
                </div>
              </div>
            ))}

            {hasMore && (
              <div className="list-group-item text-center p-3 bg-light">
                <button
                  className="btn btn-outline-primary rounded-pill px-4 btn-sm fw-bold shadow-sm"
                  onClick={loadMoreReceipts}
                >
                  <FaPlus className="me-2 small" /> {t('common.load_older_receipts')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ReceiptList;
