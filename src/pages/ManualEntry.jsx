import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { db } from '../firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { FaPlus, FaTrash, FaExclamationTriangle, FaSave, FaListAlt } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import ReceiptDetailModal from '../components/ReceiptDetailModal';

function ManualEntry() {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [marketName, setMarketName] = useState('');
  const [products, setProducts] = useState([{ id: Date.now(), type: '', brand: '', name: '', size: '', price: '' }]);
  const [manualEntries, setManualEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (user) {
      setLoadingEntries(true);
      const q = query(
        collection(db, "receipts"),
        where("userId", "==", user.uid),
        where("isManual", "==", true),
        orderBy("createdAt", "desc")
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const entries = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
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
  }, [user]);

  
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

    if (!marketName.trim()) {
      setError('Please enter a Market Name.');
      return;
    }

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (!p.type.trim() || !p.brand.trim() || !p.price.toString().trim()) {
        setError(`Please fill in all required fields (Type, Brand, Price) for Row ${i + 1}.`);
        return;
      }
    }

    setLoading(true);

    try {
      const totalAmount = products.reduce((acc, curr) => acc + parseFloat(curr.price || 0), 0);

      await addDoc(collection(db, "receipts"), {
        userId: user.uid,
        fileName: marketName,
        title: marketName,
        imageUrl: null,
        isManual: true,
        date: new Date().toLocaleDateString(),
        createdAt: new Date(),
        price: totalAmount,
        items: products
      });

      setSuccess('Data saved successfully! You can see it in the list below.');
      setMarketName('');
      setProducts([{ id: Date.now(), type: '', brand: '', name: '', size: '', price: '' }]);
      setTimeout(() => setSuccess(''), 3000);

    } catch (err) {
      console.error("Error saving document: ", err);
      setError("Failed to save data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEntry = async (e, entryId) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this entry?")) return;
    try {
      await deleteDoc(doc(db, "receipts", entryId));
    } catch (err) {
      console.error("Error deleting document: ", err);
      alert("Failed to delete entry.");
    }
  };

  const handleRowClick = (receipt) => {
    setSelectedReceipt(receipt);
    setShowModal(true);
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return '-';
    // Firebase Timestamp objesini JS Date objesine çevir
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    
    return date.toLocaleString('tr-TR', { // Türkçe format (Gün.Ay.Yıl Saat:Dakika:Saniye)
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
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
            <h1 className="display-6 fw-bold">Manual Entry</h1>
            <p className="text-muted">Enter your expense data manually by filling out the fields below.</p>
          </div>

          {!user && (
            <div className="alert alert-warning d-flex align-items-center mb-4" role="alert">
              <FaExclamationTriangle className="me-2" />
              <div>
                You are in <strong>View Only</strong> mode. Please <Link to="/login">log in</Link> to save data.
              </div>
            </div>
          )}
          {error && <div className="alert alert-danger">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <div className="row">
             <div className="col-12 mb-4">
                <div className="card border-0 shadow-sm p-4">
                    <div className="mb-4">
                      <h5 className="fw-bold mb-3">Market Information</h5>
                      <label className="form-label text-muted">Market Name</label>
                      <input type="text" className="form-control" placeholder="e.g., Central Market" value={marketName} onChange={(e) => setMarketName(e.target.value)} disabled={isDisabled} />
                    </div>
                    <div className="mb-4">
                      <h5 className="fw-bold mb-3">Product Details</h5>
                        {products.map((product) => (
                        <div key={product.id} className="card border-0 shadow-sm p-4 mb-3">
                            <div className="row g-3">
                            
                                {/* Type (Zorunlu) */}
                                <div className="col-md-2">
                                    <label className="form-label small text-muted">
                                    Type<span className="text-danger">*</span>
                                    </label>
                                    <input 
                                    type="text" 
                                    className="form-control" 
                                    placeholder="e.g., Dairy" 
                                    value={product.type} 
                                    onChange={(e) => handleInputChange(product.id, 'type', e.target.value)} 
                                    disabled={isDisabled} 
                                    />
                                </div>
                                
                                {/* Brand (Zorunlu) */}
                                <div className="col-md-3">
                                    <label className="form-label small text-muted">
                                    Brand<span className="text-danger">*</span>
                                    </label>
                                    <input 
                                    type="text" 
                                    className="form-control" 
                                    placeholder="e.g., Farm Fresh" 
                                    value={product.brand} 
                                    onChange={(e) => handleInputChange(product.id, 'brand', e.target.value)} 
                                    disabled={isDisabled} 
                                    />
                                </div>

                                {/* Name (İsteğe Bağlı) */}
                                <div className="col-md-3">
                                    <label className="form-label small text-muted">Name</label>
                                    <input 
                                    type="text" 
                                    className="form-control" 
                                    placeholder="e.g., Whole Milk" 
                                    value={product.name} 
                                    onChange={(e) => handleInputChange(product.id, 'name', e.target.value)} 
                                    disabled={isDisabled} 
                                    />
                                </div>

                                {/* Liter/Gram (İsteğe Bağlı) */}
                                <div className="col-md-2">
                                    <label className="form-label small text-muted">Liter/Gram</label>
                                    <input 
                                    type="text" 
                                    className="form-control" 
                                    placeholder="e.g., 1L" 
                                    value={product.size} 
                                    onChange={(e) => handleInputChange(product.id, 'size', e.target.value)} 
                                    disabled={isDisabled} 
                                    />
                                </div>

                                {/* Price (Zorunlu) */}
                                <div className="col-md-2">
                                    <label className="form-label small text-muted">
                                    Price<span className="text-danger">*</span>
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
                        <span>Add Product</span>
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
                            Saving...
                          </>
                        ) : (
                          <>
                            <FaSave className="me-2" /> Save Data
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
                <FaListAlt className="me-2 text-muted" /> All Manual Entries
            </h3>
            
            <div className="card shadow-sm border-0">
                <div className="list-group list-group-flush">
                    <div className="list-group-item bg-body-tertiary text-muted fw-bold small text-uppercase d-flex align-items-center">
                        <div style={{ flex: 2 }}>Market Name</div>
                        <div style={{ flex: 1 }}>Date & Time</div> 
                        <div style={{ flex: 1, textAlign: 'right' }}>Total Price</div>
                        <div style={{ width: '40px' }}></div> 
                    </div>

                    {loadingEntries && <div className="p-4 text-center text-muted">Loading entries...</div>}

                    {!loadingEntries && manualEntries.length === 0 && (
                        <div className="p-5 text-center text-muted">
                            You have no data, enter data first.
                        </div>
                    )}

                    {!loadingEntries && manualEntries.map((entry) => (
                        <div 
                            key={entry.id} 
                            className="list-group-item list-group-item-action d-flex align-items-center p-3"
                            style={{ cursor: 'pointer' }}
                            onClick={() => handleRowClick(entry)}
                        >
                            <div style={{ flex: 2 }} className="fw-bold">
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