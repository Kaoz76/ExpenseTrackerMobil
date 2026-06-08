import React, { useEffect } from 'react';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';

const ReceiptDetailModal = ({ show, onClose, receipt }) => {
  const { formatPrice } = useCurrency();
  const { t } = useLanguage();

  // ESC tuşuna basıldığında modalı kapat
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && show) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [show, onClose]);

  if (!show || !receipt) return null;

  const hasItems = receipt.items && receipt.items.length > 0;

  return (
    <>
      <div
        className="modal-backdrop fade show"
        style={{ zIndex: 1040, backgroundColor: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      ></div>

      <div
        className="modal fade show d-block"
        tabIndex="-1"
        style={{ zIndex: 1050 }}
        onClick={onClose}
        aria-modal="true"
        role="dialog"
      >
        {/* GELİŞTİRME 1: modal-dialog-scrollable eklendi */}
        <div
          className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable"
          onClick={e => e.stopPropagation()}
        >
          <div className="modal-content shadow border-0">

            <div className="modal-header bg-body-tertiary">
              <div>
                <h5 className="modal-title fw-bold text-body">{receipt.fileName}</h5>
                <small className="text-body-secondary">{receipt.date}</small>
              </div>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
            </div>

            <div className="modal-body p-4">
              <h6 className="fw-bold mb-3 text-body">{t('common.items')}</h6>
              {/* MOBILE LIST VIEW */}
              <div className="d-md-none border rounded p-3 mb-3 bg-light">
                <div className="list-group list-group-flush mb-2">
                  {hasItems ? (
                    receipt.items.map((item, index) => (
                      <div key={index} className="list-group-item px-0 py-2 bg-transparent border-bottom">
                        <div className="d-flex justify-content-between align-items-start">
                          <div className="pe-2">
                            <div className="fw-bold text-wrap" style={{ wordBreak: 'break-word' }}>{item.name || '-'}</div>
                            <div className="text-muted small mt-1 text-wrap" style={{ wordBreak: 'break-word', lineHeight: '1.2' }}>
                              {[item.type, item.brand, item.size].filter(Boolean).join(' • ')}
                            </div>
                          </div>
                          <div className="fw-bold text-primary text-end" style={{ whiteSpace: 'nowrap' }}>
                            {formatPrice(item.price, receipt.currency)}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted py-4">
                      {t('common.no_items_on_receipt')}
                    </div>
                  )}
                </div>
                <div className="d-flex justify-content-between align-items-center pt-2">
                  <span className="fw-bold">{t('common.total')}</span>
                  <span className="fw-bold fs-5 text-primary">{formatPrice(receipt.price, receipt.currency)}</span>
                </div>
              </div>

              {/* DESKTOP TABLE VIEW */}
              <div className="d-none d-md-block table-responsive">
                <table className="table table-bordered table-hover align-middle mb-0">
                  <thead className="table-secondary">
                    <tr>
                      <th>{t('common.name')}</th>
                      <th>{t('common.type')}</th>
                      <th>{t('common.brand')}</th>
                      <th>{t('common.size')}</th>
                      <th className="text-end">{t('common.price')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hasItems ? (
                      receipt.items.map((item, index) => (
                        <tr key={index}>
                          <td>{item.name || '-'}</td>
                          <td>{item.type || '-'}</td>
                          <td>{item.brand || '-'}</td>
                          <td>{item.size || '-'}</td>
                          <td className="text-end fw-bold text-primary">
                            {formatPrice(item.price, receipt.currency)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="text-center text-muted py-4">
                          {t('common.no_items_on_receipt')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="table-secondary">
                    <tr>
                      <td colSpan="4" className="text-end fw-bold">{t('common.total')}</td>
                      <td className="text-end fw-bold fs-5 text-primary">
                        {formatPrice(receipt.price, receipt.currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="modal-footer border-0 bg-body-tertiary rounded-bottom flex-wrap" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ReceiptDetailModal;