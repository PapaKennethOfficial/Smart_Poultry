import { useState } from 'react'
import { Star, Loader2 } from 'lucide-react'
import api from '../api/axios'

export default function ReviewModal({ isOpen, onClose, orderId, onReviewSubmitted }) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await api.post(`/api/orders/${orderId}/review`, { rating, comment })
      onReviewSubmitted(res.data.review)
      onClose()
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to submit review')
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', zIndex: 1100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20
    }}>
      <div style={{
        background: '#fff', padding: 28, borderRadius: 16, width: '100%', maxWidth: 400,
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'Space Grotesk', fontSize: '1.2rem', fontWeight: 600, color: '#0d1f0e' }}>
            Leave a Review
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#8da58f' }}>&times;</button>
        </div>

        {error && <div style={{ color: '#b91c1c', fontSize: '0.85rem', marginBottom: 15, background: 'rgba(239,68,68,0.1)', padding: 10, borderRadius: 8 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={32}
                onClick={() => setRating(star)}
                fill={star <= rating ? '#FFAA00' : 'none'}
                color={star <= rating ? '#FFAA00' : '#dddabd'}
                style={{ cursor: 'pointer' }}
              />
            ))}
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label" style={{ display: 'block', marginBottom: 5, fontSize: '0.85rem', color: '#5e7a61' }}>Comment (optional)</label>
            <textarea
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="How was your delivery?"
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #dddabd', outline: 'none', resize: 'vertical' }}
            />
          </div>

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: 12, background: '#237227', color: '#fff', border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8
          }}>
            {loading ? <Loader2 size={16} className="lucide-spin" /> : "Submit Review"}
          </button>
        </form>
      </div>
    </div>
  )
}
