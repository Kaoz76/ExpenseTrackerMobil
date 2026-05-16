import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { FaPlus, FaTrash, FaExclamationTriangle, FaSave, FaListAlt, FaArrowDown } from 'react-icons/fa';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ReceiptDetailModal from '../components/ReceiptDetailModal';
import { formatDateTime } from '../utils/dateFormatter';

function ManualEntry() {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const { t } = useLanguage();
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
      const totalAmount = products.reduce((acc, curr) => acc + parseFloat(curr.price || 0), 0);

      const newEntryData = {
        userId: user.uid,
        fileName: storeName,
        title: storeName,
        imageUrl: null,
        isManual: true,
        date: new Date().toLocaleDateString(),
        createdAt: Timestamp.now(),
        price: totalAmount,
        items: products
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

          <div className="row">
            <div className="col-12 mb-4">
              <div className="card border-0 shadow-sm p-4">
                <div className="mb-4">
                  <h5 className="fw-bold mb-3">{t('common.store_info')}</h5>
                  <label className="form-label text-muted">{t('common.store_name')}</label>
                  <input type="text" className="form-control" placeholder={t('common.placeholder_store')} value={storeName} onChange={(e) => setStoreName(e.target.value)} disabled={isDisabled} />
                </div>
                <div className="mb-4">
                  <h5 className="fw-bold mb-3">{t('common.product_details')}</h5>
                  {products.map((product, index) => (
                    <div key={product.id} className="card border-0 shadow-sm p-4 mb-3">
                      <div className="row g-3">

                        {/* Type (İsteğe Bağlı) */}
                        <div className="col-md-2">
                          <label className="form-label small text-muted">
                            {t('common.type')}
                          </label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder={t('common.placeholder_dairy')}
                            value={product.type}
                            onChange={(e) => handleInputChange(product.id, 'type', e.target.value)}
                            disabled={isDisabled}
                          />
                        </div>

                        {/* Brand (İsteğe Bağlı) */}
                        <div className="col-md-3">
                          <label className="form-label small text-muted">
                            {t('common.brand')}
                          </label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder={t('common.placeholder_brand')}
                            value={product.brand}
                            onChange={(e) => handleInputChange(product.id, 'brand', e.target.value)}
                            disabled={isDisabled}
                          />
                        </div>

                        {/* Name (Zorunlu) */}
                        <div className="col-md-3">
                          <label className="form-label small text-muted">
                            {t('common.name')}<span className="text-danger">*</span>
                          </label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder={t('common.placeholder_product')}
                            value={product.name}
                            onChange={(e) => handleInputChange(product.id, 'name', e.target.value)}
                            disabled={isDisabled}
                          />
                        </div>

                        {/* Liter/Gram (İsteğe Bağlı) */}
                        <div className="col-md-2">
                          <label className="form-label small text-muted">{t('common.liter_gram')}</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder={t('common.placeholder_size')}
                            value={product.size}
                            onChange={(e) => handleInputChange(product.id, 'size', e.target.value)}
                            disabled={isDisabled}
                          />
                        </div>

                        {/* Price (Zorunlu) */}
                        <div className="col-md-2">
                          <label className="form-label small text-muted">
                            {t('common.price')}<span className="text-danger">*</span>
                          </label>
                          <div className="d-flex align-items-center gap-2">
                            <input
                              type="number"
                              className="form-control"
                              placeholder="0.00"
                              value={product.price}
                              onChange={(e) => handleInputChange(product.id, 'price', e.target.value)}
                              disabled={isDisabled}
                              step="0.01"
                            />
                            {/* Silme butonu sadece birden fazla satır varsa görünür */}
                            {products.length > 1 && (
                              <button
                                className="btn btn-outline-danger border-0"
                                onClick={() => removeProductRow(product.id)}
                                disabled={isDisabled}
                                title="Remove row"
                              >
                                <FaTrash />
                              </button>
                            )}
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
                      {formatPrice(entry.price)}
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