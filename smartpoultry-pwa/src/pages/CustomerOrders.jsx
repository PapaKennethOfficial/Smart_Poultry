import { useState, useEffect, useRef } from 'react'
import { ShoppingBag, Clock, Truck, CheckCircle2, Package, MapPin, Eye, Phone, MessageCircle, Car, User as UserIcon } from 'lucide-react'
import api from '../api/axios'
import { GoogleMap, Marker, Polyline, InfoWindow, useJsApiLoader } from '@react-google-maps/api'
import { haversineKm, formatDistance } from '../utils/distance'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import TableFilter from '../components/TableFilter'
import Pagination from '../components/Pagination'
import ReviewModal from '../components/ReviewModal'
import Skeleton from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import PullToRefresh from '../components/PullToRefresh'
import OrderReceipt from '../components/OrderReceipt'
import { Star } from 'lucide-react'
import { toast } from 'react-hot-toast'

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
  DRIVER_ASSIGNED: { label: 'Driver Assigned', color: 'badge-amber', icon: UserIcon },
  ACCEPTED: { label: 'Accepted', color: 'badge-blue', icon: CheckCircle2 },
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

const TIMELINE_DOT_COLORS = {
  PENDING: '#f59e0b',
  DRIVER_ASSIGNED: '#8b5cf6',
  ACCEPTED: '#3b82f6',
  IN_TRANSIT: '#3b82f6',
  DELIVERED: '#10b981',
  CANCELLED: '#ef4444',
}

function OrderTimeline({ statusHistory }) {
  if (!statusHistory || statusHistory.length === 0) return null;

  return (
    <div style={{ marginBottom: 24, padding: '16px 20px', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-light)' }}>
      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-heading)', marginBottom: 16 }}>Order Timeline</div>
      <div style={{ position: 'relative', paddingLeft: 12 }}>
        {/* Vertical line connecting steps */}
        <div style={{ position: 'absolute', left: 16, top: 12, bottom: 12, width: 2, background: 'var(--border-light)' }} />
        
        {statusHistory.map((step, i) => {
          const isLast = i === statusHistory.length - 1;
          const config = STATUS_MAP[step.status] || STATUS_MAP.PENDING;
          const dotColor = TIMELINE_DOT_COLORS[step.status] || '#f59e0b';
          
          return (
            <div key={i} style={{ display: 'flex', gap: 16, marginBottom: isLast ? 0 : 20, position: 'relative', zIndex: 1 }}>
              <div style={{ 
                width: 10, height: 10, borderRadius: '50%', background: dotColor,
                border: `2px solid ${dotColor}`,
                marginTop: 6, zIndex: 2
              }} />
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-heading)' }}>
                  {config.label}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: 2 }}>
                  {new Date(step.timestamp).toLocaleString()}
                </div>
                {step.driverName && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Driver: {step.driverName}</div>
                )}
                {step.by && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Updated by user {step.by.slice(0, 5)}...</div>
                )}
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
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [messages, setMessages] = useState([])
  const [messageText, setMessageText] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [mapInstances, setMapInstances] = useState({})

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES
  })

  const { socket } = useSocket()
  const { user } = useAuth()

  useEffect(() => {
    if (!socket) return;
    const handleOrderUpdate = (updatedOrder) => {
      setOrders(prev => {
        const exists = prev.find(o => o.id === updatedOrder.id);
        if (exists && exists.status !== updatedOrder.status) {
          if (updatedOrder.status === 'IN_TRANSIT') {
            toast.success(`Delivery started for order ${updatedOrder.orderId}!`, { icon: '🚚' });
          } else if (updatedOrder.status === 'DELIVERED') {
            toast.success(`Order ${updatedOrder.orderId} has been delivered!`, { icon: '✅' });
          } else if (updatedOrder.status === 'CANCELLED') {
            toast.error(`Order ${updatedOrder.orderId} was cancelled.`, { icon: '❌' });
          } else if (updatedOrder.status === 'DRIVER_ASSIGNED') {
            toast.success(`A driver was assigned to order ${updatedOrder.orderId}.`, { icon: '👤' });
          }
        }
        return prev.map(o => o.id === updatedOrder.id ? updatedOrder : o);
      });
      setSelectedOrder(prev => (prev?.id === updatedOrder.id ? updatedOrder : prev));
    };
    socket.on('order_update', handleOrderUpdate);
    return () => socket.off('order_update', handleOrderUpdate);
  }, [socket]);

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
    
    const productNames = o.items?.length > 0 
      ? o.items.map(i => i.product?.name).join(' ') 
      : (o.product?.name || '');

    return o.orderId.toLowerCase().includes(s) || 
      productNames.toLowerCase().includes(s) ||
      (o.address || '').toLowerCase().includes(s)
  })

  const getOrderTitle = (o) => {
    if (o.items && o.items.length > 0) {
      if (o.items.length === 1) return o.items[0].product?.name;
      return `${o.items[0].product?.name} + ${o.items.length - 1} more`;
    }
    return o.product?.name;
  }

  const getOrderQuantityDesc = (o) => {
    if (o.items && o.items.length > 0) {
      const totalQty = o.items.reduce((sum, i) => sum + i.quantity, 0);
      return `${totalQty} items total`;
    }
    return `${o.quantity} ${o.product?.unit || ''}`;
  }
  
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
    <>
    <PullToRefresh onRefresh={fetchOrders}>
      <div>
        <div className="page-header">
        <div className="page-title">My Orders</div>
        <div className="page-desc">Track and manage your farm product deliveries</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 24 }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ padding: 20, display: 'flex', flexDirection: 'column', height: 180, background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 12 }}>
               <Skeleton variant="text" style={{ width: '40%', height: 18, marginBottom: 8 }} />
               <Skeleton variant="text" style={{ width: '60%', height: 24, marginBottom: 16 }} />
               <Skeleton variant="rectangular" style={{ width: '100%', flex: 1, borderRadius: 8 }} />
            </div>
          ))}
        </div>
      ) : paginatedOrders.length === 0 ? (
        <EmptyState 
          icon={Package}
          title="No orders found"
          description={searchValue ? `No orders matching "${searchValue}" for this status.` : "You don't have any orders with this status."}
          actionText={searchValue ? "Clear Search" : null}
          onAction={() => setSearchValue('')}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {paginatedOrders.map(o => {
            const statusConfig = STATUS_MAP[o.status] || STATUS_MAP.PENDING
            const StatusIcon = statusConfig.icon
            
            return (
              <div key={o.id} style={{ padding: 20, display: 'flex', flexDirection: 'column', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 12 }} onClick={() => setSelectedOrder(o)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', fontWeight: 600 }}>{o.orderId}</div>
                    <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, color: 'var(--text-heading)', fontSize: '1.05rem', marginTop: 2 }}>
                      {getOrderTitle(o)}
                    </div>
                  </div>
                  <span className={`badge ${statusConfig.color}`} style={{ padding: '4px 10px', fontSize: '0.7rem' }}>{statusConfig.label}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, borderBottom: '1px solid var(--border-light)', paddingBottom: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>Quantity</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{getOrderQuantityDesc(o)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>Total Amount</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-heading)' }}>GHS {o.amount.toFixed(2)}</div>
                  </div>
                </div>
                
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>Payment:</span> {` ${PAYMENT_LABELS[o.paymentMethod] || o.paymentMethod || 'N/A'} - ${(o.paymentStatus || 'PENDING').replaceAll('_', ' ')}`}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <Clock size={14} style={{ color: 'var(--text-subtle)' }} />
                    <div><span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>Delivery:</span> {new Date(o.deliveryDate).toLocaleDateString()}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <MapPin size={14} style={{ color: 'var(--text-subtle)' }} />
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.address}</div>
                  </div>
                </div>

                <button className="btn-outline" style={{ marginTop: 16, width: '100%', justifyContent: 'center', fontSize: '0.8rem', padding: '8px 12px' }}>
                  <Eye size={14} style={{ marginRight: 6 }} /> View Details
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
      </div>
    </PullToRefresh>

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

            {/* Visual Order Timeline */}
            <OrderTimeline statusHistory={selectedOrder.statusHistory} />

            <div className="section-header" style={{ marginTop: 24 }}>
              <div className="section-title">Order Items</div>
            </div>
            <div style={{ border: '1px solid var(--border-light)', borderRadius: 8, padding: 16, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, background: 'var(--primary-muted)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Package size={20} color="var(--primary)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{getOrderTitle(selectedOrder)}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{getOrderQuantityDesc(selectedOrder)}</div>
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--primary)' }}>
                    GHS {selectedOrder.amount.toFixed(2)}
                  </div>
                </div>

                {selectedOrder.items && selectedOrder.items.length > 1 && (
                  <div style={{ marginTop: 12, borderTop: '1px solid var(--border-light)', paddingTop: 12 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Included Items</div>
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '4px 0' }}>
                        <span>{item.quantity}x {item.product?.name}</span>
                        <span>GHS {(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
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

            {/* Receipt Component */}
            <div style={{ marginBottom: 24 }}>
              <OrderReceipt order={selectedOrder} />
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
                      <a 
                        href={`tel:${selectedOrder.driver.vehicle?.driver_contact_number || selectedOrder.driver.phone || ''}`}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: 'var(--primary)', textDecoration: 'none', marginTop: 4, fontWeight: 600 }}
                      >
                        <Phone size={14} /> 
                        {selectedOrder.driver.vehicle?.driver_contact_number || selectedOrder.driver.phone || 'Contact not available'}
                      </a>
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

            {/* Ratings & Reviews */}
            {selectedOrder.status === 'DELIVERED' && (
              <>
                <div className="section-header">
                  <div className="section-title">Ratings & Reviews</div>
                </div>
                <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, marginBottom: 24, border: '1px solid var(--border-light)' }}>
                  {selectedOrder.review ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={16} fill={i < selectedOrder.review.rating ? '#FFAA00' : 'none'} color={i < selectedOrder.review.rating ? '#FFAA00' : '#dddabd'} />
                        ))}
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', marginLeft: 8 }}>
                          {new Date(selectedOrder.review.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {selectedOrder.review.comment && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          "{selectedOrder.review.comment}"
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '10px 0' }}>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-subtle)', marginBottom: 12 }}>You haven't reviewed this order yet.</p>
                      <button 
                        onClick={() => setShowReviewModal(true)}
                        style={{ padding: '8px 16px', background: '#237227', color: '#fff', borderRadius: 8, border: 'none', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Leave a Review
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

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
                          : 'Order cancelled. Map is not available for cancelled orders.'}
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

              let etaMins = null
              if (distKm != null) {
                // assume ~25 km/h avg speed in city traffic => ~2.4 mins per km
                etaMins = Math.ceil(distKm * 2.4)
              }

              return (
                <>
                  <div className="section-header">
                    <div className="section-title">Live Delivery Location</div>
                    {distKm != null && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <span className="badge badge-blue">~{formatDistance(distKm)}</span>
                        {etaMins != null && (
                          <span className="badge badge-amber">ETA: {etaMins} min</span>
                        )}
                      </div>
                    )}
                  </div>
                  {isLoaded ? (
                    <div style={{ height: 260, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-light)', marginBottom: 8 }}>
                      <GoogleMap
                        mapContainerStyle={{ height: '100%', width: '100%' }}
                        center={{ lat: destPoint[0], lng: destPoint[1] }}
                        zoom={13}
                        options={{ disableDefaultUI: true, zoomControl: true }}
                        onLoad={map => setMapInstances(prev => ({ ...prev, [selectedOrder.id]: map }))}
                      >
                        <FitBounds points={points} map={mapInstances[selectedOrder.id]} />
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
                    <div style={{ height: 260, background: 'var(--bg)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                      Loading Map...
                    </div>
                  )}
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

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button className="btn-primary" onClick={() => setSelectedOrder(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <ReviewModal 
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        orderId={selectedOrder?.id}
        onReviewSubmitted={(review) => {
          setSelectedOrder({ ...selectedOrder, review })
          setOrders(orders.map(o => o.id === selectedOrder.id ? { ...o, review } : o))
        }}
      />
    </>
  )
}
