import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate, Link } from 'react-router-dom';
import { FaEye, FaEyeSlash, FaTimes, FaEnvelope } from 'react-icons/fa';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login, resetPassword } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  // ŞİFRE SIFIRLAMA MODAL STATE'LERİ
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const [lockoutTime, setLockoutTime] = useState(0);

  // Check lockout on mount
  useEffect(() => {
    const lockoutUntil = localStorage.getItem('login_lockout_until');
    if (lockoutUntil) {
      const remaining = Math.ceil((parseInt(lockoutUntil, 10) - Date.now()) / 1000);
      if (remaining > 0) {
        setLockoutTime(remaining);
        setError(t('common.login_lockout').replace('{{seconds}}', remaining.toString()));
      } else {
        localStorage.removeItem('login_lockout_until');
        localStorage.setItem('login_attempts', '0');
      }
    }
  }, [t]);

  // Handle lockout countdown timer
  useEffect(() => {
    if (lockoutTime <= 0) return;
    const timer = setInterval(() => {
      setLockoutTime((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          localStorage.removeItem('login_lockout_until');
          localStorage.setItem('login_attempts', '0');
          setError('');
          return 0;
        }
        const next = prev - 1;
        setError(t('common.login_lockout').replace('{{seconds}}', next.toString()));
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutTime, t]);

  // GELİŞTİRME 1: Kullanıcı yazmaya başladığında login hatasını temizle
  useEffect(() => {
    if (error && lockoutTime === 0) setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, password]);

  // GELİŞTİRME 3: Modal için ESC tuşu desteği
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showResetModal) {
        closeResetModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showResetModal]);

  // GELİŞTİRME 3: Modalı kapatırken içindeki eski mesajları temizle
  const closeResetModal = () => {
    setShowResetModal(false);
    setResetMessage('');
    setResetError('');
  };

  // GİRİŞ İŞLEMİ
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (lockoutTime > 0) return;
    setError('');

    try {
      setLoading(true);
      await login(email, password);
      localStorage.removeItem('login_attempts');
      localStorage.removeItem('login_lockout_until');
      navigate('/');
    } catch (err) {
      const attempts = parseInt(localStorage.getItem('login_attempts') || '0', 10) + 1;
      localStorage.setItem('login_attempts', attempts.toString());

      if (attempts >= 5) {
        const lockoutDuration = 60 * 1000; // 60 seconds
        const lockoutUntil = Date.now() + lockoutDuration;
        localStorage.setItem('login_lockout_until', lockoutUntil.toString());
        setLockoutTime(60);
        setError(t('common.login_lockout').replace('{{seconds}}', '60'));
      } else {
        setError(t('common.login_error'));
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ŞİFRE SIFIRLAMA İŞLEMİ
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetMessage('');
    setResetError('');

    if (!resetEmail) {
      return setResetError(t('common.login_reset_empty'));
    }

    try {
      setResetLoading(true);
      await resetPassword(resetEmail);
      setResetMessage(t('common.login_reset_success'));
    } catch (err) {
      setResetError(t('common.login_reset_error'));
      console.error(err);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="login-page-wrapper py-5">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-4">
            <div className="card shadow-sm border-0">
              <div className="card-body p-4 p-md-5">
                <h2 className="card-title text-center mb-4">{t('common.login_title')}</h2>

                {/* Ana Giriş Formu */}
                <form onSubmit={handleSubmit}>
                  {error && <div className="alert alert-danger">{error}</div>}

                  <div className="mb-3">
                    <label htmlFor="email" className="form-label">{t('common.login_email')}</label>
                    <input
                      type="email"
                      className="form-control"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={lockoutTime > 0}
                    />
                  </div>

                  <div className="mb-4">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <label htmlFor="password" className="form-label mb-0">{t('common.login_password')}</label>
                      {/* Forgot Password Linki */}
                      <button
                        type="button"
                        className="btn btn-link btn-sm text-decoration-none p-0"
                        onClick={() => {
                          setResetEmail(email);
                          setShowResetModal(true);
                        }}
                      >
                        {t('common.login_forgot')}
                      </button>
                    </div>

                    {/* GELİŞTİRME 2: Bootstrap Input Group ile Şifre Göster/Gizle */}
                    <div className="input-group">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="form-control border-end-0"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={lockoutTime > 0}
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary bg-transparent border-start-0 text-muted"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                  </div>

                  <div className="d-grid mt-4">
                    <button type="submit" className="btn btn-primary" disabled={loading || lockoutTime > 0}>
                      {loading ? t('common.login_logging_in') : t('common.login_title')}
                    </button>
                  </div>
                </form>

                <div className="text-center mt-4">
                  <small className="text-muted">
                    {t('common.login_no_account')} <Link to="/signup" className="fw-medium text-decoration-none">{t('common.login_signup_link')}</Link>
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PASSWORD RESET MODAL */}
      {showResetModal && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1050 }} onClick={closeResetModal}></div>
          <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1055 }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content shadow">

                <div className="modal-header border-0 pb-0 d-flex justify-content-between align-items-center">
                  <h5 className="modal-title fw-bold">{t('common.login_reset_title')}</h5>
                  <button
                    type="button"
                    className="btn-link text-muted border-0 bg-transparent p-0"
                    onClick={closeResetModal}
                  >
                    <FaTimes size={20} />
                  </button>
                </div>

                <div className="modal-body p-4">
                  <p className="text-muted small mb-4">
                    {t('common.login_reset_desc')}
                  </p>

                  {resetMessage && <div className="alert alert-success">{resetMessage}</div>}
                  {resetError && <div className="alert alert-danger">{resetError}</div>}

                  <form onSubmit={handleResetPassword}>
                    <div className="form-group mb-3">
                      <label className="form-label text-muted small fw-bold">{t('common.login_reset_email_label')}</label>
                      <div className="input-group">
                        <span className="input-group-text bg-light border-end-0"><FaEnvelope className="text-muted" /></span>
                        <input
                          type="email"
                          className="form-control border-start-0 ps-0"
                          placeholder="name@example.com"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="d-grid mt-4">
                      <button type="submit" className="btn btn-primary" disabled={resetLoading}>
                        {resetLoading ? t('common.login_reset_sending') : t('common.login_reset_send')}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
}

export default LoginPage;