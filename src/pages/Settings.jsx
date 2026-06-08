import React, { useState, useEffect } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { useTheme } from '../context/ThemeContext';
import { useCurrency, CURRENCY_MAP } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { db, storage } from '../firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, writeBatch, Timestamp } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { FaGlobe, FaPalette, FaUserCog, FaWallet, FaSave, FaTrashRestore, FaExclamationTriangle, FaBell, FaClock, FaTrash, FaFileExport, FaFileImport, FaDatabase } from 'react-icons/fa';

function Settings() {
  const { theme, toggleTheme } = useTheme();
  const { currency, updateCurrency, favoriteCurrencies, updateFavoriteCurrencies } = useCurrency();
  const { language, setLanguage, t } = useLanguage();
  const { user, logout } = useAuth();

  // Bütçe State'i
  const [budgetInput, setBudgetInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Veri Sıfırlama State'i
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  // Yedekleme State'leri
  const [backupMessage, setBackupMessage] = useState('');
  const [isProcessingBackup, setIsProcessingBackup] = useState(false);
  const fileInputRef = React.useRef(null);


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
          title: t('common.msg_notification_title'),
          body: t('common.msg_notification_body'),
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
      setMessage(t('common.msg_budget_negative'));
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      await setDoc(doc(db, "users", user.uid), {
        budgetLimit: budgetVal || 0
      }, { merge: true });

      setMessage(t('common.msg_budget_success'));
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error("Error saving budget:", error);
      setMessage(t('common.msg_budget_failed'));
    } finally {
      setSaving(false);
    }
  };

  // Bütçeyi Sıfırlama
  const handleResetBudget = async () => {
    if (!user?.uid) return;

    setSaving(true);
    setMessage('');

    try {
      await setDoc(doc(db, "users", user.uid), {
        budgetLimit: 0
      }, { merge: true });

      setBudgetInput('');
      setMessage(t('common.msg_budget_reset_success'));
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error("Error resetting budget:", error);
      setMessage(t('common.msg_budget_reset_failed'));
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
        alert(t('common.msg_push_mobile_only'));
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

        setMessage(t('common.msg_reminder_set'));
        setTimeout(() => setMessage(''), 3000);
      } else {
        alert(t('common.msg_allow_notifications'));
        setReminderEnabled(false);
      }
    } else {
      setReminderEnabled(false);
      saveReminderSettings(false, reminderTime);
      await cancelNotification();

      setMessage(t('common.msg_reminder_off'));
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // SAAT DEĞİŞİP KUTUDAN ÇIKILDIĞINDA
  const handleTimeBlur = async (e) => {
    const newTime = e.target.value;
    saveReminderSettings(reminderEnabled, newTime);

    if (reminderEnabled) {
      await scheduleNotification(newTime);
      setMessage(t('common.msg_reminder_time_updated').replace('{{time}}', newTime));
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

    if (!window.confirm(t('common.msg_reset_confirm'))) {
      return;
    }

    setResetting(true);
    setResetMessage('');

    try {
      const q = query(collection(db, "receipts"), where("userId", "==", user.uid));
      const querySnapshot = await getDocs(q);
      const docsArray = querySnapshot.docs;

      // 🔥 Delete receipt images from Firebase Storage before removing documents
      const storageDeletePromises = docsArray
        .map((document) => document.data().storagePath)
        .filter(Boolean)
        .map((storagePath) =>
          deleteObject(ref(storage, storagePath)).catch((err) =>
            console.warn("Could not delete storage file:", storagePath, err)
          )
        );
      await Promise.all(storageDeletePromises);

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

      setResetMessage(t('common.msg_reset_success'));
      setTimeout(() => setResetMessage(''), 5000);

    } catch (error) {
      console.error("Error resetting data:", error);
      setResetMessage(t('common.msg_reset_failed'));
    } finally {
      setResetting(false);
    }
  };

  // Veri Dışa Aktarma
  const handleExportData = async () => {
    if (!user?.uid) return;
    setIsProcessingBackup(true);
    setBackupMessage('');
    try {
      const q = query(collection(db, "receipts"), where("userId", "==", user.uid));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => doc.data());
      
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `expense_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      
      setBackupMessage(t('common.msg_export_success') || 'Veriler başarıyla dışa aktarıldı.');
    } catch (err) {
      console.error(err);
      setBackupMessage(t('common.msg_export_failed') || 'Dışa aktarma başarısız oldu.');
    } finally {
      setIsProcessingBackup(false);
    }
  };

  // Veri İçe Aktarma
  const handleImportData = async (e) => {
    const file = e.target.files[0];
    if (!file || !user?.uid) return;

    setIsProcessingBackup(true);
    setBackupMessage('');

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error("Invalid format");
      
      // Batch işlemi ile aktar (Firestore 500 limitini düşünerek parçalara ayırabiliriz)
      for (let i = 0; i < data.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = data.slice(i, i + 500);

        chunk.forEach(item => {
          if (item.items) {
             const docRef = doc(collection(db, "receipts"));
             
             // Convert serialized plain object createdAt to a real Firestore Timestamp
             let importedCreatedAt = Timestamp.now();
             if (item.createdAt) {
               if (item.createdAt.seconds !== undefined) {
                 importedCreatedAt = new Timestamp(item.createdAt.seconds, item.createdAt.nanoseconds || 0);
               } else if (item.createdAt._seconds !== undefined) {
                 importedCreatedAt = new Timestamp(item.createdAt._seconds, item.createdAt._nanoseconds || 0);
               } else {
                 const parsed = new Date(item.createdAt);
                 if (!isNaN(parsed.getTime())) {
                   importedCreatedAt = Timestamp.fromDate(parsed);
                 }
               }
             }

             // Override item.userId with user.uid to guarantee ownership
             const importedItem = {
               ...item,
               userId: user.uid,
               createdAt: importedCreatedAt
             };
             batch.set(docRef, importedItem);
          }
        });

        await batch.commit();
      }

      setBackupMessage(t('common.msg_import_success') || 'Veriler başarıyla içe aktarıldı.');
      // clear input
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error(err);
      setBackupMessage(t('common.msg_import_failed') || 'İçe aktarma başarısız oldu veya dosya bozuk.');
    } finally {
      setIsProcessingBackup(false);
    }
  };



  return (
    <div className="dashboard-page-wrapper p-4 enlarge-web-8">
      <div className="container-fluid">
        <h1 className="display-6 fw-bold mb-4">{t('settings.title')}</h1>

        <div className="row g-4">

          {/* Para Birimi Seçimi */}
          <div className="col-6 col-md-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body p-2 p-sm-3 p-md-4 flex-column d-flex">
                <div className="d-flex flex-column flex-sm-row align-items-center align-items-sm-start mb-3 mb-md-4 text-center text-sm-start">
                  <div className="bg-primary-subtle text-primary p-2 rounded mb-2 mb-sm-0 me-sm-3 d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '40px', height: '40px' }}>
                    <FaGlobe style={{ fontSize: '1.2rem' }} />
                  </div>
                  <h5 className="card-title mb-0 fw-bold w-100 mt-sm-1" style={{ fontSize: '0.9rem' }}>{t('common.preferences')}</h5>
                </div>

                <div className="mb-3">
                  <label className="form-label text-muted fw-bold mb-1 text-truncate w-100" style={{ fontSize: '0.7rem' }}>{t('settings.language')}</label>
                  <select
                    className="form-select form-select-sm mb-3"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    style={{ cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    <option value="en">{t('settings.english')}</option>
                    <option value="tr">{t('settings.turkish')}</option>
                  </select>

                  <label className="form-label text-muted fw-bold mb-1 text-truncate w-100" style={{ fontSize: '0.7rem' }}>{t('settings.primary_currency').toUpperCase()}</label>
                  <select
                    className="form-select form-select-sm mb-3"
                    value={currency.code}
                    onChange={(e) => updateCurrency(e.target.value)}
                    style={{ cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    <option value="USD">USD ($) - {t('settings.currency_usd')}</option>
                    <option value="EUR">EUR (€) - {t('settings.currency_eur')}</option>
                    <option value="TRY">TRY (₺) - {t('settings.currency_try')}</option>
                    <option value="GBP">GBP (£) - {t('settings.currency_gbp')}</option>
                  </select>

                  <label className="form-label text-muted fw-bold d-block mb-1 text-truncate" style={{ fontSize: '0.7rem' }}>{t('settings.favorite_currencies').toUpperCase()}</label>
                  <div className="d-flex flex-wrap gap-1 justify-content-center justify-content-sm-start">
                    {Object.values(CURRENCY_MAP).map((c) => {
                      const isFavorite = favoriteCurrencies.includes(c.code);
                      const isPrimary = c.code === currency.code;
                      return (
                        <button
                          key={c.code}
                          type="button"
                          className={`btn rounded-pill transition-all ${
                            isPrimary
                              ? 'btn-primary border-0'
                              : isFavorite
                              ? 'btn-outline-primary border-2 fw-semibold'
                              : 'btn-outline-secondary border-1 text-muted'
                          }`}
                          disabled={isPrimary}
                          onClick={() => {
                            let updated;
                            if (isFavorite) {
                              updated = favoriteCurrencies.filter(code => code !== c.code);
                            } else {
                              updated = [...favoriteCurrencies, c.code];
                            }
                            updateFavoriteCurrencies(updated);
                          }}
                          style={{ fontSize: '0.65rem', padding: '0.2rem 0.4rem' }}
                        >
                          <span className="me-1">{c.symbol}</span>
                          <span className="d-none d-sm-inline">{c.code}</span>
                          {isPrimary && <span className="badge bg-white text-primary ms-1 d-none d-sm-inline" style={{ fontSize: '0.55rem' }}>Main</span>}
                        </button>
                      );
                    })}
                  </div>
                  <div className="form-text mt-2 d-none d-sm-block" style={{ fontSize: '0.7rem' }}>
                    {t('settings.favorite_currencies_desc')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bütçe Hedefleri */}
          <div className="col-6 col-md-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body p-2 p-sm-3 p-md-4 flex-column d-flex">
                <div className="d-flex flex-column flex-sm-row align-items-center align-items-sm-start mb-3 mb-md-4 text-center text-sm-start">
                  <div className="bg-success-subtle text-success p-2 rounded mb-2 mb-sm-0 me-sm-3 d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '40px', height: '40px' }}>
                    <FaWallet style={{ fontSize: '1.2rem' }} />
                  </div>
                  <h5 className="card-title mb-0 fw-bold w-100 mt-sm-1" style={{ fontSize: '0.9rem' }}>{t('common.budget_goals')}</h5>
                </div>

                <div className="mb-3">
                  <label className="form-label text-muted fw-bold mb-1 text-truncate w-100" style={{ fontSize: '0.7rem' }}>{t('common.monthly_limit')} ({currency.symbol})</label>
                  <div className="input-group input-group-sm mb-2">
                    <span className="input-group-text bg-body-tertiary px-2">{currency.symbol}</span>
                    <input
                      type="number"
                      className="form-control px-1 text-center text-sm-start"
                      placeholder={t('common.placeholder_budget')}
                      value={budgetInput}
                      onChange={(e) => setBudgetInput(e.target.value)}
                      onKeyDown={(e) => { if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault(); }}
                      style={{ fontSize: '0.8rem' }}
                    />
                  </div>
                  <div className="d-flex gap-1 w-100">
                    <button className="btn btn-sm btn-primary flex-fill" onClick={handleSaveBudget} disabled={saving} style={{ padding: '0.3rem' }} title="Save Budget">
                      {saving ? '...' : <FaSave style={{ fontSize: '0.9rem' }} />}
                    </button>
                    <button className="btn btn-sm btn-outline-danger flex-fill" onClick={handleResetBudget} disabled={saving} style={{ padding: '0.3rem' }} title="Reset Budget">
                      <FaTrash style={{ fontSize: '0.9rem' }} />
                    </button>
                  </div>
                  <div className="form-text mt-2 d-none d-sm-block" style={{ fontSize: '0.7rem' }}>
                    {t('common.monthly_limit_desc')}
                  </div>
                  {message && <div className={`mt-2 small fw-bold text-center text-sm-start ${message.includes('Failed') ? 'text-danger' : 'text-success'}`} style={{ fontSize: '0.7rem' }}>{message}</div>}
                </div>
              </div>
            </div>
          </div>

          {/* Görünüm */}
          <div className="col-6 col-md-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body p-2 p-sm-3 p-md-4 flex-column d-flex">
                <div className="d-flex flex-column flex-sm-row align-items-center align-items-sm-start mb-3 mb-md-4 text-center text-sm-start">
                  <div className="bg-warning-subtle text-warning-emphasis p-2 rounded mb-2 mb-sm-0 me-sm-3 d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '40px', height: '40px' }}>
                    <FaPalette style={{ fontSize: '1.2rem' }} />
                  </div>
                  <h5 className="card-title mb-0 fw-bold w-100 mt-sm-1" style={{ fontSize: '0.9rem' }}>{t('common.appearance')}</h5>
                </div>

                <div className="d-flex flex-column flex-sm-row justify-content-between align-items-center text-center text-sm-start mt-auto">
                  <div className="mb-2 mb-sm-0 w-100">
                    <span className="d-block fw-bold" style={{ fontSize: '0.8rem' }}>{t('common.dark_mode')}</span>
                    <small className="text-muted d-none d-sm-block" style={{ fontSize: '0.7rem' }}>{t('common.dark_mode_desc')}</small>
                  </div>
                  <div className="switch-container mt-1 mt-sm-0" style={{ transform: 'scale(0.8)' }}>
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
          <div className="col-6 col-md-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body p-2 p-sm-3 p-md-4 flex-column d-flex">
                <div className="d-flex flex-column flex-sm-row align-items-center align-items-sm-start mb-3 mb-md-4 text-center text-sm-start">
                  <div className="bg-info-subtle text-info-emphasis p-2 rounded mb-2 mb-sm-0 me-sm-3 d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '40px', height: '40px' }}>
                    <FaBell style={{ fontSize: '1.2rem' }} />
                  </div>
                  <h5 className="card-title mb-0 fw-bold w-100 mt-sm-1 text-truncate" style={{ fontSize: '0.9rem' }}>{t('common.notifications')}</h5>
                </div>

                <div className="mb-3">
                  <label className="form-label text-muted fw-bold d-flex align-items-center justify-content-center justify-content-sm-start mb-1" style={{ fontSize: '0.7rem' }}>
                    <FaClock className="me-1 d-none d-sm-inline" /> <span className="text-truncate">{t('common.set_reminder_time')}</span>
                  </label>
                  <input
                    type="time"
                    className="form-control form-control-sm text-center text-sm-start"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    onBlur={handleTimeBlur}
                    style={{ fontSize: '0.8rem' }}
                  />
                  <div className="form-text mt-1 d-none d-sm-block" style={{ fontSize: '0.7rem' }}>
                    {t('common.reminder_time_desc')}
                  </div>
                </div>

                <div className="d-flex flex-column flex-sm-row justify-content-between align-items-center text-center text-sm-start mt-auto pt-2 border-top">
                  <div className="mb-2 mb-sm-0 w-100">
                    <span className="d-block fw-bold text-truncate" style={{ fontSize: '0.8rem' }}>{t('common.enable_reminder')}</span>
                    <small className="text-muted d-none d-sm-block" style={{ fontSize: '0.7rem' }}>{t('common.enable_reminder_desc')}</small>
                  </div>
                  <div className="switch-container mt-1 mt-sm-0" style={{ transform: 'scale(0.8)' }}>
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

          {/* VERİ YEDEKLEME */}
          <div className="col-md-12">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body p-4">
                <div className="d-flex align-items-center mb-4">
                  <div className="bg-success-subtle text-success p-2 rounded me-3">
                    <FaDatabase className="fs-5" />
                  </div>
                  <h5 className="card-title mb-0 fw-bold">{t('common.data_backup')}</h5>
                </div>

                <p className="text-muted small mb-4">
                  {t('common.data_backup_desc')}
                </p>

                <div className="d-flex flex-column flex-md-row gap-3">
                  <button 
                    className="btn btn-outline-primary d-flex align-items-center justify-content-center"
                    onClick={handleExportData}
                    disabled={isProcessingBackup}
                  >
                    <FaFileExport className="me-2" /> {t('common.export_backup')}
                  </button>

                  <input 
                    type="file" 
                    accept=".json" 
                    style={{ display: 'none' }} 
                    ref={fileInputRef} 
                    onChange={handleImportData} 
                  />
                  
                  <button 
                    className="btn btn-outline-secondary d-flex align-items-center justify-content-center"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingBackup}
                  >
                    <FaFileImport className="me-2" /> {t('common.import_restore')}
                  </button>
                </div>
                {backupMessage && <div className={`mt-3 small fw-bold ${backupMessage.includes(t('common.msg_export_failed')) || backupMessage.includes(t('common.msg_import_failed')) ? 'text-danger' : 'text-success'}`}>{backupMessage}</div>}
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