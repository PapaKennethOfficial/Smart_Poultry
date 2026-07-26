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

      <div style={{ background: 'var(--primary)', color: '#fff', padding: 24, borderRadius: 16, marginBottom: 20, boxShadow: '0 8px 24px rgba(35, 114, 39, 0.2)' }}>
        <div style={{ fontSize: '0.9rem', opacity: 0.9, marginBottom: 4 }}>Total All-Time Earnings</div>
        <div style={{ fontSize: '2.4rem', fontWeight: 800, fontFamily: 'Space Grotesk' }}>
          GHS {earnings.total.toFixed(2)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
        <div style={{ background: 'var(--bg-card)', padding: 20, borderRadius: 16, border: '1px solid var(--border-light)' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <DollarSign size={20} />
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-subtle)', fontWeight: 600 }}>Cash Collected</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: 4 }}>GHS {earnings.cashCollected.toFixed(2)}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>Kept from customers</div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: 20, borderRadius: 16, border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Wallet size={20} />
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-subtle)', fontWeight: 600 }}>Owed by Company</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: 4 }}>GHS {earnings.owedByCompany.toFixed(2)}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4, marginBottom: 12 }}>Available: GHS {availableBalance.toFixed(2)}</div>
          
          <button 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '8px 0', fontSize: '0.85rem', marginTop: 'auto', justifyContent: 'center' }}
            disabled={availableBalance <= 0}
            onClick={() => setShowWithdrawModal(true)}
          >
            Withdraw Funds
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 16, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-heading)' }}>
        Withdrawal History
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
        {withdrawals.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 12, border: '1px dashed var(--border-light)' }}>
            No withdrawals yet.
          </div>
        ) : (
          withdrawals.map((w, i) => (
            <div key={i} style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 12, border: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-heading)' }}>Withdrawal</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Calendar size={12} /> {new Date(w.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-body)' }}>GHS {w.amount.toFixed(2)}</div>
                <div style={{ fontSize: '0.75rem', marginTop: 4, color: w.status === 'PAID' ? '#10b981' : w.status === 'REJECTED' ? '#ef4444' : '#f59e0b', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                  {w.status === 'PAID' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                  {w.status}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginBottom: 16, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-heading)' }}>
        Recent Deliveries
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {earnings.history.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 12, border: '1px dashed var(--border-light)' }}>
            You haven't completed any deliveries yet.
          </div>
        ) : (
          earnings.history.map((h, i) => (
            <div key={i} style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 12, border: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{h.orderId}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Calendar size={12} /> {new Date(h.date).toLocaleDateString()}
                </div>
                <div style={{ fontSize: '0.75rem', marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4, background: h.paymentMethod === 'PAY_ON_DELIVERY' ? '#ecfdf5' : '#eff6ff', color: h.paymentMethod === 'PAY_ON_DELIVERY' ? '#10b981' : '#3b82f6', padding: '4px 8px', borderRadius: 6, fontWeight: 600 }}>
                  {h.paymentMethod === 'PAY_ON_DELIVERY' ? 'Cash Trip' : 'Company Trip'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-body)' }}>+GHS {h.amount.toFixed(2)}</div>
                {h.paymentMethod !== 'PAY_ON_DELIVERY' && (
                  <div style={{ fontSize: '0.75rem', marginTop: 4, color: h.payoutStatus === 'PAID_OUT' ? '#10b981' : '#f59e0b', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
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
          <div style={{ background: 'var(--bg-card)', width: '100%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-heading)' }}>Request Withdrawal</div>
              <button onClick={() => setShowWithdrawModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer' }}>
                <X size={24} />
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
