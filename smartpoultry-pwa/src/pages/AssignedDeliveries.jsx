import { useState, useEffect } from 'react'
import { Truck, CheckCircle2, Package, MapPin, Clock, Phone, AlertCircle, MessageCircle, Navigation } from 'lucide-react'
import api from '../api/axios'
import { GoogleMap, Marker, Polyline, InfoWindow, useJsApiLoader } from '@react-google-maps/api'
import { haversineKm, formatDistance } from '../utils/distance'
import { useSocket } from '../context/SocketContext'
import TableFilter from '../components/TableFilter'
import Pagination from '../components/Pagination'

// Google Maps libraries
const GOOGLE_MAPS_LIBRARIES = ['places']

// Fit the map to include every meaningful marker.
function FitBounds({ points, map }) {
  useEffect(() => {
    if (!map || !points || points.length === 0) return;
    if (points.length === 1) {
      map.setCenter({ lat: points[0][0], lng: points[0][1] });
      map.setZoom(15);
      return;
    }
    const bounds = new window.google.maps.LatLngBounds();
    points.forEach(p => bounds.extend({ lat: p[0], lng: p[1] }));
    map.fitBounds(bounds);
    
    // Max zoom level logic after fitting bounds to prevent zooming in too much
    const listener = window.google.maps.event.addListener(map, 'idle', () => {
      if (map.getZoom() > 15) map.setZoom(15);
      window.google.maps.event.removeListener(listener);
    });
  }, [map, points]);
  return null;
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
  
  // Track Map Instances to fit bounds
  const [mapInstances, setMapInstances] = useState({})

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES
  })

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
  }).sort((a, b) => {
    const statusOrder = { 'IN_TRANSIT': 0, 'PENDING': 1, 'DELIVERED': 2 }
    const statusA = statusOrder[a.status] ?? 3
    const statusB = statusOrder[b.status] ?? 3
    if (statusA !== statusB) return statusA - statusB
    return new Date(b.createdAt) - new Date(a.createdAt)
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 24 }}>
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
              <div key={o.id} style={{ padding: 20, display: 'flex', flexDirection: 'column', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', fontWeight: 600, letterSpacing: '0.05em' }}>{o.orderId}</div>
                    <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, color: 'var(--text-heading)', fontSize: '1.05rem', marginTop: 2 }}>{o.product?.name}</div>
                  </div>
                  <span className={`badge ${statusConfig.color}`} style={{ padding: '4px 10px', fontSize: '0.7rem' }}>{statusConfig.label}</span>
                </div>

                <div style={{ borderTop: '1px solid var(--border-light)', borderBottom: '1px solid var(--border-light)', padding: '12px 0', marginBottom: 16 }}>
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
                        {isLoaded ? (
                          <div id={`map-container-${o.id}`} style={{ height: 220, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-light)' }}>
                            <GoogleMap
                              mapContainerStyle={{ height: '100%', width: '100%' }}
                              center={{ lat: destPoint[0], lng: destPoint[1] }}
                              zoom={13}
                              options={{ disableDefaultUI: true, zoomControl: true }}
                              onLoad={map => setMapInstances(prev => ({ ...prev, [o.id]: map }))}
                            >
                              <FitBounds points={points} map={mapInstances[o.id]} />
                              <Marker 
                                position={{ lat: destPoint[0], lng: destPoint[1] }} 
                                icon={{
                                  path: window.google.maps.SymbolPath.CIRCLE,
                                  fillColor: '#237227',
                                  fillOpacity: 1,
                                  strokeColor: '#fff',
                                  strokeWeight: 2,
                                  scale: 10
                                }}
                              />
                              {driverPoint && (
                                <>
                                  <Marker 
                                    position={{ lat: driverPoint[0], lng: driverPoint[1] }}
                                    icon={{
                                      path: window.google.maps.SymbolPath.CIRCLE,
                                      fillColor: '#3b82f6',
                                      fillOpacity: 1,
                                      strokeColor: '#fff',
                                      strokeWeight: 2,
                                      scale: 10
                                    }}
                                  />
                                  <Polyline 
                                    path={[{ lat: driverPoint[0], lng: driverPoint[1] }, { lat: destPoint[0], lng: destPoint[1] }]}
                                    options={{ strokeColor: '#237227', strokeOpacity: 0.8, strokeWeight: 3 }}
                                  />
                                </>
                              )}
                            </GoogleMap>
                          </div>
                        ) : (
                          <div style={{ height: 220, background: 'var(--bg)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            Loading Map...
                          </div>
                        )}
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
                    <button 
                      className="btn-outline" 
                      style={{ padding: '6px 10px', fontSize: '0.75rem' }} 
                      onClick={() => {
                        const mapEl = document.getElementById(`map-container-${o.id}`);
                        if (mapEl) {
                          mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }}
                    >
                      <Navigation size={13} /> Route
                    </button>
                    <button className="btn-outline" style={{ padding: '6px 10px', fontSize: '0.75rem' }} onClick={() => setSelectedOrder(o)}>
                      <MessageCircle size={13} /> Chat
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: 12 }}>
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
