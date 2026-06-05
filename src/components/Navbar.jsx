import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { FaUserCircle, FaFilePdf, FaTimes, FaBell, FaCheckCircle, FaCog } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useReport } from '../context/ReportContext';
import { useLanguage } from '../context/LanguageContext';


function Navbar() {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const { t } = useLanguage();

  const reportContext = useReport();
  const hasNotification = reportContext?.hasNotification || false;
  // Dinamik ay ismini al, yoksa varsayılan göster
  const reportMonthText = reportContext?.reportMonthText || "Monthly";
  const generateAndDownloadPDF = reportContext?.generateAndDownloadPDF || (() => { });
  const isGenerating = reportContext?.isGenerating || false;
  const markAsRead = reportContext?.markAsRead || (() => { });

  const [showDropdown, setShowDropdown] = useState(false);

  // Bildirim ziline tıklandığında çalışacak fonksiyon
  const dropdownRef = useRef(null); // Bildirim alanı için referans oluşturuyoruz

  const handleBellClick = (e) => {
    e.preventDefault();
    // Menü her zaman açılıp kapanabilir (Bildirim olsun olmasın)
    setShowDropdown(!showDropdown);
  };

  useEffect(() => {
    // Ekranda herhangi bir yere tıklandığında çalışacak fonksiyon
    const handleClickOutside = (event) => {
      // Eğer tıklanan yer dropdownRef'in İÇİNDE DEĞİLSE ve menü açıksa kapat
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };


    // Tıklama dinleyicisini tüm sayfaya ekle
    document.addEventListener("mousedown", handleClickOutside);

    // Component ekrandan kalktığında dinleyiciyi temizle (Hafıza dostu)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <nav
      className={`navbar navbar-expand-md border-bottom ${theme === 'dark' ? 'navbar-dark' : 'navbar-light'}`}
      style={{ backgroundColor: 'var(--bs-tertiary-bg)' }}
    >
      <div className="container-fluid px-4 px-md-5">

        {/* Marka (Logo) */}
        <Link className="navbar-brand fw-bold d-none d-md-block" to="/">Expense Tracker</Link>
        <Link className="navbar-brand fw-bold d-md-none" to="/dashboard">Expense Tracker</Link>

        {/* Mobil Toggler (Menü boş olduğu için gizleyebiliriz ama login/logout kısmını dışarı taşıyacağız) */}
        <button
          className="navbar-toggler d-md-none"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#mainNavbar"
          aria-controls="mainNavbar"
          aria-expanded="false"
          aria-label="Toggle navigation"
          style={{ visibility: 'hidden', padding: 0, width: 0 }} /* Yer kaplamasını engelledik */
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        {/* İçerik (Sadece PC Linkleri Kaldı) */}
        <div className="collapse navbar-collapse" id="mainNavbar">
          {/* Sayfa Linkleri (Sadece PC'de görünür, Mobilde gizlenir) */}
          <ul className="navbar-nav me-auto mb-2 mb-md-0 ms-md-2 ms-lg-5 gap-1 d-none d-md-flex">
            <li className="nav-item"><NavLink className="nav-link nav-link-animated text-nowrap" to="/dashboard">{t('nav.dashboard')}</NavLink></li>
            <li className="nav-item"><NavLink className="nav-link nav-link-animated text-nowrap" to="/receipts">{t('nav.receipts')}</NavLink></li>
            <li className="nav-item"><NavLink className="nav-link nav-link-animated text-nowrap" to="/texts">{t('nav.manual_entry')}</NavLink></li>
            <li className="nav-item"><NavLink className="nav-link nav-link-animated text-nowrap" to="/subscriptions">{t('nav.subscriptions')}</NavLink></li>
            <li className="nav-item"><NavLink className="nav-link nav-link-animated text-nowrap" to="/products">{t('nav.products')}</NavLink></li>
            <li className="nav-item"><NavLink className="nav-link nav-link-animated text-nowrap" to="/stores">{t('nav.stores')}</NavLink></li>
            <li className="nav-item"><NavLink className="nav-link nav-link-animated text-nowrap" to="/analyze">{t('nav.analyze')}</NavLink></li>
            <li className="nav-item"><NavLink className="nav-link nav-link-animated text-nowrap" to="/reports">{t('nav.reports')}</NavLink></li>
          </ul>
        </div>

        {/* Kullanıcı Giriş/Çıkış Alanı (HER ZAMAN GÖRÜNECEK ŞEKİLDE DIŞARI ÇIKARILDI) */}
        <div className="d-flex align-items-center ms-auto">
          {user ? (
            // GİRİŞ YAPMIŞSA
            <>
              {/* Email (Sadece PC) */}
              <span className="navbar-text fw-medium d-none d-md-block me-2" style={{ fontSize: '0.9rem' }}>{user.email || 'User'}</span>

              {/* Ayarlar İkonu (Zilin Solunda) */}
              <Link to="/settings" className="text-secondary d-flex align-items-center me-2 me-md-3" title="Settings" style={{ textDecoration: 'none' }}>
                <FaCog className="fs-4" style={{ cursor: 'pointer', transition: 'opacity 0.2s', color: 'var(--bs-body-color)' }} onMouseEnter={(e) => e.target.style.opacity = 0.7} onMouseLeave={(e) => e.target.style.opacity = 1} />
              </Link>

              {/* BİLDİRİM ALANI */}
              <div className="position-relative me-2 me-md-3" ref={dropdownRef}>

                {/* ZİL İKONU */}
                <label
                  className="notification-bell mb-0"
                  title="Notifications"
                  onClick={handleBellClick}
                  style={{ marginRight: 0 }}
                >
                  <input type="checkbox" checked={showDropdown} readOnly />

                  <svg className="bell-regular" xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 448 512"><path d="M224 0c-17.7 0-32 14.3-32 32V49.9C119.5 61.4 64 124.2 64 200v33.4c0 45.4-15.5 89.5-43.8 124.9L5.3 377c-5.8 7.2-6.9 17.1-2.9 25.4S14.8 416 24 416H424c9.2 0 17.6-5.3 21.6-13.6s2.9-18.2-2.9-25.4l-14.9-18.6C399.5 322.9 384 278.8 384 233.4V200c0-75.8-55.5-138.6-128-150.1V32c0-17.7-14.3-32-32-32zm0 96h8c57.4 0 104 46.6 104 104v33.4c0 47.9 13.9 94.6 39.7 134.6H72.3C98.1 328 112 281.3 112 233.4V200c0-57.4 46.6-104 104-104h8zm64 352H224 160c0 17 6.7 33.3 18.7 45.3s28.3 18.7 45.3 18.7s33.3-6.7 45.3-18.7s18.7-28.3 18.7-45.3z"></path></svg>
                  <svg className="bell-solid" xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 448 512"><path d="M224 0c-17.7 0-32 14.3-32 32V51.2C119 66 64 130.6 64 208v18.8c0 47-17.3 92.4-48.5 127.6l-7.4 8.3c-8.4 9.4-10.4 22.9-5.3 34.4S19.4 416 32 416H416c12.6 0 24-7.4 29.2-18.9s3.1-25-5.3-34.4l-7.4-8.3C401.3 319.2 384 273.9 384 226.8V208c0-77.4-55-142-128-156.8V32c0-17.7-14.3-32-32-32zm45.3 493.3c12-12 18.7-28.3 18.7-45.3H224 160c0 17 6.7 33.3 18.7 45.3s28.3 18.7 45.3 18.7s33.3-6.7 45.3-18.7z"></path></svg>

                  {/* KIRMIZI NOKTA SADECE BİLDİRİM VARSA GÖRÜNÜR */}
                  {hasNotification && <span className="notification-dot"></span>}
                </label>

                {/* MENÜ (DROPDOWN) */}
                {showDropdown && (
                  <div className="notification-dropdown">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h6 className="fw-bold mb-0 text-body">{t('common.nav_notifications')}</h6>
                      <button className="btn btn-sm btn-link text-muted p-0" onClick={() => setShowDropdown(false)}>
                        <FaTimes />
                      </button>
                    </div>

                    {hasNotification ? (
                      <>
                        <div className="p-3 rounded bg-body-tertiary mb-3">
                          <div className="d-flex align-items-start">
                            <div className="bg-success-subtle text-success rounded p-2 me-2">
                              <FaBell />
                            </div>
                            <div>
                              <p className="fw-bold mb-1 text-body small">
                                {reportMonthText} {t('common.nav_report_ready')}
                              </p>
                              <p className="text-muted small mb-0" style={{ fontSize: '0.75rem' }}>
                                {t('common.nav_report_desc')}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="d-grid gap-2">
                          <button
                            className="btn btn-primary btn-sm d-flex align-items-center justify-content-center"
                            onClick={async () => {
                              await generateAndDownloadPDF();
                              setShowDropdown(false);
                            }}
                            disabled={isGenerating}
                          >
                            {isGenerating ? (
                              <>{t('common.nav_generating')}</>
                            ) : (
                              <> <FaFilePdf className="me-2" /> {t('common.nav_download_pdf')} </>
                            )}
                          </button>
                          <button className="btn btn-outline-secondary btn-sm" onClick={() => { markAsRead(); setShowDropdown(false); }}>{t('common.nav_mark_read')}</button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-4 text-muted">
                        <FaCheckCircle className="mb-2 fs-3 text-success opacity-50" />
                        <p className="mb-3 small">{t('common.nav_no_notifications')}</p>
                        <button
                          className="btn btn-outline-primary btn-sm w-100 d-flex align-items-center justify-content-center"
                          onClick={async () => {
                            await generateAndDownloadPDF();
                            setShowDropdown(false);
                          }}
                          disabled={isGenerating}
                        >
                          {isGenerating ? (
                            <>{t('common.nav_generating')}</>
                          ) : (
                            <> <FaFilePdf className="me-2" /> {t('common.nav_download_report')} </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* LOGOUT BUTONU */}
              <button className="logout-btn ms-1 ms-md-0" onClick={logout} title="Logout">
                <div className="logout-sign"><svg viewBox="0 0 512 512"><path d="M377.9 105.9L500.7 228.7c7.2 7.2 11.3 17.1 11.3 27.3s-4.1 20.1-11.3 27.3L377.9 406.1c-6.4 6.4-15 9.9-24 9.9c-18.7 0-33.9-15.2-33.9-33.9l0-62.1-128 0c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l128 0 0-62.1c0-18.7 15.2-33.9 33.9-33.9c9 0 17.6 3.6 24 9.9zM160 96L96 96c-17.7 0-32 14.3-32 32l0 256c0 17.7 14.3 32 32 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-64 0c-53 0-96-43-96-96L0 128C0 75 43 32 96 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32z"></path></svg></div>
                <div className="logout-text d-none d-md-block">{t('common.nav_logout')}</div>
              </button>
            </>
          ) : (
            // GİRİŞ YAPMAMIŞSA
            <div className="d-flex align-items-center gap-2 gap-md-3">
              <Link to="/login" className="user-profile" aria-label="User Login Button" role="button">
                <div className="user-profile-inner"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g data-name="Layer 2" id="Layer_2"><path d="M15.626 11.769a6 6 0 1 0 -7.252 0 9.008 9.008 0 0 0 -5.374 8.231 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 9.008 9.008 0 0 0 -5.374-8.231zm-7.626-4.769a4 4 0 1 1 4 4 4 4 0 0 1 -4-4zm10 14h-12a1 1 0 0 1 -1-1 7 7 0 0 1 14 0 1 1 0 0 1 -1 1z"></path></g></svg><p className="d-none d-md-block">{t('common.nav_log_in')}</p></div>
              </Link>
              <Link to="/signup" className="user-profile-primary" role="button">{t('common.nav_sign_up')}</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;