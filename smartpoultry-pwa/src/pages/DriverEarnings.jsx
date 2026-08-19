import { useState, useEffect } from 'react'
import { Wallet, DollarSign, Calendar, AlertCircle, CheckCircle2, X } from 'lucide-react'
import api from '../api/axios'

export default function DriverEarnings() {
  const [earnings, setEarnings] = useState(null)
  const [withdrawals, setWithdrawals] = useState([])
  const [availableBalance, setAvailableBalance] = useState(0)
  const [loading, setLoading] = useState(true)

  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawNotes, setWithdrawNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchEarnings = async () => {
    try {
      const [earnRes, withRes] = await Promise.all([
        api.get('/api/orders/earnings/me'),
        api.get('/api/withdrawals/me')
      ])
      setEarnings(earnRes.data.earnings)
      setWithdrawals(withRes.data.withdrawals)
      setAvailableBalance(withRes.data.availableBalance)
      setWithdrawAmount(withRes.data.availableBalance.toString())
    } catch (error) {
      console.error("Failed to fetch earnings", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEarnings()
  }, [])

  const handleWithdraw = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.post('/api/withdrawals', {
        amount: Number(withdrawAmount),
        notes: withdrawNotes
      })
      setShowWithdrawModal(false)
      fetchEarnings() // refresh data
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to request withdrawal')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-subtle)' }}>Loading earnings...</div>
  }

  if (!earnings) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--accent)' }}>Failed to load earnings.</div>
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      <div className="page-header">
        <div className="page-title">Earnings Dashboard</div>
        <div className="page-desc">Track your delivery fees and payouts</div>
      </div>

      <div style={{ background: 'var(--primary)', color: '#fff', padding: '16px 18px', borderRadius: 'var(--r-md)', marginBottom: 14, boxShadow: 'var(--e-2)' }}>
        <div style={{ fontSize: '0.68rem', opacity: 0.85, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
          Total all-time earnings
        </div>
        <div style={{ fontSize: '1.7rem', fontWeight: 700, fontFamily: 'Space Grotesk', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
          GHS {earnings.total.toFixed(2)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22 }}>
        <div style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 'var(--r-md)', border: '1px solid var(--border-light)' }}>
          {/* Icon sits beside the label rather than above it — stacking cost
              ~38px of height per card for no added meaning. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#ecfdf5', color: '#10b981', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <DollarSign size={12} />
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cash collected</div>
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>GHS {earnings.cashCollected.toFixed(2)}</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>Kept from customers</div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 'var(--r-md)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#eff6ff', color: '#3b82f6', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Wallet size={12} />
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Owed to you</div>
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>GHS {earnings.owedByCompany.toFixed(2)}</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2, marginBottom: 8 }}>Available: GHS {availableBalance.toFixed(2)}</div>

          <button
            className="btn-primary"
            style={{ width: '100%', padding: '7px 0', fontSize: '0.72rem', marginTop: 'auto', justifyContent: 'center' }}
            disabled={availableBalance <= 0}
            onClick={() => setShowWithdrawModal(true)}
          >
            Withdraw
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 10, fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Withdrawal history
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
        {withdrawals.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 'var(--r-sm)', border: '1px dashed var(--border-light)' }}>
            No withdrawals yet.
          </div>
        ) : (
          withdrawals.map((w, i) => (
            <div key={i} style={{ background: 'var(--bg-card)', padding: '10px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-heading)' }}>Withdrawal</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  <Calendar size={11} /> {new Date(w.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-body)', fontVariantNumeric: 'tabular-nums' }}>GHS {w.amount.toFixed(2)}</div>
                <div style={{ fontSize: '0.66rem', marginTop: 2, color: w.status === 'PAID' ? '#10b981' : w.status === 'REJECTED' ? '#ef4444' : '#f59e0b', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                  {w.status === 'PAID' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                  {w.status}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginBottom: 10, fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Recent deliveries
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {earnings.history.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 'var(--r-sm)', border: '1px dashed var(--border-light)' }}>
            You haven't completed any deliveries yet.
          </div>
        ) : (
          earnings.history.map((h, i) => (
            <div key={i} style={{ background: 'var(--bg-card)', padding: '10px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-heading)' }}>{h.orderId}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  <Calendar size={11} /> {new Date(h.date).toLocaleDateString()}
                </div>
                <div style={{ fontSize: '0.62rem', marginTop: 5, display: 'inline-flex', alignItems: 'center', gap: 4, background: h.paymentMethod === 'PAY_ON_DELIVERY' ? '#ecfdf5' : '#eff6ff', color: h.paymentMethod === 'PAY_ON_DELIVERY' ? '#10b981' : '#3b82f6', padding: '3px 7px', borderRadius: 'var(--r-pill)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {h.paymentMethod === 'PAY_ON_DELIVERY' ? 'Cash Trip' : 'Company Trip'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-body)', fontVariantNumeric: 'tabular-nums' }}>+GHS {h.amount.toFixed(2)}</div>
                {h.paymentMethod !== 'PAY_ON_DELIVERY' && (
                  <div style={{ fontSize: '0.66rem', marginTop: 2, color: h.payoutStatus === 'PAID_OUT' ? '#10b981' : '#f59e0b', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                    {h.payoutStatus === 'PAID_OUT' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                    {h.payoutStatus === 'PAID_OUT' ? 'Settled' : 'Unpaid'}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showWithdrawModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-card)', width: '100%', borderTopLeftRadius: 'var(--r-lg)', borderTopRightRadius: 'var(--r-lg)', padding: 18, paddingBottom: 'max(28px, env(safe-area-inset-bottom))' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-heading)', letterSpacing: '-0.015em' }}>Request withdrawal</div>
              <button onClick={() => setShowWithdrawModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleWithdraw}>
              <div className="input-group" style={{ marginBottom: 16 }}>
                <label>Amount (GHS)</label>
                <input 
                  type="number" 
                  step="0.01"
                  max={availableBalance}
                  min="0.1"
                  className="input-field" 
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  required
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Available to withdraw: GHS {availableBalance.toFixed(2)}
                </div>
              </div>

              <div className="input-group" style={{ marginBottom: 24 }}>
                <label>Momo Details / Notes (Optional)</label>
                <textarea 
                  className="input-field" 
                  value={withdrawNotes}
                  onChange={(e) => setWithdrawNotes(e.target.value)}
                  placeholder="e.g. Please send to MTN 024xxxxxxx"
                  rows={3}
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', height: 48, justifyContent: 'center' }}
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
