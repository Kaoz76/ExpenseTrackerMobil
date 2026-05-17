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
              <div className="table-responsive">
                <table className="table table-bordered table-hover align-middle mb-0">

                  <thead className="table-secondary">
                    <tr>
                      <th>{t('common.name')}</th>
                      <th className="d-none d-md-table-cell">{t('common.type')}</th>
                      <th className="d-none d-md-table-cell">{t('common.brand')}</th>
                      <th className="d-none d-md-table-cell">{t('common.size')}</th>
                      <th className="text-end">{t('common.price')}</th>
                    </tr>
                  </thead>

                  <tbody>
                    {/* GELİŞTİRME 2: Ürün varsa listele, yoksa "Bulunamadı" uyarısı ver */}
                    {hasItems ? (
                      receipt.items.map((item, index) => (
                        <tr key={index}>
                          <td>
                            <div className="fw-bold">{item.name || '-'}</div>
                            <div className="d-md-none text-muted small mt-1">
                              {[item.type, item.brand, item.size].filter(Boolean).join(' • ')}
                            </div>
                          </td>
                          <td className="d-none d-md-table-cell">{item.type || '-'}</td>
                          <td className="d-none d-md-table-cell">{item.brand || '-'}</td>
                          <td className="d-none d-md-table-cell">{item.size || '-'}</td>
                          <td className="text-end fw-bold text-primary">
                            {formatPrice(item.price)}
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
                      <td colSpan="1" className="text-end fw-bold d-table-cell d-md-none">{t('common.total')}</td>
                      <td colSpan="4" className="text-end fw-bold d-none d-md-table-cell">{t('common.total')}</td>
                      <td className="text-end fw-bold fs-5 text-primary">
                        {formatPrice(receipt.price)}
                      </td>
                    </tr>
                  </tfoot>

                </table>
              </div>
            </div>

            <div className="modal-footer border-0 bg-body-tertiary rounded-bottom">
              <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ReceiptDetailModal;