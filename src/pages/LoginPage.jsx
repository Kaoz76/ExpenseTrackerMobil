import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { FaEye, FaEyeSlash, FaTimes, FaEnvelope } from 'react-icons/fa';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const { login, resetPassword } = useAuth(); 
  const navigate = useNavigate();

  // ŞİFRE SIFIRLAMA MODAL STATE'LERİ
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // GİRİŞ İŞLEMİ
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      setLoading(true);
      await login(email, password);
      navigate('/'); 
    } catch (err) {
      setError('Invalid email or password');
      console.error(err);
    }
    setLoading(false);
  };

  // ŞİFRE SIFIRLAMA İŞLEMİ
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetMessage('');
    setResetError('');
    
    if (!resetEmail) {
      return setResetError('Please enter your email address.');
    }

    try {
      setResetLoading(true);
      await resetPassword(resetEmail);
      setResetMessage('Check your inbox for further instructions.');
    } catch (err) {
      setResetError('Failed to reset password. Check if the email is correct.');
      console.error(err);
    }
    setResetLoading(false);
  };

  return (
    <div className="login-page-wrapper py-5">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-4">
            <div className="card shadow-sm border-0">
              <div className="card-body p-4 p-md-5">
                <h2 className="card-title text-center mb-4">Log In</h2>
                
                {/* Ana Giriş Formu */}
                <form onSubmit={handleSubmit}>
                  {error && <div className="alert alert-danger">{error}</div>}
                  
                  <div className="mb-3">
                    <label htmlFor="email" className="form-label">Email address</label>
                    <input
                      type="email"
                      className="form-control"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                        <label htmlFor="password" className="form-label mb-0">Password</label>
                        {/* Forgot Password Linki */}
                        <button 
                            type="button"
                            className="btn btn-link btn-sm text-decoration-none p-0"
                            onClick={() => {
                                setResetEmail(email); 
                                setShowResetModal(true);
                            }}
                        >
                            Forgot Password?
                        </button>
                    </div>
                    
                    <div className="position-relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="form-control"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <span onClick={() => setShowPassword(!showPassword)} className="input-group-password-icon">
                        {showPassword ? <FaEye /> : <FaEyeSlash />}
                      </span>
                    </div>
                  </div>

                  <div className="d-grid mt-4">
                     <button type="submit" className="btn btn-primary" disabled={loading}>
                       {loading ? 'Logging in...' : 'Log In'}
                     </button>
                  </div>
                </form>

                <div className="text-center mt-3">
                  <small className="text-muted">
                    Don't have an account? <Link to="/signup" className="fw-medium text-decoration-none">Sign Up</Link>
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
            <div className="modal-backdrop fade show" style={{ zIndex: 1050 }}></div>
            <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1055 }}>
                <div className="modal-dialog modal-dialog-centered">
                    <div className="modal-content shadow">
                        
                        <div className="modal-header border-0 pb-0 d-flex justify-content-between align-items-center">
                            <h5 className="modal-title fw-bold">Reset Password</h5>
                            <button 
                                type="button" 
                                className="btn-link text-muted border-0 bg-transparent p-0"
                                onClick={() => setShowResetModal(false)}
                            >
                                <FaTimes size={20} />
                            </button>
                        </div>

                        <div className="modal-body p-4">
                            <p className="text-muted small mb-4">
                                Enter your email address and we'll send you a link to reset your password.
                            </p>
                            
                            {resetMessage && <div className="alert alert-success">{resetMessage}</div>}
                            {resetError && <div className="alert alert-danger">{resetError}</div>}

                            <form onSubmit={handleResetPassword}>
                                <div className="form-group mb-3">
                                    <label className="form-label text-muted small fw-bold">EMAIL ADDRESS</label>
                                    <div className="input-group">
                                        <span className="input-group-text bg-light border-end-0"><FaEnvelope className="text-muted"/></span>
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
                                <div className="d-grid">
                                    <button type="submit" className="btn btn-primary" disabled={resetLoading}>
                                        {resetLoading ? 'Sending...' : 'Send Reset Link'}
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