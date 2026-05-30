import { useState, useEffect } from 'react'
import { Truck, AlertCircle, CheckCircle2, RefreshCw, Car, Calendar, Hash, Image as ImageIcon } from 'lucide-react'
import api from '../api/axios'

const defaultVehicleForm = (vehicleType = 'Truck') => ({
  vehicle_type: vehicleType,
  make: '',
  model: '',
  year_of_manufacture: new Date().getFullYear(),
  license_plate: '',
  vin: '',
  color: '',
  insurance_provider: '',
  insurance_policy_number: '',
  insurance_expiration: '',
  driver_contact_number: '',
  driver_residential_address: '',
  driver_license_number: '',
  license_expiration: '',
  seating_capacity: 2,
  mileage: 0,
  driver_photo: '',
  vehicle_photo: '',
  insurance_document: '',
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

export default function VehicleRegistration() {
  const [vehicle, setVehicle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

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
    if (vehicle && vehicle.verification_status === 'REJECTED') {
      setFormData({
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
        driver_contact_number: vehicle.driver_contact_number || '',
        driver_residential_address: vehicle.driver_residential_address || '',
        driver_license_number: vehicle.driver_license_number || '',
        license_expiration: vehicle.license_expiration ? vehicle.license_expiration.slice(0, 10) : '',
        seating_capacity: vehicle.seating_capacity || 2,
        mileage: vehicle.mileage || 0,
        driver_photo: vehicle.driver_photo || '',
        vehicle_photo: vehicle.vehicle_photo || '',
        insurance_document: vehicle.insurance_document || '',
        registration_document: vehicle.registration_document || '',
      })
    }
  }, [vehicle])

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

  const handleFileChange = (field, { imageOnly = false, maxSizeMb = 2 } = {}) => (e) => {
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

    const reader = new FileReader()
    reader.onload = () => {
      setError('')
      setFormData(prev => ({ ...prev, [field]: reader.result }))
    }
    reader.onerror = () => setError('Could not read the selected photo.')
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      // Parse dates to ISO string if needed by backend, 
      // but standard HTML date picker provides YYYY-MM-DD which Prisma might accept or need new Date()
      const payload = {
        ...formData,
        year_of_manufacture: parseInt(formData.year_of_manufacture),
        seating_capacity: formData.seating_capacity === '' ? null : parseInt(formData.seating_capacity),
        mileage: formData.mileage === '' ? null : parseFloat(formData.mileage),
        insurance_expiration: formData.insurance_expiration
          ? new Date(formData.insurance_expiration).toISOString()
          : null,
        license_expiration: new Date(formData.license_expiration).toISOString(),
      }
      await api.post('/api/vehicles', payload)
      await fetchVehicle() // Refresh to show pending status
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

  if (vehicle && vehicle.verification_status !== 'REJECTED') {
    const isApproved = vehicle.verification_status === 'APPROVED'
    return (
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div className="page-header" style={{ textAlign: 'center' }}>
          <div className="page-title">Vehicle Status</div>
          <div className="page-desc">Manage your delivery vehicle registration</div>
        </div>

        <div className="stat-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          {isApproved ? (
            <CheckCircle2 size={48} color="#237227" style={{ margin: '0 auto 16px' }} />
          ) : (
            <AlertCircle size={48} color="#FFAA00" style={{ margin: '0 auto 16px' }} />
          )}
          
          <h2 style={{ fontSize: '1.5rem', color: 'var(--text-heading)', marginBottom: 8, fontFamily: 'Space Grotesk' }}>
            {isApproved ? 'Vehicle Approved' : 'Verification Pending'}
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
            {isApproved 
              ? 'Your vehicle has been successfully verified by the manager. You are ready to accept deliveries!'
              : 'Your vehicle details have been submitted and are currently under review by the farm manager.'}
          </p>

          <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 24, textAlign: 'left', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Vehicle</div>
              <div style={{ fontWeight: 600 }}>{vehicle.year_of_manufacture} {vehicle.make} {vehicle.model}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>License Plate</div>
              <div style={{ fontWeight: 600 }}>{vehicle.license_plate}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Type</div>
              <div style={{ fontWeight: 600 }}>{vehicle.vehicle_type}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Insurance</div>
              <div style={{ fontWeight: 600 }}>{vehicle.insurance_provider}</div>
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
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="page-header">
        <div className="page-title">Register Your Vehicle</div>
        <div className="page-desc">Provide your vehicle details for manager verification before you can start deliveries.</div>
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

      <form onSubmit={handleSubmit} className="chart-card">
        {error && (
          <div style={{ background: 'var(--clr-danger-bg)', color: 'var(--clr-danger-txt)', padding: 12, borderRadius: 8, marginBottom: 20, fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        <div className="section-header">
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Car size={18} color="var(--primary)" /> Vehicle Information
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Vehicle Type</label>
            <div style={{ display: 'flex', gap: 12 }}>
              {['Truck', 'Van', 'Motorcycle', 'Bicycle'].map(type => (
                <label key={type} style={{
                  flex: 1, padding: 12, border: `1.5px solid ${formData.vehicle_type === type ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 12, cursor: 'pointer', textAlign: 'center', background: formData.vehicle_type === type ? 'var(--primary-subtle)' : 'transparent',
                  fontWeight: formData.vehicle_type === type ? 600 : 400, color: formData.vehicle_type === type ? 'var(--primary)' : 'var(--text-body)',
                  transition: 'all 0.2s'
                }}>
                  <input type="radio" name="vehicle_type" value={type} checked={formData.vehicle_type === type} onChange={handleChange} style={{ display: 'none' }} />
                  {type}
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Make</label>
            <input required type="text" name="make" className="form-input" placeholder="e.g. Toyota, Honda" value={formData.make} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label className="form-label">Model</label>
            <input required type="text" name="model" className="form-input" placeholder="e.g. Hilux, CG125" value={formData.model} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label className="form-label">Year of Manufacture</label>
            <input required type="number" name="year_of_manufacture" className="form-input" value={formData.year_of_manufacture} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label className="form-label">License Plate {requiresFullDetails && '*'}</label>
            <input required={requiresFullDetails} type="text" name="license_plate" className="form-input" placeholder="e.g. GW 1234-26" value={formData.license_plate} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label className="form-label">VIN (Vehicle Identification Number) {requiresFullDetails && '*'}</label>
            <input required={requiresFullDetails} type="text" name="vin" className="form-input" placeholder="17-character VIN" value={formData.vin} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label className="form-label">Color *</label>
            <input required type="text" name="color" className="form-input" placeholder="e.g. White" value={formData.color} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label className="form-label">Seating Capacity</label>
            <input type="number" min="1" name="seating_capacity" className="form-input" value={formData.seating_capacity} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label className="form-label">Mileage</label>
            <input type="number" min="0" step="0.1" name="mileage" className="form-input" value={formData.mileage} onChange={handleChange} />
          </div>
        </div>

        <div className="section-header" style={{ marginTop: 12 }}>
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ImageIcon size={18} color="var(--primary)" /> Required Photos
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          {[
            { key: 'driver_photo', label: 'Driver Photo', hint: 'Clear face photo of the delivery staff' },
            { key: 'vehicle_photo', label: 'Vehicle Photo', hint: 'Clear photo showing the delivery vehicle' },
          ].map(item => (
            <div key={item.key} className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{item.label} *</label>
              <div style={{
                border: '1.5px dashed var(--border)',
                borderRadius: 12,
                padding: 12,
                background: 'var(--bg)',
              }}>
                {formData[item.key] ? (
                  <img
                    src={formData[item.key]}
                    alt={item.label}
                    style={{
                      width: '100%',
                      height: 180,
                      objectFit: 'cover',
                      borderRadius: 10,
                      marginBottom: 10,
                      background: '#fff',
                    }}
                  />
                ) : (
                  <div style={{
                    height: 180,
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
                  }}>
                    {item.hint}
                  </div>
                )}
                <input
                  required={!formData[item.key]}
                  key={`${formData.vehicle_type}-${item.key}-${formData[item.key] ? 'loaded' : 'empty'}`}
                  type="file"
                  accept="image/*"
                  className="form-input"
                  onChange={handleFileChange(item.key, { imageOnly: true, maxSizeMb: 2 })}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="section-header" style={{ marginTop: 32 }}>
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Hash size={18} color="var(--primary)" /> Driver Security Details
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Contact Number *</label>
            <input required type="tel" name="driver_contact_number" className="form-input" placeholder="e.g. 0241234567" value={formData.driver_contact_number} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label className="form-label">Residential Address *</label>
            <input required type="text" name="driver_residential_address" className="form-input" placeholder="House number, street, area/town" value={formData.driver_residential_address} onChange={handleChange} />
          </div>
        </div>

        <div className="section-header" style={{ marginTop: 32 }}>
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Hash size={18} color="var(--primary)" /> Licensing & Insurance
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Driver License Number *</label>
            <input required type="text" name="driver_license_number" className="form-input" value={formData.driver_license_number} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label className="form-label">License Expiration *</label>
            <input required type="date" name="license_expiration" className="form-input" value={formData.license_expiration} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label className="form-label">Insurance Provider {requiresFullDetails && '*'}</label>
            <input required={requiresFullDetails} type="text" name="insurance_provider" className="form-input" placeholder="e.g. SIC Insurance" value={formData.insurance_provider} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label className="form-label">Insurance Policy Number {requiresFullDetails && '*'}</label>
            <input required={requiresFullDetails} type="text" name="insurance_policy_number" className="form-input" value={formData.insurance_policy_number} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label className="form-label">Insurance Expiration {requiresFullDetails && '*'}</label>
            <input required={requiresFullDetails} type="date" name="insurance_expiration" className="form-input" value={formData.insurance_expiration} onChange={handleChange} />
          </div>
          {[
            { key: 'registration_document', label: 'Registration Document', hint: 'Upload vehicle registration document if available' },
            { key: 'insurance_document', label: 'Insurance Document', hint: 'Upload insurance document if available' },
          ].map(item => (
            <div key={item.key} className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{item.label}</label>
              <div style={{
                border: '1.5px dashed var(--border)',
                borderRadius: 12,
                padding: 12,
                background: 'var(--bg)',
              }}>
                {formData[item.key] ? (
                  formData[item.key].startsWith('data:image/') ? (
                    <img
                      src={formData[item.key]}
                      alt={item.label}
                      style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 10, marginBottom: 10, background: '#fff' }}
                    />
                  ) : (
                    <div style={{ padding: '32px 12px', background: '#fff', borderRadius: 10, marginBottom: 10, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      PDF uploaded
                    </div>
                  )
                ) : (
                  <div style={{ padding: '32px 12px', background: '#fff', borderRadius: 10, marginBottom: 10, textAlign: 'center', color: 'var(--text-subtle)', fontSize: '0.82rem' }}>
                    {item.hint}
                  </div>
                )}
                <input
                  key={`${formData.vehicle_type}-${item.key}-${formData[item.key] ? 'loaded' : 'empty'}`}
                  type="file"
                  accept="image/*,application/pdf"
                  className="form-input"
                  onChange={handleFileChange(item.key, { maxSizeMb: 4 })}
                />
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn-primary" disabled={submitting} style={{ padding: '12px 24px' }}>
            {submitting ? <RefreshCw size={16} className="spin" /> : <CheckCircle2 size={16} />}
            {submitting ? 'Submitting...' : 'Submit Vehicle Details'}
          </button>
        </div>
      </form>
    </div>
  )
}
