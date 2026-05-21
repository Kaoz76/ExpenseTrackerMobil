import React from 'react';
import { FaStore, FaPen, FaCheck, FaTimes, FaTrash, FaImage, FaExpandAlt, FaReceipt, FaShoppingCart } from 'react-icons/fa';
import { formatDateTime } from '../../utils/dateFormatter';
import { useLanguage } from '../../context/LanguageContext';
import { useCurrency, CURRENCY_MAP } from '../../context/CurrencyContext';
import { db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';

function ReceiptInfoCard({
  receipt,
  receiptId,
  storeName,
  setStoreName,
  editingStoreName,
  setEditingStoreName,
  handleSaveStoreName,
  handleDeleteReceipt,
  setShowImageLightbox,
  totalPrice,
  setTotalPrice,
  editingTotal,
  setEditingTotal,
  handleSaveTotal,
  items,
  itemsTotal
}) {
  const { t } = useLanguage();
  const { formatPrice, currency, favoriteCurrencies } = useCurrency();

  return (
    <>
      {/* HEADER */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-4 gap-3">
        <div className="d-flex align-items-center">
          <div
            className="bg-primary-subtle rounded-circle p-3 me-3 text-primary d-flex align-items-center justify-content-center"
            style={{ width: '60px', height: '60px' }}
          >
            <FaStore className="fs-3" />
          </div>
          <div>
            {editingStoreName ? (
              <div className="d-flex align-items-center gap-2">
                <input
                  type="text"
                  className="form-control form-control-lg fw-bold"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveStoreName()}
                  autoFocus
                  style={{ maxWidth: '300px' }}
                />
                <button className="btn btn-sm btn-success" onClick={handleSaveStoreName}>
                  <FaCheck />
                </button>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => {
                  setStoreName(receipt.fileName || '');
                  setEditingStoreName(false);
                }}>
                  <FaTimes />
                </button>
              </div>
            ) : (
              <div className="d-flex align-items-center gap-2">
                <h1 className="display-6 fw-bold mb-0">{receipt.fileName || t('common.unknown_store')}</h1>
                <button
                  className="btn btn-sm btn-outline-secondary border-0"
                  onClick={() => setEditingStoreName(true)}
                  title={t('common.edit')}
                >
                  <FaPen size={14} />
                </button>
              </div>
            )}
            <span className="text-muted small">
              {formatDateTime(receipt.createdAt)}
            </span>
          </div>
        </div>

        <button
          className="btn btn-outline-danger d-flex align-items-center gap-2"
          onClick={handleDeleteReceipt}
        >
          <FaTrash /> {t('common.delete_receipt')}
        </button>
      </div>

      {/* RECEIPT IMAGE */}
      {receipt.imageUrl && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-body-tertiary py-3 d-flex justify-content-between align-items-center">
            <h5 className="mb-0 fw-bold d-flex align-items-center text-body">
              <FaImage className="me-2 text-body-secondary" /> {t('common.receipt_image')}
            </h5>
            <button
              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
              onClick={() => setShowImageLightbox(true)}
              title={t('common.view_full_image')}
            >
              <FaExpandAlt size={12} /> {t('common.view_full_image')}
            </button>
          </div>
          <div className="card-body p-0 text-center bg-dark" style={{ maxHeight: '320px', overflow: 'hidden' }}>
            <img
              src={receipt.imageUrl}
              alt={receipt.fileName || 'Receipt'}
              style={{ maxHeight: '320px', maxWidth: '100%', objectFit: 'contain', cursor: 'zoom-in' }}
              onClick={() => setShowImageLightbox(true)}
            />
          </div>
        </div>
      )}

      {/* STATS ROW */}
      <div className="row mb-4 g-3">
        {/* Total Price */}
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100 p-3 bg-primary-subtle text-primary">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="mb-0 fw-bold">{t('common.total_price')}</h6>
              <FaReceipt />
            </div>
            {editingTotal ? (
              <div className="d-flex align-items-center gap-2">
                <div className="input-group input-group-sm">
                  <span className="input-group-text">{CURRENCY_MAP[receipt?.currency || currency?.code || 'USD']?.symbol || '$'}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="form-control fw-bold"
                    value={totalPrice}
                    onChange={(e) => setTotalPrice(e.target.value.replace(/[^0-9.,]/g, ''))}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveTotal()}
                    autoFocus
                  />
                </div>
                <button className="btn btn-sm btn-success" onClick={handleSaveTotal}>
                  <FaCheck />
                </button>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => {
                  setTotalPrice(receipt.price || 0);
                  setEditingTotal(false);
                }}>
                  <FaTimes />
                </button>
              </div>
            ) : (
              <div className="d-flex flex-column gap-2">
                <div className="d-flex align-items-center gap-2">
                  <h3 className="fw-bold mb-0">{formatPrice(totalPrice, receipt?.currency)}</h3>
                  <button
                    className="btn btn-sm btn-outline-primary border-0"
                    onClick={() => setEditingTotal(true)}
                    title="Edit total price"
                  >
                    <FaPen size={12} />
                  </button>
                </div>
                
                {/* Currency Pills */}
                <div className="d-flex flex-wrap gap-1 mt-1">
                  {favoriteCurrencies.map((code) => {
                    const isSelected = (receipt?.currency || currency?.code || 'USD') === code;
                    const symbol = CURRENCY_MAP[code]?.symbol || '$';
                    return (
                      <button
                        key={code}
                        type="button"
                        className={`btn btn-xs rounded-pill px-2 py-1 transition-all ${
                          isSelected
                            ? 'btn-primary border-0 fw-bold text-white'
                            : 'btn-outline-primary border-1 text-primary'
                        }`}
                        style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                        onClick={async () => {
                          try {
                            await updateDoc(doc(db, "receipts", receiptId), {
                              currency: code
                            });
                          } catch (err) {
                            console.error("Error updating receipt currency:", err);
                          }
                        }}
                      >
                        <span className="me-1">{symbol}</span>
                        <span>{code}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Items Count */}
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100 p-3 bg-info-subtle text-info-emphasis">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="mb-0 fw-bold">{t('common.items')}</h6>
              <FaShoppingCart />
            </div>
            <h3 className="fw-bold mb-0">{items.length}</h3>
            <small className="opacity-75">{t('common.parsed_items_on_this')}</small>
          </div>
        </div>

        {/* Items Sum */}
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100 p-3 bg-success-subtle text-success">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="mb-0 fw-bold">{t('common.items_total')}</h6>
              <FaReceipt />
            </div>
            <h3 className="fw-bold mb-0">{formatPrice(itemsTotal, receipt?.currency)}</h3>
            <small className="opacity-75">{t('common.sum_of_all_items')}</small>
          </div>
        </div>
      </div>
    </>
  );
}

export default ReceiptInfoCard;
