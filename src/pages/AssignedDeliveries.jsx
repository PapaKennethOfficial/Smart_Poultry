import { useState, useEffect } from 'react'
import { Truck, CheckCircle2, Package, MapPin, Clock, Phone, AlertCircle, MessageCircle, Navigation } from 'lucide-react'
import api from '../api/axios'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import { haversineKm, formatDistance } from '../utils/distance'

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
})
L.Marker.prototype.options.icon = DefaultIcon

// Colour-coded pin icons so the driver can tell their own position from the
// customer destination at a glance. Using divIcon keeps the visuals crisp
// without extra image assets.
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
const driverIcon = coloredPin('#3b82f6')      // blue — driver / me
const destinationIcon = coloredPin('#237227') // green — customer destination

// Small helper that centres/zooms the map so every meaningful marker fits.
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
  }, [map, points?.map(p => p.join(',')).join('|')]) // stable stringified dep
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
}

export default function AssignedDeliveries() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [searchValue, setSearchValue] = useState('')
  const itemsPerPage = 10
  const [actionLoading, setActionLoading] = useState(null) // store order ID being updated
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [messages, setMessages] = useState([])
  const [messageText, setMessageText] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)

  const { socket } = useSocket()

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/orders/assigned')
      setOrders(res.data.orders || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
    const interval = setInterval(fetchOrders, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const activeOrder = orders.find(o => o.status === 'IN_TRANSIT')
    if (!activeOrder || !navigator.geolocation || !socket) return undefined

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        // Emit via socket for instant map update
        socket.emit('location_update', {
          orderId: activeOrder.id,
          latitude,
          longitude
        })
        // Also persist to DB
        api.patch(`/api/orders/${activeOrder.id}/location`, {
          latitude,
          longitude,
        }).catch(() => {})
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 8000, timeout: 15000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [orders, socket])

  useEffect(() => {
    if (!selectedOrder || !socket) return undefined

    // Join room for this specific order
    socket.emit('join_order_room', selectedOrder.id)

    // Load initial messages
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
      setMessages(prev => [...prev, msg])
    }

    socket.on('chat_message', handleNewMessage)

    return () => {
      socket.off('chat_message', handleNewMessage)
    }
  }, [selectedOrder?.id, socket])

  const handleUpdateStatus = async (orderId, newStatus) => {
    setActionLoading(orderId)
    try {
      await api.patch(`/api/orders/${orderId}`, { status: newStatus })
      await fetchOrders()
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status')
    } finally {
      setActionLoading(null)
    }
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!selectedOrder || !messageText.trim()) return

    const messageContent = messageText.trim()
    setMessageText('')
    setSendingMessage(true)
    try {
      const res = await api.post(`/api/orders/${selectedOrder.id}/messages`, {
        message: messageContent,
      })
      // Emit via socket
      socket.emit('chat_message', res.data.message)
      setMessages(prev => {
        if (prev.some(m => m.id === res.data.message.id)) return prev
        return [...prev, res.data.message]
      })
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send message')
    } finally {
      setSendingMessage(false)
    }
  }

  const directionsUrl = (order) => {
    const destination = order.deliveryLatitude && order.deliveryLongitude
      ? `${order.deliveryLatitude},${order.deliveryLongitude}`
      : encodeURIComponent(order.address || '')
    return `https://www.google.com/maps/dir/?api=1&destination=${destination}`
  }

  const filteredOrders = orders.filter(o => {
    const matchesFilter = filter === 'ALL' || o.status === filter
    if (!matchesFilter) return false
    if (!searchValue) return true
    const s = searchValue.toLowerCase()
    return (
      (o.customer?.name || '').toLowerCase().includes(s) ||
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
  const pending = orders.filter(o => o.status === 'PENDING').length
  const inTransit = orders.filter(o => o.status === 'IN_TRANSIT').length
  const delivered = orders.filter(o => o.status === 'DELIVERED').length

  return (
    <div>
      <div className="page-header">
        <div className="page-title">My Deliveries</div>
        <div className="page-desc">Manage your assigned orders and update delivery status</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Total Assigned" value={total} icon={Package} iconColor="#84be88" accent="#84be88" />
        <StatCard label="Pending Startup" value={pending} icon={Clock} iconColor="#f59e0b" accent="#f59e0b" />
        <StatCard label="In Transit" value={inTransit} icon={Truck} iconColor="#3b82f6" accent="#3b82f6" />
        <StatCard label="Delivered" value={delivered} icon={CheckCircle2} iconColor="#237227" accent="#237227" />
      </div>

      <div className="section-header" style={{ marginBottom: 16 }}>
        <div className="filter-tabs">
          {['ALL', 'PENDING', 'IN_TRANSIT', 'DELIVERED'].map(f => (
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
        searchPlaceholder="Search deliveries by customer, product, or ID…"
        resultCount={filteredOrders.length}
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-subtle)' }}>Loading deliveries...</div>
      ) : paginatedOrders.length === 0 ? (
        <div className="chart-card" style={{ textAlign: 'center', padding: '60px 0' }}>
          <Truck size={48} color="var(--border)" style={{ margin: '0 auto 16px' }} />
          <div style={{ color: 'var(--text-muted)' }}>No assigned deliveries in this status.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {paginatedOrders.map(o => {
            const statusConfig = STATUS_MAP[o.status] || STATUS_MAP.PENDING
            const StatusIcon = statusConfig.icon
            
            return (
              <div key={o.id} className="stat-card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', fontWeight: 600, letterSpacing: '0.05em' }}>{o.orderId}</div>
                    <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, color: 'var(--text-heading)', fontSize: '1.05rem', marginTop: 2 }}>{o.product?.name}</div>
                  </div>
                  <span className={`badge ${statusConfig.color}`}><StatusIcon size={12} /> {statusConfig.label}</span>
                </div>

                <div style={{ background: 'var(--bg)', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 32, height: 32, background: 'var(--primary-muted)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: 'var(--primary)', fontSize: '0.8rem' }}>
                      {o.customer?.name?.charAt(0) || 'C'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{o.customer?.name}</div>
                      {(o.contactNumber || o.customer?.phone) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-subtle)', fontSize: '0.75rem' }}>
                          <Phone size={10} /> {o.contactNumber || o.customer.phone}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <Clock size={14} style={{ marginTop: 2, color: 'var(--text-subtle)', flexShrink: 0 }} />
                    <div><span style={{ fontWeight: 600 }}>Due:</span> {new Date(o.deliveryDate).toLocaleDateString()}</div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <MapPin size={14} style={{ marginTop: 2, color: 'var(--text-subtle)', flexShrink: 0 }} />
                    <div style={{ lineHeight: 1.4 }}>{o.address}</div>
                  </div>

                  {o.deliveryLatitude && o.deliveryLongitude && (() => {
                    const destPoint = [o.deliveryLatitude, o.deliveryLongitude]
                    const driverPoint = (o.driverLatitude && o.driverLongitude)
                      ? [o.driverLatitude, o.driverLongitude]
                      : null
                    const points = driverPoint ? [driverPoint, destPoint] : [destPoint]
                    const distKm = driverPoint
                      ? haversineKm(
                          { lat: driverPoint[0], lon: driverPoint[1] },
                          { lat: destPoint[0], lon: destPoint[1] },
                        )
                      : null
                    return (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ height: 220, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-light)' }}>
                          <MapContainer center={destPoint} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                            <TileLayer
                              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                              attribution="&copy; OpenStreetMap contributors"
                            />
                            <FitBounds points={points} />
                            <Marker position={destPoint} icon={destinationIcon}>
                              <Popup>Customer destination</Popup>
                            </Marker>
                            {driverPoint && (
                              <>
                                <Marker position={driverPoint} icon={driverIcon}>
                                  <Popup>Your live location</Popup>
                                </Marker>
                                <Polyline positions={points} color="#237227" weight={3} opacity={0.8} />
                              </>
                            )}
                          </MapContainer>
                        </div>
                        {/* Legend + distance chip */}
                        <div style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          marginTop: 6, fontSize: '0.72rem', color: 'var(--text-subtle)',
                          gap: 10, flexWrap: 'wrap',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} /> You
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#237227' }} /> Customer
                            </span>
                          </div>
                          {distKm != null && (
                            <span style={{ fontWeight: 600, color: 'var(--text-body)' }}>
                              ~{formatDistance(distKm)} away
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })()}

                  {o.notes && (
                    <div style={{ display: 'flex', gap: 8, fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 8, background: '#fff', padding: 8, borderRadius: 6, border: '1px dashed var(--border)' }}>
                      <AlertCircle size={14} style={{ marginTop: 2, color: 'var(--accent)', flexShrink: 0 }} />
                      <div style={{ fontStyle: 'italic' }}>{o.notes}</div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: 16, marginTop: 'auto' }}>
                  <div style={{ fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-subtle)' }}>Qty:</span> <span style={{ fontWeight: 600 }}>{o.quantity} {o.product?.unit}</span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <a className="btn-outline" style={{ padding: '6px 10px', fontSize: '0.75rem', textDecoration: 'none' }} href={directionsUrl(o)} target="_blank" rel="noreferrer">
                      <Navigation size={13} /> Route
                    </a>
                    <button className="btn-outline" style={{ padding: '6px 10px', fontSize: '0.75rem' }} onClick={() => setSelectedOrder(o)}>
                      <MessageCircle size={13} /> Chat
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 12 }}>
                  {o.status === 'PENDING' && (
                    <button 
                      className="btn-primary" 
                      style={{ padding: '6px 12px', fontSize: '0.75rem', background: 'var(--clr-info-txt)' }}
                      disabled={actionLoading === o.id}
                      onClick={() => handleUpdateStatus(o.id, 'IN_TRANSIT')}
                    >
                      {actionLoading === o.id ? 'Starting...' : 'Start Delivery'}
                    </button>
                  )}
                  {o.status === 'IN_TRANSIT' && (
                    <button 
                      className="btn-primary" 
                      style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                      disabled={actionLoading === o.id}
                      onClick={() => handleUpdateStatus(o.id, 'DELIVERED')}
                    >
                      {actionLoading === o.id ? 'Completing...' : 'Mark Delivered'}
                    </button>
                  )}
                  {o.status === 'DELIVERED' && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', fontStyle: 'italic' }}>Delivery Complete</span>
                  )}
                </div>
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
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setSelectedOrder(null) }}>
          <div className="modal-box">
            <div className="section-header">
              <div>
                <div className="modal-title">Chat - {selectedOrder.orderId}</div>
                <div className="modal-subtitle" style={{ marginBottom: 0 }}>
                  Customer: {selectedOrder.customer?.name || 'Customer'}
                </div>
              </div>
              <button className="btn-outline" onClick={() => setSelectedOrder(null)}>Close</button>
            </div>

            <div style={{ height: 300, overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: 10, padding: 12, background: 'var(--bg)', marginBottom: 14 }}>
              {messages.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-subtle)', fontSize: '0.84rem' }}>
                  No messages yet.
                </div>
              ) : messages.map(m => (
                <div key={m.id} style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', alignItems: m.sender?.role === 'DELIVERY' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '78%', background: m.sender?.role === 'DELIVERY' ? 'var(--primary)' : '#fff', color: m.sender?.role === 'DELIVERY' ? '#fff' : 'var(--text-body)', padding: '9px 12px', borderRadius: 10, fontSize: '0.84rem', lineHeight: 1.45 }}>
                    {m.message}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', marginTop: 3 }}>
                    {m.sender?.name || 'User'} - {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-input"
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                placeholder="Type a message for the customer..."
              />
              <button type="submit" className="btn-primary" disabled={sendingMessage || !messageText.trim()}>
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
