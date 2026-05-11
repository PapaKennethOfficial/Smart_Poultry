import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, MapPin, X, Truck, CheckCircle2 } from 'lucide-react'
import { useToast } from '../components/Toast'
import {
  fetchDeliveries,
  createDelivery as createDeliveryApi,
  updateDeliveryStatus as updateStatusApi,
  fetchDeliveryRevenue,
} from '../api/deliveries'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix for Leaflet marker icons in Vite/React
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
})
L.Marker.prototype.options.icon = DefaultIcon

const statusColors = {
  'Delivered': 'badge-green',
  'In Transit': 'badge-blue',
  'Pending': 'badge-amber',
  'Cancelled': 'badge-red',
}

const statusFilterMap = {
  all: null,
  pending: 'Pending',
  transit: 'In Transit',
  delivered: 'Delivered',
}

// ─── Format Helpers ──────────────────────────────────────────────────────────

function formatAmount(amount) {
  return `GHS ${Number(amount).toLocaleString()}`
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// ─── New Delivery Modal ──────────────────────────────────────────────────────

function NewDeliveryModal({ onClose }) {
  const queryClient = useQueryClient()
  const { showSuccess, showError } = useToast()

  const [form, setForm] = useState({
    customer: '',
    product: 'Eggs (Crates)',
    quantity: '',
    deliveryDate: new Date().toISOString().split('T')[0],
    driver: 'Unassigned',
    address: '',
    amount: '',
    notes: '',
  })

  const mutation = useMutation({
    mutationFn: createDeliveryApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] })
      queryClient.invalidateQueries({ queryKey: ['deliveryRevenue'] })
      showSuccess('Delivery created')
      onClose()
    },
    onError: (err) => {
      showError(err.response?.data?.error || err.response?.data?.errors ? 'Please check the form fields' : 'Failed to create delivery')
    },
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    mutation.mutate({
      ...form,
      quantity: parseInt(form.quantity, 10),
      amount: parseFloat(form.amount),
    })
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <div className="modal-title">Schedule New Delivery</div>
            <div className="modal-subtitle">Create a delivery order and assign a driver</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8da58f' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Customer Name</label>
            <input className="form-input" name="customer" value={form.customer} onChange={handleChange} placeholder="e.g. Kofi Supermart" required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Product Type</label>
              <select className="form-select" name="product" value={form.product} onChange={handleChange}>
                <option>Eggs (Crates)</option>
                <option>Broilers (Live)</option>
                <option>Broilers (Frozen)</option>
                <option>Noilers (Live)</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Quantity</label>
              <input className="form-input" type="number" name="quantity" value={form.quantity} onChange={handleChange} placeholder="e.g. 40" required min="1" />
            </div>
          </div>

          <div style={{ height: 14 }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Delivery Date</label>
              <input className="form-input" type="date" name="deliveryDate" value={form.deliveryDate} onChange={handleChange} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Assign Driver</label>
              <select className="form-select" name="driver" value={form.driver} onChange={handleChange}>
                <option>Unassigned</option>
                <option>Kwame A.</option>
                <option>Emmanuel B.</option>
              </select>
            </div>
          </div>

          <div style={{ height: 14 }} />

          <div className="form-group">
            <label className="form-label">Delivery Address</label>
            <input className="form-input" name="address" value={form.address} onChange={handleChange} placeholder="Customer address or GPS coordinates" />
          </div>

          <div className="form-group">
            <label className="form-label">Amount (GHS)</label>
            <input className="form-input" type="number" name="amount" value={form.amount} onChange={handleChange} placeholder="e.g. 2400" required min="0" step="0.01" />
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-input" rows={2} name="notes" value={form.notes} onChange={handleChange} placeholder="Special instructions..." style={{ resize: 'none' }} />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating...' : 'Create Delivery Order'}
            </button>
            <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Deliveries() {
  const [showModal, setShowModal] = useState(false)
  const [activeStatus, setActiveStatus] = useState('all')
  const queryClient = useQueryClient()
  const { showSuccess, showError } = useToast()

  const statusParam = statusFilterMap[activeStatus]

  // Fetch deliveries (filtered by status tab)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['deliveries', activeStatus],
    queryFn: () => fetchDeliveries(statusParam),
  })

  // Fetch revenue summary
  const { data: revenueData } = useQuery({
    queryKey: ['deliveryRevenue'],
    queryFn: fetchDeliveryRevenue,
  })

  // Status update mutation
  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateStatusApi(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] })
      queryClient.invalidateQueries({ queryKey: ['deliveryRevenue'] })
      showSuccess('Delivery status updated')
    },
    onError: (err) => {
      showError(err.response?.data?.error || 'Failed to update status')
    },
  })

  const deliveries = data?.deliveries || []
  const counts = data?.counts || { all: 0, pending: 0, transit: 0, delivered: 0 }

  // Find latest in-transit delivery for the active delivery card
  const activeDelivery = deliveries.find((d) => d.status === 'In Transit')

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="page-title">Delivery Management</div>
            <div className="page-desc">Track and schedule all product deliveries</div>
          </div>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={15} />
            New Delivery
          </button>
        </div>
      </div>

      {/* Status summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
        {[
          { label: 'Total Orders', value: counts.all, color: '#237227', bg: 'rgba(35,114,39,0.08)' },
          { label: 'Pending', value: counts.pending, color: '#8a5f00', bg: 'rgba(255,170,0,0.12)' },
          { label: 'In Transit', value: counts.transit, color: '#1e40af', bg: 'rgba(59,130,246,0.10)' },
          { label: 'Delivered', value: counts.delivered, color: '#065f46', bg: 'rgba(16,185,129,0.10)' },
        ].map((s, i) => (
          <div key={i} style={{
            background: '#fff', borderRadius: 12, padding: '16px 18px',
            border: '1px solid #dddabd', display: 'flex', alignItems: 'center', gap: 12
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10, background: s.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.2rem', fontWeight: 700, color: s.color
            }}>
              {s.value}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#5e7a61', fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div>
        {/* Orders table */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <div className="chart-title">Delivery Orders</div>
              <div className="chart-subtitle">{deliveries.length} orders</div>
            </div>
            <div className="filter-tabs">
              {[
                { key: 'all', label: 'All' },
                { key: 'pending', label: 'Pending' },
                { key: 'transit', label: 'In Transit' },
                { key: 'delivered', label: 'Delivered' },
              ].map(t => (
                <button key={t.key} className={`filter-tab${activeStatus === t.key ? ' active' : ''}`}
                  onClick={() => setActiveStatus(t.key)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="table-wrapper">
            {isLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#8da58f' }}>
                <div style={{ fontSize: '0.85rem' }}>Loading deliveries...</div>
              </div>
            ) : isError ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>
                <div style={{ fontSize: '0.85rem' }}>Failed to load deliveries. Please try again.</div>
              </div>
            ) : deliveries.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#8da58f' }}>
                <div style={{ fontSize: '0.85rem' }}>No deliveries found.</div>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Driver</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map(d => (
                    <tr key={d.id}>
                      <td style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '0.8rem', color: '#237227', whiteSpace: 'nowrap' }}>
                        {d.orderId}
                      </td>
                      <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{d.customer}</td>
                      <td style={{ color: '#5e7a61', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{d.product}</td>
                      <td style={{ fontWeight: 600 }}>{d.quantity}</td>
                      <td style={{ color: d.driver === 'Unassigned' ? '#8a5f00' : '#5e7a61', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                        {d.driver}
                      </td>
                      <td style={{ color: '#5e7a61', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{formatDate(d.deliveryDate)}</td>
                      <td style={{ fontWeight: 600, color: '#0d1f0e', whiteSpace: 'nowrap' }}>{formatAmount(d.amount)}</td>
                      <td>
                        <span className={`badge ${statusColors[d.status]}`}>{d.status}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {d.status === 'Pending' && (
                            <button
                              className="btn-outline"
                              style={{ fontSize: '0.7rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                              disabled={statusMutation.isPending}
                              onClick={() => statusMutation.mutate({ id: d.id, status: 'In Transit' })}
                            >
                              <Truck size={12} />
                              In Transit
                            </button>
                          )}
                          {(d.status === 'Pending' || d.status === 'In Transit') && (
                            <button
                              className="btn-outline"
                              style={{ fontSize: '0.7rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4, color: '#065f46', borderColor: '#065f46' }}
                              disabled={statusMutation.isPending}
                              onClick={() => statusMutation.mutate({ id: d.id, status: 'Delivered' })}
                            >
                              <CheckCircle2 size={12} />
                              Delivered
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Map panel + Revenue */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>
          <div className="chart-card" style={{ flex: 1 }}>
            <div className="chart-header" style={{ marginBottom: 12 }}>
              <div>
                <div className="chart-title">Live Tracking Map</div>
                <div className="chart-subtitle">GPS tracking — {activeDelivery ? '1 active delivery' : 'No active deliveries'}</div>
              </div>
            </div>
            <div style={{ height: 180, borderRadius: 12, overflow: 'hidden', border: '1px solid #dddabd', position: 'relative', zIndex: 0 }}>
              <MapContainer center={[5.6037, -0.1870]} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                {activeDelivery && (
                  <Marker position={[5.6037, -0.1870]}>
                    <Popup>
                      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600 }}>{activeDelivery.orderId}</div>
                      <div style={{ fontSize: '0.8rem', color: '#5e7a61' }}>{activeDelivery.customer}</div>
                    </Popup>
                  </Marker>
                )}
              </MapContainer>
            </div>

            {/* Active delivery card — dynamic */}
            {activeDelivery ? (
              <div style={{
                marginTop: 12, background: 'rgba(35,114,39,0.06)', borderRadius: 10,
                padding: '13px', border: '1px solid rgba(35,114,39,0.16)'
              }}>
                <div style={{ fontSize: '0.68rem', color: '#8da58f', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>
                  Active Delivery
                </div>
                <div style={{ fontWeight: 600, color: '#0d1f0e', fontSize: '0.84rem', marginBottom: 3 }}>
                  {activeDelivery.orderId} · {activeDelivery.customer}
                </div>
                <div style={{ fontSize: '0.77rem', color: '#5e7a61', marginBottom: 8 }}>
                  {activeDelivery.quantity} {activeDelivery.product} · Driver: {activeDelivery.driver}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="badge badge-blue">In Transit</span>
                  <span style={{ fontSize: '0.72rem', color: '#8da58f' }}>ETA: ~25 min</span>
                </div>
              </div>
            ) : (
              <div style={{
                marginTop: 12, background: 'rgba(0,0,0,0.02)', borderRadius: 10,
                padding: '18px 13px', border: '1px solid #edebd6', textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.78rem', color: '#8da58f' }}>No active deliveries in transit</div>
              </div>
            )}
          </div>

          {/* Revenue summary — wired to API */}
          <div className="chart-card">
            <div style={{ fontSize: '0.68rem', color: '#8da58f', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12, fontWeight: 600 }}>
              Revenue Summary
            </div>
            {[
              { label: "Today's Revenue", value: revenueData ? formatAmount(revenueData.todayTotal) : '—' },
              { label: 'Pending Collection', value: revenueData ? formatAmount(revenueData.pendingTotal) : '—' },
              { label: 'Month Total', value: revenueData ? formatAmount(revenueData.monthTotal) : '—' },
            ].map((r, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0', borderBottom: i < 2 ? '1px solid #edebd6' : 'none'
              }}>
                <span style={{ fontSize: '0.8rem', color: '#5e7a61' }}>{r.label}</span>
                <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, color: '#0d1f0e', fontSize: '0.94rem' }}>
                  {r.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showModal && <NewDeliveryModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
