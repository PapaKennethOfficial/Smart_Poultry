import { useState, useEffect } from 'react'
import { ShoppingCart, Package, Search, Plus, Minus, CheckCircle2, ShoppingBag, MapPin } from 'lucide-react'
import api from '../api/axios'

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

export default function CustomerMarketplace() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Cart state
  const [cart, setCart] = useState({}) // { productId: quantity }
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0])
  const [address, setAddress] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('PAY_ON_DELIVERY')
  const [notes, setNotes] = useState('')
  const [coords, setCoords] = useState(null)
  const [locating, setLocating] = useState(false)
  
  // Order submission
  const [submitting, setSubmitting] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState(null)

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/products')
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

  const addToCart = (productId) => {
    setCart(prev => ({ ...prev, [productId]: (prev[productId] || 0) + 1 }))
  }

  const removeFromCart = (productId) => {
    setCart(prev => {
      const newCart = { ...prev }
      if (newCart[productId] > 1) {
        newCart[productId] -= 1
      } else {
        delete newCart[productId]
      }
      return newCart
    })
  }

  const handleCheckout = async (e) => {
    e.preventDefault()
    if (Object.keys(cart).length === 0) return alert('Your cart is empty!')
    
    setSubmitting(true)
    try {
      // Create separate orders for each product for now based on current schema, 
      // or if schema supports multiple products per order, adjust accordingly.
      // Assuming DeliveryOrder supports one product per order based on the prisma schema: `productId String`
      
      const orderPromises = Object.keys(cart).map(productId => {
        return api.post('/api/orders', {
          productId,
          quantity: cart[productId],
          deliveryDate: new Date(deliveryDate).toISOString(),
          address,
          contactNumber,
          paymentMethod,
          notes,
          deliveryLatitude: coords?.latitude,
          deliveryLongitude: coords?.longitude,
        })
      })
      
      const results = await Promise.all(orderPromises)
      
      setOrderSuccess(results[0].data.order.orderId) // Just show the first ID or a success message
      setCart({})
      setDeliveryDate(new Date().toISOString().split('T')[0])
      setAddress('')
      setContactNumber('')
      setPaymentMethod('PAY_ON_DELIVERY')
      setNotes('')
      setCoords(null)
    } catch (err) {
      alert('Checkout failed: ' + formatApiError(err, err.message))
    } finally {
      setSubmitting(false)
    }
  }

  // Turn { lat, lon } into a human street address using OpenStreetMap's
  // Nominatim reverse geocoder. Free, no API key required; the driver will
  // read this text so it's worth having a real address rather than raw coords.
  const reverseGeocode = async (latitude, longitude) => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) return null
      const data = await res.json()
      // display_name is the fully-qualified string; fall back to nothing if empty
      return typeof data?.display_name === 'string' ? data.display_name : null
    } catch {
      return null
    }
  }

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Location is not supported by this browser.')
      return
    }

    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const latitude = pos.coords.latitude
        const longitude = pos.coords.longitude
        setCoords({ latitude, longitude })

        // Only overwrite the address field if the user hasn't typed anything
        // — respect any custom instructions they've already entered.
        if (!address.trim()) {
          const readable = await reverseGeocode(latitude, longitude)
          if (readable) setAddress(readable)
        }
        setLocating(false)
      },
      () => {
        setLocating(false)
        alert('Could not get your current location. Please allow location access or enter your address.')
      },
      { enableHighAccuracy: true, timeout: 12000 }
    )
  }

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
  
  const cartItems = Object.keys(cart).map(id => {
    const p = products.find(prod => prod.id === id)
    return { ...p, quantity: cart[id], total: p.price * cart[id] }
  })
  
  const cartTotal = cartItems.reduce((sum, item) => sum + item.total, 0)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, minHeight: '100%' }}>
      {/* Products Catalog */}
      <div>
        <div className="page-header" style={{ marginBottom: 20 }}>
          <div className="page-title">Farm Marketplace</div>
          <div className="page-desc">Browse fresh products directly from our poultry farm</div>
        </div>

        <div style={{ position: 'relative', marginBottom: 24 }}>
          <Search size={18} color="var(--text-subtle)" style={{ position: 'absolute', left: 14, top: 11 }} />
          <input 
            type="text" 
            className="form-input" 
            placeholder="Search products..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ paddingLeft: 40 }}
          />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-subtle)' }}>Loading products...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="chart-card" style={{ textAlign: 'center', padding: '60px 0' }}>
            <Package size={48} color="var(--border)" style={{ margin: '0 auto 16px' }} />
            <div style={{ color: 'var(--text-muted)' }}>No products found.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {filteredProducts.map(p => (
              <div key={p.id} className="stat-card" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                <div style={{ height: 140, background: 'linear-gradient(135deg, var(--primary-muted), var(--sage-light))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Package size={48} color="var(--primary)" opacity={0.5} />
                </div>
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, color: 'var(--text-heading)', fontSize: '1.05rem' }}>{p.name}</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary)' }}>GHS {p.price}</div>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12, flex: 1 }}>
                    {p.description || 'Premium farm product.'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Per {p.unit}</div>
                    <button 
                      className="btn-outline" 
                      style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                      onClick={() => addToCart(p.id)}
                    >
                      <Plus size={14} /> Add
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cart Sidebar */}
      <div style={{ background: 'var(--bg-card)', borderLeft: '1px solid var(--border)', margin: '-24px -28px -24px 0', padding: '24px 28px', display: 'flex', flexDirection: 'column' }}>
        <div className="section-header">
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingCart size={18} color="var(--primary)" /> Your Cart
          </div>
          {cartItems.length > 0 && <span className="badge badge-gold">{cartItems.length} items</span>}
        </div>

        {cartItems.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-subtle)', textAlign: 'center', opacity: 0.7 }}>
            <ShoppingBag size={48} style={{ marginBottom: 16 }} />
            <div>Your cart is empty<br/>Add some products to get started</div>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', marginRight: -8, paddingRight: 8 }}>
            {cartItems.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-heading)' }}>{item.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>GHS {item.price} / {item.unit}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>GHS {item.total.toFixed(2)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', borderRadius: 6, padding: 2 }}>
                    <button type="button" onClick={() => removeFromCart(item.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}><Minus size={14}/></button>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, minWidth: 16, textAlign: 'center' }}>{item.quantity}</span>
                    <button type="button" onClick={() => addToCart(item.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}><Plus size={14}/></button>
                  </div>
                </div>
              </div>
            ))}
            
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '2px dashed var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Subtotal</div>
                <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-heading)' }}>GHS {cartTotal.toFixed(2)}</div>
              </div>

              <form onSubmit={handleCheckout}>
                <div className="form-group">
                  <label className="form-label">Delivery Date *</label>
                  <input required type="date" className="form-input" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Delivery Address *</label>
                  <textarea required className="form-input" rows={2} value={address} onChange={e => setAddress(e.target.value)} placeholder="Full street address" />
                </div>
                <div className="form-group">
                  <button type="button" className="btn-outline" style={{ width: '100%', justifyContent: 'center' }} onClick={useCurrentLocation} disabled={locating}>
                    <MapPin size={14} />
                    {locating ? 'Getting location...' : coords ? 'Location attached' : 'Use my current location'}
                  </button>
                  {coords && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginTop: 6, textAlign: 'center' }}>
                      {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Number *</label>
                  <input required type="tel" className="form-input" value={contactNumber} onChange={e => setContactNumber(e.target.value)} placeholder="e.g. 0241234567" />
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Option *</label>
                  <select required className="form-select" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                    {PAYMENT_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes (Optional)</label>
                  <textarea className="form-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Delivery instructions" />
                </div>

                <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled={submitting}>
                  {submitting ? 'Processing...' : 'Place Order'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {orderSuccess && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ textAlign: 'center', padding: '40px 30px' }}>
            <CheckCircle2 size={56} color="var(--primary)" style={{ margin: '0 auto 16px' }} />
            <h2 className="modal-title" style={{ fontSize: '1.5rem', marginBottom: 8 }}>Order Placed Successfully!</h2>
            <p className="modal-subtitle">Your order has been received and will be processed soon.</p>
            <div style={{ background: 'var(--bg)', padding: 16, borderRadius: 8, marginBottom: 24, fontSize: '0.85rem' }}>
              Reference ID: <strong>{orderSuccess}</strong>
            </div>
            <button className="btn-primary" onClick={() => setOrderSuccess(null)}>Continue Shopping</button>
          </div>
        </div>
      )}
    </div>
  )
}
