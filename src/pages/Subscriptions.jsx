import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { db } from '../firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { FaPlus, FaTrash, FaCalendarCheck, FaExclamationTriangle, FaSync } from 'react-icons/fa';
import { Link } from 'react-router-dom';

function Subscriptions() {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [subscriptions, setSubscriptions] = useState([]);
  
  // Form State'leri
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState('1'); 

  // VERİ ÇEKME
  useEffect(() => {
    setLoading(true);

    if (user) {
      const q = query(
        collection(db, "subscriptions"),
        where("userId", "==", user.uid),
        orderBy("dayOfMonth", "asc") 
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const subsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setSubscriptions(subsData);
        setLoading(false);
      }, (error) => {
        console.error("Subscription fetch error:", error);
        setLoading(false);
      });

      return () => unsubscribe();
    } else {
      setSubscriptions([]);
      setLoading(false);
    }
  }, [user]);

  // ABONELİK EKLEME
  const handleAddSubscription = async (e) => {
    e.preventDefault();
    if (!name || !price || !dayOfMonth) return;
    
    setAdding(true);
    try {
      await addDoc(collection(db, "subscriptions"), {
        userId: user.uid,
        name: name,
        price: parseFloat(price),
        dayOfMonth: parseInt(dayOfMonth),
        createdAt: new Date()
      });
      
      setName('');
      setPrice('');
      setDayOfMonth('1');
    } catch (error) {
      console.error("Error adding subscription:", error);
      alert("Failed to add subscription.");
    } finally {
      setAdding(false);
    }
  };

  // SİLME
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this subscription?")) return;
    try {
      await deleteDoc(doc(db, "subscriptions", id));
    } catch (error) {
      console.error("Error deleting:", error);
    }
  };

  const totalMonthlyFixed = subscriptions.reduce((acc, curr) => acc + (curr.price || 0), 0);

  return (
    <div className="dashboard-page-wrapper p-4">
      <div className="container-fluid">
        
        {/* Başlık */}
        <div className="d-flex align-items-center mb-4">
           <div className="bg-primary-subtle rounded-circle p-3 me-3 text-primary d-flex align-items-center justify-content-center" style={{ width: '60px', height: '60px' }}>
              <FaSync className="fs-3" />
           </div>
           <div>
             <h1 className="display-6 fw-bold mb-0">Subscriptions</h1>
             <span className="text-muted">Manage your recurring monthly expenses.</span>
           </div>
        </div>

        {/* Giriş Uyarısı */}
        {!user && (
            <div className="alert alert-warning d-flex align-items-center mb-4" role="alert">
              <FaExclamationTriangle className="me-2" />
              <div>
                You must be <Link to="/login" className="alert-link">logged in</Link> to manage subscriptions.
              </div>
            </div>
        )}

        <div className="row g-4">
            
            {/* EKLEME FORMU */}
            <div className="col-lg-4">
                <div className="card border-0 shadow-sm h-100">
                    <div className="card-body p-4">
                        <h5 className="fw-bold mb-4 d-flex align-items-center">
                            <FaPlus className="me-2 text-primary" /> Add New
                        </h5>
                        
                        <form onSubmit={handleAddSubscription}>
                            <div className="mb-3">
                                <label className="form-label small text-muted fw-bold">NAME</label>
                                <input 
                                    type="text" 
                                    className="form-control" 
                                    placeholder="e.g. Netflix" 
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    disabled={!user}
                                    required
                                />
                            </div>

                            <div className="mb-3">
                                <label className="form-label small text-muted fw-bold">PRICE</label>
                                <input 
                                    type="number" 
                                    className="form-control" 
                                    placeholder="0.00" 
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    step="0.01"
                                    disabled={!user}
                                    required
                                />
                            </div>

                            <div className="mb-4">
                                <label className="form-label small text-muted fw-bold">RENEWAL DAY (1-31)</label>
                                <input 
                                    type="number" 
                                    className="form-control" 
                                    placeholder="e.g. 5" 
                                    value={dayOfMonth}
                                    onChange={(e) => setDayOfMonth(e.target.value)}
                                    min="1"
                                    max="31"
                                    disabled={!user}
                                    required
                                />
                                <div className="form-text">Day of the month payment occurs.</div>
                            </div>

                            <button className="btn btn-primary w-100" type="submit" disabled={!user || adding}>
                                {adding ? 'Adding...' : 'Add Subscription'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            {/* LİSTE */}
            <div className="col-lg-8">
                <div className="card border-0 shadow-sm h-100">
                    <div className="card-header bg-body-tertiary py-3 d-flex justify-content-between align-items-center">
                        <h5 className="mb-0 fw-bold d-flex align-items-center text-body">
                          <FaCalendarCheck className="me-2 text-body-secondary" /> Active Subscriptions
                        </h5>
                        <span className="badge bg-primary fs-6">
                            Total: {formatPrice(totalMonthlyFixed)} / mo
                        </span>
                    </div>
                    
                    <div className="list-group list-group-flush">
                        {/* Başlık - Karanlık Mod Uyumlu */}
                        <div className="list-group-item bg-body-tertiary text-body-secondary fw-bold small text-uppercase d-flex align-items-center">
                            <div style={{ width: '50px' }} className="text-center">Day</div>
                            <div style={{ flex: 1 }}>Name</div>
                            <div style={{ flex: 1, textAlign: 'right' }}>Cost</div>
                            <div style={{ width: '40px' }}></div>
                        </div>

                        {/* YÜKLENİYOR */}
                        {loading && (
                            <div className="p-5 text-center text-muted">
                                <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                                Loading...
                            </div>
                        )}

                        {/* BOŞ DURUM */}
                        {!loading && subscriptions.length === 0 && (
                            <div className="p-5 text-center">
                                <div className="text-body fs-5 mb-2">No active subscriptions found.</div>
                                <p className="text-secondary small">Add your recurring expenses using the form on the left.</p>
                            </div>
                        )}

                        {/* LİSTE ELEMANLARI */}
                        {!loading && subscriptions.map(sub => (
                            <div key={sub.id} className="list-group-item list-group-item-action d-flex align-items-center p-3">
                                {/* Gün Kutusu */}
                                <div className="bg-body-secondary rounded text-center d-flex flex-column justify-content-center me-3" style={{ width: '50px', height: '50px' }}>
                                    <span className="small fw-bold text-uppercase" style={{fontSize: '0.65rem'}}>Day</span>
                                    <span className="fw-bold fs-5 lh-1 text-body">{sub.dayOfMonth}</span>
                                </div>

                                <div style={{ flex: 1 }} className="fw-bold fs-5 text-body">
                                    {sub.name}
                                </div>

                                <div style={{ flex: 1, textAlign: 'right' }} className="fw-bold text-primary fs-5">
                                    {formatPrice(sub.price)}
                                </div>

                                <div style={{ width: '40px', textAlign: 'right' }}>
                                    <button 
                                        className="btn btn-link text-danger p-0" 
                                        onClick={() => handleDelete(sub.id)}
                                        title="Delete"
                                    >
                                        <FaTrash />
                                    </button>
                                </div>
                            </div>
                        ))}

                    </div>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
}

export default Subscriptions;