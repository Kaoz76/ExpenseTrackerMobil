import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate, Link } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const { signup } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [lockoutTime, setLockoutTime] = useState(0);

  // Check lockout on mount
  useEffect(() => {
    const lockoutUntil = localStorage.getItem('signup_lockout_until');
    if (lockoutUntil) {
      const remaining = Math.ceil((parseInt(lockoutUntil, 10) - Date.now()) / 1000);
      if (remaining > 0) {
        setLockoutTime(remaining);
        setError(t('common.login_lockout').replace('{{seconds}}', remaining.toString()));
      } else {
        localStorage.removeItem('signup_lockout_until');
        localStorage.setItem('signup_attempts', '0');
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
          localStorage.removeItem('signup_lockout_until');
          localStorage.setItem('signup_attempts', '0');
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

  // GELİŞTİRME 2: Kullanıcı formda düzeltme yapmaya başladığında genel hatayı gizle
  useEffect(() => {
    if (error && lockoutTime === 0) setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, password, termsAccepted]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (lockoutTime > 0) return;
    setError('');
    setPasswordError('');

    if (password !== confirmPassword) {
      setPasswordError(t('common.signup_mismatch'));
      return;
    }

    if (!termsAccepted) {
      setError(t('common.signup_terms_error'));
      return;
    }

    try {
      setLoading(true);
      await signup(email, password);
      localStorage.removeItem('signup_attempts');
      localStorage.removeItem('signup_lockout_until');
      navigate('/');
    } catch (err) {
      const attempts = parseInt(localStorage.getItem('signup_attempts') || '0', 10) + 1;
      localStorage.setItem('signup_attempts', attempts.toString());

      if (attempts >= 5) {
        const lockoutDuration = 60 * 1000; // 60 seconds
        const lockoutUntil = Date.now() + lockoutDuration;
        localStorage.setItem('signup_lockout_until', lockoutUntil.toString());
        setLockoutTime(60);
        setError(t('common.login_lockout').replace('{{seconds}}', '60'));
      } else {
        switch (err.code) {
          case 'auth/email-already-in-use':
            setError(t('common.signup_email_in_use'));
            break;
          case 'auth/weak-password':
            setError(t('common.signup_weak_password'));
            break;
          default:
            setError(t('common.signup_generic_error'));
            console.error(err);
        }
      }
    } finally {
      // GELİŞTİRME 3: Güvenli Loading kapanışı
      setLoading(false);
    }
  };

  const handleConfirmPasswordChange = (e) => {
    const value = e.target.value;
    setConfirmPassword(value);
    if (password && value && password !== value) {
      setPasswordError(t('common.signup_mismatch'));
    } else {
      setPasswordError('');
    }
  };

  return (
    <div className="login-page-wrapper py-5">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-5">

            {/* Başlık ve Alt Başlık */}
            <div className="text-center mb-4">
              <h1 className="h2 fw-bold">{t('common.signup_title')}</h1>
              <p className="text-muted">{t('common.signup_subtitle')}</p>
            </div>

            <div className="card shadow-sm border-0">
              <div className="card-body p-4 p-md-5">
                <form onSubmit={handleSubmit}>
                  {error && <div className="alert alert-danger">{error}</div>}

                  {/* Email */}
                  <div className="mb-3">
                    <label htmlFor="email" className="form-label">{t('common.signup_email')}</label>
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

                  {/* Password */}
                  <div className="mb-3">
                    <label htmlFor="password" className="form-label">{t('common.signup_password')}</label>
                    {/* GELİŞTİRME 1: Bootstrap Input Group yapısı */}
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

                  {/* Confirm Password */}
                  <div className="mb-3">
                    <label htmlFor="confirmPassword" className="form-label">{t('common.signup_confirm')}</label>
                    {/* GELİŞTİRME 1: Bootstrap Input Group yapısı */}
                    <div className="input-group">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        className={`form-control border-end-0 ${passwordError ? 'is-invalid' : ''}`}
                        id="confirmPassword"
                        value={confirmPassword}
                        onChange={handleConfirmPasswordChange}
                        required
                        disabled={lockoutTime > 0}
                      />
                      <button
                        type="button"
                        className={`btn btn-outline-secondary bg-transparent border-start-0 text-muted ${passwordError ? 'border-danger' : ''}`}
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                    {passwordError && (
                      <div className="invalid-feedback-text mt-1 text-danger small">
                        {passwordError}
                      </div>
                    )}
                  </div>

                  {/* Terms & Privacy */}
                  <div className="form-check mb-4 mt-4">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="termsCheck"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      disabled={lockoutTime > 0}
                    />
                    <label className="form-check-label small text-muted" htmlFor="termsCheck">
                      {t('common.signup_terms')} <a href="#">{t('common.signup_terms_link')}</a> & <a href="#">{t('common.signup_privacy_link')}</a>.
                    </label>
                  </div>

                  {/* Create Account Button */}
                  <div className="d-grid">
                    <button type="submit" className="btn btn-primary" disabled={loading || lockoutTime > 0}>
                      {loading ? t('common.signup_creating') : t('common.signup_create')}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Sign In Link */}
            <div className="text-center mt-4">
              <p className="text-muted">
                {t('common.signup_already')} <Link to="/login" className="fw-medium text-decoration-none">{t('common.signup_login_link')}</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignUpPage;