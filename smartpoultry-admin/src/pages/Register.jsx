import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Leaf, Eye, EyeOff, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'
import { useRegister } from '../hooks/auth/useRegister'
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth'
import { auth, isFirebaseConfigured } from '../firebase'
import { googleAuthUser } from '../api/auth'
import { useAuth } from '../context/AuthContext'

// UI slug -> Prisma Role enum.
const ROLE_MAP = {
  manager: 'MANAGER',
  customer: 'CUSTOMER',
  delivery: 'DELIVERY',
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

  const isManager = role === 'manager'

  const handleGoogleLogin = async () => {
    try {
      if (isManager) {
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
      if (err?.code === 'auth/invalid-api-key' || err?.message?.includes('dummy')) {
        alert('Firebase is not configured yet! Please create a .env file with your real Firebase credentials to use Google Sign Up.')
      } else {
        alert('Google Sign-Up failed: ' + (err?.message || 'Please try again.'))
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

  const serverStatus = error?.response?.status
  const serverData = error?.response?.data
  let serverError = null
  if (serverStatus === 409) {
    serverError = serverData?.message || 'Email already registered'
  } else if (serverStatus === 400 && serverData?.errors) {
    const first = Object.values(serverData.errors).flat()[0]
    serverError = first || 'Please check your details and try again'
  } else if (serverStatus === 403) {
    serverError = serverData?.message || 'This account type cannot be self-registered — please contact an existing manager.'
  } else if (error) {
    serverError = serverData?.message || 'Sign up failed. Please try again.'
  }
  const inlineError = matchError || serverError

  const clearOnChange = (setter) => (e) => {
    if (matchError) setMatchError(null)
    if (error) reset()
    setter(e.target.value)
  }

  const googleDisabled = !isFirebaseConfigured || isManager
  const googleButtonLabel = isManager
    ? 'Managers must use email & password'
    : !isFirebaseConfigured
      ? 'Google Sign-Up unavailable'
      : 'Continue with Google'

  const marketing = isManager
    ? {
        title: <>Create your<br /><span style={{ color: '#84be88' }}>Manager account</span></>,
        blurb: 'Register for administrative access to the SmartPoultry command centre. Manager approval may be required before activation.',
      }
    : role === 'delivery'
      ? {
          title: <>Join as a<br /><span style={{ color: '#84be88' }}>Delivery Partner</span></>,
          blurb: 'Sign up to receive assigned runs, share live location with customers, and manage your vehicle profile.',
        }
      : {
          title: <>Create your<br /><span style={{ color: '#84be88' }}>SmartPoultry account</span></>,
          blurb: 'Join the ecosystem to order fresh products directly from the farm.',
        }

  return (
    <form className="login-page" onSubmit={handleSubmit} noValidate>
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
              {marketing.title}
            </h1>

            <p style={{
              marginTop: 14, color: 'rgba(255,255,255,0.58)',
              fontSize: '0.88rem', lineHeight: 1.65, maxWidth: 320
            }}>
              {marketing.blurb}
            </p>
          </div>

          <div className="login-features" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {[
              'Farm-fresh poultry delivered securely',
              'Real-time GPS delivery tracking',
              'Streamlined driver route management',
              'Role-based access & 2FA where enabled',
            ].map((f, i) => (
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

      <div className="login-right">
        <div className="login-card">
          <div style={{ marginBottom: 22 }}>
            <h2 style={{
              fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.45rem',
              fontWeight: 700, color: '#0d1f0e', letterSpacing: '-0.02em',
              marginBottom: 6,
            }}>Create account</h2>
            <p style={{ fontSize: '0.875rem', color: '#5e7a61', lineHeight: 1.55 }}>
              Sign up to access your farm dashboard
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Sign up as</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {['manager', 'customer', 'delivery'].map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => setRole(r)}
                  style={{
                    padding: '9px 10px',
                    borderRadius: 9,
                    border: role === r ? '1.5px solid #237227' : '1.5px solid #dddabd',
                    background: role === r ? 'rgba(35,114,39,0.07)' : '#fff',
                    color: role === r ? '#237227' : '#8da58f',
                    fontSize: '0.80rem',
                    fontWeight: role === r ? 600 : 400,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                    fontFamily: 'Inter, sans-serif',
                    transition: 'all 0.15s',
                  }}
                >
                  {r === 'delivery' ? 'Delivery' : r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              className="form-input"
              type="text"
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
              placeholder={isManager ? 'manager@smartpoultry.com' : 'name@example.com'}
              value={email}
              onChange={clearOnChange(setEmail)}
              disabled={isPending}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Phone Number {role === 'delivery' && <span style={{ color: '#b91c1c' }}>*</span>}
            </label>
            <input
              className="form-input"
              type="tel"
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
                  color: '#8da58f',
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
                  color: '#8da58f',
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

          <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <input
              type="checkbox"
              id="agree-terms"
              checked={agreedToTerms}
              onChange={(e) => {
                setAgreedToTerms(e.target.checked)
                if (matchError) setMatchError(null)
              }}
              style={{ marginTop: 3, cursor: 'pointer' }}
            />
            <label htmlFor="agree-terms" style={{ fontSize: '0.85rem', color: '#5e7a61', lineHeight: 1.4 }}>
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

          {!isManager && (
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
                cursor: googleDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google Logo" style={{ width: 18, height: 18 }} />
              {googleButtonLabel}
            </button>
          )}

          <p style={{
            marginTop: 18, textAlign: 'center',
            fontSize: '0.82rem', color: '#5e7a61',
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
