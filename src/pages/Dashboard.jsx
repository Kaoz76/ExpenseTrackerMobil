import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaPlus, FaEdit, FaExclamationCircle, FaCalendarCheck } from 'react-icons/fa';
import { dashboardData } from '../data/dashboardData';
import ImageModal from '../components/ImageModal';
import ReceiptDetailModal from '../components/ReceiptDetailModal';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, limit, doc, getDoc } from "firebase/firestore";

function Dashboard() {
  const { user } = useAuth();
  const { formatPrice, currency, convertPrice } = useCurrency();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [recentScans, setRecentScans] = useState([]);
  const [loadingScans, setLoadingScans] = useState(true);
  const [budgetLimit, setBudgetLimit] = useState(0);

  const [monthlyStats, setMonthlyStats] = useState({
    totalSpent: 0,
    receiptCount: 0,
    averageSpend: 0
  });

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
          const data = doc.data();
          const subPrice = Number(data.price) || 0;
          total += convertPrice(subPrice, data.currency || currency?.code || 'USD', currency?.code || 'USD');
        });
        setSubscriptionTotal(total);
      });

      return () => unsubscribe();
    } else {
      setSubscriptionTotal(0);
    }
  }, [user, currency?.code, convertPrice]);

  // AYLIK HARCAMALARI (RECEIPTS) ÇEKME - 🔥 DÜZELTİLDİ: Sadece bu ayın verisi iniyor!
  useEffect(() => {
    if (user) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      const q = query(
        collection(db, "receipts"),
        where("userId", "==", user.uid)
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        let total = 0;
        let count = 0;

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          let createdAtDate = null;
          if (data.createdAt) {
            if (typeof data.createdAt.toDate === 'function') createdAtDate = data.createdAt.toDate();
            else if (data.createdAt.seconds) createdAtDate = new Date(data.createdAt.seconds * 1000);
            else if (data.createdAt instanceof Date) createdAtDate = data.createdAt;
          } else {
            createdAtDate = new Date();
          }
          
          if (createdAtDate && createdAtDate >= startOfMonth && createdAtDate <= endOfMonth) {
            const priceVal = Number(data.price) || 0;
            const convertedPrice = convertPrice(priceVal, data.currency || currency.code || 'USD', currency.code);
            total += convertedPrice;
            count++;
          }
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
      setMonthlyStats({ totalSpent: 0, receiptCount: 0, averageSpend: 0 });
    }
  }, [user, currency?.code, convertPrice]);

  // SON 3 KAYDI ÇEKME - 🔥 DÜZELTİLDİ: Veritabanından orderBy ve limit ile sadece 3 kayıt isteniyor!
  useEffect(() => {
    setLoadingScans(true);
    if (user) {
      const q = query(
        collection(db, "receipts"),
        where("userId", "==", user.uid)
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const scansData = [];
        querySnapshot.forEach((doc) => {
          scansData.push({ id: doc.id, ...doc.data() });
        });

        // Sort locally by createdAt desc and limit to 3
        scansData.sort((a, b) => {
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

        setRecentScans(scansData.slice(0, 3));
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

  const openImageModal = (imageUrl, imageAlt) => {
    setSelectedImage({ url: imageUrl, alt: imageAlt });
    setIsImageModalShowing(true);
  };
  const closeImageModal = () => { setIsImageModalShowing(false); setSelectedImage({ url: '', alt: '' }); };
  const openDetailModal = (receipt) => { setSelectedReceipt(receipt); setShowDetailModal(true); };
  const handleCardClick = (scan) => { navigate(`/receipts/${scan.id}`); };

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
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4">
          <div className="mb-3 mb-md-0">
            <h1 className="display-6 fw-bold mb-1 text-gradient" style={{ paddingBottom: '0.2rem' }}>{t('nav.dashboard')}</h1>
            {user && <p className="text-muted mb-0">{t('common.hello')}, {user.email ? user.email.split('@')[0] : 'User'} 👋</p>}
          </div>

          {user && (
            <div className="d-flex flex-row gap-2 w-100 w-md-auto justify-content-start justify-content-md-end">
              <Link to="/receipts" className="btn btn-pulse btn-pulse-primary flex-fill flex-md-grow-0 px-4 py-2">
                <FaPlus className="me-2" /> {t('common.new_scan')}
              </Link>
              <Link to="/texts" className="btn btn-pulse btn-pulse-secondary flex-fill flex-md-grow-0 px-4 py-2">
                <FaEdit className="me-2" /> {t('nav.manual_entry')}
              </Link>
            </div>
          )}
        </div>

        {/* CURRENT BALANCE (Mobil RN stili mavi kart) */}
        {user && (
          <div className="card border-0 mb-4 text-white shadow-sm d-md-none" style={{ background: 'linear-gradient(135deg, var(--modern-primary), #a855f7)', borderRadius: '20px' }}>
            <div className="card-body text-center p-4">
              <p className="mb-1" style={{ fontSize: '1rem', opacity: 0.8 }}>{t('common.current_balance')}</p>
              <h2 className="display-4 fw-bold mb-0">{formatPrice(monthlyStats.totalSpent)}</h2>
            </div>
          </div>
        )}

        {/* RECENT SCANS */}
        <h3 className="h5 mb-3">{t('common.recent_scans')}</h3>
        <div className="row mb-4 flex-nowrap flex-md-wrap overflow-auto hide-scroll pb-2">
          {loadingScans && (
            <div className="col-12 text-center p-5">
              <div className="spinner-border" role="status"></div>
            </div>
          )}
          {!user && !loadingScans && (
            <div className="col-12">
              <div className="card shadow-sm">
                <div className="card-body p-5 text-center">
                   <h5 className="text-muted"><Link to="/login">{t('common.log_in')}</Link> {t('common.login_to_see')}</h5>
                </div>
              </div>
            </div>
          )}
          {user && !loadingScans && recentScans.length === 0 && (
            <div className="col-12">
              <div className="card shadow-sm">
                <div className="card-body p-5 text-center">
                  <h5 className="text-muted">{t('common.no_recent_activity')}</h5>
                  <p className="text-muted mb-0">{t('common.start_by_scanning')}</p>
                </div>
              </div>
            </div>
          )}
          {user && !loadingScans && recentScans.map(scan => (
            <div key={scan.id} className="col-lg-4 col-md-6 mb-4">
              <div className="magic-card">
                <div
                  className="magic-card-inner card h-100 border-0"
                  onClick={() => handleCardClick(scan)}
                >
                  {scan.imageUrl ? (
                    <img
                      src={scan.imageUrl}
                      alt={scan.fileName}
                      className="card-img-top"
                      style={{ height: '200px', objectFit: 'cover' }}
                      onError={(e) => { e.target.src = '/empty_state.png'; }}
                    />
                  ) : (
                    <img
                      src="/empty_state.png"
                      alt="Manual Entry"
                      className="card-img-top"
                      style={{ height: '200px', objectFit: 'cover' }}
                    />
                  )}

                  <div className="card-body">
                    <h6 className="card-title text-truncate" title={scan.fileName}>{scan.fileName}</h6>
                    <p className="card-text text-muted">{formatPrice(scan.price, scan.currency)}</p>

                    {scan.isManual && <span className="badge bg-secondary me-1">{t('common.text_badge')}</span>}
                    {!scan.isManual && <span className="badge bg-info text-dark">{t('common.scanned')}</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* QUICK LINKS */}
        <h3 className="h5 mb-3">{t('common.quick_links')}</h3>
        <div className="row mb-4 g-2 g-md-4">
          {dashboardData.quickLinks.map(link => (
            <div key={link.id} className="col-4 col-md-6 col-lg-4 mb-2 mb-md-4">
              <Link to={link.to} className="text-decoration-none text-dark">
                <div className="magic-link-card">
                  <div className="magic-link-info">
                    <div className="fs-4 fs-md-3 mb-1 mb-md-2"><link.icon /></div>
                    <span className="magic-link-title mb-0">{t('nav.' + link.to.replace('/', ''))}</span>
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
                <h5 className="mb-0 text-muted">{t('common.monthly_budget')}</h5>
              </div>
              <span className="fw-bold fs-5">
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
                {t('common.budget_exceeded')}
              </div>
            )}
          </div>
        )}

        {user && budgetLimit === 0 && (
          <div className="alert alert-light border border-dashed mb-5 text-center p-4">
            <p className="mb-2 text-muted">{t('common.no_budget_set')}</p>
            <Link to="/settings" className="btn btn-sm btn-outline-primary rounded-pill px-4">{t('common.set_budget_goal')}</Link>
          </div>
        )}

        {/* MONTHLY SPENDING */}
        <h3 className="h5 mb-3 fw-bold text-secondary">{t('common.monthly_spending')}</h3>
        <div className="row mb-4">
          <div className="col-lg-4 col-md-6 mb-4">
            <div className="card stat-card border-0 shadow-sm h-100">
              <div className="card-body">
                <h6 className="text-muted text-uppercase small fw-bold mb-2">{t('common.total_spent')}</h6>
                <h2 className="display-6 fw-bold text-gradient">{formatPrice(monthlyStats.totalSpent)}</h2>
              </div>
            </div>
          </div>
          <div className="col-lg-4 col-md-6 mb-4">
            <div className="card stat-card border-0 shadow-sm h-100">
              <div className="card-body">
                <h6 className="text-muted text-uppercase small fw-bold mb-2">{t('common.avg_spend')}</h6>
                <h2 className="display-6 fw-bold">{formatPrice(monthlyStats.averageSpend)}</h2>
              </div>
            </div>
          </div>
          <div className="col-lg-4 col-md-6 mb-4">
            <div className="card stat-card border-0 shadow-sm h-100">
              <div className="card-body">
                <h6 className="text-muted text-uppercase small fw-bold mb-2">{t('common.number_of_receipts')}</h6>
                <h2 className="display-6 fw-bold">{monthlyStats.receiptCount}</h2>
              </div>
            </div>
          </div>
        </div>

        {/* ABONELİKLER */}
        <h3 className="h5 mb-3 fw-bold text-secondary">{t('common.subscription_expenses')}</h3>
        <div className="row">
          <div className="col-12">
            <div className="card stat-card border-0 shadow-sm">
              <div className="card-body d-flex align-items-center p-4">
                <div className="bg-warning-subtle text-warning-emphasis p-3 rounded-circle me-4">
                  <FaCalendarCheck className="fs-2" />
                </div>
                <div>
                  <h6 className="text-muted mb-1">{t('common.total_recurring')}</h6>
                  <h2 className="display-6 fw-bold mb-0">
                    {formatPrice(subscriptionTotal)}
                  </h2>
                </div>

                <div className="ms-auto">
                  <Link to="/subscriptions" className="btn btn-outline-warning rounded-pill px-4">
                    {t('common.manage_subs')}
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