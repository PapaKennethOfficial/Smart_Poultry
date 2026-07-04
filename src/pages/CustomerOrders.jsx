import { useState, useEffect, useRef } from 'react'
import { ShoppingBag, Clock, Truck, CheckCircle2, Package, MapPin, Eye, Phone, MessageCircle, Car, User as UserIcon } from 'lucide-react'
import api from '../api/axios'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import { haversineKm, formatDistance } from '../utils/distance'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import TableFilter from '../components/TableFilter'
import Pagination from '../components/Pagination'

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
})
L.Marker.prototype.options.icon = DefaultIcon

// Colour-coded pin markers matching AssignedDeliveries.jsx so the customer sees
// the same visual language as their driver — green = destination, blue = driver.
function coloredPin(fill) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="34" viewBox="0 0 26 34">
      <path d="M13 0C5.82 0 0 5.82 0 13c0 9.75 13 21 13 21s13-11.25 13-21C26 5.82 20.18 0 13 0z"
            fill="${fill}" stroke="#fff" stroke-width="2"/>
      <circle cx="13" cy="13" r="4.5" fill="#fff"/>
    </svg>`
  return L.divIcon({
    className: '',
    html: svg,
    iconSize: [26, 34],
    iconAnchor: [13, 34],
    popupAnchor: [0, -30],
  })
}
const driverIcon = coloredPin('#3b82f6')
const destinationIcon = coloredPin('#237227')

// Fit the map to include every meaningful marker.
function FitBounds({ points }) {
  const map = useMap()
  useEffect(() => {
    if (!points || points.length === 0) return
    if (points.length === 1) {
      map.setView(points[0], 15)
      return
    }
    const bounds = L.latLngBounds(points)
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 })
  }, [map, points?.map(p => p.join(',')).join('|')])
  return null
}

function StatCard({ label, value, icon: Icon, iconColor, accent }) {
  return (
    <div className="stat-card">
      <div className="card-accent" style={{ background: accent }} />
      <div className="card-icon" style={{ background: `${iconColor}22`, width: 46, height: 46, borderRadius: 12 }}>
        <Icon size={22} color={iconColor} strokeWidth={1.75} />
      </div>
      <div className="card-label">{label}</div>
      <div className="card-value">{value}</div>
    </div>
  )
}

const STATUS_MAP = {
  PENDING: { label: 'Pending', color: 'badge-amber', icon: Clock },
  IN_TRANSIT: { label: 'In Transit', color: 'badge-blue', icon: Truck },
  DELIVERED: { label: 'Delivered', color: 'badge-green', icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelled', color: 'badge-red', icon: Package }
}

const PAYMENT_LABELS = {
  MOBILE_MONEY: 'Mobile Money',
  BANK_TRANSFER: 'Bank Transfer',
  CARD: 'Card',
  PAY_ON_DELIVERY: 'Pay on Delivery',
}

// ─── Delivery progress (estimated) ───────────────────────────────────────────
// Maps the four order statuses to a four-step indicator. CANCELLED orders
// short-circuit to a single "Cancelled" step rendered in red.
const PROGRESS_STEPS = [
  { key: 'PLACED',     label: 'Placed' },
  { key: 'PENDING',    label: 'Confirmed' },
  { key: 'IN_TRANSIT', label: 'In Transit' },
  { key: 'DELIVERED',  label: 'Delivered' },
]

function progressIndexFor(status) {
  // 'Placed' is always reached as soon as the order exists.
  if (!status || status === 'PENDING') return 1
  if (status === 'IN_TRANSIT') return 2
  if (status === 'DELIVERED') return 3
  return 0
}

function DeliveryProgress({ status }) {
  if (status === 'CANCELLED') {
    return (
      <div style={{
        padding: '14px 16px', borderRadius: 10, marginBottom: 20,
        background: 'var(--clr-danger-bg)', color: 'var(--clr-danger-txt)',
        fontSize: '0.85rem', fontWeight: 600, textAlign: 'center',
      }}>
        Order cancelled
      </div>
    )
  }

  const currentIndex = progressIndexFor(status)
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
        {/* connecting line behind dots */}
        <div style={{
          position: 'absolute', top: 11, left: '8%', right: '8%', height: 2,
          background: 'var(--border-light)', zIndex: 0,
        }} />
        <div style={{
          position: 'absolute', top: 11, left: '8%',
          width: `${(currentIndex / (PROGRESS_STEPS.length - 1)) * 84}%`,
          height: 2, background: 'var(--primary)', zIndex: 0,
          transition: 'width 0.3s',
        }} />

        {PROGRESS_STEPS.map((step, i) => {
          const done = i <= currentIndex
          return (
            <div key={step.key} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              flex: 1, position: 'relative', zIndex: 1,
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: done ? 'var(--primary)' : '#fff',
                border: `2px solid ${done ? 'var(--primary)' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: '0.7rem', fontWeight: 700,
              }}>
                {done && <CheckCircle2 size={14} />}
              </div>
              <div style={{
                fontSize: '0.72rem', marginTop: 6, textAlign: 'center',
                fontWeight: i === currentIndex ? 600 : 400,
                color: done ? 'var(--text-heading)' : 'var(--text-subtle)',
              }}>
                {step.label}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function CustomerOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [searchValue, setSearchValue] = useState('')
  const itemsPerPage = 10
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [messages, setMessages] = useState([])
  const [messageText, setMessageText] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)

  const { socket } = useSocket()
  const { user } = useAuth()

  useEffect(() => {
    fetchOrders()
    const interval = setInterval(fetchOrders, 30000) // 30s instead of 10s for general order updates
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!selectedOrder) return
    const fresh = orders.find(o => o.id === selectedOrder.id)
    if (fresh) setSelectedOrder(prev => ({ ...fresh, driverLatitude: prev.driverLatitude || fresh.driverLatitude, driverLongitude: prev.driverLongitude || fresh.driverLongitude }))
  }, [orders, selectedOrder?.id])

  useEffect(() => {
    if (!selectedOrder || !socket) return undefined

    // Join room for this specific order
    socket.emit('join_order_room', selectedOrder.id)

    // Initial load of messages via API to get history
    const loadMessages = async () => {
      try {
        const res = await api.get(`/api/orders/${selectedOrder.id}/messages`)
        setMessages(res.data.messages || [])
      } catch (err) {
        console.error("Failed to load messages", err)
      }
    }
    loadMessages()

    const handleNewMessage = (msg) => {
      // msg format from backend/socket: { id, message, createdAt, sender: { id, name, role } }
      // the socket implementation in backend (socket.js) might just broadcast simple objects.
      // Assuming it broadcasts the saved message object or a custom format.
      setMessages(prev => [...prev, msg])
    }

    const handleLocationUpdate = (loc) => {
      // loc format: { orderId, latitude, longitude }
      if (loc.orderId === selectedOrder.id) {
        setSelectedOrder(prev => ({
          ...prev,
          driverLatitude: loc.latitude,
          driverLongitude: loc.longitude,
          driverLocationUpdatedAt: new Date().toISOString()
        }))
      }
    }

    socket.on('chat_message', handleNewMessage)
    socket.on('location_update', handleLocationUpdate)

    return () => {
      socket.off('chat_message', handleNewMessage)
      socket.off('location_update', handleLocationUpdate)
      // We don't necessarily need to leave the room right away, but it's good practice
    }
  }, [selectedOrder?.id, socket])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/orders/me')
      setOrders(res.data.orders || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!selectedOrder || !messageText.trim()) return

    const messageContent = messageText.trim()
    setMessageText('')
    setSendingMessage(true)
    try {
      // We still save via API to persist, but we also emit via socket for real-time
      const res = await api.post(`/api/orders/${selectedOrder.id}/messages`, {
        message: messageContent,
      })
      // The backend should ideally broadcast the message upon API creation or we emit directly.
      // Based on our socket.js, it expects `socket.emit('chat_message', msg)`
      socket.emit('chat_message', res.data.message)
      // The socket listener handles appending it, so we don't need to append here if the server broadcasts back to the sender too.
      // If it doesn't broadcast to sender, we append here. For safety, we append manually to ensure immediate UI update and let backend handle broadcasting to OTHERS.
      setMessages(prev => {
        // Prevent duplicate appending if socket also echoes back
        if (prev.some(m => m.id === res.data.message.id)) return prev
        return [...prev, res.data.message]
      })
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send message')
    } finally {
      setSendingMessage(false)
    }
  }

  const filteredOrders = orders.filter(o => {
    const matchesFilter = filter === 'ALL' || o.status === filter
    if (!matchesFilter) return false
    if (!searchValue) return true
    const s = searchValue.toLowerCase()
    return (
      (o.product?.name || '').toLowerCase().includes(s) ||
      (o.orderId || '').toLowerCase().includes(s)
    )
  })
  
  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [filter, searchValue])

  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const total = orders.length
  const active = orders.filter(o => o.status === 'PENDING' || o.status === 'IN_TRANSIT').length
  const completed = orders.filter(o => o.status === 'DELIVERED').length

  return (
    <div>
      <div className="page-header">
        <div className="page-title">My Orders</div>
        <div className="page-desc">Track and manage your farm product deliveries</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Total Orders" value={total} icon={ShoppingBag} iconColor="#84be88" accent="#84be88" />
        <StatCard label="Active Orders" value={active} icon={Truck} iconColor="#3b82f6" accent="#3b82f6" />
        <StatCard label="Completed" value={completed} icon={CheckCircle2} iconColor="#237227" accent="#237227" />
      </div>

      <div className="section-header" style={{ marginBottom: 16 }}>
        <div className="filter-tabs">
          {['ALL', 'PENDING', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'].map(f => (
            <button 
              key={f} 
              className={`filter-tab ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f.replace('_', ' ').charAt(0) + f.replace('_', ' ').slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      <TableFilter
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Search orders by product or ID…"
        resultCount={filteredOrders.length}
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-subtle)' }}>Loading your orders...</div>
      ) : paginatedOrders.length === 0 ? (
        <div className="chart-card" style={{ textAlign: 'center', padding: '60px 0' }}>
          <Package size={48} color="var(--border)" style={{ margin: '0 auto 16px' }} />
          <div style={{ color: 'var(--text-muted)' }}>No orders found for this status.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {paginatedOrders.map(o => {
            const statusConfig = STATUS_MAP[o.status] || STATUS_MAP.PENDING
            const StatusIcon = statusConfig.icon
            
            return (
              <div key={o.id} className="stat-card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }} onClick={() => setSelectedOrder(o)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', fontWeight: 600, letterSpacing: '0.05em' }}>{o.orderId}</div>
                    <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, color: 'var(--text-heading)', fontSize: '1.05rem', marginTop: 2 }}>{o.product?.name}</div>
                  </div>
                  <span className={`badge ${statusConfig.color}`}><StatusIcon size={12} /> {statusConfig.label}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, background: 'var(--bg)', padding: '10px 14px', borderRadius: 8 }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>Quantity</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{o.quantity} {o.product?.unit}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>Total Amount</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)' }}>GHS {o.amount.toFixed(2)}</div>
                  </div>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                  <span style={{ fontWeight: 600 }}>Payment:</span> {` ${PAYMENT_LABELS[o.paymentMethod] || o.paymentMethod || 'N/A'} - ${(o.paymentStatus || 'PENDING').replaceAll('_', ' ')}`}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <Clock size={14} style={{ marginTop: 2, color: 'var(--text-subtle)' }} />
                    <div><span style={{ fontWeight: 600 }}>Delivery:</span> {new Date(o.deliveryDate).toLocaleDateString()}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <MapPin size={14} style={{ marginTop: 2, color: 'var(--text-subtle)' }} />
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.address}</div>
                  </div>
                </div>

                <button className="btn-outline" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}>
                  <Eye size={14} /> View Details
                </button>
              </div>
            )
          })}
        </div>
      )}

      {!loading && filteredOrders.length > itemsPerPage && (
        <div style={{ marginTop: 24 }}>
          <Pagination 
            currentPage={currentPage}
            totalItems={filteredOrders.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {selectedOrder && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
              <div>
                <h2 className="modal-title">Order {selectedOrder.orderId}</h2>
                <div className="modal-subtitle" style={{ marginBottom: 0 }}>Placed on {new Date(selectedOrder.createdAt).toLocaleString()}</div>
              </div>
              <span className={`badge ${STATUS_MAP[selectedOrder.status]?.color || 'badge-gray'}`}>{selectedOrder.status}</span>
            </div>

            {/* Estimated delivery progress */}
            <DeliveryProgress status={selectedOrder.status} />

            <div className="section-header">
              <div className="section-title">Order Items</div>
            </div>
            <div style={{ border: '1px solid var(--border-light)', borderRadius: 8, padding: 16, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, background: 'var(--primary-muted)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Package size={20} color="var(--primary)" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{selectedOrder.product?.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedOrder.quantity} {selectedOrder.product?.unit}</div>
                  </div>
                </div>
                <div style={{ fontWeight: 700 }}>GHS {selectedOrder.amount.toFixed(2)}</div>
              </div>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-light)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: '0.84rem' }}>
                <div>
                  <div style={{ color: 'var(--text-subtle)', marginBottom: 4 }}>Payment Option</div>
                  <div style={{ fontWeight: 600 }}>{PAYMENT_LABELS[selectedOrder.paymentMethod] || selectedOrder.paymentMethod || 'N/A'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-subtle)', marginBottom: 4 }}>Payment Status</div>
                  <div style={{ fontWeight: 600 }}>{(selectedOrder.paymentStatus || 'PENDING').replaceAll('_', ' ')}</div>
                </div>
              </div>
            </div>

            <div className="section-header">
              <div className="section-title">Delivery Details</div>
            </div>
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 16, marginBottom: 24, fontSize: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ color: 'var(--text-subtle)', marginBottom: 4 }}>Scheduled Date</div>
                  <div style={{ fontWeight: 600 }}>{new Date(selectedOrder.deliveryDate).toLocaleDateString()}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-subtle)', marginBottom: 4 }}>Address</div>
                  <div style={{ fontWeight: 600 }}>{selectedOrder.address}</div>
                </div>
              </div>
              
              {selectedOrder.driver && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-light)' }}>
                  <div style={{ color: 'var(--text-subtle)', marginBottom: 8 }}>Delivery Driver</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    {selectedOrder.driver.vehicle?.driver_photo ? (
                      <img
                        src={selectedOrder.driver.vehicle.driver_photo}
                        alt={selectedOrder.driver.name}
                        style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', objectPosition: 'center top', border: '1px solid var(--border)' }}
                      />
                    ) : (
                      <div style={{ width: 44, height: 44, background: '#fff', border: '1px solid var(--border)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '0.95rem' }}>
                        {selectedOrder.driver.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight: 600 }}>{selectedOrder.driver.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 2 }}>
                        <Phone size={12} /> {selectedOrder.driver.vehicle?.driver_contact_number || selectedOrder.driver.phone || 'Contact not available'}
                      </div>
                    </div>
                  </div>

                  {/* Vehicle details — so the customer knows what to look out for */}
                  {selectedOrder.driver.vehicle && (
                    <div style={{
                      background: '#fff', border: '1px solid var(--border-light)',
                      borderRadius: 10, padding: 12,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-subtle)', fontSize: '0.78rem', marginBottom: 10 }}>
                        <Car size={14} /> Delivery vehicle
                      </div>
                      <div style={{ display: 'flex', gap: 12 }}>
                        {selectedOrder.driver.vehicle.vehicle_photo ? (
                          <img
                            src={selectedOrder.driver.vehicle.vehicle_photo}
                            alt="Delivery vehicle"
                            style={{ width: 96, height: 72, objectFit: 'cover', objectPosition: 'center', borderRadius: 8, border: '1px solid var(--border-light)', flexShrink: 0, background: 'var(--bg)' }}
                          />
                        ) : (
                          <div style={{ width: 96, height: 72, background: 'var(--bg)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Truck size={20} color="var(--border)" />
                          </div>
                        )}
                        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: '0.82rem' }}>
                          <div>
                            <div style={{ color: 'var(--text-subtle)', fontSize: '0.7rem' }}>Type</div>
                            <div style={{ fontWeight: 600 }}>{selectedOrder.driver.vehicle.vehicle_type || '—'}</div>
                          </div>
                          <div>
                            <div style={{ color: 'var(--text-subtle)', fontSize: '0.7rem' }}>Color</div>
                            <div style={{ fontWeight: 600 }}>{selectedOrder.driver.vehicle.color || '—'}</div>
                          </div>
                          <div>
                            <div style={{ color: 'var(--text-subtle)', fontSize: '0.7rem' }}>Make / Model</div>
                            <div style={{ fontWeight: 600 }}>
                              {[selectedOrder.driver.vehicle.make, selectedOrder.driver.vehicle.model].filter(Boolean).join(' ') || '—'}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: 'var(--text-subtle)', fontSize: '0.7rem' }}>License Plate</div>
                            <div style={{ fontWeight: 600 }}>{selectedOrder.driver.vehicle.license_plate || '—'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {(() => {
              const status = selectedOrder.status
              // Privacy rule: don't render a live map for terminal statuses.
              // Show a small summary card instead so the customer still sees
              // an outcome, not a stale-looking blank map.
              const isTerminal = status === 'DELIVERED' || status === 'CANCELLED'
              if (isTerminal) {
                return (
                  <>
                    <div className="section-header">
                      <div className="section-title">Delivery Summary</div>
                    </div>
                    <div style={{
                      background: status === 'DELIVERED' ? 'rgba(35,114,39,0.06)' : 'var(--clr-danger-bg)',
                      border: `1px solid ${status === 'DELIVERED' ? 'rgba(35,114,39,0.25)' : 'var(--clr-danger-txt)'}`,
                      borderRadius: 10, padding: '14px 16px', marginBottom: 24,
                      display: 'flex', alignItems: 'center', gap: 12,
                      color: status === 'DELIVERED' ? '#0d1f0e' : 'var(--clr-danger-txt)',
                      fontSize: '0.86rem',
                    }}>
                      {status === 'DELIVERED'
                        ? <CheckCircle2 size={20} color="#237227" />
                        : <Package size={20} color="var(--clr-danger-txt)" />}
                      <div style={{ lineHeight: 1.45 }}>
                        {status === 'DELIVERED'
                          ? 'Order delivered. Live driver tracking has ended.'
                          : 'Order cancelled. No live tracking available.'}
                      </div>
                    </div>
                  </>
                )
              }

              const destPoint = (selectedOrder.deliveryLatitude && selectedOrder.deliveryLongitude)
                ? [selectedOrder.deliveryLatitude, selectedOrder.deliveryLongitude]
                : null
              const driverPoint = (selectedOrder.driverLatitude && selectedOrder.driverLongitude)
                ? [selectedOrder.driverLatitude, selectedOrder.driverLongitude]
                : null
              if (!destPoint && !driverPoint) return null

              const points = [driverPoint, destPoint].filter(Boolean)
              const distKm = (driverPoint && destPoint)
                ? haversineKm(
                    { lat: driverPoint[0], lon: driverPoint[1] },
                    { lat: destPoint[0], lon: destPoint[1] },
                  )
                : null

              return (
                <>
                  <div className="section-header">
                    <div className="section-title">Live Delivery Location</div>
                    {distKm != null && (
                      <span className="badge badge-blue">~{formatDistance(distKm)} away</span>
                    )}
                  </div>
                  <div style={{ height: 260, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-light)', marginBottom: 8 }}>
                    <MapContainer
                      center={points[0]}
                      zoom={13}
                      style={{ height: '100%', width: '100%' }}
                      zoomControl={false}
                    >
                      <TileLayer
                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                        attribution="&copy; OpenStreetMap contributors"
                      />
                      <FitBounds points={points} />
                      {destPoint && (
                        <Marker position={destPoint} icon={destinationIcon}>
                          <Popup>Your delivery address</Popup>
                        </Marker>
                      )}
                      {driverPoint && (
                        <Marker position={driverPoint} icon={driverIcon}>
                          <Popup>Driver's current location</Popup>
                        </Marker>
                      )}
                      {driverPoint && destPoint && (
                        <Polyline positions={[driverPoint, destPoint]} color="#237227" weight={3} opacity={0.8} />
                      )}
                    </MapContainer>
                  </div>
                  {/* Legend + last-updated stamp */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: 20, fontSize: '0.72rem', color: 'var(--text-subtle)',
                    gap: 10, flexWrap: 'wrap',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} /> Driver
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#237227' }} /> Destination
                      </span>
                    </div>
                    {selectedOrder.driverLocationUpdatedAt && (
                      <span>
                        Updated {new Date(selectedOrder.driverLocationUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </>
              )
            })()}

            <div className="section-header">
              <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageCircle size={16} color="var(--primary)" /> Delivery Chat
              </div>
            </div>
            {!selectedOrder.driver ? (
              <div style={{ border: '1px solid var(--border-light)', borderRadius: 10, padding: 16, background: 'var(--bg)', marginBottom: 24, color: 'var(--text-muted)', fontSize: '0.84rem', lineHeight: 1.5 }}>
                A delivery staff member has not been assigned yet. The chat will open automatically once the manager assigns a driver to this order.
              </div>
            ) : (
              <>
              <div style={{ height: 240, overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: 10, padding: 12, background: 'var(--bg)', marginBottom: 12 }}>
                {messages.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-subtle)', fontSize: '0.84rem' }}>
                  No messages yet.
                </div>
                ) : messages.map(m => (
                <div key={m.id} style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', alignItems: m.sender?.role === 'CUSTOMER' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '78%', background: m.sender?.role === 'CUSTOMER' ? 'var(--primary)' : '#fff', color: m.sender?.role === 'CUSTOMER' ? '#fff' : 'var(--text-body)', padding: '9px 12px', borderRadius: 10, fontSize: '0.84rem', lineHeight: 1.45 }}>
                    {m.message}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', marginTop: 3 }}>
                    {m.sender?.name || 'User'} - {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                ))}
              </div>
              <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                <input
                  className="form-input"
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  placeholder="Type a message for the delivery staff..."
                />
                <button type="submit" className="btn-primary" disabled={sendingMessage || !messageText.trim()}>
                  Send
                </button>
              </form>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-primary" onClick={() => setSelectedOrder(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
