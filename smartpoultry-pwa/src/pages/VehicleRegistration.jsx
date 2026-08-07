import { useState, useEffect } from 'react'
import {
  AlertCircle, CheckCircle2, RefreshCw, Car, Hash,
  Image as ImageIcon, Truck, User as UserIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '../api/axios'

const defaultVehicleForm = (vehicleType = 'Truck') => ({
  vehicle_type: vehicleType,
  make: '',
  model: '',
  year_of_manufacture: new Date().getFullYear(),
  license_plate: '',
  vin: '',
  color: '',
  driver_contact_number: '',
  driver_residential_address: '',
  driver_license_number: '',
  license_expiration: '',
  driver_photo: '',
  vehicle_photo: '',
  registration_document: '',
})

function formatApiError(err, fallback) {
  const fieldErrors = err.response?.data?.errors
  if (fieldErrors) {
    const messages = Object.entries(fieldErrors)
      .flatMap(([field, values]) => (values || []).map(message => `${field.replaceAll('_', ' ')}: ${message}`))
    if (messages.length) return messages.join(' ')
  }
  return err.response?.data?.message || fallback
}

// ─── Approved vehicle display ────────────────────────────────────────────────
// Shown when verification_status === 'APPROVED'. Photos lead, then the
// confirmation fields the brief calls out so the driver can see at a glance
// that the correct vehicle was approved.
function ApprovedVehicleCard({ vehicle, onUpdateClick }) {
  const detailRows = [
    { label: 'Make',         value: vehicle.make },
    { label: 'Model',        value: vehicle.model },
    { label: 'Color',        value: vehicle.color },
    { label: 'Type',         value: vehicle.vehicle_type },
    { label: 'License Plate', value: vehicle.license_plate || 'Not provided' },
  ]

  return (
    <div className="stat-card" style={{ padding: 32 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <CheckCircle2 size={48} color="#237227" style={{ margin: '0 auto 12px' }} />
        <h2 style={{ fontSize: '1.5rem', color: 'var(--text-heading)', marginBottom: 6, fontFamily: 'Space Grotesk' }}>
          Vehicle Approved
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Your vehicle has been verified. You can confirm the approved details below.
        </p>
        <span className="badge badge-green" style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle2 size={12} /> {vehicle.verification_status}
        </span>
      </div>

      {/* Photos lead — visual proof of what was approved */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24,
      }}>
        <PhotoTile
          label="Vehicle Photo"
          src={vehicle.vehicle_photo}
          fallbackIcon={Truck}
        />
        <PhotoTile
          label="Driver Photo"
          src={vehicle.driver_photo}
          fallbackIcon={UserIcon}
        />
      </div>

      <div style={{
        background: 'var(--bg)', borderRadius: 12, padding: 20,
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16,
      }}>
        {detailRows.map(row => (
          <div key={row.label}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {row.label}
            </div>
            <div style={{ fontWeight: 600, marginTop: 2 }}>{row.value || '—'}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <button 
          className="btn-outline" 
          onClick={onUpdateClick}
          style={{ padding: '10px 20px', fontSize: '0.85rem' }}
        >
          Update Vehicle Details
        </button>
      </div>
    </div>
  )
}

function PhotoTile({ label, src, fallbackIcon: FallbackIcon }) {
  return (
    <div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{
        height: 'clamp(100px, 20vw, 150px)', borderRadius: 12, overflow: 'hidden',
        border: '1px solid var(--border-light)', background: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {src ? (
          <img
            src={src}
            alt={label}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <FallbackIcon size={36} color="var(--border)" />
        )}
      </div>
    </div>
  )
}

// ─── Pending verification view ───────────────────────────────────────────────
function PendingVerificationCard({ vehicle }) {
  return (
    <div className="stat-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
      <AlertCircle size={48} color="#FFAA00" style={{ margin: '0 auto 16px' }} />
      <h2 style={{ fontSize: '1.5rem', color: 'var(--text-heading)', marginBottom: 8, fontFamily: 'Space Grotesk' }}>
        Verification Pending
      </h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
        Your vehicle details have been submitted and are currently under review by the farm manager.
      </p>

      <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 24, textAlign: 'left', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Vehicle</div>
          <div style={{ fontWeight: 600 }}>{vehicle.year_of_manufacture} {vehicle.make} {vehicle.model}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>License Plate</div>
          <div style={{ fontWeight: 600 }}>{vehicle.license_plate || '—'}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Type</div>
          <div style={{ fontWeight: 600 }}>{vehicle.vehicle_type}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Color</div>
          <div style={{ fontWeight: 600 }}>{vehicle.color}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Driver License</div>
          <div style={{ fontWeight: 600 }}>{vehicle.driver_license_number}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>License Expires</div>
          <div style={{ fontWeight: 600 }}>{vehicle.license_expiration ? new Date(vehicle.license_expiration).toLocaleDateString() : 'N/A'}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Contact Number</div>
          <div style={{ fontWeight: 600 }}>{vehicle.driver_contact_number}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Residential Address</div>
          <div style={{ fontWeight: 600 }}>{vehicle.driver_residential_address}</div>
        </div>
      </div>
    </div>
  )
}

export default function VehicleRegistration() {
  const [vehicle, setVehicle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingField, setUploadingField] = useState(null)
  const [error, setError] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [isEditingApproved, setIsEditingApproved] = useState(false)

  // Form State
  const [formData, setFormData] = useState(() => defaultVehicleForm())

  const fetchVehicle = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/vehicles/me')
      setVehicle(res.data.vehicle)
    } catch (err) {
      if (err.response?.status !== 404) {
        console.error(err)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVehicle()
  }, [])

  useEffect(() => {
    if (vehicle && (vehicle.verification_status === 'REJECTED' || isEditingApproved)) {
      setFormData({
        vehicle_type: vehicle.vehicle_type || 'Truck',
        make: vehicle.make || '',
        model: vehicle.model || '',
        year_of_manufacture: vehicle.year_of_manufacture || new Date().getFullYear(),
        license_plate: vehicle.license_plate || '',
        vin: vehicle.vin || '',
        color: vehicle.color || '',
        driver_contact_number: vehicle.driver_contact_number || '',
        driver_residential_address: vehicle.driver_residential_address || '',
        driver_license_number: vehicle.driver_license_number || '',
        license_expiration: vehicle.license_expiration ? vehicle.license_expiration.slice(0, 10) : '',
        driver_photo: vehicle.driver_photo || '',
        vehicle_photo: vehicle.vehicle_photo || '',
        registration_document: vehicle.registration_document || '',
      })
    }
  }, [vehicle, isEditingApproved])

  const requiresFullDetails = !['Bicycle', 'Motorcycle'].includes(formData.vehicle_type)

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name === 'vehicle_type') {
      setFormData(prev => ({
        ...defaultVehicleForm(value),
        driver_contact_number: prev.driver_contact_number,
        driver_residential_address: prev.driver_residential_address,
        driver_photo: prev.driver_photo,
      }))
      return
    }
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleFileChange = (field, { imageOnly = false, maxSizeMb = 5 } = {}) => async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const isImage = file.type.startsWith('image/')
    const isPdf = file.type === 'application/pdf'
    if ((imageOnly && !isImage) || (!imageOnly && !isImage && !isPdf)) {
      setError(imageOnly ? 'Please upload an image file.' : 'Please upload an image or PDF file.')
      return
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`File must be ${maxSizeMb}MB or smaller.`)
      return
    }

    setUploadingField(field)
    setError('')
    
    try {
      const formDataUpload = new FormData()
      formDataUpload.append('file', file)
      
      const res = await api.post('/api/upload', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      
      const fullUrl = `http://localhost:5000${res.data.url}`
      setFormData(prev => ({ ...prev, [field]: fullUrl }))
    } catch (err) {
      setError(formatApiError(err, 'Failed to upload photo.'))
    } finally {
      setUploadingField(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isEditingApproved && !agreedToTerms) {
      setError('You must agree to the terms.')
      return
    }
    
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        ...formData,
        year_of_manufacture: parseInt(formData.year_of_manufacture),
        license_expiration: new Date(formData.license_expiration).toISOString(),
      }
      const res = await api.post('/api/vehicles', payload)
      setVehicle(res.data.vehicle)
      setIsEditingApproved(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(formatApiError(err, 'Failed to submit vehicle details. Please check your inputs.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#8da58f' }}>
        <RefreshCw size={24} className="spin" />
        <span style={{ marginLeft: 10 }}>Loading vehicle data...</span>
      </div>
    )
  }

  if (vehicle) {
    if (vehicle.verification_status === 'PENDING') {
      return (
        <div style={{ paddingBottom: 80 }}>
          <PendingVerificationCard vehicle={vehicle} />
        </div>
      )
    }

    if (vehicle.verification_status === 'APPROVED' && !isEditingApproved) {
      return (
        <div style={{ paddingBottom: 80 }}>
          <ApprovedVehicleCard 
            vehicle={vehicle} 
            onUpdateClick={() => setIsEditingApproved(true)} 
          />
        </div>
      )
    }
  }

  // ── Small helpers used inside the wider two-column layout ────────────────
  const PhotoUpload = ({ field, label, hint, previewHeight = 180 }) => (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <label className="form-label">{label} *</label>
      <div style={{
        border: '1.5px dashed var(--border)',
        borderRadius: 12,
        padding: 12,
        background: 'var(--bg)',
      }}>
        {formData[field] ? (
          <img
            src={formData[field]}
            alt={label}
            style={{
              width: '100%',
              height: previewHeight,
              objectFit: 'contain',
              borderRadius: 10,
              marginBottom: 10,
              background: '#fff',
            }}
          />
        ) : (
          <div style={{
            height: previewHeight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-subtle)',
            background: '#fff',
            borderRadius: 10,
            marginBottom: 10,
            textAlign: 'center',
            fontSize: '0.82rem',
            lineHeight: 1.4,
            padding: '0 12px',
          }}>
            {hint}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            required={!formData[field]}
            key={`${formData.vehicle_type}-${field}-${formData[field] ? 'loaded' : 'empty'}`}
            type="file"
            accept="image/*"
            className="form-input"
            disabled={uploadingField === field || submitting}
            onChange={handleFileChange(field, { imageOnly: true, maxSizeMb: 5 })}
            style={{ flex: 1 }}
          />
          {uploadingField === field && <RefreshCw size={18} className="spin" color="var(--primary)" />}
        </div>
      </div>
    </div>
  )

  // Card that groups a section — reused so the two columns stay visually consistent.
  const SectionCard = ({ icon: Icon, title, children, style }) => (
    <div className="chart-card" style={{ padding: 24, ...style }}>
      <div className="section-header" style={{ marginBottom: 16 }}>
        <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon size={18} color="var(--primary)" /> {title}
        </div>
      </div>
      {children}
    </div>
  )

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', padding: '0 20px' }}>
      <div className="page-header">
        <div className="page-title">{isEditingApproved ? 'Update Vehicle' : 'Register Your Vehicle'}</div>
        <div className="page-desc">{isEditingApproved ? 'Update your details for manager re-verification.' : 'Provide your vehicle details for manager verification before you can start deliveries.'}</div>
      </div>

      {vehicle && vehicle.verification_status === 'REJECTED' && (
        <div style={{ background: 'var(--clr-danger-bg)', border: '1px solid var(--clr-danger-txt)', padding: 16, borderRadius: 12, marginBottom: 24 }}>
          <h4 style={{ color: 'var(--clr-danger-txt)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <AlertCircle size={18} /> Vehicle Rejected
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--clr-danger-txt)' }}>
            <strong>Reason:</strong> {vehicle.rejection_reason}
          </p>
          {vehicle.changes_requested && (
            <p style={{ fontSize: '0.85rem', color: 'var(--clr-danger-txt)', marginTop: 4 }}>
              <strong>Changes Requested:</strong> {vehicle.changes_requested}
            </p>
          )}
          <p style={{ fontSize: '0.8rem', marginTop: 12, opacity: 0.8 }}>Please update your details below and resubmit.</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {error && (
          <div style={{ background: 'var(--clr-danger-bg)', color: 'var(--clr-danger-txt)', padding: 12, borderRadius: 8, marginBottom: 20, fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {/* Vehicle-type tabs — full width across the top so the choice steers the whole form */}
        <div className="chart-card" style={{ padding: 20, marginBottom: 20 }}>
          <label className="form-label" style={{ marginBottom: 12, display: 'block' }}>Vehicle Type</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {['Truck', 'Van', 'Motorcycle', 'Bicycle'].map(type => (
              <label key={type} style={{
                padding: 12,
                border: `1.5px solid ${formData.vehicle_type === type ? 'var(--primary)' : 'var(--border)'}`,
                borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                background: formData.vehicle_type === type ? 'var(--primary-subtle)' : 'transparent',
                fontWeight: formData.vehicle_type === type ? 600 : 400,
                color: formData.vehicle_type === type ? 'var(--primary)' : 'var(--text-body)',
                transition: 'all 0.2s'
              }}>
                <input type="radio" name="vehicle_type" value={type} checked={formData.vehicle_type === type} onChange={handleChange} style={{ display: 'none' }} />
                {type}
              </label>
            ))}
          </div>
        </div>

        {/* Two-column responsive grid — auto-collapses to one column below ~880px */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: 20,
          alignItems: 'start',
        }}>

          {/* ── Column A · Row 1 · Vehicle Information ───────────────── */}
          <SectionCard icon={Car} title="Vehicle Information">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Make *</label>
                <input required type="text" name="make" className="form-input" placeholder="e.g. Toyota, Honda" value={formData.make} onChange={handleChange} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Model *</label>
                <input required type="text" name="model" className="form-input" placeholder="e.g. Hilux, CG125" value={formData.model} onChange={handleChange} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Year of Manufacture *</label>
                <input required type="number" name="year_of_manufacture" className="form-input" value={formData.year_of_manufacture} onChange={handleChange} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Color *</label>
                <input required type="text" name="color" className="form-input" placeholder="e.g. White" value={formData.color} onChange={handleChange} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">License Plate {requiresFullDetails && '*'}</label>
                <input required={requiresFullDetails} type="text" name="license_plate" className="form-input" placeholder="e.g. GW 1234-26" value={formData.license_plate} onChange={handleChange} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">VIN {requiresFullDetails && '*'}</label>
                <input required={requiresFullDetails} type="text" name="vin" className="form-input" placeholder="17-character VIN" value={formData.vin} onChange={handleChange} />
              </div>
            </div>
          </SectionCard>

          {/* ── Column B · Row 1 · Required Photos ────────────────────── */}
          <SectionCard icon={ImageIcon} title="Required Photos">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <PhotoUpload
                field="driver_photo"
                label="Driver Photo"
                hint="Clear face photo of the delivery staff"
                previewHeight={160}
              />
              <PhotoUpload
                field="vehicle_photo"
                label="Vehicle Photo"
                hint="Clear photo showing the delivery vehicle"
                previewHeight={160}
              />
            </div>
          </SectionCard>

          {/* ── Column A · Row 2 · Driver Security + Licensing ─────────── */}
          <SectionCard icon={UserIcon} title="Driver Security & Licensing">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Contact Number *</label>
                <input required type="tel" name="driver_contact_number" className="form-input" placeholder="e.g. 0241234567" value={formData.driver_contact_number} onChange={handleChange} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Residential Address *</label>
                <input required type="text" name="driver_residential_address" className="form-input" placeholder="House, street, area/town" value={formData.driver_residential_address} onChange={handleChange} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Driver License Number *</label>
                <input required type="text" name="driver_license_number" className="form-input" value={formData.driver_license_number} onChange={handleChange} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">License Expiration *</label>
                <input required type="date" name="license_expiration" className="form-input" value={formData.license_expiration} onChange={handleChange} />
              </div>
            </div>
          </SectionCard>

          {/* ── Column B · Row 2 · Registration Document ───────────────── */}
          <SectionCard icon={Hash} title="Registration Document">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ color: 'var(--text-subtle)' }}>Optional — upload if available</label>
              <div style={{
                border: '1.5px dashed var(--border)',
                borderRadius: 12,
                padding: 12,
                background: 'var(--bg)',
              }}>
                {formData.registration_document ? (
                  formData.registration_document.endsWith('.pdf') ? (
                    <div style={{ padding: '32px 12px', background: '#fff', borderRadius: 10, marginBottom: 10, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      PDF Document Uploaded
                    </div>
                  ) : (
                    <img
                      src={formData.registration_document}
                      alt="Registration document"
                      style={{ width: '100%', height: 190, objectFit: 'contain', borderRadius: 10, marginBottom: 10, background: '#f9f9f9' }}
                    />
                  )
                ) : (
                  <div style={{ padding: '52px 12px', background: '#fff', borderRadius: 10, marginBottom: 10, textAlign: 'center', color: 'var(--text-subtle)', fontSize: '0.82rem' }}>
                    Upload vehicle registration document if available
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    required={!formData.registration_document}
                    key={`${formData.vehicle_type}-registration_document-${formData.registration_document ? 'loaded' : 'empty'}`}
                    type="file"
                    accept="image/*,application/pdf"
                    className="form-input"
                    disabled={uploadingField === 'registration_document' || submitting}
                    onChange={handleFileChange('registration_document', { maxSizeMb: 5 })}
                    style={{ flex: 1 }}
                  />
                  {uploadingField === 'registration_document' && <RefreshCw size={18} className="spin" color="var(--primary)" />}
                </div>
              </div>
              {formData.registration_document && (
                <a href={formData.registration_document} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: 8, fontSize: '0.8rem', color: 'var(--primary)' }}>
                  View Uploaded Document
                </a>
              )}
            </div>
          </SectionCard>

        </div>

        {/* Full-width footer card. When editing an already-approved vehicle,
            show the "changes will drop you back to Pending" notice instead of
            the terms disclaimer. Cancel button only appears in edit mode. */}
        <div className="chart-card" style={{ padding: 20, marginTop: 20 }}>
          {isEditingApproved ? (
            <div style={{ marginBottom: 20, padding: 16, background: 'rgba(255,170,0,0.08)', borderRadius: 12 }}>
              <p style={{ fontSize: '0.85rem', color: '#b45309', margin: 0 }}>
                <strong>Note:</strong> Submitting updated vehicle details will place your account back into <strong>Pending Verification</strong> status, and you will not be able to accept deliveries until approved.
              </p>
            </div>
          ) : (
            <label htmlFor="agree-staff-terms" style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
              fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4,
              marginBottom: 20,
            }}>
              <input
                type="checkbox"
                id="agree-staff-terms"
                checked={agreedToTerms}
                onChange={(e) => {
                  setAgreedToTerms(e.target.checked)
                  if (error) setError('')
                }}
                style={{ marginTop: 3, cursor: 'pointer', accentColor: 'var(--primary)' }}
              />
              <span>
                I agree to the{' '}
                <Link to="/terms" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Terms and Conditions</Link>
                {' '}and{' '}
                <Link to="/privacy" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Privacy Policy</Link>, and acknowledge that platform interactions contribute to AI analytics.
              </span>
            </label>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {isEditingApproved && (
              <button
                type="button"
                className="btn-outline"
                style={{ padding: '12px 24px', minWidth: 140, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                onClick={() => setIsEditingApproved(false)}
                disabled={submitting}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="btn-primary"
              style={{ padding: '12px 32px', minWidth: 260, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}
              disabled={submitting || uploadingField}
            >
              {submitting ? <RefreshCw size={16} className="spin" /> : <CheckCircle2 size={16} />}
              {submitting
                ? 'Submitting...'
                : (isEditingApproved ? 'Submit Update Request' : 'Submit Vehicle Details')}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
