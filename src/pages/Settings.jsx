import React, { useState, useEffect } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core'; // 🔥 GELİŞTİRME 2: Platform kontrolü için eklendi
import { useTheme } from '../context/ThemeContext';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { FaGlobe, FaPalette, FaUserCog, FaWallet, FaSave, FaTrashRestore, FaExclamationTriangle, FaBell, FaClock } from 'react-icons/fa';

function Settings() {
  const { theme, toggleTheme } = useTheme();
  const { currency, updateCurrency } = useCurrency();
  const { language, setLanguage, t } = useLanguage();
  const { user, logout } = useAuth();

  // Bütçe State'i
  const [budgetInput, setBudgetInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Veri Sıfırlama State'i
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  // BİLDİRİM VE SAAT STATE'LERİ
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('20:00'); // Varsayılan

  // Verileri Çekme
  useEffect(() => {
    if (user?.uid) {
      const fetchData = async () => {
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.budgetLimit) setBudgetInput(data.budgetLimit);
            if (data.reminderEnabled !== undefined) setReminderEnabled(data.reminderEnabled);
            if (data.reminderTime) setReminderTime(data.reminderTime);
          }
        } catch (error) {
          console.error("Error fetching settings:", error);
        }
      };
      fetchData();
    }
  }, [user]);

  // BİLDİRİMİ SİSTEME KAYDET
  const scheduleNotification = async (time) => {
    if (!Capacitor.isNativePlatform()) return; // Sadece mobilde çalışır

    await LocalNotifications.cancel({ notifications: [{ id: 1 }] });

    const [hours, minutes] = time.split(':').map(Number);

    await LocalNotifications.schedule({
      notifications: [
        {
          title: "Expense Tracker",
          body: "Don't forget to log your daily expenses! 💰",
          id: 1,
          schedule: {
            on: {
              hour: hours,
              minute: minutes,
            },
            repeats: true,
          },
        }
      ]
    });
  };

  // BİLDİRİMİ İPTAL ET
  const cancelNotification = async () => {
    if (!Capacitor.isNativePlatform()) return;
    await LocalNotifications.cancel({ notifications: [{ id: 1 }] });
  };

  // Bütçeyi Kaydetme
  const handleSaveBudget = async () => {
    if (!user?.uid) return;

    const budgetVal = parseFloat(budgetInput);
    if (budgetVal < 0) {
      setMessage('Budget cannot be negative!');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      await setDoc(doc(db, "users", user.uid), {
        budgetLimit: budgetVal || 0
      }, { merge: true });

      setMessage('Budget updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error("Error saving budget:", error);
      setMessage('Failed to save budget.');
    } finally {
      setSaving(false);
    }
  };

  // BİLDİRİM AÇMA/KAPAMA
  const handleToggleReminder = async (e) => {
    if (!user?.uid) return;

    const isChecked = e.target.checked;

    if (isChecked) {
      // 🔥 GELİŞTİRME 2: Web tarayıcıda izne çalışıp çökmemesi için koruma
      if (!Capacitor.isNativePlatform()) {
        alert("Push notifications are only supported on the mobile app.");
        setReminderEnabled(false);
        return;
      }

      let permStatus = await LocalNotifications.checkPermissions();
      if (permStatus.display === 'prompt') {
        permStatus = await LocalNotifications.requestPermissions();
      }

      if (permStatus.display === 'granted') {
        setReminderEnabled(true);
        saveReminderSettings(true, reminderTime);
        await scheduleNotification(reminderTime);

        setMessage('Daily reminder set successfully!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        alert("Please allow notifications from your phone settings.");
        setReminderEnabled(false);
      }
    } else {
      setReminderEnabled(false);
      saveReminderSettings(false, reminderTime);
      await cancelNotification();

      setMessage('Reminder turned off.');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // SAAT DEĞİŞİP KUTUDAN ÇIKILDIĞINDA
  const handleTimeBlur = async (e) => {
    const newTime = e.target.value;
    saveReminderSettings(reminderEnabled, newTime);

    if (reminderEnabled) {
      await scheduleNotification(newTime);
      setMessage(`Reminder time updated to ${newTime}`);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // Firestore Yardımcısı
  const saveReminderSettings = async (enabled, time) => {
    if (!user?.uid) return;
    try {
      await setDoc(doc(db, "users", user.uid), {
        reminderEnabled: enabled,
        reminderTime: time
      }, { merge: true });
    } catch (error) {
      console.error("Error saving reminder settings:", error);
    }
  };

  // Veri Sıfırlama
  const handleResetData = async () => {
    if (!user?.uid) return;

    if (!window.confirm("ARE YOU SURE? \n\nThis will permanently delete ALL your scanned receipts and manual entries. This action cannot be undone.")) {
      return;
    }

    setResetting(true);
    setResetMessage('');

    try {
      const q = query(collection(db, "receipts"), where("userId", "==", user.uid));
      const querySnapshot = await getDocs(q);
      const docsArray = querySnapshot.docs;

      // 🔥 GELİŞTİRME 1: Firebase 500 Belge Sınırı Çözümü (Chunking)
      // Belgeleri 500'lük parçalara ayırarak siliyoruz
      for (let i = 0; i < docsArray.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = docsArray.slice(i, i + 500);

        chunk.forEach((document) => {
          batch.delete(document.ref);
        });

        await batch.commit();
      }

      setResetMessage('All data has been successfully deleted.');
      setTimeout(() => setResetMessage(''), 5000);

    } catch (error) {
      console.error("Error resetting data:", error);
      setResetMessage('Failed to reset data. Please try again.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="dashboard-page-wrapper p-4">
      <div className="container-fluid">
        <h1 className="display-6 fw-bold mb-4">{t('settings.title')}</h1>

        <div className="row g-4">

          {/* Para Birimi Seçimi */}
          <div className="col-md-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body p-4">
                <div className="d-flex align-items-center mb-4">
                  <div className="bg-primary-subtle text-primary p-2 rounded me-3">
                    <FaGlobe className="fs-5" />
                  </div>
                  <h5 className="card-title mb-0 fw-bold">{t('common.preferences')}</h5>
                </div>

                <div className="mb-3">
                  <label className="form-label text-muted small fw-bold">{t('settings.language')}</label>
                  <select
                    className="form-select form-select-lg mb-4"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="en">{t('settings.english')}</option>
                    <option value="tr">{t('settings.turkish')}</option>
                  </select>

                  <label className="form-label text-muted small fw-bold">{t('settings.currency').toUpperCase()}</label>
                  <select
                    className="form-select form-select-lg"
                    value={currency.code}
                    onChange={(e) => updateCurrency(e.target.value)}
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="USD">USD ($) - US Dollar</option>
                    <option value="EUR">EUR (€) - Euro</option>
                    <option value="TRY">TRY (₺) - Turkish Lira</option>
                    <option value="GBP">GBP (£) - British Pound</option>
                    <option value="JPY">JPY (¥) - Japanese Yen</option>
                  </select>
                  <div className="form-text mt-2">
                    {t('common.currency_desc')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bütçe Hedefleri */}
          <div className="col-md-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body p-4">
                <div className="d-flex align-items-center mb-4">
                  <div className="bg-success-subtle text-success p-2 rounded me-3">
                    <FaWallet className="fs-5" />
                  </div>
                  <h5 className="card-title mb-0 fw-bold">{t('common.budget_goals')}</h5>
                </div>

                <div className="mb-3">
                  <label className="form-label text-muted small fw-bold">{t('common.monthly_limit')} ({currency.symbol})</label>
                  <div className="input-group input-group-lg">
                    <span className="input-group-text bg-body-tertiary">{currency.symbol}</span>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="e.g. 5000"
                      value={budgetInput}
                      onChange={(e) => setBudgetInput(e.target.value)}
                    />
                    <button
                      className="btn btn-primary"
                      onClick={handleSaveBudget}
                      disabled={saving}
                    >
                      {saving ? '...' : <FaSave />}
                    </button>
                  </div>
                  <div className="form-text mt-2">
                    {t('common.monthly_limit_desc')}
                  </div>
                  {message && <div className={`mt-2 small fw-bold ${message.includes('Failed') ? 'text-danger' : 'text-success'}`}>{message}</div>}
                </div>
              </div>
            </div>
          </div>

          {/* Görünüm */}
          <div className="col-md-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body p-4">
                <div className="d-flex align-items-center mb-4">
                  <div className="bg-warning-subtle text-warning-emphasis p-2 rounded me-3">
                    <FaPalette className="fs-5" />
                  </div>
                  <h5 className="card-title mb-0 fw-bold">{t('common.appearance')}</h5>
                </div>

                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <span className="d-block fw-medium">{t('common.dark_mode')}</span>
                    <small className="text-muted">{t('common.dark_mode_desc')}</small>
                  </div>

                  <div className="switch-container">
                    <input
                      type="checkbox"
                      id="darkModeToggle"
                      className="switch-input"
                      checked={theme === 'dark'}
                      onChange={toggleTheme}
                    />
                    <label htmlFor="darkModeToggle" className="switch-label"></label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bildirimler */}
          <div className="col-md-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body p-4">
                <div className="d-flex align-items-center mb-4">
                  <div className="bg-info-subtle text-info-emphasis p-2 rounded me-3">
                    <FaBell className="fs-5" />
                  </div>
                  <h5 className="card-title mb-0 fw-bold">{t('common.notifications')}</h5>
                </div>

                {/* Saat Seçici */}
                <div className="mb-3">
                  <label className="form-label text-muted small fw-bold d-flex align-items-center">
                    <FaClock className="me-2" /> {t('common.set_reminder_time')}
                  </label>
                  <input
                    type="time"
                    className="form-control form-control-lg"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    onBlur={handleTimeBlur}
                  />
                  <div className="form-text mt-1">
                    {t('common.reminder_time_desc')}
                  </div>
                </div>

                {/* Hatırlatıcı Switch */}
                <div className="d-flex justify-content-between align-items-center pt-3 border-top">
                  <div>
                    <span className="d-block fw-medium">{t('common.enable_reminder')}</span>
                    <small className="text-muted">{t('common.enable_reminder_desc')}</small>
                  </div>
                  <div className="switch-container">
                    <input
                      type="checkbox"
                      id="reminderToggle"
                      className="switch-input"
                      checked={reminderEnabled}
                      onChange={handleToggleReminder}
                    />
                    <label htmlFor="reminderToggle" className="switch-label"></label>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* HESAP */}
          <div className="col-md-12">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body p-4">
                <div className="d-flex align-items-center mb-3">
                  <div className="bg-secondary-subtle text-secondary p-2 rounded me-3">
                    <FaUserCog className="fs-5" />
                  </div>
                  <h5 className="card-title mb-0 fw-bold">{t('common.account_management')}</h5>
                </div>

                <div className="mb-4">
                  <p className="text-muted mb-1 small fw-bold">{t('common.logged_in_as')}</p>
                  <p className="fw-medium fs-5">{user?.email}</p>
                  <button className="btn btn-outline-danger btn-sm mt-2" onClick={logout}>
                    {t('common.logout')}
                  </button>
                </div>

                <hr className="my-4" />

                <div>
                  <p className="text-danger fw-bold small d-flex align-items-center">
                    <FaExclamationTriangle className="me-2" /> {t('common.danger_zone')}
                  </p>
                  <p className="text-muted small mb-3">
                    {t('common.danger_zone_desc')}
                  </p>
                  <button
                    className="btn btn-outline-danger w-100 d-flex align-items-center justify-content-center"
                    onClick={handleResetData}
                    disabled={resetting}
                  >
                    {resetting ? t('common.processing') : <><FaTrashRestore className="me-2" /> {t('common.reset_all_data')}</>}
                  </button>
                  {resetMessage && <div className="mt-2 text-center small fw-bold text-success">{resetMessage}</div>}
                </div>

              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Settings;