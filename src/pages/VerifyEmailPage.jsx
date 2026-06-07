import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';

function VerifyEmailPage() {
  const { user, sendVerification, reloadUser, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Eğer kullanıcı giriş yapmamışsa login sayfasına, doğrulanmışsa dashboard'a yönlendir
  useEffect(() => {
    if (!user) {
      navigate('/login');
    } else if (user.emailVerified) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleResend = async () => {
    setResending(true);
    setError('');
    setMessage('');
    try {
      await sendVerification();
      setMessage(t('common.verification_sent') || 'Verification email sent successfully.');
    } catch (err) {
      setError(err.message || 'Failed to send verification email.');
    } finally {
      setResending(false);
    }
  };

  const handleCheckStatus = async () => {
    setError('');
    setMessage('');
    try {
      await reloadUser();
      // AuthContext state'i güncelleyecek, yukarıdaki useEffect de kontrol edip yönlendirecektir.
    } catch (err) {
      setError(err.message || 'Failed to refresh user status.');
    }
  };

  return (
    <div className="login-page-wrapper py-5">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-5">
            <div className="text-center mb-4">
              <h1 className="h2 fw-bold">{t('common.verification_title') || 'Email Verification'}</h1>
              <p className="text-muted">
                {(t('common.verification_desc') || 'A verification link has been sent to {{email}}.')
                  .replace('{{email}}', user?.email || '')}
              </p>
            </div>

            <div className="card shadow-sm border-0">
              <div className="card-body p-4 p-md-5">
                {message && <div className="alert alert-success">{message}</div>}
                {error && <div className="alert alert-danger">{error}</div>}

                <div className="d-grid gap-3 mt-2">
                  <button className="btn btn-primary btn-lg" onClick={handleCheckStatus}>
                    {t('common.verification_check') || 'I Have Verified My Email'}
                  </button>
                  
                  <button 
                    className="btn btn-outline-secondary" 
                    onClick={handleResend} 
                    disabled={resending}
                  >
                    {resending 
                      ? (t('common.verification_resending') || 'Sending...') 
                      : (t('common.verification_resend') || 'Resend Verification Email')
                    }
                  </button>

                  <hr className="my-3 text-muted" />

                  <button 
                    className="btn btn-link text-danger text-decoration-none" 
                    onClick={() => logout().then(() => navigate('/login'))}
                  >
                    {t('common.verification_logout') || 'Logout & Try Another Account'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VerifyEmailPage;
