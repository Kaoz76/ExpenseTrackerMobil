import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCurrency, CURRENCY_MAP } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { FaPlus, FaTrash, FaCalendarCheck, FaExclamationTriangle, FaSync } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

function Subscriptions() {
  const { user } = useAuth();
  const { formatPrice, currency, favoriteCurrencies, convertPrice } = useCurrency();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [subscriptions, setSubscriptions] = useState([]);

  // Form State'leri
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState('');

  // Bağlam para birimi yüklendiğinde başlangıç para birimini ayarla
  useEffect(() => {
    if (currency?.code && !selectedCurrency) {
      setSelectedCurrency(currency.code);
    }
  }, [currency, selectedCurrency]);

  // VERİ ÇEKME
  useEffect(() => {
    setLoading(true);

    if (user) {
      const q = query(
        collection(db, "subscriptions"),
        where("userId", "==", user.uid)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const subsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Firebase Composite Index hatasından kaçınmak için lokal sıralama
        subsData.sort((a, b) => {
          const dayA = Number(a.dayOfMonth) || 0;
          const dayB = Number(b.dayOfMonth) || 0;
          return dayA - dayB;
        });

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
    if (!name || !price || !dayOfMonth || !user) return;

    // 🔥 DÜZELTME 1: Negatif fiyat girişini engelle (Güvenlik)
    const priceValue = parseFloat(price);
    if (priceValue <= 0) {
      alert(t('common.price_greater_zero'));
      return;
    }

    // Day of Month Validation (between 1 and 31)
    const dayValue = parseInt(dayOfMonth, 10);
    if (isNaN(dayValue) || dayValue < 1 || dayValue > 31) {
      alert(t('common.msg_day_invalid'));
      return;
    }

    setAdding(true);
    try {
      const docRef = await addDoc(collection(db, "subscriptions"), {
        userId: user.uid,
        name: name.trim(), // Boşlukları temizle
        price: priceValue,
        currency: selectedCurrency || currency?.code || 'USD',
        dayOfMonth: parseInt(dayOfMonth),
        startDate: startDate,
        endDate: endDate || null,
        createdAt: Timestamp.now()
      });

      // Bitiş tarihinden 3 gün önceye bildirim planla
      if (endDate && Capacitor.isNativePlatform()) {
        try {
          // Push notification izni iste (sadece ilk seferde çalışır)
          await LocalNotifications.requestPermissions();
          
          const endObj = new Date(endDate);
          // 3 gün öncesi sabah 10:00'a planla
          const notifDate = new Date(endObj.getFullYear(), endObj.getMonth(), endObj.getDate() - 3, 10, 0, 0);
          
          // Eğer 3 gün öncesi geçmişte değilse
          if (notifDate > new Date()) {
            await LocalNotifications.schedule({
              notifications: [
                {
                  title: t('common.expiring_soon') || "Subscription Expiring Soon!",
                  body: t('common.sub_expiring_desc', { name: name.trim(), date: endObj.toLocaleDateString() }) || `Your ${name.trim()} subscription ends on ${endObj.toLocaleDateString()}.`,
                  id: Math.floor(Math.random() * 100000) + 1, // Rastgele ID
                  schedule: { at: notifDate },
                  extra: { subId: docRef.id }
                }
              ]
            });
          }
        } catch (e) {
          console.warn("LocalNotifications not available or permission denied", e);
        }
      }

      setName('');
      setPrice('');
      setDayOfMonth('1');
      setStartDate(new Date().toISOString().split('T')[0]);
      setEndDate('');
    } catch (error) {
      console.error("Error adding subscription:", error);
      alert(t('common.failed_to_add'));
    } finally {
      setAdding(false);
    }
  };

  // SİLME
  const handleDelete = async (id) => {
    if (!window.confirm(t('common.confirm_delete_sub'))) return;
    try {
      await deleteDoc(doc(db, "subscriptions", id));
    } catch (error) {
      console.error("Error deleting:", error);
      alert(t('common.failed_to_delete'));
    }
  };

  // 🔥 DÜZELTME 2: Gereksiz render hesaplamalarını engelleyen useMemo
  const totalMonthlyFixed = useMemo(() => {
    return subscriptions.reduce((acc, curr) => {
      const convPrice = convertPrice(curr.price || 0, curr.currency || currency?.code || 'USD', currency?.code || 'USD');
      return acc + convPrice;
    }, 0);
  }, [subscriptions, currency?.code, convertPrice]);

  return (
    <div className="dashboard-page-wrapper p-4">
      <div className="container-fluid">

        {/* Başlık */}
        <div className="d-flex align-items-center mb-4">
          <div className="bg-primary-subtle rounded-circle p-3 me-3 text-primary d-flex align-items-center justify-content-center" style={{ width: '60px', height: '60px' }}>
            <FaSync className="fs-3" />
          </div>
          <div>
            <h1 className="display-6 fw-bold mb-0">{t('nav.subscriptions')}</h1>
            <span className="text-muted">{t('common.manage_recurring')}</span>
          </div>
        </div>

        {/* Giriş Uyarısı */}
        {!user && (
          <div className="alert alert-warning d-flex align-items-center mb-4" role="alert">
            <FaExclamationTriangle className="me-2" />
            <div>
              {t('common.must_be_logged_in_subs')} <Link to="/login" className="alert-link">{t('common.log_in')}</Link>
            </div>
          </div>
        )}

        <div className="row g-4">
          {/* EKLEME FORMU */}
          <div className="col-lg-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body p-4">
                <h5 className="fw-bold mb-4 d-flex align-items-center">
                  <FaPlus className="me-2 text-primary" /> {t('common.add_new')}
                </h5>

                <form onSubmit={handleAddSubscription}>
                  <div className="mb-3">
                    <label className="form-label small text-muted fw-bold">{t('common.name_upper')}</label>
                    <input
                      type="text"
                      className="form-control"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={!user || adding}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small text-muted fw-bold">{t('common.price_upper')}</label>
                    <div className="input-group">
                      <span className="input-group-text">
                        {CURRENCY_MAP[selectedCurrency || currency?.code || 'USD']?.symbol || '$'}
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="form-control"
                        placeholder="0.00"
                        value={price}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9.,]/g, '');
                          setPrice(val);
                        }}
                        disabled={!user || adding}
                        required
                      />
                    </div>
                  </div>

                  {/* Currency Selection Pills */}
                  {favoriteCurrencies.length > 1 && (
                    <div className="mb-3">
                      <label className="form-label small text-muted fw-bold">{t('settings.favorite_currencies')}</label>
                      <div className="d-flex flex-wrap gap-1">
                        {favoriteCurrencies.map((code) => {
                          const isSelected = (selectedCurrency || currency?.code || 'USD') === code;
                          const symbol = CURRENCY_MAP[code]?.symbol || '$';
                          return (
                            <button
                              key={code}
                              type="button"
                              className={`btn btn-xs rounded-pill px-2 py-1 transition-all ${
                                isSelected
                                  ? 'btn-primary border-0 fw-bold text-white'
                                  : 'btn-outline-primary border-1 text-primary'
                              }`}
                              style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                              onClick={() => setSelectedCurrency(code)}
                              disabled={adding}
                            >
                              <span className="me-1">{symbol}</span>
                              <span>{code}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="mb-4">
                    <label className="form-label small text-muted fw-bold">{t('common.renewal_day')}</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="form-control"
                      value={dayOfMonth}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setDayOfMonth(val);
                      }}
                      disabled={!user || adding}
                      required
                    />
                    <div className="form-text">{t('common.day_payment_occurs')}</div>
                  </div>

                  <div className="mb-4">
                    <label className="form-label small text-muted fw-bold">{t('common.start_date')}</label>
                    <input
                      type="date"
                      className="form-control"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      disabled={!user || adding}
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label className="form-label small text-muted fw-bold">{t('common.end_date_optional')}</label>
                    <input
                      type="date"
                      className="form-control"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      disabled={!user || adding}
                      min={startDate}
                    />
                  </div>

                  <button className="btn btn-primary w-100 fw-bold" type="submit" disabled={!user || adding}>
                    {adding ? t('common.adding') : t('common.add_subscription')}
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* LİSTE */}
          <div className="col-lg-8">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-body-tertiary py-3 d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
                <h5 className="mb-0 fw-bold d-flex align-items-center text-body">
                  <FaCalendarCheck className="me-2 text-body-secondary" /> {t('common.active_subscriptions')}
                </h5>
                <span className="badge bg-primary fs-6">
                  {t('common.total')} {formatPrice(totalMonthlyFixed)} {t('common.per_mo')}
                </span>
              </div>

              <div className="list-group list-group-flush">
                {/* Başlık - Karanlık Mod Uyumlu */}
                <div className="list-group-item bg-body-tertiary text-body-secondary fw-bold small text-uppercase d-flex align-items-center">
                  <div style={{ width: '50px' }} className="text-center">{t('common.day')}</div>
                  <div style={{ flex: 1 }}>{t('common.name')}</div>
                  <div style={{ flex: 1, textAlign: 'right' }}>{t('common.cost')}</div>
                  <div style={{ width: '40px' }}></div>
                </div>

                {/* YÜKLENİYOR */}
                {loading && (
                  <div className="p-5 text-center text-muted">
                    <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                    {t('common.loading')}
                  </div>
                )}

                {/* BOŞ DURUM */}
                {!loading && subscriptions.length === 0 && (
                  <div className="p-5 text-center">
                    <div className="text-body fs-5 mb-2">{t('common.no_active_subs')}</div>
                    <p className="text-secondary small">{t('common.add_recurring_left')}</p>
                  </div>
                )}

                {/* LİSTE ELEMANLARI */}
                {!loading && subscriptions.map(sub => {
                  let isExpired = false;
                  if (sub.endDate) {
                    const endObj = new Date(sub.endDate);
                    endObj.setHours(23, 59, 59, 999);
                    if (endObj < new Date()) {
                      isExpired = true;
                    }
                  }

                  return (
                  <div key={sub.id} className={`list-group-item list-group-item-action d-flex align-items-center p-3 card-hover-effect ${isExpired ? 'opacity-50' : ''}`}>
                    {/* Gün Kutusu */}
                    <div className="bg-body-secondary rounded text-center d-flex flex-column justify-content-center me-3 shadow-sm" style={{ width: '50px', height: '50px' }}>
                      <span className="small fw-bold text-uppercase" style={{ fontSize: '0.65rem' }}>{t('common.day')}</span>
                      <span className={`fw-bold fs-5 lh-1 ${isExpired ? 'text-muted' : 'text-body'}`}>{sub.dayOfMonth}</span>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }} className="pe-2">
                      <div className={`fw-bold fs-5 text-truncate ${isExpired ? 'text-decoration-line-through text-muted' : 'text-body'}`}>
                        {sub.name}
                      </div>
                      <div className="text-muted small">
                        {isExpired ? (
                          <span className="text-danger fw-bold">{t('common.expired') || "Süresi doldu."} ({new Date(sub.endDate).toLocaleDateString()})</span>
                        ) : sub.endDate ? (
                          `${t('common.end_date_optional')?.split(' ')[0]}: ${new Date(sub.endDate).toLocaleDateString()}`
                        ) : (
                          t('common.indefinite')
                        )}
                      </div>
                    </div>

                    <div style={{ flex: 1, textAlign: 'right' }} className={`fw-bold fs-5 ${isExpired ? 'text-muted' : 'text-primary'}`}>
                      {formatPrice(sub.price, sub.currency)}
                    </div>

                    <div style={{ width: '40px', textAlign: 'right' }}>
                      <button
                        className="btn btn-link text-danger p-0"
                        onClick={() => handleDelete(sub.id)}
                        title={t('common.delete')}
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                  );
                })}

              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Subscriptions;