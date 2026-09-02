import { useState, useEffect } from 'react'
import { ShoppingCart, Package, Search, Plus, Minus, CheckCircle2, ShoppingBag, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '../api/axios'
import { useCart } from '../context/CartContext'
import Pagination from '../components/Pagination'
import EmptyState from '../components/EmptyState'
import Skeleton from '../components/Skeleton'
import PullToRefresh from '../components/PullToRefresh'
import ProductImage from '../components/ProductImage'

// Keep this list aligned with the backend `PAYMENT_METHODS` enum
// (smartpoultry-backend/src/routes/order.routes.js). Card and bank transfer
// are not yet supported server-side, so we don't offer them in the UI.
const PAYMENT_OPTIONS = [
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'PAY_ON_DELIVERY', label: 'Payment on Delivery' },
]

function formatApiError(err, fallback) {
  const fieldErrors = err.response?.data?.errors
  if (fieldErrors) {
    const messages = Object.entries(fieldErrors)
      .flatMap(([field, values]) => (values || []).map(message => `${field.replaceAll('_', ' ')}: ${message}`))
    if (messages.length) return messages.join(' ')
  }
  return err.response?.data?.message || fallback
}

const CATEGORIES = ['All', 'Eggs', 'Poultry Meat', 'Live Birds', 'Farm Inputs']

export default function CustomerMarketplace() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8
  
  const { addToCart } = useCart()
  
  const fetchProducts = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (activeCategory !== 'All') params.append('category', activeCategory)
      if (searchTerm) params.append('search', searchTerm)

      const res = await api.get(`/api/products?${params.toString()}`)
      setProducts(res.data.products || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])


  // Checkout is handled in CartDrawer

  // The backend handles filtering now, so we just use the returned products
  const filteredProducts = products

  // Paginate
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // Reset page when filters change (and refetch)
  useEffect(() => {
    setCurrentPage(1)
    const delayDebounceFn = setTimeout(() => {
      fetchProducts()
    }, 300)
    return () => clearTimeout(delayDebounceFn)
  }, [searchTerm, activeCategory])

  return (
    <PullToRefresh onRefresh={fetchProducts}>
      <div className="marketplace-layout">
        {/* Products Catalog */}
        <div>
          <div className="page-header" style={{ marginBottom: 20 }}>
          <div className="page-title">Farm Marketplace</div>
          <div className="page-desc">Browse fresh products directly from our poultry farm</div>
        </div>

        <div style={{ position: 'relative', marginBottom: 16 }}>
          <Search size={18} color="var(--text-subtle)" style={{ position: 'absolute', left: 14, top: 11 }} />
          <input 
            type="text" 
            className="form-input" 
            placeholder="e.g., Fresh Large Eggs" 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ paddingLeft: 40 }}
          />
        </div>

        {/* Category Filter Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '7px 16px',
                borderRadius: 20,
                border: activeCategory === cat ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
                background: activeCategory === cat ? 'var(--primary-subtle)' : 'var(--bg-card)',
                color: activeCategory === cat ? 'var(--primary)' : 'var(--text-muted)',
                fontSize: '0.78rem',
                fontWeight: activeCategory === cat ? 600 : 400,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                transition: 'all 0.15s',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="marketplace-products-grid">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
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
        ) : paginatedProducts.length === 0 ? (
          <EmptyState 
            icon={Package} 
            title="No products found" 
            description={searchTerm ? `We couldn't find anything matching "${searchTerm}".` : "There are currently no products available in this category."}
            actionText={searchTerm || activeCategory !== 'All' ? "Clear Filters" : null}
            onAction={() => {
              setSearchTerm('')
              setActiveCategory('All')
            }}
          />
        ) : (
          <div className="marketplace-products-grid">
            {paginatedProducts.map(p => {
              return (
              <div
                key={p.id}
                className="product-card"
                style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 'var(--r-md)', position: 'relative' }}
              >
                {/* Image takes the slot the product name used to occupy. */}
                <ProductImage src={p.imageUrl} alt={p.name} ratio="3 / 2" radius="0" />

                <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                  {/* The name now lives where the description used to be.
                      Clamped to two lines so a long name cannot make one card
                      taller than its neighbours and break the grid. */}
                  <div
                    style={{
                      fontFamily: 'Space Grotesk', fontWeight: 600,
                      color: 'var(--text-heading)', fontSize: '0.82rem',
                      lineHeight: 1.3, display: '-webkit-box',
                      WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      overflow: 'hidden', minHeight: '2.13em',
                    }}
                  >
                    {p.name}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-heading)', fontVariantNumeric: 'tabular-nums' }}>
                      GHS {p.price}
                    </span>
                    <span style={{ fontSize: '0.66rem', color: 'var(--text-subtle)' }}>/ {p.unit}</span>
                  </div>

                  <div style={{
                    fontSize: '0.65rem', fontWeight: 600, marginTop: -1,
                    color: p.stock > 5 ? 'var(--primary)' : p.stock > 0 ? '#d97706' : '#ef4444',
                  }}>
                    {p.stock > 5 ? 'In stock' : p.stock > 0 ? `Only ${p.stock} left` : 'Out of stock'}
                  </div>

                  <button
                    className="btn-primary"
                    style={{ marginTop: 'auto', width: '100%', fontSize: '0.74rem' }}
                    onClick={() => addToCart(p)}
                    disabled={p.stock <= 0}
                  >
                    {p.stock <= 0 ? 'Out of stock' : 'Add to cart'}
                  </button>
                </div>
              </div>
            )})}
          </div>
        )}

        {!loading && filteredProducts.length > itemsPerPage && (
          <div style={{ marginTop: 24 }}>
            <Pagination
              currentPage={currentPage}
              totalItems={filteredProducts.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>
      </div>
    </PullToRefresh>
  )
}
