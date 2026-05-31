import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Leaf, Eye, EyeOff, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'
import { useLogin } from '../hooks/auth/useLogin'
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth'
import { auth, isFirebaseConfigured } from '../firebase'
import { googleAuthUser } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

const GOOGLE_ROLE_MAP = {
  delivery: 'DELIVERY',
  customer: 'CUSTOMER',
}

const PASSWORD_ROLE_MAP = {
  manager: 'MANAGER',
  delivery: 'DELIVERY',
  customer: 'CUSTOMER',
}

export default function Login() {
  const [showPass, setShowPass] = useState(false)
  const [role, setRole] = useState('manager')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const { mutate: login, isPending, error, reset } = useLogin()
  const { setToken, setRole: setAuthRole, setUser } = useAuth()
  const navigate = useNavigate()

  const handleGoogleLogin = async () => {
    try {
      if (role === 'manager') {
        alert('Managers and admins must sign in with their approved account credentials.')
        return
      }
      if (!isFirebaseConfigured || !auth) {
        alert('Firebase is not configured yet. Use email and password, or add your Firebase credentials to enable Google Sign-In.')
        return
      }
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      const idToken = await result.user.getIdToken()
      const data = await googleAuthUser({ token: idToken, role: GOOGLE_ROLE_MAP[role] || 'CUSTOMER' })
      setToken(data.token)
      if (data.role) setAuthRole(data.role)
      if (data.user) setUser(data.user)
      navigate(data.role === 'DELIVERY' ? '/delivery/vehicle' : '/customer/marketplace')
    } catch (err) {
      console.error(err)
      if (err?.code === "auth/invalid-api-key" || err?.message?.includes("dummy")) {
        alert("Firebase is not configured yet! Please create a .env file with your real Firebase credentials to use Google Sign In.")
      } else {
        alert("Google Sign-In failed: " + (err?.message || 'Please try again.'))
      }
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    login({ email, password, role: PASSWORD_ROLE_MAP[role] })
  }

  const isInvalidCreds = error?.response?.status === 401
  const inlineError = isInvalidCreds
    ? 'Incorrect email or password'
    : error
      ? (error?.response?.data?.message || 'Login failed. Please try again.')
      : null

  const clearErrorOnChange = (setter) => (e) => {
    if (error) reset()
    setter(e.target.value)
  }

  const googleDisabled = role === 'manager' || !isFirebaseConfigured
  const googleButtonLabel = !isFirebaseConfigured
    ? 'Google Sign-In unavailable'
    : role === 'manager'
      ? 'Use password for managers'
      : 'Continue with Google'

  const features = [
    'AI-powered egg yield forecasting (10-day)',
    'Real-time IoT environmental monitoring',
    'Integrated delivery & logistics tracking',
    'Automated farm logbook & analytics',
  ]

  return (
    <form className="login-page" onSubmit={handleSubmit} noValidate>
      {/* Left panel */}
      <div className="login-left">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 44 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'rgba(255,170,0,0.18)',
              border: '1px solid rgba(255,170,0,0.28)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Leaf size={20} color="#FFAA00" />
            </div>
            <span style={{
              fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.2rem',
              fontWeight: 700, color: '#fff', letterSpacing: '-0.02em'
            }}>
              Smart<span style={{ color: '#84be88' }}>Poultry</span>
            </span>
          </div>

          <div style={{ marginBottom: 30 }}>
            <div style={{
              display: 'inline-block',
              background: 'rgba(255,170,0,0.15)',
              border: '1px solid rgba(255,170,0,0.28)',
              borderRadius: 20, padding: '4px 14px',
              fontSize: '0.70rem', color: '#FFAA00',
              fontWeight: 600, letterSpacing: '0.07em',
              textTransform: 'uppercase', marginBottom: 14
            }}>
              AI-Driven Farm Intelligence
            </div>

            <h1 style={{
              fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700,
              fontSize: '2.1rem', color: '#fff',
              lineHeight: 1.15, letterSpacing: '-0.03em'
            }}>
              Smarter Poultry.<br />
              <span style={{ color: '#84be88' }}>Better Yields.</span>
            </h1>

            <p style={{
              marginTop: 14, color: 'rgba(255,255,255,0.58)',
              fontSize: '0.88rem', lineHeight: 1.65, maxWidth: 320
            }}>
              An integrated platform built for Ghanaian poultry farmers — from daily logging to AI-powered decision support.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {features.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle2 size={15} color="#FFAA00" />
                <span style={{ fontSize: '0.83rem', color: 'rgba(255,255,255,0.72)' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          position: 'relative', zIndex: 1,
          color: 'rgba(255,255,255,0.22)', fontSize: '0.70rem'
        }}>
          © 2026 SmartPoultry · GCTU Final Year Project
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
            }}>Welcome back</h2>
            <p style={{ fontSize: '0.875rem', color: '#5e7a61', lineHeight: 1.55 }}>
              Sign in to access your farm dashboard
            </p>
          </div>

          {/* Role selector */}
          <div className="form-group">
            <label className="form-label">Sign in as</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))', gap: 8 }}>
              {['manager', 'delivery', 'customer'].map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  style={{
                    padding: '9px 14px',
                    borderRadius: 9,
                    border: role === r ? '1.5px solid #237227' : '1.5px solid #dddabd',
                    background: role === r ? 'rgba(35,114,39,0.07)' : '#fff',
                    color: role === r ? '#237227' : '#8da58f',
                    fontSize: '0.82rem',
                    fontWeight: role === r ? 600 : 400,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                    fontFamily: 'Inter, sans-serif',
                    transition: 'all 0.15s'
                  }}
                >
                  {r === 'delivery' ? 'Delivery Staff' : r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              className="form-input"
              type="email"
              id="login-email"
              placeholder="dennis@smartpoultry.gh"
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
                id="login-password"
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
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: 22
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" defaultChecked style={{ accentColor: '#237227', width: 14, height: 14 }} />
              <span style={{ fontSize: '0.8rem', color: '#5e7a61' }}>Remember me</span>
            </label>
            <span style={{
              fontSize: '0.8rem', color: '#237227', cursor: 'pointer', fontWeight: 600
            }}>Forgot password?</span>
          </div>

          {inlineError && (
            <div
              role="alert"
              style={{
                marginBottom: 14,
                padding: '9px 12px',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.28)',
                borderRadius: 9,
                color: '#b91c1c',
                fontSize: '0.8rem',
                lineHeight: 1.4,
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
                Signing in…
              </>
            ) : (
              <>
                Sign In to Dashboard
                <ArrowRight size={16} />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleDisabled}
            style={{ 
              width: '100%', 
              justifyContent: 'center', 
              padding: '12px', 
              marginTop: '12px',
              background: '#fff',
              border: '1px solid #ddd',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              color: '#333',
              opacity: googleDisabled ? 0.6 : 1,
              cursor: googleDisabled ? 'not-allowed' : 'pointer'
            }}
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google Logo" style={{ width: 18, height: 18 }} />
            {googleButtonLabel}
          </button>

          <p style={{
            marginTop: 18, textAlign: 'center',
            fontSize: '0.82rem', color: '#5e7a61'
          }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: '#237227', fontWeight: 600, textDecoration: 'none' }}>
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </form>
  )
}
