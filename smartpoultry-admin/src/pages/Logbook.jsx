import { useState, useEffect } from 'react'
import { Plus, X, Search, Download, Loader2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/axios'
import { useToast } from '../components/Toast'
import Pagination from '../components/Pagination'

function AddEntryModal({ onClose }) {
  const queryClient = useQueryClient()
  const { showSuccess, showError } = useToast()

  // Dynamically fetch active batches from the database
  const { data: batches = [], isLoading: batchesLoading } = useQuery({
    queryKey: ['logbook', 'batches'],
    queryFn: () => api.get('/api/logbook/batches').then(r => r.data),
  })

  // Egg-producing breeds
  const EGG_BREEDS = ['layer', 'noiler', 'local fowl', 'local']

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    batchId: '',
    feedConsumption: '',
    eggsCount: '',
    dailyEggPurchases: '',
    weeklyEggPurchases: '',
    birdsBought: '',
    mortality: '',
    expenses: '',
    waterConsumption: '',
    sales: '',
    notes: '',
  })

  // Auto-select first batch when batches load
  useEffect(() => {
    if (batches.length > 0 && !formData.batchId) {
      setFormData(prev => ({ ...prev, batchId: batches[0].id }))
    }
  }, [batches])

  const [errors, setErrors] = useState({})

  const selectedBatch = batches.find(b => b.id === formData.batchId)
  const hasEggs = selectedBatch ? EGG_BREEDS.some(e => selectedBatch.breed.toLowerCase().includes(e)) : true

  const validate = () => {
    const newErrors = {}
    if (!formData.batchId) newErrors.batchId = "Please select a batch"
    if (hasEggs && Number(formData.eggsCount) < 0) {
      newErrors.eggsCount = "Egg count cannot be negative"
    }
    if (Number(formData.feedConsumption) < 0) newErrors.feedConsumption = "Feed amount cannot be negative"
    if (Number(formData.birdsBought) < 0) newErrors.birdsBought = "Birds bought count cannot be negative"

    const today = new Date().toISOString().split('T')[0]
    if (formData.date > today) newErrors.date = "Date cannot be in the future"

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const mutation = useMutation({
    mutationFn: (newEntry) => api.post('/api/logbook', newEntry),
    onSuccess: () => {
      showSuccess("Entry saved")
      queryClient.invalidateQueries({ queryKey: ['logbook'] })
      onClose()
    },
    onError: (err) => {
      showError(err.response?.data?.error || "Failed to save entry")
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return

    mutation.mutate({
      date: formData.date,
      batchId: formData.batchId,
      feedConsumption: Number(formData.feedConsumption || 0),
      eggsCount: hasEggs ? Number(formData.eggsCount || 0) : 0,
      dailyEggPurchases: hasEggs ? Number(formData.dailyEggPurchases || 0) : 0,
      weeklyEggPurchases: hasEggs ? Number(formData.weeklyEggPurchases || 0) : 0,
      birdsBought: Number(formData.birdsBought || 0),
      mortality: Number(formData.mortality || 0),
      expenses: Number(formData.expenses || 0),
      waterConsumption: Number(formData.waterConsumption || 0),
      sales: Number(formData.sales || 0),
      notes: formData.notes,
    })
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // clear error for that field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }))
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box" style={{ maxWidth: '600px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <div className="modal-title">Add Logbook Entry</div>
            <div className="modal-subtitle">Record today's farm activity data</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8da58f' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Date</label>
              <input className="form-input" type="date" name="date" value={formData.date} onChange={handleChange} required />
              {errors.date && <div style={{ color: 'red', fontSize: '0.75rem', marginTop: '4px' }}>{errors.date}</div>}
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Batch / House</label>
              <select className="form-select" name="batchId" value={formData.batchId} onChange={handleChange} required>
                <option value="">— Select a batch —</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>{b.batchNumber} - {b.breed} ({b.currentCount} birds)</option>
                ))}
              </select>
              {batchesLoading && <div style={{ fontSize: '0.75rem', color: '#8da58f', marginTop: 4 }}>Loading batches…</div>}
              {!batchesLoading && batches.length === 0 && <div style={{ fontSize: '0.75rem', color: 'red', marginTop: 4 }}>No active batches found. Create a batch first.</div>}
            </div>
          </div>

          <div style={{ height: 14 }} />

          {hasEggs ? (
            <>
              {/* Row 2: Feed and Eggs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Feed Used (kg)</label>
                  <input className="form-input" type="number" step="any" name="feedConsumption" value={formData.feedConsumption} onChange={handleChange} placeholder="e.g. 480" required />
                  {errors.feedConsumption && <div style={{ color: 'red', fontSize: '0.75rem', marginTop: '4px' }}>{errors.feedConsumption}</div>}
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Egg Count</label>
                  <input className="form-input" type="number" name="eggsCount" value={formData.eggsCount} onChange={handleChange} placeholder="e.g. 1200" />
                  {errors.eggsCount && <div style={{ color: 'red', fontSize: '0.75rem', marginTop: '4px' }}>{errors.eggsCount}</div>}
                </div>
              </div>

              <div style={{ height: 14 }} />

              {/* Row 3: Egg Purchases */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Daily Egg Purchases</label>
                  <input className="form-input" type="number" name="dailyEggPurchases" value={formData.dailyEggPurchases} onChange={handleChange} placeholder="e.g. 20" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Weekly Egg Purchases</label>
                  <input className="form-input" type="number" name="weeklyEggPurchases" value={formData.weeklyEggPurchases} onChange={handleChange} placeholder="e.g. 150" />
                </div>
              </div>

              <div style={{ height: 14 }} />

              {/* Row 4: Mortality & Birds Bought */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Mortality Count</label>
                  <input className="form-input" type="number" name="mortality" value={formData.mortality} onChange={handleChange} placeholder="e.g. 2" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{selectedBatch?.breed || 'Bird'}s Bought</label>
                  <input className="form-input" type="number" name="birdsBought" value={formData.birdsBought} onChange={handleChange} placeholder="e.g. 100" />
                  {errors.birdsBought && <div style={{ color: 'red', fontSize: '0.75rem', marginTop: '4px' }}>{errors.birdsBought}</div>}
                </div>
              </div>

              <div style={{ height: 14 }} />

              {/* Row 5: Water Consumption & Expenses */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Water Consumption (L)</label>
                  <input className="form-input" type="number" step="any" name="waterConsumption" value={formData.waterConsumption} onChange={handleChange} placeholder="e.g. 320" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Expenses (GHS)</label>
                  <input className="form-input" type="number" step="any" name="expenses" value={formData.expenses} onChange={handleChange} placeholder="e.g. 1200" />
                </div>
              </div>

              <div style={{ height: 14 }} />

              {/* Row 6: Sales */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Sales (GHS)</label>
                  <input className="form-input" type="number" step="any" name="sales" value={formData.sales} onChange={handleChange} placeholder="e.g. 2400" />
                </div>
                <div></div>
              </div>
            </>
          ) : (
            <>
              {/* Row 2: Feed & Birds Bought */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Feed Used (kg)</label>
                  <input className="form-input" type="number" step="any" name="feedConsumption" value={formData.feedConsumption} onChange={handleChange} placeholder="e.g. 480" required />
                  {errors.feedConsumption && <div style={{ color: 'red', fontSize: '0.75rem', marginTop: '4px' }}>{errors.feedConsumption}</div>}
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{selectedBatch?.breed || 'Bird'}s Bought</label>
                  <input className="form-input" type="number" name="birdsBought" value={formData.birdsBought} onChange={handleChange} placeholder="e.g. 100" />
                  {errors.birdsBought && <div style={{ color: 'red', fontSize: '0.75rem', marginTop: '4px' }}>{errors.birdsBought}</div>}
                </div>
              </div>

              <div style={{ height: 14 }} />

              {/* Row 3: Mortality & Water */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Mortality Count</label>
                  <input className="form-input" type="number" name="mortality" value={formData.mortality} onChange={handleChange} placeholder="e.g. 2" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Water Consumption (L)</label>
                  <input className="form-input" type="number" step="any" name="waterConsumption" value={formData.waterConsumption} onChange={handleChange} placeholder="e.g. 320" />
                </div>
              </div>

              <div style={{ height: 14 }} />

              {/* Row 4: Expenses & Sales */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Expenses (GHS)</label>
                  <input className="form-input" type="number" step="any" name="expenses" value={formData.expenses} onChange={handleChange} placeholder="e.g. 1200" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Sales (GHS)</label>
                  <input className="form-input" type="number" step="any" name="sales" value={formData.sales} onChange={handleChange} placeholder="e.g. 2400" />
                </div>
              </div>
            </>
          )}

          <div style={{ height: 14 }} />

          <div className="form-group">
            <label className="form-label">Health & Notes</label>
            <textarea
              className="form-input"
              rows={3}
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Any observations, vet visits, environmental issues..."
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Save Entry'}
            </button>
            <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Logbook() {
  const [showModal, setShowModal] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [page, setPage] = useState(1)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput)
      setPage(1) // reset page on new search
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // React Query Fetch
  const { data, isLoading, isError } = useQuery({
    queryKey: ['logbook', debouncedSearch, activeTab, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (debouncedSearch) params.append('search', debouncedSearch)
      if (activeTab !== 'all') params.append('batch', activeTab)
      params.append('page', page)
      params.append('limit', 20)
      
      const res = await api.get(`/api/logbook?${params.toString()}`)
      return res.data
    }
  })

  const logEntries = data?.data || []
  const totalEntries = data?.meta?.total || 0

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="page-title">Farm Logbook</div>
            <div className="page-desc">Daily farm activity records — all batches</div>
          </div>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={15} />
            Add Entry
          </button>
        </div>
      </div>

      {/* Summary row (Dummy Data for now, can be computed or fetched later) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
        {[
          { label: 'Total Entries',   value: totalEntries.toString(), sub: 'In database'  },
          { label: 'Avg Daily Eggs',  value: '0',          sub: 'Last 7 days'  },
          { label: 'Total Mortality', value: '0',          sub: 'Last 7 days'  },
          { label: 'Total Expenses',  value: 'GHS 0',      sub: 'Last 7 days'  },
        ].map((s, i) => (
          <div key={i} style={{
            background: '#fff', borderRadius: 12, padding: '15px 18px',
            border: '1px solid #dddabd'
          }}>
            <div style={{ fontSize: '0.68rem', color: '#8da58f', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
              {s.label}
            </div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.35rem', fontWeight: 700, color: '#0d1f0e', margin: '4px 0 2px' }}>
              {s.value}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#8da58f' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div className="chart-card">
        <div className="chart-header">
          <div>
            <div className="chart-title">Log Entries</div>
            <div className="chart-subtitle">{totalEntries} records found</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Tabs */}
            <div className="filter-tabs">
              {['all', 'broiler', 'layer', 'noiler', 'local fowl'].map(t => (
                <button key={t} className={`filter-tab${activeTab === t ? ' active' : ''}`}
                  onClick={() => { setActiveTab(t); setPage(1); }}>
                  {t === 'all' ? 'All' : t === 'local fowl' ? 'Local Fowls' : t.charAt(0).toUpperCase() + t.slice(1) + 's'}
                </button>
              ))}
            </div>

            {/* Search */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: '#F7F6E5', border: '1.5px solid #dddabd',
              borderRadius: 9, padding: '6px 11px'
            }}>
              <Search size={13} color="#8da58f" />
              <input
                placeholder="Search entries..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                style={{
                  border: 'none', background: 'transparent', outline: 'none',
                  fontSize: '0.78rem', color: '#2a3d2b', width: 130,
                  fontFamily: 'Inter, sans-serif'
                }}
              />
            </div>

            <button className="btn-outline" style={{ padding: '6px 13px', fontSize: '0.78rem' }}>
              <Download size={13} />
              Export CSV
            </button>
          </div>
        </div>

        <div className="table-wrapper">
          {isLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#8da58f' }}>
               <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 10px' }} />
               Loading logs...
            </div>
          ) : isError ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'red' }}>
               Error loading logbook entries.
            </div>
          ) : logEntries.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#8da58f' }}>
               No log entries found.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Entry ID</th>
                  <th>Date</th>
                  <th>Batch / House</th>
                  <th>Feed (kg)</th>
                  <th>Egg Count</th>
                  <th>Purchases (D/W)</th>
                  <th>Birds Bought</th>
                  <th>Mortality</th>
                  <th>Notes (Exp/Sales)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {logEntries.map(entry => {
                  const dateStr = new Date(entry.date).toLocaleDateString()
                  const batchName = entry.batch?.breed || "Unknown Batch"
                  const isBroiler = batchName.toLowerCase().includes('broiler')
                  const badgeClass = batchName.toLowerCase().includes('broiler') ? 'badge-green' :
                                     batchName.toLowerCase().includes('layer') ? 'badge-blue' :
                                     batchName.toLowerCase().includes('noiler') ? 'badge-amber' :
                                     batchName.toLowerCase().includes('local') ? 'badge-purple' : 'badge-gray';
                  
                  return (
                    <tr key={entry.id}>
                      <td style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '0.8rem', color: '#237227' }}>
                        {entry.id.substring(entry.id.length - 6).toUpperCase()}
                      </td>
                      <td style={{ color: '#5e7a61', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{dateStr}</td>
                      <td>
                        <span className={`badge ${badgeClass}`}>
                          {batchName}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{entry.feedConsumption}</td>
                      <td style={{ fontWeight: 600 }}>{isBroiler ? '-' : entry.eggsCount.toLocaleString()}</td>
                      <td style={{ color: '#5e7a61', fontSize: '0.82rem' }}>
                        {isBroiler ? '-' : `${entry.dailyEggPurchases} / ${entry.weeklyEggPurchases}`}
                      </td>
                      <td style={{ fontWeight: 600, color: '#2a3d2b' }}>
                        {entry.birdsBought > 0 ? `+${entry.birdsBought}` : '-'}
                      </td>
                      <td>
                        <span className={`badge ${entry.mortality === 0 ? 'badge-green' : entry.mortality <= 2 ? 'badge-amber' : 'badge-red'}`}>
                          {entry.mortality} deaths
                        </span>
                      </td>
                      <td className="td-notes" title={entry.notes}>{entry.notes || '-'}</td>
                      <td><span className="badge badge-green">Saved</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!isLoading && data?.meta && (
          <div style={{ padding: '0 16px' }}>
            <Pagination 
              currentPage={page}
              totalItems={data.meta.total}
              itemsPerPage={20}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {showModal && <AddEntryModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
