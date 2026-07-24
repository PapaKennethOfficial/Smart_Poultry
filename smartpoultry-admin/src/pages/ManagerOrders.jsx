import { useState, useEffect, useMemo } from 'react'
import { ShoppingBag, Truck, CheckCircle2, Clock, Package, MapPin, Eye, Phone, Edit2, Filter, X } from 'lucide-react'
import api from '../api/axios'
import Pagination from '../components/Pagination'

// Payment-status options come from the seed flow: PENDING / AWAITING_CONFIRMATION
// / PAID / FAILED. The backend matches on uppercase strings — anything we add
// here just becomes another filter chip.
const PAYMENT_STATUS_OPTIONS = ['PENDING', 'AWAITING_CONFIRMATION', 'PAID', 'FAILED']

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

export default function ManagerOrders() {
  const [orders, setOrders] = useState([])
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Advanced filter row state
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [driverSearch, setDriverSearch] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')

  // Modals
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [assigningDriver, setAssigningDriver] = useState(false)
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [newStatus, setNewStatus] = useState('')

  const [actionLoading, setActionLoading] = useState(false)

  // Advanced filters go to the backend so the manager can search across the
  // whole table. The status tabs stay client-side so the stat cards keep
  // reflecting totals across the loaded set.
  const orderQueryParams = useMemo(() => {
    const params = {}
    if (dateFrom) params.dateFrom = dateFrom
    if (dateTo) params.dateTo = dateTo
    if (driverSearch.trim()) params.driver = driverSearch.trim()
    if (customerSearch.trim()) params.customer = customerSearch.trim()
    if (productSearch.trim()) params.product = productSearch.trim()
    if (paymentStatus) params.paymentStatus = paymentStatus
    return params
  }, [dateFrom, dateTo, driverSearch, customerSearch, productSearch, paymentStatus])

  const activeFilterCount = (dateFrom ? 1 : 0)
    + (dateTo ? 1 : 0)
    + (driverSearch.trim() ? 1 : 0)
    + (customerSearch.trim() ? 1 : 0)
    + (productSearch.trim() ? 1 : 0)
    + (paymentStatus ? 1 : 0)

  const fetchData = async (params = orderQueryParams) => {
    try {
      setLoading(true)
      const [ordersRes, driversRes] = await Promise.all([
        api.get('/api/orders', { params }),
        api.get('/api/vehicles?status=APPROVED'),
      ])
      setOrders(ordersRes.data.orders || [])
      const availableDrivers = (driversRes.data.vehicles || []).map(v => ({
        ...v.user,
        vehicle: v,
        activeAssignments: v.user?.assignedDeliveries || [],
      }))
      setDrivers(availableDrivers)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Initial load — drivers list doesn't depend on filters.
  useEffect(() => {
    fetchData({})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Refetch when the user changes any filter. Debounce so typing in the
  // search inputs doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      fetchData(orderQueryParams)
    }, 350)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderQueryParams])

  const resetFilters = () => {
    setDateFrom('')
    setDateTo('')
    setDriverSearch('')
    setCustomerSearch('')
    setProductSearch('')
    setPaymentStatus('')
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    setActionLoading(true)
    try {
      const payload = {}
      if (assigningDriver) payload.driverId = selectedDriverId
      if (updatingStatus) payload.status = newStatus

      await api.patch(`/api/orders/${selectedOrder.id}`, payload)
      await fetchData(orderQueryParams)
      closeModal()
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update order')
    } finally {
      setActionLoading(false)
    }
  }

  const closeModal = () => {
    setSelectedOrder(null)
    setAssigningDriver(false)
    setUpdatingStatus(false)
    setSelectedDriverId('')
    setNewStatus('')
  }

  const filteredOrders = orders.filter(o => filter === 'ALL' || o.status === filter)
  
  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [filter, dateFrom, dateTo, driverSearch, customerSearch, productSearch, paymentStatus])

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
        <div className="page-title">Customer Orders</div>
        <div className="page-desc">Manage all orders, assign delivery staff, and track progress</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Total Orders" value={total} icon={ShoppingBag} iconColor="#84be88" accent="#84be88" />
        <StatCard label="Pending" value={pending} icon={Clock} iconColor="#f59e0b" accent="#f59e0b" />
        <StatCard label="In Transit" value={inTransit} icon={Truck} iconColor="#3b82f6" accent="#3b82f6" />
        <StatCard label="Delivered" value={delivered} icon={CheckCircle2} iconColor="#237227" accent="#237227" />
      </div>

      <div className="chart-card">
        <div className="section-header" style={{ flexWrap: 'wrap', gap: 12 }}>
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
          <button
            type="button"
            className="btn-outline"
            style={{ padding: '6px 12px', fontSize: '0.78rem' }}
            onClick={() => setFiltersOpen(o => !o)}
          >
            <Filter size={14} />
            {filtersOpen ? 'Hide filters' : 'More filters'}
            {activeFilterCount > 0 && (
              <span className="badge badge-gold" style={{ marginLeft: 6, padding: '0 7px' }}>{activeFilterCount}</span>
            )}
          </button>
        </div>

        {filtersOpen && (
          <div style={{
            background: 'var(--bg)', borderRadius: 10, padding: 14,
            marginBottom: 16, border: '1px solid var(--border-light)',
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 12,
            }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Date from</label>
                <input
                  type="date"
                  className="form-input"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Date to</label>
                <input
                  type="date"
                  className="form-input"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Driver</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Name, email or phone"
                  value={driverSearch}
                  onChange={(e) => setDriverSearch(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Customer</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Name, email or phone"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Product</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Product name"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Payment status</label>
                <select
                  className="form-select"
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                >
                  <option value="">Any</option>
                  {PAYMENT_STATUS_OPTIONS.map(s => (
                    <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>
                  ))}
                </select>
              </div>
            </div>
            {activeFilterCount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <button
                  type="button"
                  className="btn-outline"
                  style={{ padding: '5px 11px', fontSize: '0.75rem' }}
                  onClick={resetFilters}
                >
                  <X size={12} /> Clear filters
                </button>
              </div>
            )}
          </div>
        )}

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Product</th>
                <th>Qty / Amount</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Driver Assigned</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-subtle)' }}>Loading orders...</td></tr>
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>
                    <Package size={32} color="var(--border)" style={{ margin: '0 auto 10px' }} />
                    <div style={{ color: 'var(--text-muted)' }}>No orders found</div>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map(o => {
                  const statusConfig = STATUS_MAP[o.status] || STATUS_MAP.PENDING
                  return (
                    <tr key={o.id}>
                      <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{o.orderId}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{o.customer?.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                          {o.contactNumber || o.customer?.phone || o.customer?.email}
                        </div>
                      </td>
                      <td>{o.product?.name}</td>
                      <td>
                        <div>{o.quantity} {o.product?.unit}</div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)' }}>GHS {o.amount.toFixed(2)}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{PAYMENT_LABELS[o.paymentMethod] || o.paymentMethod || 'N/A'}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>{(o.paymentStatus || 'PENDING').replaceAll('_', ' ')}</div>
                      </td>
                      <td><span className={`badge ${statusConfig.color}`}>{statusConfig.label}</span></td>
                      <td>
                        {o.driver ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 24, height: 24, background: 'var(--primary-muted)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 600, color: 'var(--primary)' }}>
                              {o.driver.name.charAt(0)}
                            </div>
                            <span style={{ fontSize: '0.85rem' }}>{o.driver.name}</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-subtle)', fontSize: '0.8rem', fontStyle: 'italic' }}>Unassigned</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn-outline" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => { setSelectedOrder(o); }}>
                            <Eye size={14} /> View
                          </button>
                          <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => { setSelectedOrder(o); setAssigningDriver(true); setSelectedDriverId(o.driverId || ''); }}>
                            Assign
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {!loading && filteredOrders.length > itemsPerPage && (
          <div style={{ padding: '0 16px' }}>
            <Pagination 
              currentPage={currentPage}
              totalItems={filteredOrders.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {selectedOrder && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div>
                <h2 className="modal-title">Order {selectedOrder.orderId}</h2>
                <div className="modal-subtitle" style={{ marginBottom: 0 }}>Customer: {selectedOrder.customer?.name}</div>
              </div>
              <span className={`badge ${STATUS_MAP[selectedOrder.status]?.color || 'badge-gray'}`}>{selectedOrder.status}</span>
            </div>

            {!assigningDriver && !updatingStatus ? (
              <>
                <div className="section-header">
                  <div className="section-title">Order Details</div>
                  <button className="btn-outline" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => { setUpdatingStatus(true); setNewStatus(selectedOrder.status); }}>
                    <Edit2 size={12} /> Update Status
                  </button>
                </div>
                
                <div style={{ background: 'var(--bg)', padding: 16, borderRadius: 8, marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: '0.85rem' }}>
                  <div><strong style={{ color: 'var(--text-muted)' }}>Product:</strong> {selectedOrder.product?.name}</div>
                  <div><strong style={{ color: 'var(--text-muted)' }}>Quantity:</strong> {selectedOrder.quantity} {selectedOrder.product?.unit}</div>
                  <div><strong style={{ color: 'var(--text-muted)' }}>Total Amount:</strong> GHS {selectedOrder.amount.toFixed(2)}</div>
                  <div><strong style={{ color: 'var(--text-muted)' }}>Payment:</strong> {PAYMENT_LABELS[selectedOrder.paymentMethod] || selectedOrder.paymentMethod || 'N/A'}</div>
                  <div><strong style={{ color: 'var(--text-muted)' }}>Payment Status:</strong> {(selectedOrder.paymentStatus || 'PENDING').replaceAll('_', ' ')}</div>
                  <div><strong style={{ color: 'var(--text-muted)' }}>Placed On:</strong> {new Date(selectedOrder.createdAt).toLocaleDateString()}</div>
                </div>

                <div className="section-header">
                  <div className="section-title">Delivery</div>
                  <button className="btn-primary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => { setAssigningDriver(true); setSelectedDriverId(selectedOrder.driverId || ''); }}>
                    Assign Driver
                  </button>
                </div>

                <div style={{ background: 'var(--bg)', padding: 16, borderRadius: 8, marginBottom: 24, fontSize: '0.85rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div><strong style={{ color: 'var(--text-muted)' }}>Scheduled Date:</strong> {new Date(selectedOrder.deliveryDate).toLocaleDateString()}</div>
                    <div><strong style={{ color: 'var(--text-muted)' }}>Driver:</strong> {selectedOrder.driver?.name || <span style={{ color: 'var(--clr-danger-txt)' }}>Not Assigned</span>}</div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <strong style={{ color: 'var(--text-muted)' }}>Customer Contact:</strong> {selectedOrder.contactNumber || selectedOrder.customer?.phone || 'N/A'}
                  </div>
                  <div><strong style={{ color: 'var(--text-muted)' }}>Address:</strong> {selectedOrder.address}</div>
                  {selectedOrder.notes && (
                    <div style={{ marginTop: 8 }}><strong style={{ color: 'var(--text-muted)' }}>Notes:</strong> {selectedOrder.notes}</div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn-outline" onClick={closeModal}>Close</button>
                </div>
              </>
            ) : (
              <form onSubmit={handleUpdate}>
                {assigningDriver && (
                  <div className="form-group">
                    <label className="form-label">Assign Delivery Staff</label>
                    <select className="form-select" value={selectedDriverId} onChange={e => setSelectedDriverId(e.target.value)} required>
                      <option value="" disabled>Select an approved driver</option>
                      {drivers.map(d => {
                        const blockingAssignments = (d.activeAssignments || []).filter(order => order.id !== selectedOrder.id)
                        return (
                          <option key={d.id} value={d.id} disabled={blockingAssignments.length > 0}>
                            {d.name} ({d.vehicle?.vehicle_type || 'Vehicle'} - {d.vehicle?.license_plate || d.vehicle?.make}) {blockingAssignments.length ? `${blockingAssignments.length} active order(s)` : 'available'}
                          </option>
                        )
                      })}
                    </select>
                  </div>
                )}

                {updatingStatus && (
                  <div className="form-group">
                    <label className="form-label">Order Status</label>
                    <select className="form-select" value={newStatus} onChange={e => setNewStatus(e.target.value)} required>
                      <option value="PENDING">Pending</option>
                      <option value="IN_TRANSIT">In Transit</option>
                      <option value="DELIVERED">Delivered</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
                  <button type="button" className="btn-outline" onClick={() => { setAssigningDriver(false); setUpdatingStatus(false); }}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={actionLoading}>
                    {actionLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
