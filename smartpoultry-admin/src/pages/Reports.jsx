import api from '../api/axios'
import { useState, useEffect } from 'react'
import { Download, FileText, Calendar, BarChart2, TrendingUp, Truck, DollarSign, Loader2, X } from 'lucide-react'
import { generateReport, fetchReportHistory, fetchAuditLogs } from '../api/reports'

const reportTypes = [
  { id: 'production', icon: BarChart2,   label: 'Production Report',  desc: 'Egg yield, feed used, mortality trends',       color: '#237227', bg: 'rgba(35,114,39,0.08)'   },
  { id: 'financial',  icon: DollarSign,  label: 'Financial Report',   desc: 'Expenses, revenue, profit margins',            color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)'  },
  { id: 'delivery',   icon: Truck,       label: 'Delivery Report',    desc: 'Order history, delivery performance',          color: '#3b82f6', bg: 'rgba(59,130,246,0.08)'  },
  { id: 'analytics',  icon: TrendingUp,  label: 'AI Analytics Report',desc: 'Forecast accuracy, model insights',            color: '#FFAA00', bg: 'rgba(255,170,0,0.10)'   },
]


const AVAILABLE_SECTIONS = [
  { id: 'egg_trend', label: 'Egg Production Summary', defaultFor: ['production', 'analytics'] },
  { id: 'fcr', label: 'Feed Conversion Ratio', defaultFor: ['production', 'analytics'] },
  { id: 'revenue_timeseries', label: 'Financial Overview', defaultFor: ['financial', 'analytics'] },
  { id: 'fulfilment_funnel', label: 'Delivery Performance', defaultFor: ['delivery', 'analytics'] }
];


function ScheduleReportModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box" style={{ maxWidth: '400px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <div className="modal-title">Schedule Report</div>
            <div className="modal-subtitle">Set up automated recurring reports</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8da58f' }}>
            <X size={20} />
          </button>
        </div>
        <div className="form-group">
          <label className="form-label">Frequency</label>
          <select className="form-select">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Email Recipients</label>
          <input className="form-input" type="text" placeholder="manager@farm.com" />
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button type="button" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => {
            alert('Schedule saved to local config.');
            onClose();
          }}>
            Save Schedule
          </button>
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function Reports() {
  const [selectedType, setSelectedType] = useState('production')
  const [dateRange, setDateRange]       = useState('week')
  const [format, setFormat]             = useState('pdf')
  const [batchId, setBatchId]           = useState('all')
  const [batches, setBatches]           = useState([])
  const [selectedSections, setSelectedSections] = useState(AVAILABLE_SECTIONS.filter(s => s.defaultFor.includes('production')).map(s => s.id))
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  
  const [history, setHistory]           = useState([])
  const [logs, setLogs]                 = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [loadingLogs, setLoadingLogs]       = useState(true)
  const [generating, setGenerating]         = useState(false)
  const [error, setError]                   = useState(null)

  // Fetch report history and audit logs on mount
  const loadData = async () => {
    try {
      api.get('/api/logbook/batches').then(res => setBatches(res.data)).catch(console.error)
    } catch(e) {}
    try {
      setLoadingHistory(true)
      const reportHistory = await fetchReportHistory()
      setHistory(reportHistory)
    } catch (err) {
      console.error('Failed to load report history:', err)
    } finally {
      setLoadingHistory(false)
    }

    try {
      setLoadingLogs(true)
      const auditLogs = await fetchAuditLogs()
      setLogs(auditLogs)
    } catch (err) {
      console.error('Failed to load audit logs:', err)
    } finally {
      setLoadingLogs(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleGenerate = async () => {
    try {
      setGenerating(true)
      setError(null)
      const result = await generateReport({
        type: selectedType,
        dateRange,
        format,
        batchId,
        sections: selectedSections
      })
      if (result && result.fileUrl) {
        // Trigger download
        window.open(result.fileUrl, '_blank')
        // Refresh history and audit logs
        loadData()
      } else {
        throw new Error('No download URL returned from server')
      }
    } catch (err) {
      console.error('Failed to generate report:', err)
      setError('Failed to generate report. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const handleDownload = (fileUrl) => {
    if (fileUrl) {
      window.open(fileUrl, '_blank')
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Reports</div>
        <div className="page-desc">Generate, download, and schedule farm performance reports</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 18 }}>
        {/* Report generator */}
        <div>
          {/* Report type selection */}
          <div className="chart-card" style={{ marginBottom: 14 }}>
            <div className="section-header">
              <div>
                <div className="section-title">Report Type</div>
                <div className="section-sub">Select the type of report to generate</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {reportTypes.map(r => (
                <div
                  key={r.id}
                  onClick={() => {
                    setSelectedType(r.id);
                    setSelectedSections(AVAILABLE_SECTIONS.filter(s => s.defaultFor.includes(r.id)).map(s => s.id));
                  }}
                  style={{
                    padding: '14px', borderRadius: 11, cursor: 'pointer',
                    border: selectedType === r.id ? `1.5px solid ${r.color}` : '1.5px solid #dddabd',
                    background: selectedType === r.id ? r.bg : '#fff',
                    transition: 'all 0.15s', display: 'flex', gap: 12, alignItems: 'flex-start'
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 9, background: r.bg,
                    border: `1px solid ${r.color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <r.icon size={16} color={r.color} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#0d1f0e' }}>{r.label}</div>
                    <div style={{ fontSize: '0.73rem', color: '#5e7a61', marginTop: 2, lineHeight: 1.45 }}>{r.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="chart-card" style={{ marginBottom: 14 }}>
            <div className="section-title" style={{ marginBottom: 14 }}>Report Parameters</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Date Range</label>
                <select className="form-select" value={dateRange} onChange={e => setDateRange(e.target.value)}>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                  <option value="quarter">This Quarter</option>
                  <option value="custom" disabled>Custom Range</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Batch / House</label>
                <select className="form-select" value={batchId} onChange={e => setBatchId(e.target.value)}>
                  <option value="all">All Batches</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>{b.batchNumber} - {b.breed}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Export Format</label>
                <select className="form-select" value={format} onChange={e => setFormat(e.target.value)}>
                  <option value="pdf">PDF Document</option>
                  <option value="csv">CSV Spreadsheet</option>
                  <option value="excel" disabled>Excel (.xlsx)</option>
                </select>
              </div>
            </div>

            {dateRange === 'custom' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">From Date</label>
                  <input className="form-input" type="date" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">To Date</label>
                  <input className="form-input" type="date" />
                </div>
              </div>
            )}
          </div>

          {/* Include sections */}
          <div className="chart-card" style={{ marginBottom: 14 }}>
            <div className="section-title" style={{ marginBottom: 12 }}>Include Sections</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 9 }}>
              {AVAILABLE_SECTIONS.map((s, i) => (
                <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedSections.includes(s.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSections([...selectedSections, s.id]);
                      } else {
                        setSelectedSections(selectedSections.filter(id => id !== s.id));
                      }
                    }}
                    style={{ accentColor: '#237227', width: 14, height: 14 }} 
                  />
                  <span style={{ fontSize: '0.82rem', color: '#2a3d2b' }}>{s.label}</span>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ color: '#ef4444', fontSize: '0.82rem', marginBottom: 14, fontWeight: 500 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button 
              className="btn-primary" 
              style={{ flex: 1, justifyContent: 'center', padding: '12px' }}
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <>
                  <Loader2 size={15} style={{ animation: 'spin 1s linear infinite', marginRight: 6 }} />
                  Generating Report...
                </>
              ) : (
                <>
                  <Download size={15} />
                  Generate & Download Report
                </>
              )}
            </button>
            <button className="btn-outline" onClick={() => setShowScheduleModal(true)}>
              <Calendar size={14} />
              Schedule Auto-Report
            </button>
          </div>
        </div>

        {/* Recent reports & audit log */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Recent reports */}
          <div className="chart-card">
            <div className="section-title" style={{ marginBottom: 12 }}>Recent Reports</div>
            {loadingHistory ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
                <Loader2 size={20} color="#237227" style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            ) : history.length === 0 ? (
              <div style={{ fontSize: '0.78rem', color: '#8da58f', textAlign: 'center', padding: '20px 0' }}>
                No reports generated yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {history.map((r, i) => (
                  <div key={r.id || i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 0', borderBottom: i < history.length - 1 ? '1px solid #edebd6' : 'none'
                  }}>
                    <div style={{ display: 'flex', gap: 9, alignItems: 'center', minWidth: 0, flex: 1 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, background: 'rgba(35,114,39,0.08)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        <FileText size={14} color="#237227" />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '0.79rem', fontWeight: 500, color: '#0d1f0e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.title}>
                          {r.title}
                        </div>
                        <div style={{ fontSize: '0.69rem', color: '#8da58f', marginTop: 1 }}>
                          {new Date(r.createdAt).toLocaleDateString()} · by {r.generatedBy}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0, marginLeft: 8 }}>
                      <span className="badge badge-gray" style={{ fontSize: '0.64rem' }}>{r.format}</span>
                      <button 
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#237227' }}
                        onClick={() => handleDownload(r.fileUrl)}
                        title="Download report file"
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Audit log */}
          <div className="chart-card">
            <div className="section-title" style={{ marginBottom: 12 }}>Audit Log</div>
            {loadingLogs ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
                <Loader2 size={20} color="#237227" style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            ) : logs.length === 0 ? (
              <div style={{ fontSize: '0.78rem', color: '#8da58f', textAlign: 'center', padding: '20px 0' }}>
                No actions logged yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {logs.slice(0, 5).map((a, i) => {
                  const logTime = new Date(a.createdAt)
                  const diffMinutes = Math.floor((new Date() - logTime) / 60000)
                  let timeStr = 'Just now'
                  if (diffMinutes >= 60) {
                    const diffHours = Math.floor(diffMinutes / 60)
                    if (diffHours >= 24) {
                      timeStr = `${Math.floor(diffHours / 24)} days ago`
                    } else {
                      timeStr = `${diffHours} hrs ago`
                    }
                  } else if (diffMinutes > 0) {
                    timeStr = `${diffMinutes} mins ago`
                  }
                  
                  return (
                    <div key={a.id || i} style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: '9px 0', borderBottom: i < Math.min(logs.length, 5) - 1 ? '1px solid #edebd6' : 'none'
                    }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 500, color: '#0d1f0e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.action}>
                          {a.action}
                        </div>
                        <div style={{ fontSize: '0.70rem', color: '#8da58f', marginTop: 1 }}>{a.user}</div>
                      </div>
                      <div style={{ fontSize: '0.70rem', color: '#8da58f', flexShrink: 0, marginLeft: 8 }}>{timeStr}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      {showScheduleModal && <ScheduleReportModal onClose={() => setShowScheduleModal(false)} />}
    </div>
  )
}
