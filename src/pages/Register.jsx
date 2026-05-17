import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Leaf, Eye, EyeOff, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'
import { useRegister } from '../hooks/auth/useRegister'

// UI label → Prisma Role enum
const ROLE_MAP = {
  farmer:  'WORKER',
  worker:  'WORKER',
  manager: 'MANAGER',
  admin:   'ADMIN',
}

export default function Register() {
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [role, setRole] = useState('farmer')
  const [matchError, setMatchError] = useState(null)

  const { mutate: register, isPending, error, reset } = useRegister()

  const handleSubmit = (e) => {
    e.preventDefault()

    if (password !== confirm) {
      setMatchError('Passwords do not match')
      return
    }
    setMatchError(null)

    register({
      name: name.trim(),
      email,
      password,
      role: ROLE_MAP[role] || 'WORKER',
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
  } else if (error) {
    serverError = serverData?.message || 'Sign up failed. Please try again.'
  }

  const inlineError = matchError || serverError

  const clearOnChange = (setter) => (e) => {
    if (matchError) setMatchError(null)
    if (error) reset()
    setter(e.target.value)
  }

  const features = [
    'AI-powered egg yield forecasting (10-day)',
    'Real-time IoT environmental monitoring',
    'Integrated delivery & logistics tracking',
    'Automated farm logbook & analytics',
  ]

  return (
    <form className="login-page" onSubmit={handleSubmit} noValidate>
      {/* Left panel — mirrors Login.jsx for visual consistency */}
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
              Set up access for yourself or your team — pick the role that matches your responsibilities on the farm.
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {['farmer', 'manager', 'admin'].map(r => (
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
                  {r.charAt(0).toUpperCase() + r.slice(1)}
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
              placeholder="Dennis Akpalolo"
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
              placeholder="dennis@smartpoultry.gh"
              value={email}
              onChange={clearOnChange(setEmail)}
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
