import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FaCamera, FaChartLine, FaSync, FaArrowRight, FaReceipt, FaMoneyBillWave, FaCalendarCheck, FaSearch, FaClipboardList } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { parseDate } from '../utils/dateFormatter';

// Scroll animasyonu için custom hook
function useScrollReveal() {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.15 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return [ref, isVisible];
}

// Animasyonlu sayaç
function AnimatedCounter({ target, duration = 1200 }) {
  const [count, setCount] = useState(0);
  const [ref, isVisible] = useScrollReveal();

  useEffect(() => {
    if (!isVisible || target === 0) return;

    let start = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [isVisible, target, duration]);

  return <span ref={ref}>{count}</span>;
}

// Scroll reveal wrapper component
function RevealSection({ children, className = '', delay = 0 }) {
  const [ref, isVisible] = useScrollReveal();

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(40px)',
        transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`
      }}
    >
      {children}
    </div>
  );
}

function Landing() {
  const { user } = useAuth();
  const { formatPrice, currency, convertPrice } = useCurrency();
  const { t } = useLanguage();

  // Canlı istatistikler (sadece giriş yapmış kullanıcılar için)
  const [stats, setStats] = useState({ totalSpent: 0, receiptCount: 0, subscriptionCount: 0 });

  const convertPriceRef = useRef(convertPrice);
  const currencyCodeRef = useRef(currency?.code);

  useEffect(() => {
    convertPriceRef.current = convertPrice;
    currencyCodeRef.current = currency?.code;
  }, [convertPrice, currency?.code]);

  useEffect(() => {
    if (!user) return;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Fişler
    const qReceipts = query(
      collection(db, "receipts"),
      where("userId", "==", user.uid)
    );

    const unsubReceipts = onSnapshot(qReceipts, (snapshot) => {
      let total = 0;
      let count = 0;
      snapshot.forEach((doc) => {
        const data = doc.data();
        const createdAtDate = data.createdAt ? parseDate(data.createdAt) : null;
        if (createdAtDate && createdAtDate >= startOfMonth && createdAtDate <= endOfMonth) {
          const rawPrice = Number(data.price) || 0;
          const currentCode = currencyCodeRef.current || 'USD';
          total += convertPriceRef.current(rawPrice, data.currency || currentCode, currentCode);
          count++;
        }
      });
      setStats(prev => ({ ...prev, totalSpent: total, receiptCount: count }));
    });

    // Abonelikler
    const qSubs = query(
      collection(db, "subscriptions"),
      where("userId", "==", user.uid)
    );

    const unsubSubs = onSnapshot(qSubs, (snapshot) => {
      setStats(prev => ({ ...prev, subscriptionCount: snapshot.size }));
    });

    return () => {
      unsubReceipts();
      unsubSubs();
    };
  }, [user]);

  return (
    <div className="dashboard-page-wrapper">

      {/* ════════════════════════════════════════
          HERO SECTION
          ════════════════════════════════════════ */}
      <div className="container py-5 text-center">
        <div className="row justify-content-center mt-4">
          <div className="col-md-10 col-lg-8">
            <RevealSection>
              <h1 className="display-4 fw-bold mb-4">
                {t('common.landing_hero_title_1')} <br className="d-none d-md-block" />
                <span className="text-gradient">{t('common.landing_hero_title_2')}</span>
              </h1>
              <p className="lead text-muted mb-5 px-md-4">
                {t('common.landing_hero_desc')}
              </p>
              <div className="d-flex flex-column flex-sm-row justify-content-center gap-3">
                {user ? (
                  <>
                    <Link to="/receipts" className="btn btn-primary btn-lg rounded-pill px-5 fw-bold shadow-sm d-flex align-items-center justify-content-center btn-pulse btn-pulse-primary">
                      <FaCamera className="me-2" /> {t('common.landing_scan_receipt')}
                    </Link>
                    <Link to="/texts" className="btn btn-outline-secondary btn-lg rounded-pill px-5 fw-bold d-flex align-items-center justify-content-center">
                      {t('common.landing_add_manual')}
                    </Link>
                  </>
                ) : (
                  <>
                    <Link to="/signup" className="btn btn-primary btn-lg rounded-pill px-5 fw-bold shadow-sm d-flex align-items-center justify-content-center btn-pulse btn-pulse-primary">
                      {t('common.landing_get_started')} <FaArrowRight className="ms-2" />
                    </Link>
                    <Link to="/login" className="btn btn-outline-secondary btn-lg rounded-pill px-5 fw-bold d-flex align-items-center justify-content-center">
                      {t('common.landing_login')}
                    </Link>
                  </>
                )}
              </div>
            </RevealSection>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════
          CANLI İSTATİSTİKLER (Giriş yapılmışsa)
          ════════════════════════════════════════ */}
      {user && (
        <RevealSection className="container mb-3" delay={0.1}>
          <div className="row g-3 justify-content-center">
            <div className="col-md-4">
              <div className="card border-0 shadow-sm h-100 text-center p-4" style={{ borderRadius: '20px' }}>
                <div className="mx-auto bg-primary-subtle text-primary rounded-circle p-3 mb-3 d-flex align-items-center justify-content-center" style={{ width: '60px', height: '60px' }}>
                  <FaMoneyBillWave className="fs-4" />
                </div>
                <h3 className="fw-bold text-gradient mb-1">{formatPrice(stats.totalSpent)}</h3>
                <p className="text-muted small mb-0">{t('common.landing_spent_this_month')}</p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card border-0 shadow-sm h-100 text-center p-4" style={{ borderRadius: '20px' }}>
                <div className="mx-auto bg-info-subtle text-info-emphasis rounded-circle p-3 mb-3 d-flex align-items-center justify-content-center" style={{ width: '60px', height: '60px' }}>
                  <FaReceipt className="fs-4" />
                </div>
                <h3 className="fw-bold mb-1"><AnimatedCounter target={stats.receiptCount} /></h3>
                <p className="text-muted small mb-0">{t('common.landing_receipts_this_month')}</p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card border-0 shadow-sm h-100 text-center p-4" style={{ borderRadius: '20px' }}>
                <div className="mx-auto bg-warning-subtle text-warning-emphasis rounded-circle p-3 mb-3 d-flex align-items-center justify-content-center" style={{ width: '60px', height: '60px' }}>
                  <FaCalendarCheck className="fs-4" />
                </div>
                <h3 className="fw-bold mb-1"><AnimatedCounter target={stats.subscriptionCount} /></h3>
                <p className="text-muted small mb-0">{t('common.landing_active_subscriptions')}</p>
              </div>
            </div>
          </div>
        </RevealSection>
      )}

      {/* ════════════════════════════════════════
          HOW IT WORKS
          ════════════════════════════════════════ */}
      <RevealSection className="container py-5 mt-2" delay={0.1}>
        <h2 className="text-center fw-bold mb-2">{t('common.landing_how_it_works')}</h2>
        <p className="text-center text-muted mb-5">{t('common.landing_how_subtitle')}</p>

        <div className="row g-4 align-items-start">
          {/* Step 1 */}
          <div className="col-md-4 text-center">
            <div className="position-relative d-inline-flex align-items-center justify-content-center mb-4"
              style={{
                width: '90px', height: '90px', borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--modern-primary), #a855f7)',
                boxShadow: '0 8px 25px rgba(99, 102, 241, 0.3)'
              }}>
              <FaCamera className="text-white fs-2" />
              <span className="position-absolute top-0 start-0 badge rounded-pill bg-dark"
                style={{ fontSize: '0.7rem', transform: 'translate(-25%, -25%)' }}>1</span>
            </div>
            <h5 className="fw-bold mb-2">{t('common.landing_step1_title')}</h5>
            <p className="text-muted small px-3">
              {t('common.landing_step1_desc')}
            </p>
          </div>

          {/* Step 2 */}
          <div className="col-md-4 text-center">
            <div className="position-relative d-inline-flex align-items-center justify-content-center mb-4"
              style={{
                width: '90px', height: '90px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #0ea5e9, #06b6d4)',
                boxShadow: '0 8px 25px rgba(14, 165, 233, 0.3)'
              }}>
              <FaSearch className="text-white fs-2" />
              <span className="position-absolute top-0 start-0 badge rounded-pill bg-dark"
                style={{ fontSize: '0.7rem', transform: 'translate(-25%, -25%)' }}>2</span>
            </div>
            <h5 className="fw-bold mb-2">{t('common.landing_step2_title')}</h5>
            <p className="text-muted small px-3">
              {t('common.landing_step2_desc')}
            </p>
          </div>

          {/* Step 3 */}
          <div className="col-md-4 text-center">
            <div className="position-relative d-inline-flex align-items-center justify-content-center mb-4"
              style={{
                width: '90px', height: '90px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                boxShadow: '0 8px 25px rgba(245, 158, 11, 0.3)'
              }}>
              <FaChartLine className="text-white fs-2" />
              <span className="position-absolute top-0 start-0 badge rounded-pill bg-dark"
                style={{ fontSize: '0.7rem', transform: 'translate(-25%, -25%)' }}>3</span>
            </div>
            <h5 className="fw-bold mb-2">{t('common.landing_step3_title')}</h5>
            <p className="text-muted small px-3">
              {t('common.landing_step3_desc')}
            </p>
          </div>
        </div>
      </RevealSection>

      {/* ════════════════════════════════════════
          FEATURES SECTION
          ════════════════════════════════════════ */}
      <div className="container py-5">
        <RevealSection>
          <h2 className="text-center fw-bold mb-2">{t('common.landing_why_choose')}</h2>
          <p className="text-center text-muted mb-5">{t('common.landing_why_subtitle')}</p>
        </RevealSection>

        <div className="row g-4">
          <RevealSection className="col-md-6 col-lg-4" delay={0}>
            <div className="magic-card">
              <div className="magic-card-inner p-4 text-center d-flex flex-column align-items-center h-100">
                <div className="bg-primary-subtle text-primary rounded-circle p-3 mb-4 d-flex align-items-center justify-content-center" style={{ width: '70px', height: '70px' }}>
                  <FaCamera className="fs-3" />
                </div>
                <h5 className="fw-bold mb-3">{t('common.landing_feature1_title')}</h5>
                <p className="text-muted small mb-0">
                  {t('common.landing_feature1_desc')}
                </p>
              </div>
            </div>
          </RevealSection>

          <RevealSection className="col-md-6 col-lg-4" delay={0.15}>
            <div className="magic-card">
              <div className="magic-card-inner p-4 text-center d-flex flex-column align-items-center h-100">
                <div className="bg-info-subtle text-info-emphasis rounded-circle p-3 mb-4 d-flex align-items-center justify-content-center" style={{ width: '70px', height: '70px' }}>
                  <FaChartLine className="fs-3" />
                </div>
                <h5 className="fw-bold mb-3">{t('common.landing_feature2_title')}</h5>
                <p className="text-muted small mb-0">
                  {t('common.landing_feature2_desc')}
                </p>
              </div>
            </div>
          </RevealSection>

          <RevealSection className="col-md-6 col-lg-4" delay={0.3}>
            <div className="magic-card">
              <div className="magic-card-inner p-4 text-center d-flex flex-column align-items-center h-100">
                <div className="bg-warning-subtle text-warning-emphasis rounded-circle p-3 mb-4 d-flex align-items-center justify-content-center" style={{ width: '70px', height: '70px' }}>
                  <FaSync className="fs-3" />
                </div>
                <h5 className="fw-bold mb-3">{t('common.landing_feature3_title')}</h5>
                <p className="text-muted small mb-0">
                  {t('common.landing_feature3_desc')}
                </p>
              </div>
            </div>
          </RevealSection>
        </div>
      </div>

      {/* ════════════════════════════════════════
          FOOTER
          ════════════════════════════════════════ */}
      <RevealSection delay={0.1}>
        <footer className="border-top mt-5" style={{ backgroundColor: 'var(--bs-tertiary-bg)' }}>
          <div className="container py-4 text-center">
            <p className="text-muted mb-0" style={{ fontSize: '0.95rem' }}>
              <span style={{ color: 'var(--modern-primary)' }}>2026 </span>
              <span className="fw-bold" style={{ color: 'var(--modern-primary)' }}>Expense Tracker</span> © {t('common.landing_footer_rights')}
            </p>
          </div>
        </footer>
      </RevealSection>

    </div>
  );
}

export default Landing;
