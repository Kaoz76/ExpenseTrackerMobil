import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  FaStore, FaReceipt, FaTrash, FaPlus, FaPen, FaCheck,
  FaTimes, FaArrowLeft, FaShoppingCart, FaSave, FaImage, FaExpandAlt
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';

import { db, storage } from '../firebase';
import { doc, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { useLanguage } from '../context/LanguageContext';
import ReceiptInfoCard from '../components/receipts/ReceiptInfoCard';
import ReceiptItemList from '../components/receipts/ReceiptItemList';

function ReceiptDetail() {
  const { receiptId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
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

        <ReceiptInfoCard
          receipt={receipt}
          receiptId={receiptId}
          storeName={storeName}
          setStoreName={setStoreName}
          editingStoreName={editingStoreName}
          setEditingStoreName={setEditingStoreName}
          handleSaveStoreName={handleSaveStoreName}
          handleDeleteReceipt={handleDeleteReceipt}
          setShowImageLightbox={setShowImageLightbox}
          totalPrice={totalPrice}
          setTotalPrice={setTotalPrice}
          editingTotal={editingTotal}
          setEditingTotal={setEditingTotal}
          handleSaveTotal={handleSaveTotal}
          items={items}
          itemsTotal={itemsTotal}
        />

        {/* ITEMS TABLE */}
        <ReceiptItemList
          receipt={receipt}
          items={items}
          itemsTotal={itemsTotal}
          hasChanges={hasChanges}
          saving={saving}
          handleSaveItems={handleSaveItems}
          showAddForm={showAddForm}
          setShowAddForm={setShowAddForm}
          newItem={newItem}
          setNewItem={setNewItem}
          handleAddItem={handleAddItem}
          editingItemIdx={editingItemIdx}
          setEditingItemIdx={setEditingItemIdx}
          handleItemChange={handleItemChange}
          handleRemoveItem={handleRemoveItem}
        />

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