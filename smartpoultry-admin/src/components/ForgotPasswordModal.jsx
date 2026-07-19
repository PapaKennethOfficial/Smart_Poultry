import { useState } from 'react'
import { forgotPassword, resetPassword } from '../api/auth'
import { Loader2 } from 'lucide-react'

export default function ForgotPasswordModal({ isOpen, onClose, initialEmail = '' }) {
  const [step, setStep] = useState(1) // 1: Request, 2: OTP, 3: Reset
  const [email, setEmail] = useState(initialEmail)
  const [otpCode, setOtpCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  if (!isOpen) return null

  const handleRequestOTP = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = await forgotPassword({ email })
      setMessage(res.message)
      setStep(2)
      if (res.mockOtp) {
        // Mock OTP available in development — visible in server logs only
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to request reset")
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = (e) => {
    e.preventDefault()
    setStep(3) // In our flow, OTP verification happens at the reset endpoint
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      await resetPassword({ email, otpCode, newPassword })
      setMessage("Password successfully reset! You can now log in.")
      setStep(4) // Success state
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to reset password")
    } finally {
      setLoading(false)
    }
  }

  const close = () => {
    setStep(1)
    setEmail('')
    setOtpCode('')
    setNewPassword('')
    setError(null)
    setMessage(null)
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20
    }}>
      <div style={{
        background: '#fff', padding: 28, borderRadius: 16, width: '100%', maxWidth: 400,
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'Space Grotesk', fontSize: '1.2rem', fontWeight: 600, color: '#0d1f0e' }}>
            Reset Password
          </h2>
          <button onClick={close} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#8da58f' }}>&times;</button>
        </div>

        {error && <div style={{ color: '#b91c1c', fontSize: '0.85rem', marginBottom: 15, background: 'rgba(239,68,68,0.1)', padding: 10, borderRadius: 8 }}>{error}</div>}
        {message && step !== 4 && <div style={{ color: '#237227', fontSize: '0.85rem', marginBottom: 15, background: 'rgba(35,114,39,0.1)', padding: 10, borderRadius: 8 }}>{message}</div>}

        {step === 1 && (
          <form onSubmit={handleRequestOTP}>
            <div className="form-group" style={{ marginBottom: 15 }}>
              <label className="form-label" style={{ display: 'block', marginBottom: 5, fontSize: '0.85rem', color: '#5e7a61' }}>Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #dddabd', outline: 'none' }}
              />
            </div>
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: 12, background: '#237227', color: '#fff', border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8
            }}>
              {loading ? <Loader2 size={16} className="lucide-spin" /> : "Send Reset Code"}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerifyOTP}>
            <div className="form-group" style={{ marginBottom: 15 }}>
              <label className="form-label" style={{ display: 'block', marginBottom: 5, fontSize: '0.85rem', color: '#5e7a61' }}>Enter OTP</label>
              <input
                type="text"
                required
                value={otpCode}
                onChange={e => setOtpCode(e.target.value)}
                placeholder="6-digit code"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #dddabd', outline: 'none' }}
              />
            </div>
            <button type="submit" style={{
              width: '100%', padding: 12, background: '#237227', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer'
            }}>
              Verify Code
            </button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleResetPassword}>
            <div className="form-group" style={{ marginBottom: 15 }}>
              <label className="form-label" style={{ display: 'block', marginBottom: 5, fontSize: '0.85rem', color: '#5e7a61' }}>New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #dddabd', outline: 'none' }}
              />
            </div>
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: 12, background: '#237227', color: '#fff', border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8
            }}>
              {loading ? <Loader2 size={16} className="lucide-spin" /> : "Reset Password"}
            </button>
          </form>
        )}

        {step === 4 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#237227', fontWeight: 600, marginBottom: 20 }}>{message}</div>
            <button onClick={close} style={{
              width: '100%', padding: 12, background: '#237227', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer'
            }}>
              Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
