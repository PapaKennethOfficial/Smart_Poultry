import { useState, useEffect } from 'react'
import { ShieldCheck, CheckCircle2, XCircle, Truck, Clock, Eye, AlertCircle, Edit2, UserX } from 'lucide-react'
import api from '../api/axios'

function StatCard({ label, value, hint, icon: Icon, iconColor, accent }) {
  return (
    <div className="stat-card">
      <div className="card-accent" style={{ background: accent }} />
      <div className="card-icon" style={{ background: `${iconColor}22`, width: 46, height: 46, borderRadius: 12 }}>
        <Icon size={22} color={iconColor} strokeWidth={1.75} />
      </div>
      <div className="card-label">{label}</div>
      <div className="card-value">{value}</div>
      {hint && <div className="card-change" style={{ color: '#8da58f' }}>{hint}</div>}
    </div>
  )
}

function formatDate(value) {
  if (!value) return 'N/A'
  return new Date(value).toLocaleDateString()
}

function buildEditForm(vehicle) {
  return {
    vehicle_type: vehicle.vehicle_type || 'Truck',
    make: vehicle.make || '',
    model: vehicle.model || '',
    year_of_manufacture: vehicle.year_of_manufacture || new Date().getFullYear(),
    license_plate: vehicle.license_plate || '',
    vin: vehicle.vin || '',
    color: vehicle.color || '',
    insurance_provider: vehicle.insurance_provider || '',
    insurance_policy_number: vehicle.insurance_policy_number || '',
    insurance_expiration: vehicle.insurance_expiration ? vehicle.insurance_expiration.slice(0, 10) : '',
    driver_contact_number: vehicle.driver_contact_number || vehicle.user?.phone || '',
    driver_residential_address: vehicle.driver_residential_address || '',
    driver_license_number: vehicle.driver_license_number || '',
    license_expiration: vehicle.license_expiration ? vehicle.license_expiration.slice(0, 10) : '',
    seating_capacity: vehicle.seating_capacity || '',
    mileage: vehicle.mileage ?? '',
    is_active: Boolean(vehicle.is_active),
    verification_notes: vehicle.verification_notes || '',
  }
}

function formatApiError(err, fallback) {
  const fieldErrors = err.response?.data?.errors
  if (fieldErrors) {
    const messages = Object.entries(fieldErrors)
      .flatMap(([field, values]) => (values || []).map(message => `${field.replaceAll('_', ' ')}: ${message}`))
    if (messages.length) return messages.join(' ')
  }
  return err.response?.data?.message || fallback
}

export default function VehicleVerification() {
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  
  // Modals
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [actionType, setActionType] = useState(null) // 'APPROVE' | 'REJECT'
  const [notes, setNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [changesRequested, setChangesRequested] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [editForm, setEditForm] = useState(null)

  const fetchVehicles = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/vehicles')
      setVehicles(res.data.vehicles || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVehicles()
  }, [])

  const handleAction = async (e) => {
    e.preventDefault()
    setActionLoading(true)
    try {
      const payload = {
        status: actionType,
        notes: notes.trim(),
        ...(actionType === 'REJECTED' && {
          rejection_reason: rejectionReason.trim(),
          changes_requested: changesRequested.trim()
        })
      }
      await api.patch(`/api/vehicles/${selectedVehicle.id}/verify`, payload)
      await fetchVehicles()
      closeModal()
    } catch (err) {
      alert(err.response?.data?.message || 'Action failed')
    } finally {
      setActionLoading(false)
    }
  }

  const openEdit = (vehicle) => {
    setSelectedVehicle(vehicle)
    setActionType('EDIT')
    setEditForm(buildEditForm(vehicle))
  }

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target
    setEditForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    setActionLoading(true)
    try {
      const payload = {
        ...editForm,
        year_of_manufacture: parseInt(editForm.year_of_manufacture, 10),
        seating_capacity: editForm.seating_capacity === '' ? null : parseInt(editForm.seating_capacity, 10),
        mileage: editForm.mileage === '' ? null : parseFloat(editForm.mileage),
        insurance_expiration: editForm.insurance_expiration ? new Date(editForm.insurance_expiration).toISOString() : null,
        license_expiration: new Date(editForm.license_expiration).toISOString(),
      }
      await api.patch(`/api/vehicles/${selectedVehicle.id}`, payload)
      await fetchVehicles()
      closeModal()
    } catch (err) {
      alert(formatApiError(err, 'Failed to update vehicle details'))
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeactivate = async (vehicle) => {
    const reason = window.prompt('Enter the reason for removing this driver from active delivery service:')
    if (!reason || reason.trim().length < 5) return

    setActionLoading(true)
    try {
      await api.patch(`/api/vehicles/${vehicle.id}/deactivate`, { reason: reason.trim() })
      await fetchVehicles()
      closeModal()
    } catch (err) {
      alert(formatApiError(err, 'Failed to remove driver'))
    } finally {
      setActionLoading(false)
    }
  }

  const closeModal = () => {
    setSelectedVehicle(null)
    setActionType(null)
    setEditForm(null)
    setNotes('')
    setRejectionReason('')
    setChangesRequested('')
  }

  const filteredVehicles = vehicles.filter(v => filter === 'ALL' || v.verification_status === filter)
  
  const total = vehicles.length
  const pending = vehicles.filter(v => v.verification_status === 'PENDING').length
  const approved = vehicles.filter(v => v.verification_status === 'APPROVED').length
  const rejected = vehicles.filter(v => v.verification_status === 'REJECTED').length

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Vehicle Verification</div>
        <div className="page-desc">Approve or reject delivery staff vehicle registrations</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Total Vehicles" value={total} icon={Truck} iconColor="#3b82f6" accent="#3b82f6" />
        <StatCard label="Pending Review" value={pending} icon={Clock} iconColor="#f59e0b" accent="#f59e0b" />
        <StatCard label="Approved" value={approved} icon={CheckCircle2} iconColor="#237227" accent="#237227" />
        <StatCard label="Rejected" value={rejected} icon={XCircle} iconColor="#ef4444" accent="#ef4444" />
      </div>

      <div className="chart-card">
        <div className="section-header">
          <div className="filter-tabs">
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(f => (
              <button 
                key={f} 
                className={`filter-tab ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Driver</th>
                <th>Vehicle</th>
                <th>License Plate</th>
                <th>Contact</th>
                <th>Insurance</th>
                <th>Active Orders</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-subtle)' }}>Loading...</td></tr>
              ) : filteredVehicles.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>
                    <Truck size={32} color="var(--border)" style={{ margin: '0 auto 10px' }} />
                    <div style={{ color: 'var(--text-muted)' }}>No vehicles found</div>
                  </td>
                </tr>
              ) : (
                filteredVehicles.map(v => {
                  const activeOrders = v.user?.assignedDeliveries || []
                  return (
                    <tr key={v.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{v.user?.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>{v.user?.email}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{v.year_of_manufacture} {v.make}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>{v.model} ({v.vehicle_type})</div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{v.license_plate || 'N/A'}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{v.driver_contact_number || v.user?.phone || 'N/A'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {v.driver_residential_address || 'No residence recorded'}
                        </div>
                      </td>
                      <td>
                        <div>{v.insurance_provider || 'N/A'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                          {v.insurance_expiration ? `Exp: ${formatDate(v.insurance_expiration)}` : 'No Insurance Info'}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{activeOrders.length ? `${activeOrders.length} active` : 'Available'}</div>
                        {activeOrders[0] && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>{activeOrders[0].orderId} - {activeOrders[0].status.replace('_', ' ')}</div>
                        )}
                      </td>
                      <td>
                        {v.verification_status === 'APPROVED' && <span className="badge badge-green">Approved</span>}
                        {v.verification_status === 'PENDING' && <span className="badge badge-amber">Pending</span>}
                        {v.verification_status === 'REJECTED' && <span className="badge badge-red">Rejected</span>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {v.verification_status === 'PENDING' && (
                            <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => { setSelectedVehicle(v); setActionType('VIEW'); }}>
                              <Eye size={14} /> Review
                            </button>
                          )}
                          {v.verification_status !== 'PENDING' && (
                            <>
                              <button className="btn-outline" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => { setSelectedVehicle(v); setActionType('VIEW'); }}>
                                <Eye size={14} /> View
                              </button>
                              <button className="btn-outline" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => openEdit(v)}>
                                <Edit2 size={14} /> Edit
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedVehicle && actionType && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h2 className="modal-title">
              {actionType === 'APPROVED' ? 'Approve Vehicle' : actionType === 'REJECTED' ? 'Reject Vehicle' : actionType === 'EDIT' ? 'Edit Driver & Vehicle' : 'Vehicle Details'}
            </h2>
            <div className="modal-subtitle">
              Driver: {selectedVehicle.user?.name} | {selectedVehicle.make} {selectedVehicle.model} ({selectedVehicle.license_plate || 'No plate'})
            </div>

            {actionType !== 'EDIT' && (
              <div style={{ background: 'rgba(35,114,39,0.06)', border: '1px solid rgba(35,114,39,0.16)', padding: 14, borderRadius: 10, marginBottom: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginBottom: 4 }}>Driver Contact</div>
                  <div style={{ fontWeight: 700, color: 'var(--text-heading)' }}>{selectedVehicle.driver_contact_number || selectedVehicle.user?.phone || 'N/A'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginBottom: 4 }}>Account Email</div>
                  <div style={{ fontWeight: 700, color: 'var(--text-heading)' }}>{selectedVehicle.user?.email || 'N/A'}</div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginBottom: 4 }}>Residential Address</div>
                  <div style={{ fontWeight: 700, color: 'var(--text-heading)' }}>{selectedVehicle.driver_residential_address || 'N/A'}</div>
                </div>
              </div>
            )}

            {actionType !== 'EDIT' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
              {[
                { label: 'Driver Photo', src: selectedVehicle.driver_photo },
                { label: 'Vehicle Photo', src: selectedVehicle.vehicle_photo },
              ].map(item => (
                <div key={item.label} style={{ background: 'var(--bg)', borderRadius: 10, padding: 10, border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8 }}>{item.label}</div>
                  {item.src ? (
                    <img
                      src={item.src}
                      alt={item.label}
                      style={{ width: '100%', height: 190, objectFit: 'cover', borderRadius: 8, background: '#fff' }}
                    />
                  ) : (
                    <div style={{ height: 190, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-subtle)', background: '#fff', borderRadius: 8 }}>
                      No image uploaded
                    </div>
                  )}
                </div>
              ))}
            </div>
            )}

            {actionType !== 'EDIT' && (
            <div style={{ background: 'var(--bg)', padding: 16, borderRadius: 8, marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: '0.85rem' }}>
              {[
                ['Driver Email', selectedVehicle.user?.email || 'N/A'],
                ['Contact Number', selectedVehicle.driver_contact_number || selectedVehicle.user?.phone || 'N/A'],
                ['Residential Address', selectedVehicle.driver_residential_address || 'N/A'],
                ['Vehicle Type', selectedVehicle.vehicle_type],
                ['Make / Model', `${selectedVehicle.year_of_manufacture} ${selectedVehicle.make} ${selectedVehicle.model}`],
                ['License Plate', selectedVehicle.license_plate || 'N/A'],
                ['VIN', selectedVehicle.vin || 'N/A'],
                ['Color', selectedVehicle.color],
                ['Seating Capacity', selectedVehicle.seating_capacity || 'N/A'],
                ['Mileage', selectedVehicle.mileage ?? 'N/A'],
                ['Insurance Provider', selectedVehicle.insurance_provider || 'N/A'],
                ['Insurance Policy', selectedVehicle.insurance_policy_number || 'N/A'],
                ['Insurance Exp', formatDate(selectedVehicle.insurance_expiration)],
                ['Driver License', selectedVehicle.driver_license_number],
                ['License Exp', formatDate(selectedVehicle.license_expiration)],
                ['Registered On', formatDate(selectedVehicle.createdAt)],
              ].map(([label, value]) => (
                <div key={label}>
                  <strong style={{ color: 'var(--text-muted)' }}>{label}:</strong> {value}
                </div>
              ))}

              {(selectedVehicle.registration_document || selectedVehicle.insurance_document) && (
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                  {selectedVehicle.registration_document && (
                    <a className="btn-outline" style={{ padding: '6px 12px', fontSize: '0.75rem', textDecoration: 'none' }} href={selectedVehicle.registration_document} target="_blank" rel="noreferrer">
                      View Registration Document
                    </a>
                  )}
                  {selectedVehicle.insurance_document && (
                    <a className="btn-outline" style={{ padding: '6px 12px', fontSize: '0.75rem', textDecoration: 'none' }} href={selectedVehicle.insurance_document} target="_blank" rel="noreferrer">
                      View Insurance Document
                    </a>
                  )}
                </div>
              )}

              {selectedVehicle.user?.assignedDeliveries?.length > 0 && (
                <div style={{ gridColumn: '1 / -1', marginTop: 8, background: '#fff', padding: 10, borderRadius: 6, border: '1px solid var(--border-light)' }}>
                  <strong style={{ color: 'var(--text-muted)' }}>Active Delivery Orders:</strong>
                  <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                    {selectedVehicle.user.assignedDeliveries.map(order => (
                      <div key={order.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span>{order.orderId}</span>
                        <span>{order.status.replace('_', ' ')} - {formatDate(order.deliveryDate)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {actionType === 'VIEW' && selectedVehicle.verification_notes && (
                <div style={{ gridColumn: '1 / -1', marginTop: 8, background: '#fff', padding: 8, borderRadius: 6 }}>
                  <strong style={{ color: 'var(--text-muted)' }}>Manager Notes:</strong> {selectedVehicle.verification_notes}
                </div>
              )}

              {actionType === 'VIEW' && selectedVehicle.verification_status === 'REJECTED' && (
                <div style={{ gridColumn: '1 / -1', marginTop: 8, color: 'var(--clr-danger-txt)', background: 'var(--clr-danger-bg)', padding: 8, borderRadius: 6 }}>
                  <strong>Rejection Reason:</strong> {selectedVehicle.rejection_reason}
                  {selectedVehicle.changes_requested && (
                    <div style={{ marginTop: 4 }}><strong>Requested Changes:</strong> {selectedVehicle.changes_requested}</div>
                  )}
                </div>
              )}
            </div>
            )}

            {actionType === 'EDIT' && editForm && (
              <form onSubmit={handleEditSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Vehicle Type</label>
                    <select className="form-select" name="vehicle_type" value={editForm.vehicle_type} onChange={handleEditChange}>
                      {['Truck', 'Van', 'Motorcycle', 'Bicycle'].map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </div>
                  {[
                    ['make', 'Make', 'text'],
                    ['model', 'Model', 'text'],
                    ['year_of_manufacture', 'Year of Manufacture', 'number'],
                    ['license_plate', 'License Plate', 'text'],
                    ['vin', 'VIN', 'text'],
                    ['color', 'Color', 'text'],
                    ['driver_contact_number', 'Driver Contact', 'tel'],
                    ['driver_residential_address', 'Residential Address', 'text'],
                    ['driver_license_number', 'Driver License Number', 'text'],
                    ['license_expiration', 'License Expiration', 'date'],
                    ['insurance_provider', 'Insurance Provider', 'text'],
                    ['insurance_policy_number', 'Insurance Policy Number', 'text'],
                    ['insurance_expiration', 'Insurance Expiration', 'date'],
                    ['seating_capacity', 'Seating Capacity', 'number'],
                    ['mileage', 'Mileage', 'number'],
                  ].map(([name, label, type]) => (
                    <div className="form-group" key={name}>
                      <label className="form-label">{label}</label>
                      <input
                        required={['make', 'model', 'year_of_manufacture', 'color', 'driver_contact_number', 'driver_residential_address', 'driver_license_number', 'license_expiration'].includes(name)}
                        className="form-input"
                        type={type}
                        name={name}
                        value={editForm[name]}
                        onChange={handleEditChange}
                      />
                    </div>
                  ))}
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Manager Notes</label>
                    <textarea className="form-input" name="verification_notes" rows={3} value={editForm.verification_notes} onChange={handleEditChange} />
                  </div>
                  <label style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.84rem', color: 'var(--text-body)' }}>
                    <input type="checkbox" name="is_active" checked={editForm.is_active} onChange={handleEditChange} />
                    Active for delivery assignment
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
                  <button type="button" className="btn-outline" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={actionLoading}>
                    {actionLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}

            {(actionType === 'APPROVED' || actionType === 'REJECTED') && (
              <form onSubmit={handleAction}>
                {actionType === 'REJECTED' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Rejection Reason *</label>
                      <input required type="text" className="form-input" value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} placeholder="e.g. Invalid Insurance Document" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Changes Requested</label>
                      <input type="text" className="form-input" value={changesRequested} onChange={e => setChangesRequested(e.target.value)} placeholder="e.g. Please update your insurance provider" />
                    </div>
                  </>
                )}
                
                <div className="form-group">
                  <label className="form-label">Internal Notes (Optional)</label>
                  <textarea className="form-input" value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Add any notes for your records" />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
                  <button type="button" className="btn-outline" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={actionLoading} style={{ background: actionType === 'REJECTED' ? 'var(--clr-danger-txt)' : undefined }}>
                    {actionLoading ? 'Processing...' : `Confirm ${actionType === 'APPROVED' ? 'Approval' : 'Rejection'}`}
                  </button>
                </div>
              </form>
            )}

            {actionType === 'VIEW' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button className="btn-outline" onClick={() => openEdit(selectedVehicle)}>
                    <Edit2 size={14} /> Edit Details
                  </button>
                  {selectedVehicle.is_active && (
                    <button
                      className="btn-outline"
                      style={{ borderColor: 'var(--clr-danger-txt)', color: 'var(--clr-danger-txt)' }}
                      disabled={actionLoading}
                      onClick={() => handleDeactivate(selectedVehicle)}
                    >
                      <UserX size={14} /> Remove Driver
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {selectedVehicle.verification_status === 'PENDING' && (
                    <>
                      <button className="btn-outline" style={{ borderColor: 'var(--clr-danger-txt)', color: 'var(--clr-danger-txt)' }} onClick={() => setActionType('REJECTED')}>
                        Reject
                      </button>
                      <button className="btn-primary" onClick={() => setActionType('APPROVED')}>
                        Approve
                      </button>
                    </>
                  )}
                  <button className="btn-outline" onClick={closeModal}>Close</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
