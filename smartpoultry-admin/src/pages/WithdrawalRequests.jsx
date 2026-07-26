import { useState, useEffect } from 'react'
import api from '../api/axios'

export default function WithdrawalRequests() {
  const [withdrawals, setWithdrawals] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(null)

  const fetchWithdrawals = async () => {
    try {
      const res = await api.get('/api/withdrawals')
      setWithdrawals(res.data.withdrawals)
    } catch (error) {
      console.error("Failed to fetch withdrawals", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWithdrawals()
  }, [])

  const handleUpdateStatus = async (id, status) => {
    setProcessing(id)
    try {
      await api.patch(`/api/withdrawals/${id}/status`, { status })
      fetchWithdrawals()
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update status')
    } finally {
      setProcessing(null)
    }
  }

  if (loading) {
    return <div className="loading">Loading withdrawal requests...</div>
  }

  return (
    <div className="dashboard-content">
      <div className="page-header">
        <h1 className="page-title">Withdrawal Requests</h1>
        <p className="page-desc">Manage driver earnings payouts and reconciliation</p>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Driver</th>
              <th>Amount</th>
              <th>Notes / Details</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {withdrawals.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>
                  No withdrawal requests found.
                </td>
              </tr>
            ) : (
              withdrawals.map(w => (
                <tr key={w.id}>
                  <td>{new Date(w.createdAt).toLocaleString()}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{w.driver.name}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-subtle)' }}>{w.driver.phone}</div>
                  </td>
                  <td style={{ fontWeight: 600 }}>GHS {w.amount.toFixed(2)}</td>
                  <td>{w.notes || '-'}</td>
                  <td>
                    <span className={`status-badge status-${w.status.toLowerCase()}`}>
                      {w.status}
                    </span>
                  </td>
                  <td>
                    {w.status === 'PENDING' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button 
                          className="btn btn-primary btn-sm"
                          disabled={processing === w.id}
                          onClick={() => handleUpdateStatus(w.id, 'PAID')}
                        >
                          Mark Paid
                        </button>
                        <button 
                          className="btn btn-outline btn-sm"
                          disabled={processing === w.id}
                          onClick={() => handleUpdateStatus(w.id, 'REJECTED')}
                          style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    {w.status !== 'PENDING' && (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-subtle)' }}>
                        Processed {w.processedAt ? new Date(w.processedAt).toLocaleDateString() : ''}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
