import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  FaStore, FaReceipt, FaTrash, FaPlus, FaPen, FaCheck,
  FaTimes, FaArrowLeft, FaShoppingCart, FaSave, FaImage, FaExpandAlt
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { db, storage } from '../firebase';
import { doc, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { formatDateTime } from '../utils/dateFormatter';
import { useLanguage } from '../context/LanguageContext';

function ReceiptDetail() {
  const { receiptId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatPrice, currency } = useCurrency();
  const { t } = useLanguage();

  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable states
  const [editingStoreName, setEditingStoreName] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [editingTotal, setEditingTotal] = useState(false);
  const [totalPrice, setTotalPrice] = useState(0);

  // Items state (local copy for editing)
  const [items, setItems] = useState([]);
  const [editingItemIdx, setEditingItemIdx] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  // New item form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', price: '', brand: '', type: '', size: '' });

  // Image lightbox
  const [showImageLightbox, setShowImageLightbox] = useState(false);

  // Fetch receipt data in real-time
  useEffect(() => {
    // 🔥 DÜZELTME 3: user.uid garantisi eklendi
    if (!user?.uid || !receiptId) {
      setLoading(false);
      return;
    }

    const docRef = doc(db, "receipts", receiptId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setReceipt(data);
        setStoreName(data.fileName || '');
        setTotalPrice(data.price || 0);
        setItems(data.items || []);
      } else {
        setReceipt(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching receipt:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, receiptId]);

  // Mark changes
  const markChanged = () => setHasChanges(true);

  // ─── STORE NAME ────────────────────────────────
  const handleSaveStoreName = async () => {
    if (!storeName.trim()) return;
    setEditingStoreName(false);
    try {
      await updateDoc(doc(db, "receipts", receiptId), {
        fileName: storeName.trim(),
        title: storeName.trim()
      });
    } catch (err) {
      console.error("Error updating store name:", err);
    }
  };

  // ─── TOTAL PRICE ───────────────────────────────
  const handleSaveTotal = async () => {
    setEditingTotal(false);
    try {
      await updateDoc(doc(db, "receipts", receiptId), {
        price: parseFloat(totalPrice) || 0
      });
    } catch (err) {
      console.error("Error updating total:", err);
    }
  };

  // ─── ITEM CRUD ─────────────────────────────────
  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    // 🔥 DÜZELTME 2: Gereksiz ternary operatörü temizlendi
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
    markChanged();
  };

  const handleRemoveItem = (index) => {
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
    markChanged();
    if (editingItemIdx === index) setEditingItemIdx(null);
  };

  const handleAddItem = () => {
    if (!newItem.name.trim()) return;
    const itemToAdd = {
      name: newItem.name.trim(),
      price: parseFloat(newItem.price) || 0,
      brand: newItem.brand.trim(),
      type: newItem.type.trim(),
      size: newItem.size.trim()
    };
    setItems([...items, itemToAdd]);
    setNewItem({ name: '', price: '', brand: '', type: '', size: '' });
    setShowAddForm(false);
    markChanged();
  };

  // ─── SAVE ALL ITEM CHANGES ────────────────────
  const handleSaveItems = async () => {
    setSaving(true);
    try {
      const cleanedItems = items.map(item => ({
        ...item,
        price: parseFloat(item.price) || 0
      }));

      // 🔥 DÜZELTME 1: Ürünlerin yeni toplamını hesapla ve ana fiş tutarıyla senkronize et!
      const newItemsTotal = cleanedItems.reduce((sum, item) => sum + item.price, 0);

      await updateDoc(doc(db, "receipts", receiptId), {
        items: cleanedItems,
        price: newItemsTotal // Ana fiş tutarı otomatik güncelleniyor
      });

      setTotalPrice(newItemsTotal); // Local state'i de güncelliyoruz
      setHasChanges(false);
      setEditingItemIdx(null);
    } catch (err) {
      console.error("Error saving items:", err);
    } finally {
      setSaving(false);
    }
  };

  // ─── DELETE RECEIPT ────────────────────────────
  const handleDeleteReceipt = async () => {
    if (!window.confirm(t('common.msg_delete_receipt_full_confirm'))) {
      return;
    }
    try {
      // 🔥 Delete image from Firebase Storage if it exists
      if (receipt?.storagePath) {
        try {
          await deleteObject(ref(storage, receipt.storagePath));
        } catch (storageErr) {
          console.warn("Could not delete storage file:", storageErr);
        }
      }
      await deleteDoc(doc(db, "receipts", receiptId));
      navigate('/receipts');
    } catch (err) {
      console.error("Error deleting receipt:", err);
      alert(t('common.msg_delete_receipt_failed'));
    }
  };

  // 🔥 DÜZELTME 3: itemsTotal performansı useMemo ile korumaya alındı
  const itemsTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
  }, [items]);

  if (loading) {
    return (
      <div className="dashboard-page-wrapper p-4">
        <div className="container-fluid">
          <div className="text-center p-5">
            <div className="spinner-border text-primary" role="status"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="dashboard-page-wrapper p-4">
        <div className="container-fluid text-center py-5">
          <FaReceipt size={48} className="text-muted mb-3" />
          <h4 className="text-muted">{t('common.receipt_not_found')}</h4>
          <Link to="/receipts" className="btn btn-primary mt-3">
            <FaArrowLeft className="me-2" /> {t('common.back_to_receipts')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page-wrapper p-4">
      <div className="container-fluid">

        {/* BREADCRUMB */}
        <nav aria-label="breadcrumb" className="mb-4">
          <ol className="breadcrumb">
            <li className="breadcrumb-item">
              <Link to="/receipts" className="text-decoration-none">{t('common.receipts')}</Link>
            </li>
            <li className="breadcrumb-item active" aria-current="page">
              {receipt.fileName || t('common.details')}
            </li>
          </ol>
        </nav>

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
                    <span className="input-group-text">{currency?.symbol || '$'}</span>
                    <input
                      type="number"
                      className="form-control fw-bold"
                      value={totalPrice}
                      onChange={(e) => setTotalPrice(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveTotal()}
                      step="0.01"
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
                <div className="d-flex align-items-center gap-2">
                  <h3 className="fw-bold mb-0">{formatPrice(totalPrice)}</h3>
                  <button
                    className="btn btn-sm btn-outline-primary border-0"
                    onClick={() => setEditingTotal(true)}
                    title="Edit total price"
                  >
                    <FaPen size={12} />
                  </button>
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
              <h3 className="fw-bold mb-0">{formatPrice(itemsTotal)}</h3>
              <small className="opacity-75">{t('common.sum_of_all_items')}</small>
            </div>
          </div>
        </div>

        {/* ITEMS TABLE */}
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-body-tertiary py-3 d-flex justify-content-between align-items-center">
            <h5 className="mb-0 fw-bold d-flex align-items-center text-body">
              <FaShoppingCart className="me-2 text-body-secondary" /> {t('common.parsed_items')}
            </h5>
            <div className="d-flex gap-2">
              {hasChanges && (
                <button
                  className="btn btn-success btn-sm d-flex align-items-center gap-1"
                  onClick={handleSaveItems}
                  disabled={saving}
                >
                  <FaSave /> {saving ? t('common.saving') : t('common.save_changes')}
                </button>
              )}
              <button
                className="btn btn-primary btn-sm d-flex align-items-center gap-1"
                onClick={() => setShowAddForm(true)}
              >
                <FaPlus /> {t('common.add_item')}
              </button>
            </div>
          </div>

          {/* Add Item Form */}
          {showAddForm && (
            <div className="p-3 bg-primary-subtle border-bottom">
              <h6 className="fw-bold mb-3 text-primary">{t('common.add_new_item')}</h6>
              <div className="row g-2 align-items-end">
                <div className="col-md-3">
                  <label className="form-label small fw-bold">{t('common.name_star')}</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder={t('common.placeholder_item_name')}
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  />
                </div>
                <div className="col-6 col-md-2">
                  <label className="form-label small fw-bold">{t('common.type')}</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={newItem.type}
                    onChange={(e) => setNewItem({ ...newItem, type: e.target.value })}
                  />
                </div>
                <div className="col-6 col-md-2">
                  <label className="form-label small fw-bold">{t('common.brand')}</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={newItem.brand}
                    onChange={(e) => setNewItem({ ...newItem, brand: e.target.value })}
                  />
                </div>
                <div className="col-6 col-md-2">
                  <label className="form-label small fw-bold">{t('common.size')}</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={newItem.size}
                    onChange={(e) => setNewItem({ ...newItem, size: e.target.value })}
                  />
                </div>
                <div className="col-6 col-md-2">
                  <label className="form-label small fw-bold">{t('common.price')}</label>
                  <div className="input-group input-group-sm">
                    <span className="input-group-text">{currency?.symbol || '$'}</span>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control form-control-sm"
                      placeholder="0.00"
                      value={newItem.price}
                      onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                    />
                  </div>
                </div>
                <div className="col-12 col-md-1 d-flex gap-1 mt-2 mt-md-0">
                  <button
                    className="btn btn-success btn-sm flex-grow-1 px-1"
                    onClick={handleAddItem}
                    disabled={!newItem.name.trim()}
                    title={t('common.add_action')}
                  >
                    <FaCheck />
                  </button>
                  <button
                    className="btn btn-outline-secondary btn-sm px-1"
                    onClick={() => {
                      setShowAddForm(false);
                      setNewItem({ name: '', price: '', brand: '', type: '', size: '' });
                    }}
                    title={t('common.cancel')}
                  >
                    <FaTimes />
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle">
              <thead className="table-secondary">
                <tr>
                  <th className="py-3 ps-4" style={{ width: '40px' }}>#</th>
                  <th className="py-3">{t('common.name')}</th>
                  <th className="py-3 d-none d-md-table-cell">{t('common.type')}</th>
                  <th className="py-3 d-none d-md-table-cell">{t('common.brand')}</th>
                  <th className="py-3 d-none d-md-table-cell">{t('common.size')}</th>
                  <th className="py-3 text-end">{t('common.price')}</th>
                  <th className="py-3 text-center pe-4" style={{ width: '100px' }}>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className={editingItemIdx === idx ? 'table-active' : ''}>
                    <td className="ps-4 text-body-secondary fw-medium">{idx + 1}</td>

                    {editingItemIdx === idx ? (
                      <>
                        <td>
                          <input
                            type="text"
                            className="form-control form-control-sm mb-1"
                            value={item.name || ''}
                            onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                            placeholder={t('common.name')}
                          />
                          <div className="d-md-none d-flex gap-1 mt-1">
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder={t('common.type')}
                              value={item.type || ''}
                              onChange={(e) => handleItemChange(idx, 'type', e.target.value)}
                            />
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder={t('common.brand')}
                              value={item.brand || ''}
                              onChange={(e) => handleItemChange(idx, 'brand', e.target.value)}
                            />
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder={t('common.size')}
                              value={item.size || ''}
                              onChange={(e) => handleItemChange(idx, 'size', e.target.value)}
                            />
                          </div>
                        </td>
                        <td className="d-none d-md-table-cell">
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={item.type || ''}
                            onChange={(e) => handleItemChange(idx, 'type', e.target.value)}
                          />
                        </td>
                        <td className="d-none d-md-table-cell">
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={item.brand || ''}
                            onChange={(e) => handleItemChange(idx, 'brand', e.target.value)}
                          />
                        </td>
                        <td className="d-none d-md-table-cell">
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={item.size || ''}
                            onChange={(e) => handleItemChange(idx, 'size', e.target.value)}
                          />
                        </td>
                        <td>
                          <div className="input-group input-group-sm">
                            <span className="input-group-text">{currency?.symbol || '$'}</span>
                            <input
                              type="number"
                              step="0.01"
                              className="form-control form-control-sm text-end"
                              value={item.price}
                              onChange={(e) => handleItemChange(idx, 'price', e.target.value)}
                            />
                          </div>
                        </td>
                        <td className="text-center pe-4">
                          <button
                            className="btn btn-sm btn-success me-1 mb-1 mb-md-0"
                            onClick={() => setEditingItemIdx(null)}
                            title={t('common.done_editing')}
                          >
                            <FaCheck size={12} />
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleRemoveItem(idx)}
                            title={t('common.delete_item')}
                          >
                            <FaTrash size={12} />
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>
                          <div className="fw-bold">{item.name || '-'}</div>
                          <div className="d-md-none text-muted small mt-1">
                            {[item.type, item.brand, item.size].filter(Boolean).join(' • ')}
                          </div>
                        </td>
                        <td className="d-none d-md-table-cell text-muted">{item.type || '-'}</td>
                        <td className="d-none d-md-table-cell text-muted">{item.brand || '-'}</td>
                        <td className="d-none d-md-table-cell text-muted">{item.size || '-'}</td>
                        <td className="text-end fw-bold text-primary">{formatPrice(item.price)}</td>
                        <td className="text-center pe-4">
                          <button
                            className="btn btn-sm btn-outline-primary me-1 border-0"
                            onClick={() => setEditingItemIdx(idx)}
                            title={t('common.edit_item')}
                          >
                            <FaPen size={12} />
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger border-0"
                            onClick={() => handleRemoveItem(idx)}
                            title={t('common.delete_item')}
                          >
                            <FaTrash size={12} />
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}

                {items.length === 0 && (
                  <tr>
                    <td colSpan="7" className="text-center py-5 text-body-secondary">
                      <FaShoppingCart size={32} className="mb-2 opacity-50" />
                      <div>{t('common.no_items_on_receipt')}</div>
                      <button
                        className="btn btn-sm btn-primary mt-2"
                        onClick={() => setShowAddForm(true)}
                      >
                        <FaPlus className="me-1" /> {t('common.add_first_item')}
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>

              {items.length > 0 && (
                <tfoot className="table-secondary">
                  <tr>
                    <td colSpan="2" className="text-end fw-bold py-3 ps-4 d-table-cell d-md-none">{t('common.items_total')}</td>
                    <td colSpan="5" className="text-end fw-bold py-3 ps-4 d-none d-md-table-cell">{t('common.items_total')}</td>
                    <td className="text-end fw-bold fs-5 text-primary py-3">{formatPrice(itemsTotal)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Floating save bar */}
        {hasChanges && (
          <div
            className="position-fixed bottom-0 start-0 end-0 bg-body border-top shadow-lg p-3 d-flex justify-content-center align-items-center gap-3"
            style={{ zIndex: 1030 }}
          >
            <span className="text-warning fw-bold d-none d-sm-inline">
              {t('common.unsaved_changes')}
            </span>
            <button
              className="btn btn-success d-flex align-items-center gap-2"
              onClick={handleSaveItems}
              disabled={saving}
            >
              <FaSave /> {saving ? t('common.saving') : t('common.save_all_changes')}
            </button>
            <button
              className="btn btn-outline-secondary"
              onClick={() => {
                setItems(receipt.items || []);
                setHasChanges(false);
                setEditingItemIdx(null);
              }}
            >
              {t('common.discard')}
            </button>
          </div>
        )}

      </div>

      {/* IMAGE LIGHTBOX */}
      {showImageLightbox && receipt?.imageUrl && (
        <>
          <div
            className="modal-backdrop fade show"
            style={{ zIndex: 1060 }}
            onClick={() => setShowImageLightbox(false)}
          />
          <div
            className="modal fade show d-flex align-items-center justify-content-center"
            style={{ zIndex: 1065, display: 'flex !important' }}
            tabIndex="-1"
            onClick={() => setShowImageLightbox(false)}
          >
            <div
              className="position-relative"
              style={{ maxWidth: '95vw', maxHeight: '90vh' }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="btn btn-light position-absolute top-0 end-0 m-2 rounded-circle shadow"
                style={{ zIndex: 10, width: '36px', height: '36px', padding: 0 }}
                onClick={() => setShowImageLightbox(false)}
              >
                <FaTimes />
              </button>
              <img
                src={receipt.imageUrl}
                alt={receipt.fileName || 'Receipt'}
                style={{
                  maxWidth: '95vw',
                  maxHeight: '90vh',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ReceiptDetail;