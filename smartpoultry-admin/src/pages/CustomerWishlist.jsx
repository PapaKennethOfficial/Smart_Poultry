import { useState, useEffect } from 'react'
import { Heart, Plus, Package } from 'lucide-react'
import api from '../api/axios'
import { useCart } from '../context/CartContext'
import PullToRefresh from '../components/PullToRefresh'
import EmptyState from '../components/EmptyState'
import Skeleton from '../components/Skeleton'

export default function CustomerWishlist() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const { addToCart } = useCart()

  const fetchWishlist = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/products/wishlist')
      setProducts(res.data.products || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWishlist()
  }, [])

  const removeFromWishlist = async (product) => {
    try {
      await api.post(`/api/products/${product.id}/wishlist`)
      // Optimistically remove from state
      setProducts(prev => prev.filter(p => p.id !== product.id))
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <PullToRefresh onRefresh={fetchWishlist}>
      <div className="marketplace-layout">
        <div>
          <div className="page-header" style={{ marginBottom: 20 }}>
            <div className="page-title">My Wishlist</div>
            <div className="page-desc">Your favorite farm products</div>
          </div>

          {loading ? (
            <div className="marketplace-products-grid">
              {[1, 2, 3].map(i => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', height: 200, padding: 20, background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 12 }}>
                  <Skeleton variant="text" className="mb-2" style={{ height: 24, width: '70%' }} />
                  <Skeleton variant="text" className="mb-4" style={{ height: 16, width: '40%' }} />
                  <Skeleton variant="rectangular" className="flex-1 mb-4 rounded-md" />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Skeleton variant="text" style={{ height: 32, width: '30%' }} />
                    <Skeleton variant="rounded" style={{ height: 32, width: '30%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <EmptyState 
              icon={Heart} 
              title="Your wishlist is empty" 
              description="Save items you like by tapping the heart icon in the marketplace."
            />
          ) : (
            <div className="marketplace-products-grid">
              {products.map(p => (
                <div key={p.id} style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 12 }}>
                  <div style={{ padding: 20, display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, color: 'var(--text-heading)', fontSize: '1.05rem', paddingRight: 24 }}>{p.name}</div>
                      <button 
                        onClick={() => removeFromWishlist(p)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, marginTop: -4, marginRight: -4 }}
                      >
                        <Heart size={20} fill="#ef4444" color="#ef4444" />
                      </button>
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-heading)', marginBottom: 6 }}>GHS {p.price}</div>
                    {p.category && (
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>{p.category}</span>
                    )}
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16, flex: 1, lineHeight: 1.5 }}>
                      {p.description || 'Premium farm product.'}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--border-light)' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Per {p.unit}</div>
                        <div style={{ fontSize: '0.75rem', color: p.stock > 5 ? 'var(--primary)' : p.stock > 0 ? '#d97706' : '#ef4444', fontWeight: 600, marginTop: 2 }}>
                          {p.stock > 5 ? `${p.stock} in stock` : p.stock > 0 ? `Only ${p.stock} left` : 'Out of stock'}
                        </div>
                      </div>
                      <button 
                        className="btn-outline" 
                        style={{ padding: '8px 16px', fontSize: '0.75rem', opacity: p.stock === 0 ? 0.4 : 1, borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => addToCart(p)}
                        disabled={p.stock <= 0}
                      >
                        <Plus size={16} /> Add
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PullToRefresh>
  )
}
