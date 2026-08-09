import { useState, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Area, AreaChart, ComposedChart, ReferenceLine,
  ScatterChart, Scatter, ZAxis,
} from 'recharts'
import { Brain, TrendingUp, Zap, Target, Loader2, Sparkles, RefreshCw, AlertTriangle, MessageSquare, Send, User as UserIcon, DollarSign, ShoppingCart, Package, Receipt, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react'
import { fetchForecast, fetchFCR, fetchInsights, fetchFulfilmentFunnel, fetchDriverEfficiency, fetchOrderHeatmap } from '../api/analytics'
import { useDemandForecast, useRetrainDemandForecast } from '../hooks/analytics/useDemandForecast'
import { useMorningBriefing, useAskInsight } from '../hooks/analytics/useInsights'
import { useSalesTracker } from '../hooks/analytics/useSalesTracker'

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: '#0a260d', color: '#fff', borderRadius: 10,
        padding: '10px 14px', fontSize: '0.78rem'
      }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color }}>
            {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
          </div>
        ))}
      </div>
    )
  }
  return null
}

// ─── AI Demand Forecast Panel ───────────────────────────────────────────────
// Reads /api/ai/forecast/demand which proxies to the Python Prophet service.
// Historical points and the yhat forecast share one Recharts ComposedChart;
// the shaded band is the 85% prediction interval.
function DemandForecastPanel() {
  const query = useDemandForecast(14)
  const retrain = useRetrainDemandForecast()

  const data = query.data
  // Merge history + forecast into a single series keyed by date, so Recharts
  // can draw the historical line and the forecast line on the same X axis.
  const chartData = (() => {
    if (!data) return []
    const merged = new Map()
    for (const h of data.history || []) {
      merged.set(h.ds, { ds: h.ds, actual: h.y })
    }
    for (const f of data.forecast || []) {
      const existing = merged.get(f.ds) || { ds: f.ds }
      merged.set(f.ds, {
        ...existing,
        yhat: f.yhat,
        yhat_lower: f.yhat_lower,
        yhat_upper: f.yhat_upper,
        // Recharts needs a two-element array for the Area band
        band: [f.yhat_lower, f.yhat_upper],
      })
    }
    return Array.from(merged.values()).sort((a, b) => a.ds.localeCompare(b.ds))
  })()

  const metrics = data?.metrics || {}
  const trainedAt = data?.trained_at ? new Date(data.trained_at) : null

  return (
    <div className="chart-card" style={{ marginBottom: 16 }}>
      <div className="chart-header">
        <div>
          <div className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={16} color="#8b5cf6" /> AI Demand Forecast — Next 14 Days
          </div>
          <div className="chart-subtitle">
            Prophet time-series model trained on your delivery-order history
            {trainedAt && ` · trained ${trainedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {metrics.mape != null && (
            <span className="badge badge-green" title="Mean Absolute Percentage Error on holdout">
              MAPE {metrics.mape}%
            </span>
          )}
          {metrics.rmse != null && (
            <span className="badge badge-blue" title="Root Mean Squared Error on holdout">
              RMSE {metrics.rmse}
            </span>
          )}
          <button
            className="btn-outline"
            style={{ padding: '5px 11px', fontSize: '0.75rem' }}
            onClick={() => retrain.mutate()}
            disabled={retrain.isPending}
            title="Retrain the model on the latest data"
          >
            <RefreshCw size={12} style={retrain.isPending ? { animation: 'spin 1s linear infinite' } : {}} />
            {retrain.isPending ? 'Retraining…' : 'Retrain'}
          </button>
        </div>
      </div>

      {query.isLoading && (
        <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5a7a5c', gap: 8 }}>
          <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
          Loading forecast…
        </div>
      )}

      {query.isError && (
        <div style={{
          height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 8, color: '#b91c1c', textAlign: 'center', padding: 16, fontSize: '0.85rem',
        }}>
          <AlertTriangle size={18} />
          {query.error?.response?.data?.message
            || 'AI service is unreachable. Start smartpoultry-ai (uvicorn on :8000) and refresh.'}
        </div>
      )}

      {!query.isLoading && !query.isError && chartData.length === 0 && (
        <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5a7a5c', fontSize: '0.85rem' }}>
          Not enough history to train a forecast yet — create a few delivery orders and hit Retrain.
        </div>
      )}

      {!query.isLoading && !query.isError && chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: -6, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eceacc" />
            <XAxis
              dataKey="ds"
              tickFormatter={(d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              tick={{ fontSize: 10, fill: '#7a917b' }}
              axisLine={false}
              tickLine={false}
              minTickGap={20}
            />
            <YAxis tick={{ fontSize: 10, fill: '#7a917b' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="line" />
            {/* Confidence band (85%) as a light shaded area between yhat_lower and yhat_upper */}
            <Area type="monotone" dataKey="band" name="85% band" stroke="none" fill="#8b5cf6" fillOpacity={0.12} />
            {/* Historical actuals */}
            <Line type="monotone" dataKey="actual" name="Actual" stroke="#237227" strokeWidth={2.2} dot={{ r: 2.5, fill: '#237227' }} />
            {/* Forecast */}
            <Line type="monotone" dataKey="yhat" name="Predicted" stroke="#8b5cf6" strokeWidth={2.2} strokeDasharray="5 4" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {metrics.warnings?.length > 0 && (
        <div style={{
          marginTop: 8, padding: '8px 10px', borderRadius: 8,
          background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.28)',
          color: '#8a5f00', fontSize: '0.75rem', lineHeight: 1.45,
        }}>
          {metrics.warnings.join(' · ')}
        </div>
      )}
      {metrics.note && !metrics.mape && (
        <div style={{ marginTop: 8, color: '#7a917b', fontSize: '0.72rem', fontStyle: 'italic' }}>
          {metrics.note}
        </div>
      )}
    </div>
  )
}

// ─── Morning Briefing (Gemini) ───────────────────────────────────────────────
// A prominent card at the top of the analytics page so managers see the plain-
// language summary before they scan a single chart (matches the brief's
// "executive summary header" requirement).
function MorningBriefingCard() {
  const query = useMorningBriefing()

  return (
    <div className="chart-card" style={{ marginBottom: 16, background: 'linear-gradient(180deg, #f8fbf8 0%, #ffffff 100%)' }}>
      <div className="chart-header">
        <div>
          <div className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={16} color="#8b5cf6" /> Morning Briefing
          </div>
          <div className="chart-subtitle">Plain-language summary of the last 7 days, generated by Gemini</div>
        </div>
        <button
          className="btn-outline"
          style={{ padding: '5px 11px', fontSize: '0.75rem' }}
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          title="Regenerate the briefing"
        >
          <RefreshCw size={12} style={query.isFetching ? { animation: 'spin 1s linear infinite' } : {}} />
          {query.isFetching ? 'Regenerating…' : 'Regenerate'}
        </button>
      </div>

      {query.isLoading || (query.isFetching && !query.data) ? (
        // Skeleton — matches the paragraph shape so the layout doesn't jump
        <div style={{ padding: '6px 0' }}>
          {[92, 100, 78].map((w, i) => (
            <div key={i} style={{
              height: 10, borderRadius: 5, background: '#e8ede8',
              width: `${w}%`, marginBottom: 8,
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
          ))}
        </div>
      ) : query.isError ? (
        <div style={{
          display: 'flex', gap: 10, alignItems: 'flex-start',
          padding: '10px 12px', borderRadius: 8,
          background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.22)',
          color: '#b91c1c', fontSize: '0.85rem', lineHeight: 1.5,
        }}>
          <AlertTriangle size={16} style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            {query.error?.response?.data?.message
              || 'Morning Briefing unavailable. Set GOOGLE_API_KEY in smartpoultry-ai/.env and restart the AI service.'}
          </div>
        </div>
      ) : (
        <p style={{
          fontSize: '0.95rem', lineHeight: 1.55, color: '#0a260d', margin: '4px 0 4px',
          whiteSpace: 'pre-wrap',
        }}>
          {query.data?.text || '—'}
        </p>
      )}
    </div>
  )
}

// ─── AI Advisor Chat ─────────────────────────────────────────────────────────
// Simple free-text Q&A grounded in the same weekly-metrics snapshot the
// Morning Briefing uses. History is kept in local state — one manager, one
// browser tab, no server-side conversation store.
function AiAdvisorPanel() {
  const [question, setQuestion] = useState('')
  const [history, setHistory] = useState([])
  const ask = useAskInsight()

  const submit = (e) => {
    e?.preventDefault?.()
    const q = question.trim()
    if (!q) return
    ask.mutate(q, {
      onSuccess: (data) => {
        setHistory((prev) => [...prev, { q, a: data?.answer || '(no answer)' }])
        setQuestion('')
      },
    })
  }

  return (
    <div className="chart-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="chart-header">
        <div>
          <div className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageSquare size={16} color="#8b5cf6" /> AI Advisor
          </div>
          <div className="chart-subtitle">Ask a question about the last 7 days</div>
        </div>
      </div>

      <div style={{
        flex: 1, minHeight: 240, maxHeight: 320, overflowY: 'auto',
        border: '1px solid #edebd6', borderRadius: 10, padding: 12,
        background: '#fafbfa', marginBottom: 10,
      }}>
        {history.length === 0 && !ask.isPending && (
          <div style={{ color: '#8da58f', fontSize: '0.82rem', textAlign: 'center', paddingTop: 40 }}>
            Try: <em>"Why are sales up this week?"</em> · <em>"Which product is our best seller?"</em>
          </div>
        )}
        {history.map((h, i) => (
          <div key={i} style={{ marginBottom: 14 }}>
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6,
              fontSize: '0.82rem', fontWeight: 600, color: '#237227',
            }}>
              <UserIcon size={13} style={{ marginTop: 2 }} /> You
            </div>
            <div style={{ fontSize: '0.85rem', color: '#0a260d', lineHeight: 1.45, marginBottom: 8, paddingLeft: 22 }}>
              {h.q}
            </div>
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6,
              fontSize: '0.82rem', fontWeight: 600, color: '#8b5cf6',
            }}>
              <Sparkles size={13} style={{ marginTop: 2 }} /> Advisor
            </div>
            <div style={{ fontSize: '0.85rem', color: '#0a260d', lineHeight: 1.5, paddingLeft: 22, whiteSpace: 'pre-wrap' }}>
              {h.a}
            </div>
          </div>
        ))}
        {ask.isPending && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#5a7a5c', fontSize: '0.82rem' }}>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Thinking…
          </div>
        )}
      </div>

      <form onSubmit={submit} style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          className="form-input"
          placeholder="Ask about revenue, driver perf, backlog…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={ask.isPending}
          maxLength={500}
        />
        <button
          type="submit"
          className="btn-primary"
          style={{ padding: '8px 14px' }}
          disabled={ask.isPending || !question.trim()}
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  )
}

function InsightCard({ icon: Icon, color, bg, title, value, desc, loading }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '20px',
      border: '1px solid #e8ede8', display: 'flex', gap: 14, alignItems: 'flex-start'
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 12, background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}>
        {loading ? (
          <Loader2 size={19} color={color} style={{ animation: 'spin 1s linear infinite' }} />
        ) : (
          <Icon size={19} color={color} />
        )}
      </div>
      <div>
        <div style={{ fontSize: '0.72rem', color: '#7a917b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>
          {title}
        </div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.3rem', fontWeight: 800, color: '#0a260d', margin: '2px 0 4px' }}>
          {loading ? '...' : value}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#5a7a5c', lineHeight: 1.4 }}>
          {loading ? 'Fetching latest data...' : desc}
        </div>
      </div>
    </div>
  )
}

// ─── Fulfilment Funnel (top-down bar) ──────────────────────────────────────
function FulfilmentFunnelPanel() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    fetchFulfilmentFunnel(30)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [])
  return (
    <div className="chart-card">
      <div className="chart-header">
        <div>
          <div className="chart-title">Order Fulfilment Funnel (last 30 days)</div>
          <div className="chart-subtitle">Drop-off between each stage of the pipeline</div>
        </div>
      </div>
      {loading ? (
        <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5a7a5c' }}>
          <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : data.length === 0 ? (
        <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5a7a5c', fontSize: '0.85rem' }}>
          No orders in the last 30 days.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eceacc" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: '#7a917b' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fill: '#0a260d' }} axisLine={false} tickLine={false} width={80} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" fill="#237227" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ─── Driver Efficiency Scatter ─────────────────────────────────────────────
function DriverEfficiencyPanel() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    fetchDriverEfficiency(30)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [])

  // Plain-language summary underneath — surface the top and bottom performer
  const summary = (() => {
    if (data.length < 2) return null
    const sorted = [...data].sort((a, b) => a.avgHoursPerDelivery - b.avgHoursPerDelivery)
    const fastest = sorted[0]
    const slowest = sorted[sorted.length - 1]
    return `${fastest.driverName} is your fastest (${fastest.avgHoursPerDelivery} h avg), `
         + `${slowest.driverName} takes the longest (${slowest.avgHoursPerDelivery} h avg).`
  })()

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div>
          <div className="chart-title">Driver Efficiency</div>
          <div className="chart-subtitle">Deliveries completed vs. average time per delivery (last 30 days)</div>
        </div>
      </div>
      {loading ? (
        <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5a7a5c' }}>
          <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : data.length === 0 ? (
        <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5a7a5c', fontSize: '0.85rem' }}>
          No completed deliveries in the last 30 days.
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eceacc" />
              <XAxis
                type="number" dataKey="deliveries" name="Deliveries"
                tick={{ fontSize: 10, fill: '#7a917b' }} axisLine={false} tickLine={false}
                label={{ value: 'Deliveries', position: 'insideBottom', fontSize: 10, fill: '#7a917b', offset: -2 }}
              />
              <YAxis
                type="number" dataKey="avgHoursPerDelivery" name="Avg hours per delivery"
                tick={{ fontSize: 10, fill: '#7a917b' }} axisLine={false} tickLine={false}
                label={{ value: 'Hrs / delivery', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#7a917b' }}
              />
              <ZAxis type="category" dataKey="driverName" name="Driver" />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
              <Scatter data={data} fill="#8b5cf6" />
            </ScatterChart>
          </ResponsiveContainer>
          {summary && (
            <div style={{ fontSize: '0.78rem', color: '#5a7a5c', marginTop: 4, fontStyle: 'italic' }}>
              {summary}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Time × Day Heatmap ───────────────────────────────────────────────────
function OrderHeatmapPanel() {
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    fetchOrderHeatmap(60)
      .then(setPayload)
      .catch(() => setPayload(null))
      .finally(() => setLoading(false))
  }, [])

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const max = payload?.maxCount || 0

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div>
          <div className="chart-title">Peak Order Times (last 60 days)</div>
          <div className="chart-subtitle">Order volume by weekday × hour of day</div>
        </div>
      </div>
      {loading ? (
        <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5a7a5c' }}>
          <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : !payload || max === 0 ? (
        <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5a7a5c', fontSize: '0.85rem' }}>
          No orders in the last 60 days.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '38px repeat(24, minmax(18px, 1fr))', gap: 2 }}>
            <div />
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} style={{ fontSize: '0.6rem', color: '#7a917b', textAlign: 'center' }}>{h}</div>
            ))}
            {payload.grid.map((row, dayIdx) => (
              <>
                <div key={`label-${dayIdx}`} style={{ fontSize: '0.7rem', color: '#0a260d', fontWeight: 500, alignSelf: 'center' }}>
                  {dayLabels[dayIdx]}
                </div>
                {row.map((cell, hourIdx) => {
                  const intensity = max === 0 ? 0 : cell / max
                  const bg = intensity === 0
                    ? '#f2f0e0'
                    : `rgba(35, 114, 39, ${0.15 + intensity * 0.85})`
                  return (
                    <div
                      key={`c-${dayIdx}-${hourIdx}`}
                      title={`${dayLabels[dayIdx]} ${hourIdx}:00 — ${cell} order${cell === 1 ? '' : 's'}`}
                      style={{
                        height: 18, background: bg, borderRadius: 3,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.55rem', color: intensity > 0.5 ? '#fff' : '#0a260d',
                      }}
                    >
                      {cell > 0 ? cell : ''}
                    </div>
                  )
                })}
              </>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sales Tracker Panel ─────────────────────────────────────────────────────
// Full transaction-side rollup: KPIs, revenue timeseries, order-status and
// payment-status breakdowns, top products by revenue, and the most recent
// transactions. Backed by GET /api/analytics/sales-tracker.
const STATUS_COLOURS = {
  DELIVERED:  '#237227',
  IN_TRANSIT: '#3b82f6',
  PENDING:    '#f59e0b',
  CANCELLED:  '#ef4444',
}
const PAYMENT_COLOURS = {
  PAID:      '#237227',
  PENDING:   '#f59e0b',
  PARTIAL:   '#3b82f6',
  REFUNDED:  '#8b5cf6',
  FAILED:    '#ef4444',
}
function formatMoney(n) {
  return 'GHS ' + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function formatDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}
function formatDateTime(iso) {
  const d = new Date(iso)
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// ─── Recent Transactions Table with Pagination & Filtering ──────────────────
const ROWS_PER_PAGE = 5
const ALL_STATUSES = ['ALL', 'PENDING', 'CONFIRMED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED']
const ALL_PAYMENTS = ['ALL', 'PAID', 'UNPAID', 'PARTIAL']

function RecentTransactionsTable({ transactions = [] }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [paymentFilter, setPaymentFilter] = useState('ALL')
  const [page, setPage] = useState(1)

  // Reset to page 1 when filters change
  const filtered = transactions.filter(t => {
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false
    if (paymentFilter !== 'ALL' && t.paymentStatus !== paymentFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (
        !(t.orderId || '').toLowerCase().includes(q) &&
        !(t.customer || '').toLowerCase().includes(q) &&
        !(t.product || '').toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const pageRows = filtered.slice((safePage - 1) * ROWS_PER_PAGE, safePage * ROWS_PER_PAGE)

  // Reset page when filters change
  const handleSearch = (v) => { setSearch(v); setPage(1) }
  const handleStatus = (v) => { setStatusFilter(v); setPage(1) }
  const handlePayment = (v) => { setPaymentFilter(v); setPage(1) }

  const selectStyle = {
    padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)',
    fontSize: '0.78rem', background: '#fff', color: 'var(--text-body)', outline: 'none',
  }

  return (
    <div className="chart-card">
      <div className="chart-header" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="chart-title">Recent Transactions</div>
          <div className="chart-subtitle">
            {filtered.length} of {transactions.length} orders
            {(statusFilter !== 'ALL' || paymentFilter !== 'ALL' || search) && ' (filtered)'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search order, customer, product…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            style={{ ...selectStyle, minWidth: 180 }}
          />
          <select value={statusFilter} onChange={e => handleStatus(e.target.value)} style={selectStyle}>
            {ALL_STATUSES.map(s => (
              <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : s.replace('_', ' ')}</option>
            ))}
          </select>
          <select value={paymentFilter} onChange={e => handlePayment(e.target.value)} style={selectStyle}>
            {ALL_PAYMENTS.map(s => (
              <option key={s} value={s}>{s === 'ALL' ? 'All Payments' : s}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border-light)' }}>
              <th style={{ padding: '10px 8px' }}>Order ID</th>
              <th style={{ padding: '10px 8px' }}>Customer</th>
              <th style={{ padding: '10px 8px' }}>Product</th>
              <th style={{ padding: '10px 8px', textAlign: 'right' }}>Amount</th>
              <th style={{ padding: '10px 8px' }}>Status</th>
              <th style={{ padding: '10px 8px' }}>Payment</th>
              <th style={{ padding: '10px 8px' }}>When</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 20, textAlign: 'center', color: 'var(--text-subtle)' }}>
                  {transactions.length === 0 ? 'No transactions in this window.' : 'No transactions match the current filters.'}
                </td>
              </tr>
            ) : pageRows.map((t) => (
              <tr key={t.orderId} style={{ borderBottom: '1px solid var(--border-light)' }}>
                <td style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--text-heading)' }}>{t.orderId}</td>
                <td style={{ padding: '10px 8px', color: 'var(--text-body)' }}>{t.customer}</td>
                <td style={{ padding: '10px 8px', color: 'var(--text-body)' }}>{t.product}</td>
                <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--text-heading)' }}>{formatMoney(t.amount)}</td>
                <td style={{ padding: '10px 8px' }}>
                  <span style={{
                    padding: '3px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600,
                    background: (STATUS_COLOURS[t.status] || '#8da58f') + '20',
                    color: STATUS_COLOURS[t.status] || '#8da58f',
                  }}>{t.status.replace('_', ' ')}</span>
                </td>
                <td style={{ padding: '10px 8px' }}>
                  <span style={{
                    padding: '3px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600,
                    background: (PAYMENT_COLOURS[t.paymentStatus] || '#8da58f') + '20',
                    color: PAYMENT_COLOURS[t.paymentStatus] || '#8da58f',
                  }}>{t.paymentStatus}</span>
                </td>
                <td style={{ padding: '10px 8px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDateTime(t.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 8px 6px', borderTop: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Page {safePage} of {totalPages}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              style={{
                padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)',
                background: safePage <= 1 ? '#f5f5f5' : '#fff', color: safePage <= 1 ? '#ccc' : 'var(--text-body)',
                fontSize: '0.78rem', cursor: safePage <= 1 ? 'default' : 'pointer',
              }}
            >← Prev</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .map((p, idx, arr) => (
                <span key={p}>
                  {idx > 0 && arr[idx - 1] !== p - 1 && <span style={{ padding: '5px 4px', color: 'var(--text-muted)' }}>…</span>}
                  <button
                    onClick={() => setPage(p)}
                    style={{
                      padding: '5px 10px', borderRadius: 6,
                      border: p === safePage ? '1.5px solid #237227' : '1px solid var(--border)',
                      background: p === safePage ? 'rgba(35,114,39,0.08)' : '#fff',
                      color: p === safePage ? '#237227' : 'var(--text-body)',
                      fontWeight: p === safePage ? 700 : 500,
                      fontSize: '0.78rem', cursor: 'pointer',
                    }}
                  >{p}</button>
                </span>
              ))
            }
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              style={{
                padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)',
                background: safePage >= totalPages ? '#f5f5f5' : '#fff', color: safePage >= totalPages ? '#ccc' : 'var(--text-body)',
                fontSize: '0.78rem', cursor: safePage >= totalPages ? 'default' : 'pointer',
              }}
            >Next →</button>
          </div>
        </div>
      )}
    </div>
  )
}

function SalesTrackerPanel() {
  const [windowDays, setWindowDays] = useState(30)
  const { data, isLoading, isError, refetch, isFetching } = useSalesTracker(windowDays)

  const h = data?.headline
  const wowUp = (h?.wowRevenueChange ?? 0) >= 0

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Section header + window switch + refresh */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '1.15rem', color: 'var(--text-heading)' }}>
            <Receipt size={18} color="#237227" /> Sales Tracker
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
            Every transaction across the platform · last {windowDays} days
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setWindowDays(d)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: windowDays === d ? '1.5px solid #237227' : '1px solid var(--border)',
                background: windowDays === d ? 'rgba(35,114,39,0.08)' : '#fff',
                color: windowDays === d ? '#237227' : 'var(--text-muted)',
                fontWeight: windowDays === d ? 600 : 500,
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >{d}d</button>
          ))}
          <button
            type="button"
            onClick={() => refetch()}
            title="Refresh"
            disabled={isFetching}
            style={{
              padding: 7, borderRadius: 8, border: '1px solid var(--border)',
              background: '#fff', cursor: isFetching ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', color: 'var(--text-muted)',
            }}
          >
            <RefreshCw size={14} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {isError && (
        <div className="chart-card" style={{ padding: 16, color: '#b91c1c', fontSize: '0.85rem', display: 'flex', gap: 8, alignItems: 'center' }}>
          <AlertTriangle size={16} /> Could not load sales data. Check that the backend is running on the expected port.
        </div>
      )}

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Loader2 size={28} color="#237227" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : data && (
        <>
          {/* KPI row — 4-up on desktop, collapses to 2×2 then 1-col on phones */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 14 }}>
            <KpiCard
              icon={DollarSign}
              tint="#237227"
              label="Total Revenue"
              value={formatMoney(h.totalRevenue)}
              foot={
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: wowUp ? '#237227' : '#ef4444', fontSize: '0.72rem', fontWeight: 600 }}>
                  {wowUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {Math.abs(h.wowRevenueChange).toFixed(1)}% vs previous {windowDays}d
                </span>
              }
            />
            <KpiCard
              icon={ShoppingCart}
              tint="#3b82f6"
              label="Orders"
              value={h.totalOrders.toLocaleString()}
              foot={<span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>Includes cancelled</span>}
            />
            <KpiCard
              icon={TrendingUp}
              tint="#8b5cf6"
              label="Avg Order Value"
              value={formatMoney(h.avgOrderValue)}
              foot={<span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>Excludes cancelled</span>}
            />
            <KpiCard
              icon={Clock}
              tint="#f59e0b"
              label="Unpaid Balance"
              value={formatMoney(h.unpaidBalance)}
              foot={<span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>Non-cancelled, unpaid</span>}
            />
          </div>

          {/* Revenue timeseries + breakdown side-by-side. Collapses to a
              single column on narrower viewports so both are legible on
              tablet / phone widths. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, marginBottom: 14 }}>
            <div className="chart-card">
              <div className="chart-header">
                <div>
                  <div className="chart-title">Revenue Over Time</div>
                  <div className="chart-subtitle">Daily non-cancelled revenue</div>
                </div>
                <span className="badge badge-green">{formatMoney(h.totalRevenue)}</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data.revenueTimeseries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#237227" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#237227" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(0,0,0,0.05)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={(v) => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#237227" strokeWidth={2} fill="url(#revenueGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <div className="chart-header">
                <div>
                  <div className="chart-title">Revenue by Status</div>
                  <div className="chart-subtitle">Where each Cedi currently sits</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '6px 0' }}>
                {data.statusBreakdown.map((row) => {
                  const total = data.statusBreakdown.reduce((s, r) => s + r.amount, 0) || 1
                  const pct = (row.amount / total) * 100
                  return (
                    <div key={row.status}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                          {row.status.replace('_', ' ')} · {row.count}
                        </span>
                        <span style={{ color: 'var(--text-heading)', fontWeight: 600 }}>
                          {formatMoney(row.amount)}
                        </span>
                      </div>
                      <div style={{ height: 8, background: '#f1f0e6', borderRadius: 6, overflow: 'hidden' }}>
                        <div style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: STATUS_COLOURS[row.status] || '#8da58f',
                          transition: 'width .3s',
                        }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Payment status + Top products — same responsive rule as above */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, marginBottom: 14 }}>
            <div className="chart-card">
              <div className="chart-header">
                <div>
                  <div className="chart-title">Payment Status</div>
                  <div className="chart-subtitle">Collected vs outstanding</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '6px 0' }}>
                {data.paymentBreakdown.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-subtle)', fontSize: '0.85rem' }}>No payments yet.</div>
                ) : data.paymentBreakdown.map((row) => {
                  const total = data.paymentBreakdown.reduce((s, r) => s + r.amount, 0) || 1
                  const pct = (row.amount / total) * 100
                  return (
                    <div key={row.status}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                          {row.status.replace('_', ' ')} · {row.count} order{row.count === 1 ? '' : 's'}
                        </span>
                        <span style={{ color: 'var(--text-heading)', fontWeight: 600 }}>
                          {formatMoney(row.amount)}
                        </span>
                      </div>
                      <div style={{ height: 8, background: '#f1f0e6', borderRadius: 6, overflow: 'hidden' }}>
                        <div style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: PAYMENT_COLOURS[row.status] || '#8da58f',
                          transition: 'width .3s',
                        }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-header">
                <div>
                  <div className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Package size={14} color="#237227" /> Top Products by Revenue
                  </div>
                  <div className="chart-subtitle">Top 5 in the last {windowDays} days</div>
                </div>
              </div>
              {data.topProducts.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-subtle)', fontSize: '0.85rem' }}>No product sales yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '6px 0' }}>
                  {data.topProducts.map((p, i) => {
                    const max = data.topProducts[0].revenue || 1
                    const pct = (p.revenue / max) * 100
                    return (
                      <div key={p.productName + i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
                          <span style={{ color: 'var(--text-heading)', fontWeight: 600 }}>{p.productName}</span>
                          <span style={{ color: 'var(--text-muted)' }}>
                            {p.count} order{p.count === 1 ? '' : 's'} · {formatMoney(p.revenue)}
                          </span>
                        </div>
                        <div style={{ height: 8, background: '#f1f0e6', borderRadius: 6, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: '#84be88' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Recent transactions table with pagination & filtering */}
          <RecentTransactionsTable transactions={data.recentTransactions} />
        </>
      )}
    </div>
  )
}

// Small KPI card local to SalesTrackerPanel — kept private since the existing
// InsightCard is styled for the AI insights row, not for money-focused stats.
function KpiCard({ icon: Icon, tint, label, value, foot }) {
  return (
    <div className="chart-card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: tint + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={15} color={tint} />
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
      </div>
      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4 }}>
        {value}
      </div>
      <div>{foot}</div>
    </div>
  )
}

export default function Analytics() {
  const [forecast, setForecast] = useState([])
  const [fcrData, setFcrData] = useState([])
  const [insights, setInsights] = useState(null)

  const [loadingForecast, setLoadingForecast] = useState(true)
  const [loadingFcr, setLoadingFcr] = useState(true)
  const [loadingInsights, setLoadingInsights] = useState(true)

  useEffect(() => {
    // Fetch forecast
    fetchForecast()
      .then(data => {
        setForecast(data)
      })
      .catch(err => console.error('Failed to fetch forecast:', err))
      .finally(() => setLoadingForecast(false))

    // Fetch FCR
    fetchFCR(6)
      .then(data => {
        setFcrData(data)
      })
      .catch(err => console.error('Failed to fetch FCR:', err))
      .finally(() => setLoadingFcr(false))

    // Fetch Insights
    fetchInsights()
      .then(data => {
        setInsights(data)
      })
      .catch(err => console.error('Failed to fetch insights:', err))
      .finally(() => setLoadingInsights(false))
  }, [])

  // Derived statistics for forecast
  const avgPredicted = forecast.length > 0
    ? Math.round(forecast.reduce((sum, item) => sum + item.predicted, 0) / forecast.length)
    : 0

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="page-title">Analytics & Insights</div>
            <div className="page-desc">Farm performance analytics and yield trends</div>
          </div>
        </div>
      </div>

      {/* Sales Tracker — every transaction across the platform */}
      <SalesTrackerPanel />

      {/* Executive summary from Gemini */}
      <MorningBriefingCard />

      {/* AI demand forecast (left) + AI Advisor (right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        <DemandForecastPanel />
        <AiAdvisorPanel />
      </div>

      {/* Insight cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <InsightCard
          icon={Target}
          color="#2e7d34" 
          bg="#f0f7f0" 
          title="Predicted Yield (Tomorrow)" 
          value={insights?.predictedYield ? `${insights.predictedYield.value.toLocaleString()} eggs` : '—'} 
          desc={insights?.predictedYield ? `Based on 10-day historical averages (${insights.predictedYield.change})` : '—'} 
          loading={loadingInsights}
        />
        <InsightCard 
          icon={TrendingUp} 
          color="#3b82f6" 
          bg="#eff6ff" 
          title="Feed Conv. Ratio" 
          value={insights?.fcrStatus ? insights.fcrStatus.value : '—'} 
          desc={insights?.fcrStatus ? `${insights.fcrStatus.status} (benchmark 2.3)` : '—'} 
          loading={loadingInsights}
        />
        <InsightCard 
          icon={Zap} 
          color="#f59e0b" 
          bg="#fff7ed" 
          title="Anomaly Score" 
          value={insights?.anomalyScore ? insights.anomalyScore.value : '—'} 
          desc={insights?.anomalyScore ? insights.anomalyScore.description : '—'} 
          loading={loadingInsights}
        />
        <InsightCard 
          icon={Brain} 
          color="#8b5cf6" 
          bg="#f5f3ff" 
          title="Health Alert Status" 
          value={insights?.healthStatus ? insights.healthStatus.value : '—'} 
          desc={insights?.healthStatus ? insights.healthStatus.description : '—'} 
          loading={loadingInsights}
        />
      </div>

      {/* Charts row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* 10-day forecast */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <div className="chart-title">10-Day Egg Yield Trend</div>
              <div className="chart-subtitle">Calculated daily egg collection averages</div>
            </div>
            <span className="badge badge-blue">Production Trend</span>
          </div>

          {loadingForecast ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 220 }}>
              <Loader2 size={30} color="#2e7d34" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : forecast.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 220, fontSize: '0.85rem', color: '#5a7a5c' }}>
              No production logs found.
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={forecast} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f5f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#7a917b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#7a917b' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="predicted" stroke="#2e7d34" strokeWidth={2.5}
                    fill="url(#forecastGrad)" name="Eggs Collected" />
                  <defs>
                    <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2e7d34" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#2e7d34" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                </ComposedChart>
              </ResponsiveContainer>

              {/* Legend stats */}
              <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f5f0' }}>
                <div style={{ fontSize: '0.75rem', color: '#5a7a5c' }}>
                  <span style={{ fontWeight: 600, color: '#0a260d' }}>Avg yield:</span> {avgPredicted.toLocaleString()} eggs/day
                </div>
                <div style={{ fontSize: '0.75rem', color: '#5a7a5c' }}>
                  <span style={{ fontWeight: 600, color: '#0a260d' }}>Days logged:</span> {forecast.length} days
                </div>
              </div>
            </>
          )}
        </div>

        {/* Feed conversion */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <div className="chart-title">Feed Conversion Ratio (FCR)</div>
              <div className="chart-subtitle">Weekly FCR vs industry benchmark (2.3)</div>
            </div>
            {insights?.fcrStatus?.status === 'Below Benchmark' ? (
              <span className="badge badge-green">Below benchmark ↓</span>
            ) : (
              <span className="badge badge-red">Above benchmark ↑</span>
            )}
          </div>

          {loadingFcr ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 220 }}>
              <Loader2 size={30} color="#2e7d34" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : fcrData.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 220, fontSize: '0.85rem', color: '#5a7a5c' }}>
              No weekly data found to calculate FCR.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={fcrData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f5f0" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#7a917b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#7a917b' }} axisLine={false} tickLine={false} domain={[0, 'auto']} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: 12 }} />
                <Bar dataKey="ratio" name="SmartPoultry FCR" fill="#84be88" radius={[6, 6, 0, 0]} />
                <ReferenceLine y={2.3} stroke="red" strokeDasharray="3 3" label={{ value: 'Benchmark (2.3)', fill: 'red', fontSize: 10, position: 'top' }} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Extra operational analytics — funnel + driver scatter + heatmap */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <FulfilmentFunnelPanel />
        <DriverEfficiencyPanel />
      </div>
      <div style={{ marginTop: 16 }}>
        <OrderHeatmapPanel />
      </div>
    </div>
  )
}
