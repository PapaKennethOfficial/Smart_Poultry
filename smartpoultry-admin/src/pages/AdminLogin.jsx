import { useState } from 'react';
import { Leaf, Eye, EyeOff, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { useLogin } from '../hooks/auth/useLogin';
import { useVerifyOTP } from '../hooks/auth/useVerifyOTP';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import ForgotPasswordModal from '../components/ForgotPasswordModal';

export default function AdminLogin() {
  const [showPass, setShowPass] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);

  const { mutate: login, data: loginData, isPending, error, reset } = useLogin();
  const { mutate: verifyOtp, isPending: isVerifying } = useVerifyOTP();
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loginData?.requires2FA) {
      verifyOtp({ userId: loginData.userId, otpCode });
    } else {
      login({ email, password, role: 'MANAGER' });
    }
  };

  const isInvalidCreds = error?.response?.status === 401;
  const inlineError = isInvalidCreds
    ? 'Incorrect email or password'
    : error
      ? (error?.response?.data?.message || 'Login failed. Please try again.')
      : null;

  const clearErrorOnChange = (setter) => (e) => {
    if (error) reset();
    setter(e.target.value);
  };

  return (
    <form className="login-page desktop-only" onSubmit={handleSubmit} noValidate>
      {/* Left panel */}
      <div className="login-left">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 44 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'linear-gradient(135deg, rgba(35, 114, 39, 0.8), rgba(132, 190, 136, 0.8))',
              border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Leaf size={20} color="#fff" strokeWidth={2.5} />
            </div>
            <span style={{
              fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.2rem',
              fontWeight: 700, color: '#fff', letterSpacing: '-0.02em'
            }}>
              Smart<span style={{ color: '#84be88' }}>Poultry</span>
            </span>
          </div>

          <div className="login-marketing" style={{ marginBottom: 30 }}>
            <h1 style={{
              fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700,
              fontSize: '2.1rem', color: '#fff',
              lineHeight: 1.15, letterSpacing: '-0.03em'
            }}>
              Admin Portal
            </h1>
            <p style={{
              marginTop: 14, color: 'rgba(255,255,255,0.58)',
              fontSize: '0.88rem', lineHeight: 1.65, maxWidth: 320
            }}>
              Secure access to farm management, inventory, and analytics.
            </p>
          </div>
        </div>

        <div className="login-footer-text" style={{
          position: 'relative', zIndex: 1,
          color: 'rgba(255,255,255,0.22)', fontSize: '0.70rem'
        }}>
          © 2026 SmartPoultry
        </div>
      </div>

      {/* Right panel */}
      <div className="login-right">
        <div className="login-card">
          <div style={{ marginBottom: 28 }}>
            <h2 style={{
              fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.45rem',
              fontWeight: 700, color: '#0d1f0e', letterSpacing: '-0.02em',
              marginBottom: 6
            }}>Manager Login</h2>
            <p style={{ fontSize: '0.875rem', color: '#5e7a61', lineHeight: 1.55 }}>
              Sign in with your approved credentials
            </p>
          </div>

          {loginData?.requires2FA ? (
            <div className="form-group">
              <label className="form-label">Enter OTP Code</label>
              <input
                className="form-input"
                type="text"
                placeholder="123456"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                disabled={isVerifying}
                required
              />
            </div>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  className="form-input"
                  type="email"
                  placeholder="admin@smartpoultry.com"
                  value={email}
                  onChange={clearErrorOnChange(setEmail)}
                  disabled={isPending}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="form-input"
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={clearErrorOnChange(setPassword)}
                    disabled={isPending}
                    required
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    style={{
                      position: 'absolute', right: 13, top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#8da58f'
                    }}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{
                display: 'flex', justifyContent: 'flex-end',
                alignItems: 'center', marginBottom: 22
              }}>
                <span 
                  onClick={() => setShowForgotModal(true)}
                  style={{
                    fontSize: '0.8rem', color: '#237227', cursor: 'pointer', fontWeight: 600
                  }}>Forgot password?</span>
              </div>
            </>
          )}

          {inlineError && (
            <div
              role="alert"
              style={{
                marginBottom: 14, padding: '9px 12px',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.28)',
                borderRadius: 9, color: '#b91c1c',
                fontSize: '0.8rem', lineHeight: 1.4,
              }}
            >
              {inlineError}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '12px', opacity: (isPending || isVerifying) ? 0.75 : 1 }}
            disabled={isPending || isVerifying}
          >
            {(isPending || isVerifying) ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                {isVerifying ? 'Verifying…' : 'Signing in…'}
              </>
            ) : (
              <>
                {loginData?.requires2FA ? 'Verify OTP' : 'Sign In to Dashboard'}
                <ArrowRight size={16} />
              </>
            )}
          </button>

          {!loginData?.requires2FA && (
            <div style={{ marginTop: 24, textAlign: 'center', fontSize: '0.85rem' }}>
              <span style={{ color: '#5e7a61' }}>New to SmartPoultry Admin? </span>
              <Link to="/admin/register" style={{ color: '#237227', fontWeight: 600, textDecoration: 'none' }}>
                Create an account
              </Link>
            </div>
          )}
        </div>
      </div>
      
      <ForgotPasswordModal 
        isOpen={showForgotModal} 
        onClose={() => setShowForgotModal(false)} 
        initialEmail={email}
      />
    </form>
  );
}
