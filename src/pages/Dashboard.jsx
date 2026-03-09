import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaPlus, FaEdit, FaExclamationCircle, FaCalendarCheck } from 'react-icons/fa';
import { dashboardData } from '../data/dashboardData'; 
import ImageModal from '../components/ImageModal';
import ReceiptDetailModal from '../components/ReceiptDetailModal'; 
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext'; 
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, limit, doc, getDoc } from "firebase/firestore";

function Dashboard() {
  const { user } = useAuth();
  const { formatPrice } = useCurrency(); 
  
  // STATE'LER
  const [recentScans, setRecentScans] = useState([]);
  const [loadingScans, setLoadingScans] = useState(true);
  const [budgetLimit, setBudgetLimit] = useState(0);

  // Değişken Harcamalar (Fişler ve Manuel Girişler)
  const [monthlyStats, setMonthlyStats] = useState({
    totalSpent: 0,
    receiptCount: 0,
    averageSpend: 0
  });

  // Sabit Giderler (Abonelikler)
  const [subscriptionTotal, setSubscriptionTotal] = useState(0);

  const [isImageModalShowing, setIsImageModalShowing] = useState(false);
  const [selectedImage, setSelectedImage] = useState({ url: '', alt: '' });
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  // KULLANICI BÜTÇESİNİ ÇEKME
  useEffect(() => {
    if (user) {
      const fetchBudget = async () => {
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data().budgetLimit) {
            setBudgetLimit(Number(docSnap.data().budgetLimit));
          } else {
            setBudgetLimit(0);
          }
        } catch (error) {
          console.error("Error fetching budget:", error);
        }
      };
      fetchBudget();
    }
  }, [user]);

  // ABONELİKLERİ ÇEKME
  useEffect(() => {
    if (user) {
      const q = query(
        collection(db, "subscriptions"),
        where("userId", "==", user.uid)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        let total = 0;
        snapshot.forEach((doc) => {
          total += Number(doc.data().price) || 0;
        });
        setSubscriptionTotal(total);
      });

      return () => unsubscribe();
    } else {
      setSubscriptionTotal(0);
    }
  }, [user]);

  // AYLIK HARCAMALARI (RECEIPTS) ÇEKME
  useEffect(() => {
    if (user) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      const q = query(
        collection(db, "receipts"),
        where("userId", "==", user.uid),
        where("createdAt", ">=", startOfMonth),
        where("createdAt", "<=", endOfMonth)
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        let total = 0;
        let count = 0;

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          total += Number(data.price) || 0;
          count++;
        });

        setMonthlyStats({
          totalSpent: total,
          receiptCount: count,
          averageSpend: count > 0 ? total / count : 0
        });

      }, (error) => {
        console.error("Error calculating monthly stats:", error);
      });

      return () => unsubscribe();
    } else {
      setMonthlyStats({
        totalSpent: 0,
        receiptCount: 0,
        averageSpend: 0
      });
    }
  }, [user]);

  // SON 3 KAYDI ÇEKME
  useEffect(() => {
    setLoadingScans(true);
    if (user) {
      const q = query(
        collection(db, "receipts"), 
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(3) 
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const scansData = [];
        querySnapshot.forEach((doc) => {
          scansData.push({ id: doc.id, ...doc.data() });
        });
        setRecentScans(scansData);
        setLoadingScans(false);
      }, (error) => { 
        console.error("Error fetching recent scans: ", error);
        setLoadingScans(false);
      });

      return () => unsubscribe();
    } else {
      setRecentScans([]);
      setLoadingScans(false);
    }
  }, [user]);

  // Modal Fonksiyonları
  const openImageModal = (imageUrl, imageAlt) => {
    setSelectedImage({ url: imageUrl, alt: imageAlt });
    setIsImageModalShowing(true);
  };
  const closeImageModal = () => { setIsImageModalShowing(false); setSelectedImage({ url: '', alt: '' }); };
  const openDetailModal = (receipt) => { setSelectedReceipt(receipt); setShowDetailModal(true); };
  const handleCardClick = (scan) => { if (scan.isManual) { openDetailModal(scan); } else { openImageModal(scan.imageUrl, scan.fileName); } };
  
  // BÜTÇE HESAPLAMA
  // Gerçek Toplam = Değişken Harcamalar + Sabit Abonelikler
  const grandTotal = monthlyStats.totalSpent + subscriptionTotal;

  const calculateProgress = () => {
    if (budgetLimit <= 0) return 0;
    const percentage = (grandTotal / budgetLimit) * 100;
    return Math.min(percentage, 100); 
  };

  const getProgressColor = () => {
    const p = calculateProgress();
    if (p < 50) return 'bg-success'; 
    if (p < 85) return 'bg-warning'; 
    return 'bg-danger'; 
  };
  
  return (
    <div className="dashboard-page-wrapper p-4">
      
      <div className={`dashboard-content-wrapper ${isImageModalShowing || showDetailModal ? 'content-blurred' : ''}`} style={{ transition: 'filter 0.3s ease-in-out' }}>
        
        {/* BAŞLIK */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1 className="display-6 fw-bold">Dashboard</h1>
          <div className="d-flex flex-column flex-sm-row gap-2">
             <Link to="/receipts" className="btn btn-pulse btn-pulse-primary px-4 py-2">
                <FaPlus className="me-2" /> New Scan
             </Link>
             <Link to="/texts" className="btn btn-pulse btn-pulse-secondary px-4 py-2">
                <FaEdit className="me-2" /> New Text
             </Link>
          </div>
        </div>

        {/* RECENT SCANS */}
        <h3 className="h5 mb-3">Recent Scans</h3>
        <div className="row mb-4">
          {loadingScans && (
            <div className="col-12 text-center p-5">
              <div className="spinner-border" role="status"></div>
            </div>
          )}
          {!user && !loadingScans && (
            <div className="col-12">
              <div className="card shadow-sm">
                <div className="card-body p-5 text-center">
                  <h5 className="text-muted"><Link to="/login">Log in</Link> to see your data.</h5>
                </div>
              </div>
            </div>
          )}
          {user && !loadingScans && recentScans.length === 0 && (
             <div className="col-12">
              <div className="card shadow-sm">
                <div className="card-body p-5 text-center">
                  <h5 className="text-muted">No recent activity found.</h5>
                  <p className="text-muted mb-0">Start by scanning a receipt or entering an expense manually.</p>
                </div>
              </div>
            </div>
          )}
          {user && !loadingScans && recentScans.map(scan => (
            <div key={scan.id} className="col-lg-4 col-md-6 mb-4">
              
              {/* KART YAPISI (Magic Card) */}
              <div className="magic-card">
                <div 
                  className="magic-card-inner card h-100 border-0" 
                  onClick={() => handleCardClick(scan)}
                >
                  {/* Resim varsa göster, yoksa ikon göster */}
                  {scan.imageUrl ? (
                      // Scanned Receipt (Storage'dan gelen resim)
                      <img 
                        src={scan.imageUrl} 
                        alt={scan.fileName} 
                        className="card-img-top" 
                        style={{ height: '200px', objectFit: 'cover' }} 
                        onError={(e) => { e.target.src = 'https://placehold.co/600x400?text=No+Image'; }}
                      />
                  ) : (
                      // Manual Text (public klasöründeki text-img.png)
                      <img 
                        src="/text-img.png" 
                        alt="Manual Entry"
                        className="card-img-top" 
                        style={{ height: '200px', objectFit: 'cover' }} 
                      />
                  )}
                  
                  <div className="card-body">
                    <h6 className="card-title text-truncate" title={scan.fileName}>{scan.fileName}</h6>
                    <p className="card-text text-muted">{formatPrice(scan.price)}</p>
                    
                    {scan.isManual && <span className="badge bg-secondary me-1">Text</span>}
                    {!scan.isManual && <span className="badge bg-info text-dark">Scanned</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* QUICK LINKS */}
        <h3 className="h5 mb-3">Quick Links</h3>
        <div className="row mb-4">
          {dashboardData.quickLinks.map(link => (
            <div key={link.id} className="col-lg-4 col-md-6 mb-4">
              <Link to={link.to} className="text-decoration-none text-dark">
                <div className="magic-link-card">
                  <div className="magic-link-info">
                    <div className="fs-3 mb-2"><link.icon /></div>
                    <span className="magic-link-title mb-0">{link.title}</span>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>

        {/* BÜTÇE DURUMU */}
        {budgetLimit > 0 && (
          <div className="mb-5">
            <div className="d-flex justify-content-between align-items-end mb-2">
                <div>
                  <h5 className="mb-0 text-muted">Monthly Budget</h5>
                </div>
                <span className="fw-bold fs-5">
                    {/* Grand Total */}
                    {formatPrice(grandTotal)} / {formatPrice(budgetLimit)}
                </span>
            </div>
            
            <div className="progress" style={{ height: '25px', borderRadius: '15px', backgroundColor: 'var(--bs-tertiary-bg)' }}>
                <div 
                    className={`progress-bar progress-bar-striped progress-bar-animated ${getProgressColor()}`} 
                    role="progressbar" 
                    style={{ width: `${calculateProgress()}%` }} 
                >
                    {calculateProgress().toFixed(0)}%
                </div>
            </div>
            
            {grandTotal > budgetLimit && (
                <div className="mt-2 text-danger d-flex align-items-center small fw-bold">
                    <FaExclamationCircle className="me-1" />
                    You have exceeded your monthly budget!
                </div>
            )}
          </div>
        )}
        
        {user && budgetLimit === 0 && (
            <div className="alert alert-light border border-dashed mb-5 text-center p-4">
                <p className="mb-2 text-muted">You haven't set a monthly budget yet.</p>
                <Link to="/settings" className="btn btn-sm btn-outline-primary rounded-pill px-4">Set Budget Goal</Link>
            </div>
        )}

        {/* MONTHLY SPENDING */}
        <h3 className="h5 mb-3">Monthly Spending</h3>
        <div className="row mb-4">
          <div className="col-lg-4 col-md-6 mb-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <h6 className="text-muted">Total Spent</h6>
                <h2 className="display-6 fw-bold text-primary">{formatPrice(monthlyStats.totalSpent)}</h2>
              </div>
            </div>
          </div>
          <div className="col-lg-4 col-md-6 mb-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <h6 className="text-muted">Average Spend per Receipt</h6>
                <h2 className="display-6 fw-bold">{formatPrice(monthlyStats.averageSpend)}</h2>
              </div>
            </div>
          </div>
          <div className="col-lg-4 col-md-6 mb-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <h6 className="text-muted">Number of Receipts</h6>
                <h2 className="display-6 fw-bold">{monthlyStats.receiptCount}</h2>
              </div>
            </div>
          </div>
        </div>

        {/* ABONELİKLER */}
        <h3 className="h5 mb-3">Subscription Expenses</h3>
        <div className="row">
           <div className="col-12">
              <div className="card border-0 shadow-sm">
                 <div className="card-body d-flex align-items-center p-4">
                    <div className="bg-warning-subtle text-warning-emphasis p-3 rounded-circle me-4">
                       <FaCalendarCheck className="fs-2" />
                    </div>
                    <div>
                       <h6 className="text-muted mb-1">Total Recurring Subscriptions</h6>
                       <h2 className="display-6 fw-bold text-dark mb-0">
                          {formatPrice(subscriptionTotal)}
                       </h2>
                    </div>
                    
                    <div className="ms-auto">
                       <Link to="/subscriptions" className="btn btn-outline-warning rounded-pill px-4">
                          Manage Subs
                       </Link>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div> 

      {/* Modallar */}
      <ImageModal
        isShowing={isImageModalShowing}
        onClose={closeImageModal}
        imageUrl={selectedImage.url}
        imageAlt={selectedImage.alt}
      />
      <ReceiptDetailModal 
        show={showDetailModal} 
        onClose={() => setShowDetailModal(false)} 
        receipt={selectedReceipt} 
      />
    </div>
  );
}

export default Dashboard;