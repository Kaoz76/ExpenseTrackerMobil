import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Yeni state'ler
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setPasswordError('');

    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }
    
    if (!termsAccepted) {
      setError('You must agree to the Terms of Service and Privacy Policy.');
      return;
    }

    try {
      setLoading(true);
      await signup(email, password);
      navigate('/');
    } catch (err) {
      switch (err.code) {
        case 'auth/email-already-in-use':
          setError('This email is already in use.');
          break;
        case 'auth/weak-password':
          setError('Password must be at least 6 characters.');
          break;
        default:
          setError('Failed to create an account. Please try again.');
          console.error(err);
      }
    }
    setLoading(false);
  };

  const handleConfirmPasswordChange = (e) => {
    const value = e.target.value;
    setConfirmPassword(value);
    if (password && value && password !== value) {
      setPasswordError('Passwords do not match.');
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
              <h1 className="h2 fw-bold">Create Your Account</h1>
              <p className="text-muted">Start tracking your spending and saving money today.</p>
            </div>

            <div className="card shadow-sm border-0">
              <div className="card-body p-4 p-md-5">
                <form onSubmit={handleSubmit}>
                  {error && <div className="alert alert-danger">{error}</div>}
                  
                  {/* Email */}
                  <div className="mb-3">
                    <label htmlFor="email" className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  
                  {/* Password */}
                  <div className="mb-3"> 
                    <label htmlFor="password" className="form-label">Password</label>
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
                  
                  {/* Confirm Password */}
                  <div className="mb-3">
                    <label htmlFor="confirmPassword" className="form-label">Confirm Password</label>
                    <div className="position-relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        className={`form-control ${passwordError ? 'is-invalid' : ''}`}
                        id="confirmPassword"
                        value={confirmPassword}
                        onChange={handleConfirmPasswordChange}
                        required
                      />
                      <span onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="input-group-password-icon">
                        {showConfirmPassword ? <FaEye /> : <FaEyeSlash />}
                      </span>
                    </div>
                    {passwordError && (
                      <div className="invalid-feedback-text mt-1">
                        {passwordError}
                      </div>
                    )}
                  </div>

                  {/* Terms & Privacy */}
                  <div className="form-check mb-3">
                    <input 
                      className="form-check-input" 
                      type="checkbox" 
                      id="termsCheck"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                    />
                    <label className="form-check-label small text-muted" htmlFor="termsCheck">
                      By creating an account, you agree to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
                    </label>
                  </div>
                  
                  {/* Create Account Button */}
                  <div className="d-grid">
                     <button type="submit" className="btn btn-primary" disabled={loading}>
                       {loading ? 'Creating...' : 'Create Account'}
                     </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Sign In Link */}
            <div className="text-center mt-4">
              <p className="text-muted">
                Already have an account? <Link to="/login" className="fw-medium text-decoration-none">Sign In</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignUpPage;
