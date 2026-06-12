import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaPlus, FaEdit, FaExclamationCircle, FaCalendarCheck, FaArrowUp, FaArrowDown } from 'react-icons/fa';
import { dashboardData } from '../data/dashboardData';
import ImageModal from '../components/ImageModal';

import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, orderBy, limit } from "firebase/firestore";

// Daha akıcı bir deneyim için resim yükleme sarmalayıcı bileşeni
const DashboardImage = ({ src, alt }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div style={{ position: 'relative', height: '200px', width: '100%', backgroundColor: 'var(--bs-tertiary-bg)' }}>
      {!loaded && !error && (
        <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center placeholder-glow">
          <span className="placeholder w-100 h-100"></span>
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className="card-img-top"
        onLoad={() => setLoaded(true)}
        onError={(e) => {
          setError(true);
          setLoaded(true);
          e.target.src = '/empty_state.png';
        }}
        style={{
          height: '200px',
          objectFit: 'cover',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.3s ease-in-out',
          position: 'relative',
          zIndex: 1
        }}
      />
    </div>
  );
};

function Dashboard() {
  const { user } = useAuth();
  const { formatPrice, currency, convertPrice } = useCurrency();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [recentScans, setRecentScans] = useState([]);
  const [loadingScans, setLoadingScans] = useState(true);
  const [budgetLimit, setBudgetLimit] = useState(0);

  // Ham Firestore verisi - döviz dönüşümü dinleyicide değil, useMemo'da yapılır
  const [currentMonthRawReceipts, setCurrentMonthRawReceipts] = useState([]);
  const [lastMonthRawReceipts, setLastMonthRawReceipts] = useState([]);
  const [rawSubscriptions, setRawSubscriptions] = useState([]);

  const [isImageModalShowing, setIsImageModalShowing] = useState(false);
  const [selectedImage, setSelectedImage] = useState({ url: '', alt: '' });


  // Kullanıcı bütçesini getir
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

  // Abonelikleri getir
  useEffect(() => {
    if (user) {
      const q = query(
        collection(db, "subscriptions"),
        where("userId", "==", user.uid)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        setRawSubscriptions(snapshot.docs.map(d => d.data()));
      });

      return () => unsubscribe();
    } else {
      setRawSubscriptions([]);
    }
  }, [user]);

  // Aylık harcamaları getir (Sadece bu ayın fişleri)
  useEffect(() => {
    if (!user) {
      setCurrentMonthRawReceipts([]);
      return;
    }
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const q = query(
      collection(db, "receipts"),
      where("userId", "==", user.uid),
      where("createdAt", ">=", startOfMonth),
      where("createdAt", "<=", endOfMonth),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCurrentMonthRawReceipts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Error fetching current month receipts:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Geçmiş ay harcamaları (Trend karşılaştırması için tek seferlik)
  useEffect(() => {
    if (!user) {
      setLastMonthRawReceipts([]);
      return;
    }
    const now = new Date();
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const q = query(
      collection(db, "receipts"),
      where("userId", "==", user.uid),
      where("createdAt", ">=", startOfLastMonth),
      where("createdAt", "<=", endOfLastMonth),
      orderBy("createdAt", "desc")
    );

    getDocs(q).then((snapshot) => {
      setLastMonthRawReceipts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }).catch(err => console.error("Error fetching last month receipts:", err));
  }, [user]);

  // Son 3 kayıt (Gösterge paneli kartları için gerçek zamanlı)
  useEffect(() => {
    if (!user) {
      setRecentScans([]);
      setLoadingScans(false);
      return;
    }
    setLoadingScans(true);

    const q = query(
      collection(db, "receipts"),
      where("userId", "==", user.uid),
      where("isManual", "==", false),
      orderBy("createdAt", "desc"),
      limit(3)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecentScans(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingScans(false);
    }, (error) => {
      console.error("Error fetching recent scans:", error);
      setLoadingScans(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Hesaplanan değerler (Döviz kuru değiştiğinde sadece hesaplama yenilenir)
  const subscriptionTotal = useMemo(() => {
    return rawSubscriptions.reduce((acc, data) => {
      const subPrice = Number(data.price) || 0;
      return acc + convertPrice(subPrice, data.currency || currency?.code || 'USD', currency?.code || 'USD');
    }, 0);
  }, [rawSubscriptions, convertPrice, currency?.code]);

  const monthlyStats = useMemo(() => {
    let total = 0;
    currentMonthRawReceipts.forEach(data => {
      const priceVal = Number(data.price) || 0;
      total += convertPrice(priceVal, data.currency || currency?.code || 'USD', currency?.code || 'USD');
    });
    const count = currentMonthRawReceipts.length;
    return {
      totalSpent: total,
      receiptCount: count,
      averageSpend: count > 0 ? total / count : 0
    };
  }, [currentMonthRawReceipts, convertPrice, currency?.code]);

  const lastMonthStats = useMemo(() => {
    let total = 0;
    lastMonthRawReceipts.forEach(data => {
      const priceVal = Number(data.price) || 0;
      total += convertPrice(priceVal, data.currency || currency?.code || 'USD', currency?.code || 'USD');
    });
    return { totalSpent: total };
  }, [lastMonthRawReceipts, convertPrice, currency?.code]);

  const closeImageModal = () => { setIsImageModalShowing(false); setSelectedImage({ url: '', alt: '' }); };
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

  const renderTrend = () => {
    if (lastMonthStats.totalSpent === 0) return null;
    const diff = monthlyStats.totalSpent - lastMonthStats.totalSpent;
    const percentage = ((Math.abs(diff) / lastMonthStats.totalSpent) * 100).toFixed(1);

    if (diff > 0) {
      return (
        <span className="badge bg-danger bg-opacity-10 text-danger ms-2 px-2 py-1 border border-danger-subtle rounded-pill">
          <FaArrowUp className="me-1 small" /> {percentage}%
        </span>
      );
    } else if (diff < 0) {
      return (
        <span className="badge bg-success bg-opacity-10 text-success ms-2 px-2 py-1 border border-success-subtle rounded-pill">
          <FaArrowDown className="me-1 small" /> {percentage}%
        </span>
      );
    }
    return null;
  };

  return (
    <div className="dashboard-page-wrapper p-4">

      <div className={`dashboard-content-wrapper ${isImageModalShowing ? 'content-blurred' : ''}`} style={{ transition: 'filter 0.3s ease-in-out' }}>

        {/* Başlık */}
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4">
          <div className="mb-3 mb-md-0">
            <h1 className="display-6 fw-bold mb-1 text-gradient text-nowrap" style={{ paddingBottom: '0.2rem' }}>{t('nav.dashboard')}</h1>
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

        {/* Mevcut Bakiye (Mobil mavi kart) */}
        {user && (
          <div className="card border-0 mb-4 text-white shadow-sm d-md-none" style={{ background: 'linear-gradient(135deg, var(--modern-primary), #a855f7)', borderRadius: '20px' }}>
            <div className="card-body text-center p-4">
              <p className="mb-1" style={{ fontSize: '1rem', opacity: 0.8 }}>{t('common.current_balance')}</p>
              <h2 className="display-4 fw-bold mb-0">{formatPrice(monthlyStats.totalSpent)}</h2>
            </div>
          </div>
        )}

        {/* Son Taramalar */}
        <h3 className="h5 mb-3">{t('common.recent_scans')}</h3>
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
          {user && !loadingScans && recentScans.map((scan, index) => (
            <div key={scan.id} className={`col-6 col-md-4 mb-4 ${index >= 2 ? 'd-none d-md-block' : ''}`}>
              <div className="magic-card h-100">
                <div
                  className="magic-card-inner card h-100 border-0"
                  onClick={() => handleCardClick(scan)}
                >
                  {scan.imageUrl ? (
                    <DashboardImage src={scan.imageUrl} alt={scan.fileName} />
                  ) : (
                    <img
                      src="/empty_state.png"
                      alt="Manual Entry"
                      className="card-img-top"
                      style={{ height: '200px', objectFit: 'cover' }}
                    />
                  )}

                  <div className="card-body p-2 p-sm-3">
                    <h6 className="card-title text-truncate fw-bold mb-1" style={{ fontSize: '0.85rem' }} title={scan.fileName}>{scan.fileName}</h6>
                    <p className="card-text text-muted mb-2" style={{ fontSize: '0.8rem' }}>{formatPrice(scan.price, scan.currency)}</p>

                    <div className="mt-auto">
                      {scan.isManual && <span className="badge bg-secondary me-1" style={{ fontSize: '0.65rem' }}>{t('common.text_badge')}</span>}
                      {!scan.isManual && <span className="badge bg-info text-dark" style={{ fontSize: '0.65rem' }}>{t('common.scanned')}</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Hızlı Bağlantılar (Sadece Mobil) */}
        <div className="d-md-none">
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
        </div>

        {/* Bütçe Durumu */}
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

        {/* Aylık Harcama */}
        <h3 className="h5 mb-3 fw-bold text-secondary">{t('common.monthly_spending')}</h3>
        <div className="row mb-4">
          <div className="col-lg-4 col-md-6 mb-4">
            <div className="card stat-card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <h6 className="text-muted text-uppercase small fw-bold mb-0">{t('common.total_spent')}</h6>
                  {renderTrend()}
                </div>
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

        {/* Abonelikler */}
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

    </div>
  );
}

export default Dashboard;