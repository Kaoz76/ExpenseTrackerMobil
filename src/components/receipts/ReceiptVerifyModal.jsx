import React, { useState } from 'react';
import { FaCheck, FaTimes, FaListAlt, FaTrash, FaPlus, FaEdit } from 'react-icons/fa';
import { useCurrency, CURRENCY_MAP } from '../../context/CurrencyContext';
import { useLanguage } from '../../context/LanguageContext';

function ReceiptVerifyModal({
  showVerifyModal,
  processedScans,
  verifyData,
  setVerifyData,
  verifiedPrice,
  setVerifiedPrice,
  handleCloseAll,
  handleSendToManual,
  handleCancelSave,
  handleConfirmSave,
  isSavingDoc
}) {
  const { currency, favoriteCurrencies } = useCurrency();
  const { t } = useLanguage();
  const [showItems, setShowItems] = useState(false);

  if (!showVerifyModal) return null;

  const handleItemChange = (index, field, value) => {
    if (!verifyData) return;
    const updatedItems = [...verifyData.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setVerifyData({ ...verifyData, items: updatedItems });
  };

  const handleRemoveItem = (index) => {
    if (!verifyData) return;
    const updatedItems = verifyData.items.filter((_, i) => i !== index);
    setVerifyData({ ...verifyData, items: updatedItems });
  };

  const handleAddItem = () => {
    if (!verifyData) return;
    const newItem = { name: '', price: 0, type: '', brand: '', size: '' };
    const updatedItems = [...(verifyData.items || []), newItem];
    setVerifyData({ ...verifyData, items: updatedItems });
    if (!showItems) setShowItems(true);
  };

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1055 }}></div>
      <div className="modal fade show d-block" style={{ zIndex: 1060 }} tabIndex="-1">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content shadow-lg border-0">

            <div className="modal-header bg-primary text-white">
              <h5 className="modal-title fw-bold">
                {t('common.verify_receipt')} ({processedScans.length} {t('common.msg_remaining')})
              </h5>
              <button type="button" className="btn-close btn-close-white" onClick={handleCloseAll} title="Cancel All"></button>
            </div>

            <div className="modal-body p-4">
              {verifyData?.tempImageUrl && (
                <div className="mb-4 text-center">
                  <img
                    src={verifyData.tempImageUrl}
                    alt="Scanned Receipt"
                    style={{ maxHeight: '200px', maxWidth: '100%', objectFit: 'contain', borderRadius: '8px', border: '1px solid #dee2e6' }}
                  />
                </div>
              )}

              <p className="text-muted mb-4">
                {t('common.ocr_detected_price')}
              </p>

              <div className="text-center mb-4">
                <div className="p-4 bg-light rounded border shadow-sm mx-auto" style={{ maxWidth: '250px' }}>
                  <FaCheck className="text-success mb-2" size={40} />
                  <input
                    type="text"
                    className="form-control text-center fw-bold mt-2"
                    value={verifyData?.fileName || ''}
                    onChange={(e) => setVerifyData({ ...verifyData, fileName: e.target.value })}
                    placeholder={t('common.store_name')}
                  />
                  <small className="text-muted mt-1 d-block">{t('common.enter_store_name')}</small>
                </div>
              </div>

              <div className="form-group mb-4">
                <label className="form-label fw-bold">{t('common.total_price_ocr').replace(' (OCR)', '')}</label>
                <div className="input-group input-group-lg mb-2">
                  <span className="input-group-text">{CURRENCY_MAP[verifyData?.currency || currency?.code || 'USD']?.symbol || '$'}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="form-control"
                    value={verifiedPrice}
                    onChange={(e) => setVerifiedPrice(e.target.value.replace(/[^0-9.,]/g, ''))}
                  />
                </div>
                <div className="d-flex flex-wrap gap-2 mt-1">
                  {favoriteCurrencies.map((code) => {
                    const isSelected = (verifyData?.currency || currency?.code || 'USD') === code;
                    const symbol = CURRENCY_MAP[code]?.symbol || '$';
                    return (
                      <button
                        key={code}
                        type="button"
                        className={`btn btn-sm px-3 py-2 rounded-3 transition-all ${
                          isSelected
                            ? 'btn-primary shadow-sm border-0 fw-bold'
                            : 'btn-outline-secondary border-1 text-muted'
                        }`}
                        onClick={() => setVerifyData({ ...verifyData, currency: code })}
                      >
                        <span className="me-1">{symbol}</span>
                        <span>{code}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="form-text">{t('common.detected_from_ocr')}</div>
              </div>

              {verifyData && (
                <div className="border rounded mb-3 overflow-hidden">
                  <button
                    className="btn btn-light w-100 d-flex justify-content-between align-items-center p-3 text-secondary"
                    onClick={() => setShowItems(!showItems)}
                    style={{ borderRadius: 0, border: 'none', borderBottom: showItems ? '1px solid #dee2e6' : 'none' }}
                  >
                    <span className="fw-bold text-dark">
                      {t('common.parsed_items')} <span className="badge bg-secondary ms-2">{(verifyData.items || []).length}</span>
                    </span>
                    <span>{showItems ? <FaTimes size={14} className="text-secondary" /> : <FaListAlt size={14} className="text-secondary" />}</span>
                  </button>

                  {showItems && (
                    <div className="bg-white" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                      <ul className="list-group list-group-flush">
                        {(verifyData.items || []).map((item, idx) => (
                          <li key={idx} className="list-group-item d-flex flex-column py-2 px-3">
                            <div className="d-flex justify-content-between align-items-center">
                              <button
                                className="btn btn-sm btn-outline-danger me-2 border-0"
                                onClick={() => handleRemoveItem(idx)}
                                title="Remove Item"
                              >
                                <FaTrash size={12} />
                              </button>
                              <input
                                type="text"
                                className="form-control form-control-sm me-2 text-secondary"
                                style={{ fontWeight: '500' }}
                                value={item.name}
                                onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                                placeholder={t('common.item_name')}
                              />
                              <div className="input-group input-group-sm" style={{ width: '120px' }}>
                                <span className="input-group-text bg-light text-primary fw-bold border-end-0">{currency?.symbol || '$'}</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  className="form-control form-control-sm text-end text-primary fw-bold border-start-0 ps-0"
                                  value={item.price}
                                  onChange={(e) => handleItemChange(idx, 'price', e.target.value.replace(/[^0-9.,-]/g, ''))}
                                  placeholder={t('common.price')}
                                />
                              </div>
                            </div>
                            <div className="row g-2 ps-4 mt-1">
                              <div className="col-12 col-md-4">
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  placeholder={t('common.type')}
                                  value={item.type || ''}
                                  onChange={(e) => handleItemChange(idx, 'type', e.target.value)}
                                />
                              </div>
                              <div className="col-6 col-md-4">
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  placeholder={t('common.brand')}
                                  value={item.brand || ''}
                                  onChange={(e) => handleItemChange(idx, 'brand', e.target.value)}
                                />
                              </div>
                              <div className="col-6 col-md-4">
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  placeholder={t('common.size')}
                                  value={item.size || ''}
                                  onChange={(e) => handleItemChange(idx, 'size', e.target.value)}
                                />
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <div className="p-2 border-top bg-light">
                        <button
                          className="btn btn-sm btn-outline-primary w-100 d-flex justify-content-center align-items-center"
                          onClick={handleAddItem}
                        >
                          <FaPlus className="me-2" /> {t('common.add_item')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {verifyData?.rawOcrText && (
                <div className="mt-3">
                  <details className="card border-secondary bg-dark text-white p-2" style={{ borderRadius: '6px' }}>
                    <summary className="fw-bold text-muted" style={{ cursor: 'pointer', fontSize: '12px', outline: 'none' }}>
                      Show Raw OCR Text / Ham Metni Göster
                    </summary>
                    <pre className="mt-2 p-2 bg-light text-dark rounded border text-start mb-0" style={{ fontSize: '10px', maxHeight: '150px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                      {verifyData.rawOcrText}
                    </pre>
                  </details>
                </div>
              )}
            </div>

            <div className="modal-footer bg-light d-flex justify-content-between">
              <button className="btn btn-outline-info border-0 d-flex align-items-center" onClick={handleSendToManual} disabled={isSavingDoc}>
                <FaEdit className="me-1" /> {t('common.use_manual_form')}
              </button>
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-outline-secondary" onClick={handleCancelSave} disabled={isSavingDoc}>
                  <FaTimes className="me-2" /> {t('common.discard')}
                </button>
                <button type="button" className="btn btn-success px-4" onClick={handleConfirmSave} disabled={isSavingDoc}>
                  {isSavingDoc ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      {t('common.processing')}...
                    </>
                  ) : (
                    <>
                      <FaCheck className="me-2" /> {t('common.save_next')}
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

export default ReceiptVerifyModal;
