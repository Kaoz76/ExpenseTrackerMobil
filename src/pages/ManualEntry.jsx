import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCurrency, CURRENCY_MAP } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { FaPlus, FaTrash, FaExclamationTriangle, FaSave, FaListAlt, FaArrowDown } from 'react-icons/fa';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ReceiptDetailModal from '../components/ReceiptDetailModal';
import { formatDateTime } from '../utils/dateFormatter';
import { suggestedCategoriesTR, suggestedCategoriesEN, localizeCategory } from '../utils/categoryMap';
import { suggestedBrands } from '../data/brandDictionary';
import { enrichItemsWithGemini } from '../services/geminiService';

function ManualEntry() {
  const { user } = useAuth();
  const { formatPrice, currency, favoriteCurrencies } = useCurrency();
  const { t, language } = useLanguage();
  const [entryCurrency, setEntryCurrency] = useState(currency?.code || 'USD');

  useEffect(() => {
    if (currency?.code) {
      setEntryCurrency(currency.code);
    }
  }, [currency?.code]);

  const suggestedCategories = language === 'tr' ? suggestedCategoriesTR : suggestedCategoriesEN;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [storeName, setStoreName] = useState('');
  const [products, setProducts] = useState([{ id: Date.now(), type: '', brand: '', name: '', size: '', price: '' }]);
  const [manualEntries, setManualEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // 🔥 YENİ: Firebase'den kaç veri çekileceğini tutan state
  const [entryLimit, setEntryLimit] = useState(10);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (error) setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeName, products]);

  useEffect(() => {
    if (location.state && location.state.scannedData) {
      const { items, fileName } = location.state.scannedData;
      if (fileName) {
        setStoreName(fileName);
      }
      if (items && items.length > 0) {
        const mappedProducts = items.map((item, index) => ({
          id: Date.now() + index,
          type: '',
          brand: '',
          name: item.name || '',
          size: '',
          price: item.price || ''
        }));
        setProducts(mappedProducts);
      }
      window.history.replaceState({}, document.title)
    }
  }, [location.state]);

  useEffect(() => {
    if (user) {
      setLoadingEntries(true);
      // Query without orderBy to avoid composite index requirement
      const q = query(
        collection(db, "receipts"),
        where("userId", "==", user.uid),
        where("isManual", "==", true)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const entries = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Sort client-side to avoid composite index requirement
        entries.sort((a, b) => {
          const getMillis = (t) => {
            if (!t) return Date.now();
            if (typeof t.toMillis === 'function') return t.toMillis();
            if (t.seconds) return t.seconds * 1000;
            if (t instanceof Date) return t.getTime();
            if (typeof t === 'number') return t;
            return 0;
          };
          return getMillis(b.createdAt) - getMillis(a.createdAt);
        });

        setManualEntries(entries);
        setLoadingEntries(false);
      }, (error) => {
        console.error("Error fetching entries:", error);
        setLoadingEntries(false);
      });

      return () => unsubscribe();
    } else {
      setManualEntries([]);
      setLoadingEntries(false);
    }
  }, [user]); // Only re-run when user changes

  const addProductRow = () => {
    setProducts([
      ...products,
      { id: Date.now(), type: '', brand: '', name: '', size: '', price: '' }
    ]);
  };

  const removeProductRow = (id) => {
    if (products.length === 1) return;
    setProducts(products.filter(product => product.id !== id));
  };

  const handleInputChange = (id, field, value) => {
    const updatedProducts = products.map(product => {
      if (product.id === id) {
        return { ...product, [field]: value };
      }
      return product;
    });
    setProducts(updatedProducts);
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');

    if (!user) return;

    if (!storeName.trim()) {
      setError(t('common.msg_enter_store_name'));
      return;
    }

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (!p.name.trim() || !String(p.price).trim()) {
        setError(t('common.msg_fill_required').replace('{{row}}', i + 1));
        return;
      }
    }

    setLoading(true);

    try {
      // 1. Prepare items for Gemini mapping format (requires name and price fields)
      const itemsToEnrich = products.map(p => ({
        name: p.name.trim(),
        price: parseFloat(p.price || 0)
      }));

      // 2. Query Gemini to enrich missing categories and brands based on current input context
      let enrichedItems = [];
      try {
        enrichedItems = await enrichItemsWithGemini(itemsToEnrich, storeName, language);
      } catch (aiError) {
        console.warn("Manual AI enrichment failed, falling back to user input:", aiError);
      }

      // 3. Merge the AI results back. If the user explicitly typed a brand or category, prioritize their manual text over the AI's suggestion
      const formattedProducts = products.map((p, idx) => {
        const aiSuggestion = enrichedItems[idx];
        
        let finalType = p.type.trim();
        if (!finalType && aiSuggestion?.type) {
          finalType = aiSuggestion.type;
        }

        let finalBrand = p.brand.trim();
        if (!finalBrand && aiSuggestion?.brand) {
          finalBrand = aiSuggestion.brand;
        }

        return {
          name: p.name.trim(),
          size: p.size.trim(),
          price: Math.abs(parseFloat(p.price || 0)),
          type: finalType ? localizeCategory(finalType, language) : '',
          brand: finalBrand ? finalBrand.charAt(0).toUpperCase() + finalBrand.slice(1) : ''
        };
      });

      const totalAmount = formattedProducts.reduce((acc, curr) => acc + parseFloat(curr.price || 0), 0);

      const newEntryData = {
        userId: user.uid,
        fileName: storeName,
        title: storeName,
        imageUrl: null,
        isManual: true,
        date: new Date().toLocaleDateString(),
        createdAt: Timestamp.now(),
        price: totalAmount,
        currency: entryCurrency,
        items: formattedProducts
      };

      await addDoc(collection(db, "receipts"), newEntryData);

      setSuccess(t('common.msg_save_success'));
      setStoreName('');
      setProducts([{ id: Date.now(), type: '', brand: '', name: '', size: '', price: '' }]);
      setTimeout(() => setSuccess(''), 3000);

    } catch (err) {
      console.error("Error saving document: ", err);
      setError(t('common.msg_save_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEntry = async (e, entryId) => {
    e.stopPropagation();
    if (!window.confirm(t('common.msg_delete_entry_confirm'))) return;
    try {
      await deleteDoc(doc(db, "receipts", entryId));
    } catch (err) {
      console.error("Error deleting document: ", err);
      alert(t('common.msg_delete_entry_failed'));
    }
  };

  const handleRowClick = (receipt) => {
    setSelectedReceipt(receipt);
    setShowModal(true);
  };

  const isDisabled = !user || loading;

  return (
    <div className="dashboard-page-wrapper p-4">
      <div
        className={showModal ? 'content-blurred' : ''}
        style={{ transition: 'filter 0.3s ease-in-out' }}
      >
        <div className="container-fluid">

          <div className="mb-4">
            <h1 className="display-6 fw-bold">{t('common.manual_entry')}</h1>
            <p className="text-muted">{t('common.manual_entry_desc')}</p>
          </div>

          {!user && (
            <div className="alert alert-warning d-flex align-items-center mb-4" role="alert">
              <FaExclamationTriangle className="me-2" />
              <div>
                {t('common.view_only_mode')} <Link to="/login">{t('common.log_in')}</Link>
              </div>
            </div>
          )}
          {error && <div className="alert alert-danger">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          {/* Otomatik Tamamlama Listeleri */}
          <datalist id="category-suggestions">
            {suggestedCategories.map((category, index) => (
              <option key={`cat-${index}`} value={category} />
            ))}
          </datalist>

          <datalist id="brand-suggestions">
            {suggestedBrands.map((brand, index) => (
              <option key={`brand-${index}`} value={brand} />
            ))}
          </datalist>

          <div className="row">
            <div className="col-12 mb-4">
              <div className="card border-0 shadow-sm p-4">
                <div className="mb-4">
                  <h5 className="fw-bold mb-3 text-secondary">{t('common.store_info')}</h5>
                  <div className="row g-3">
                    <div className="col-md-7">
                      <label className="form-label small fw-bold text-secondary mb-1">
                        {t('common.store_name')}<span className="text-danger ms-1">*</span>
                      </label>
                      <input 
                        type="text" 
                        className="form-control form-control-lg bg-light" 
                        placeholder={t('common.placeholder_store')} 
                        value={storeName} 
                        onChange={(e) => setStoreName(e.target.value)} 
                        disabled={isDisabled} 
                        style={{ fontSize: '1rem' }}
                      />
                    </div>
                    <div className="col-md-5">
                      <label className="form-label small fw-bold text-secondary mb-1">
                        {t('settings.currency')}
                      </label>
                      <div className="d-flex flex-wrap gap-2 mt-1">
                        {favoriteCurrencies.map((code) => {
                          const isSelected = entryCurrency === code;
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
                              onClick={() => setEntryCurrency(code)}
                              disabled={isDisabled}
                            >
                              <span className="me-1">{symbol}</span>
                              <span>{code}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mb-4">
                  <h5 className="fw-bold mb-3">{t('common.product_details')}</h5>
                  {products.map((product, index) => (
                    <div key={product.id} className="card border shadow-sm mb-4 rounded-4" style={{ overflow: 'hidden' }}>
                      <div className="card-header bg-light border-bottom-0 pt-3 pb-2 px-4 d-flex justify-content-between align-items-center">
                        <span className="fw-bold text-primary small text-uppercase" style={{ letterSpacing: '0.5px' }}>#{index + 1}</span>
                        {products.length > 1 && (
                          <button
                            className="btn btn-sm btn-outline-danger border-0 rounded-circle p-2 d-flex align-items-center justify-content-center"
                            onClick={() => removeProductRow(product.id)}
                            disabled={isDisabled}
                            title="Remove row"
                            style={{ width: '32px', height: '32px' }}
                          >
                            <FaTrash size={14} />
                          </button>
                        )}
                      </div>
                      <div className="card-body p-4 pt-3">
                        <div className="row g-3">
                          
                          {/* Name (Zorunlu) */}
                          <div className="col-12 col-md-6">
                            <label className="form-label small fw-bold text-secondary mb-1">
                              {t('common.name')}<span className="text-danger ms-1">*</span>
                            </label>
                            <input
                              type="text"
                              className="form-control form-control-lg bg-light"
                              placeholder={t('common.placeholder_product')}
                              value={product.name}
                              onChange={(e) => handleInputChange(product.id, 'name', e.target.value)}
                              disabled={isDisabled}
                              style={{ fontSize: '1rem' }}
                            />
                          </div>

                          {/* Price (Zorunlu) */}
                          <div className="col-12 col-md-6">
                            <label className="form-label small fw-bold text-secondary mb-1">
                              {t('common.price')}<span className="text-danger ms-1">*</span>
                            </label>
                            <div className="input-group input-group-lg bg-light rounded border">
                              <span className="input-group-text bg-transparent border-0 text-muted fw-bold pe-1">{CURRENCY_MAP[entryCurrency]?.symbol || '$'}</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                className="form-control border-0 bg-transparent ps-2"
                                placeholder="0.00"
                                value={product.price}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[^0-9.,]/g, '');
                                  handleInputChange(product.id, 'price', val);
                                }}
                                disabled={isDisabled}
                                style={{ fontSize: '1rem' }}
                              />
                            </div>
                          </div>

                          {/* Optional Fields Container */}
                          <div className="col-12 mt-4">
                            <div className="row g-3">
                              {/* Type (İsteğe Bağlı) */}
                              <div className="col-6 col-md-4">
                                <label className="form-label small text-muted mb-1">
                                  {t('common.type')}
                                </label>
                                <input
                                  type="text"
                                  list="category-suggestions"
                                  className="form-control form-control-sm"
                                  placeholder={t('common.placeholder_dairy')}
                                  value={product.type}
                                  onChange={(e) => handleInputChange(product.id, 'type', e.target.value)}
                                  disabled={isDisabled}
                                />
                              </div>

                              {/* Brand (İsteğe Bağlı) */}
                              <div className="col-6 col-md-4">
                                <label className="form-label small text-muted mb-1">
                                  {t('common.brand')}
                                </label>
                                <input
                                  type="text"
                                  list="brand-suggestions"
                                  className="form-control form-control-sm"
                                  placeholder={t('common.placeholder_brand')}
                                  value={product.brand}
                                  onChange={(e) => handleInputChange(product.id, 'brand', e.target.value)}
                                  disabled={isDisabled}
                                />
                              </div>

                              {/* Liter/Gram (İsteğe Bağlı) */}
                              <div className="col-12 col-md-4">
                                <label className="form-label small text-muted mb-1">{t('common.liter_gram')}</label>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  placeholder={t('common.placeholder_size')}
                                  value={product.size}
                                  onChange={(e) => handleInputChange(product.id, 'size', e.target.value)}
                                  disabled={isDisabled}
                                />
                              </div>
                            </div>
                          </div>
                          
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    className="add-btn"
                    onClick={addProductRow}
                    disabled={isDisabled}
                    title="Add New Row"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      height="50px"
                      width="50px"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeWidth="1.5"
                        d="M12 22C17.5 22 22 17.5 22 12C22 6.5 17.5 2 12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22Z"
                      ></path>
                      <path strokeWidth="1.5" d="M8 12H16"></path>
                      <path strokeWidth="1.5" d="M12 16V8"></path>
                    </svg>
                    <span>{t('common.add_product')}</span>
                  </button>
                </div>
                <div className="d-flex justify-content-end mt-3 pb-5">
                  <button
                    className="save-btn"
                    onClick={handleSave}
                    disabled={isDisabled}
                  >
                    <span>
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                          {t('common.saving')}
                        </>
                      ) : (
                        <>
                          <FaSave className="me-2" /> {t('common.save_data')}
                        </>
                      )}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 mb-5">
            <h3 id="manual-section" className="h5 mb-3 fw-bold d-flex align-items-center">
              <FaListAlt className="me-2 text-muted" /> {t('common.recent_manual_entries')}
            </h3>

            <div className="card shadow-sm border-0">
              <div className="list-group list-group-flush">
                <div className="list-group-item bg-body-tertiary text-muted fw-bold small text-uppercase d-flex align-items-center">
                  <div style={{ flex: 2 }}>{t('common.store_name')}</div>
                  <div style={{ flex: 1 }}>{t('common.date_time')}</div>
                  <div style={{ flex: 1, textAlign: 'right' }}>{t('common.total_price')}</div>
                  <div style={{ width: '40px' }}></div>
                </div>

                {loadingEntries && <div className="p-4 text-center text-muted">{t('common.loading_entries')}</div>}

                {!loadingEntries && manualEntries.length === 0 && (
                  <div className="p-5 text-center text-muted">
                    {t('common.no_data_enter_first')}
                  </div>
                )}

                {!loadingEntries && manualEntries.slice(0, entryLimit).map((entry) => (
                  <div
                    key={entry.id}
                    className="list-group-item list-group-item-action d-flex align-items-center p-3"
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleRowClick(entry)}
                  >
                    <div style={{ flex: 2, minWidth: 0 }} className="fw-bold text-truncate pe-2">
                      {entry.fileName}
                    </div>

                    <div style={{ flex: 1 }} className="text-muted small">
                      {formatDateTime(entry.createdAt)}
                    </div>

                    <div style={{ flex: 1, textAlign: 'right' }} className="fw-bold text-primary">
                      {formatPrice(entry.price, entry.currency)}
                    </div>

                    <div style={{ width: '50px', display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        className="delete-entry-btn"
                        onClick={(e) => handleDeleteEntry(e, entry.id)}
                        title="Delete Entry"
                      >
                        <svg viewBox="0 0 448 512" className="delete-entry-svgIcon">
                          <path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}

                {!loadingEntries && manualEntries.length > entryLimit && (
                  <div className="list-group-item text-center p-3 bg-light">
                    <button
                      className="btn btn-outline-primary rounded-pill px-4 btn-sm fw-bold d-flex align-items-center mx-auto"
                      onClick={() => setEntryLimit(prev => prev + 10)}
                    >
                      <FaArrowDown className="me-2" /> {t('common.load_more_entries')}
                    </button>
                  </div>
                )}

              </div>
            </div>
          </div>

        </div>
      </div>

      <ReceiptDetailModal
        show={showModal}
        onClose={() => setShowModal(false)}
        receipt={selectedReceipt}
      />

    </div>
  );
}

export default ManualEntry;