import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Leaf, Eye, EyeOff, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'
import { useRegister } from '../hooks/auth/useRegister'
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth'
import { auth, isFirebaseConfigured } from '../firebase'
import { googleAuthUser } from '../api/auth'
import { useAuth } from '../context/AuthContext'

// UI label → Prisma Role enum
const ROLE_MAP = {
  delivery: 'DELIVERY',
  customer: 'CUSTOMER',
}

export default function Register() {
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [role, setRole] = useState('customer')
  const [matchError, setMatchError] = useState(null)
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  const { mutate: register, isPending, error, reset } = useRegister()
  const { setToken, setRole: setAuthRole, setUser } = useAuth()
  const navigate = useNavigate()

  const handleGoogleLogin = async () => {
    try {
      if (role === 'manager') {
        alert('Managers must sign up with email and password.')
        return
      }
      if (!isFirebaseConfigured || !auth) {
        alert('Firebase is not configured yet. Use email and password, or add your Firebase credentials to enable Google Sign-Up.')
        return
      }
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      const idToken = await result.user.getIdToken()
      const data = await googleAuthUser({ token: idToken, role: ROLE_MAP[role] || 'CUSTOMER' })
      setToken(data.token)
      if (data.role) setAuthRole(data.role)
      if (data.user) setUser(data.user)
      navigate(data.role === 'DELIVERY' ? '/delivery/vehicle' : '/customer/marketplace')
    } catch (err) {
      console.error(err)
      if (err?.code === "auth/invalid-api-key" || err?.message?.includes("dummy")) {
        alert("Firebase is not configured yet! Please create a .env file with your real Firebase credentials to use Google Sign Up.")
      } else {
        alert("Google Sign-Up failed: " + (err?.message || 'Please try again.'))
      }
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!agreedToTerms) {
      setMatchError('You must agree to the Terms and Conditions and Privacy Policy.')
      return
    }

    if (password !== confirm) {
      setMatchError('Passwords do not match')
      return
    }
    setMatchError(null)

    register({
      name: name.trim(),
      email,
      phone: phone.trim(),
      password,
      role: ROLE_MAP[role] || 'CUSTOMER',
    })
  }

  // Surface server-side errors inline
  const serverStatus = error?.response?.status
  const serverData = error?.response?.data

  let serverError = null
  if (serverStatus === 409) {
    serverError = serverData?.message || 'Email already registered'
  } else if (serverStatus === 400 && serverData?.errors) {
    // Zod field errors → flatten to one-line message
    const first = Object.values(serverData.errors).flat()[0]
    serverError = first || 'Please check your details and try again'
  } else if (serverStatus === 403) {
    serverError = serverData?.message || 'This account type cannot be self-registered.'
  } else if (error) {
    serverError = serverData?.message || 'Sign up failed. Please try again.'
  }

  const inlineError = matchError || serverError

  const clearOnChange = (setter) => (e) => {
    if (matchError) setMatchError(null)
    if (error) reset()
    setter(e.target.value)
  }

  const googleDisabled = !isFirebaseConfigured
  const googleButtonLabel = !isFirebaseConfigured
    ? 'Google Sign-Up unavailable'
    : 'Continue with Google'

  const features = [
    'Farm-fresh poultry delivered securely',
    'Real-time GPS delivery tracking',
    'Streamlined driver route management',
    'Direct communication with delivery staff',
  ]

  return (
    <form className="login-page" onSubmit={handleSubmit} noValidate>
      {/* Left panel — mirrors Login.jsx for visual consistency */}
      <div className="login-left">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Link to="/" className="login-logo-container" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
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

          <div className="login-marketing" style={{ marginBottom: 30 }}>
            <div style={{
              display: 'inline-block',
              background: 'rgba(255,170,0,0.15)',
              border: '1px solid rgba(255,170,0,0.28)',
              borderRadius: 20, padding: '4px 14px',
              fontSize: '0.70rem', color: '#FFAA00',
              fontWeight: 600, letterSpacing: '0.07em',
              textTransform: 'uppercase', marginBottom: 14
            }}>
              Join the platform
            </div>

            <h1 style={{
              fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700,
              fontSize: '2.1rem', color: '#fff',
              lineHeight: 1.15, letterSpacing: '-0.03em'
            }}>
              Create your<br />
              <span style={{ color: '#84be88' }}>SmartPoultry account</span>
            </h1>

            <p style={{
              marginTop: 14, color: 'rgba(255,255,255,0.58)',
              fontSize: '0.88rem', lineHeight: 1.65, maxWidth: 320
            }}>
              Join the ecosystem to order fresh products directly from the farm, or register as a delivery partner to start earning.
            </p>
          </div>

          <div className="login-features" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {features.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle2 size={15} color="#FFAA00" />
                <span style={{ fontSize: '0.83rem', color: 'rgba(255,255,255,0.72)' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="login-footer-text" style={{
          position: 'relative', zIndex: 1,
          color: 'rgba(255,255,255,0.22)', fontSize: '0.70rem'
        }}>
          © 2026 SmartPoultry · GCTU Final Year Project
        </div>
      </div>

      {/* Right panel */}
      <div className="login-right">
        <div className="login-card">
          <div style={{ marginBottom: 22 }}>
            <h2 style={{
              fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.45rem',
              fontWeight: 700, color: '#0d1f0e', letterSpacing: '-0.02em',
              marginBottom: 6
            }}>Create account</h2>
            <p style={{ fontSize: '0.875rem', color: '#5e7a61', lineHeight: 1.55 }}>
              Sign up to access your farm dashboard
            </p>
          </div>

          {/* Role selector */}
          <div className="form-group">
            <label className="form-label">Sign up as</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))', gap: 8 }}>
              {['customer', 'delivery'].map(r => (
                <button
                  type="button"
                  key={r}
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
            <label className="form-label">Full Name</label>
            <input
              className="form-input"
              type="text"
              id="register-name"
              placeholder="e.g. John Doe"
              value={name}
              onChange={clearOnChange(setName)}
              disabled={isPending}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              className="form-input"
              type="email"
              id="register-email"
              placeholder="name@example.com"
              value={email}
              onChange={clearOnChange(setEmail)}
              disabled={isPending}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Phone Number (Required for Drivers)</label>
            <input
              className="form-input"
              type="tel"
              id="register-phone"
              placeholder="e.g. +1234567890"
              value={phone}
              onChange={clearOnChange(setPhone)}
              disabled={isPending}
              required={role === 'delivery'}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={showPass ? 'text' : 'password'}
                id="register-password"
                placeholder="At least 6 characters"
                value={password}
                onChange={clearOnChange(setPassword)}
                disabled={isPending}
                required
                minLength={6}
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

          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={showConfirm ? 'text' : 'password'}
                id="register-confirm"
                placeholder="Re-enter your password"
                value={confirm}
                onChange={clearOnChange(setConfirm)}
                disabled={isPending}
                required
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                style={{
                  position: 'absolute', right: 13, top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#8da58f'
                }}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
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

          <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <input 
              type="checkbox" 
              id="agree-terms" 
              checked={agreedToTerms}
              onChange={(e) => {
                setAgreedToTerms(e.target.checked)
                if (matchError) setMatchError(null)
              }}
              style={{ marginTop: '3px', cursor: 'pointer' }}
            />
            <label htmlFor="agree-terms" style={{ fontSize: '0.85rem', color: '#5e7a61', lineHeight: '1.4' }}>
              I agree to the{' '}
              <Link to="/terms" style={{ color: '#237227', textDecoration: 'underline' }}>Terms and Conditions</Link>
              {' '}and{' '}
              <Link to="/privacy" style={{ color: '#237227', textDecoration: 'underline' }}>Privacy Policy</Link>.
            </label>
          </div>

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
                Create Account
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
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#237227', fontWeight: 600, textDecoration: 'none' }}>
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </form>
  )
}
