import { useState } from 'react';
import { Leaf, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import { useRegister } from '../hooks/auth/useRegister';
import { Link, useNavigate } from 'react-router-dom';

export default function AdminRegister() {
  const [showPass, setShowPass] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { mutate: register, isPending, error, reset } = useRegister();
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    // Register the user with the MANAGER role
    register({ name, email, password, role: 'MANAGER' });
  };

  const inlineError = error ? (error?.response?.data?.message || 'Registration failed. Please try again.') : null;

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
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
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
            </Link>
          </div>

          <div className="login-marketing" style={{ marginBottom: 30 }}>
            <h1 style={{
              fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700,
              fontSize: '2.1rem', color: '#fff',
              lineHeight: 1.15, letterSpacing: '-0.03em'
            }}>
              Join the Team
            </h1>
            <p style={{
              marginTop: 14, color: 'rgba(255,255,255,0.58)',
              fontSize: '0.88rem', lineHeight: 1.65, maxWidth: 320
            }}>
              Register as a manager to get secure access to farm operations, inventory, and real-time analytics.
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
            }}>Create Manager Account</h2>
            <p style={{ fontSize: '0.875rem', color: '#5e7a61', lineHeight: 1.55 }}>
              Sign up to access the admin portal
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              className="form-input"
              type="text"
              placeholder="e.g. John Doe"
              value={name}
              onChange={clearErrorOnChange(setName)}
              disabled={isPending}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              className="form-input"
              type="email"
              placeholder="manager@smartpoultry.com"
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
            style={{ width: '100%', justifyContent: 'center', padding: '12px', opacity: isPending ? 0.75 : 1 }}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Creating account…
              </>
            ) : (
              <>
                Register Account
                <ArrowRight size={16} />
              </>
            )}
          </button>

          <div style={{ marginTop: 24, textAlign: 'center', fontSize: '0.85rem' }}>
            <span style={{ color: '#5e7a61' }}>Already have an account? </span>
            <Link to="/login" style={{ color: '#237227', fontWeight: 600, textDecoration: 'none' }}>
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </form>
  );
}
