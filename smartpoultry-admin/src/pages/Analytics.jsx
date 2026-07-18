import { useState, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Area, AreaChart, ComposedChart, ReferenceLine,
  ScatterChart, Scatter, ZAxis,
} from 'recharts'
import { Brain, TrendingUp, Zap, Target, Loader2, Sparkles, RefreshCw, AlertTriangle, MessageSquare, Send, User as UserIcon } from 'lucide-react'
import { fetchForecast, fetchFCR, fetchInsights, fetchEnvironmental, fetchFulfilmentFunnel, fetchDriverEfficiency, fetchOrderHeatmap } from '../api/analytics'
import { useDemandForecast, useRetrainDemandForecast } from '../hooks/analytics/useDemandForecast'
import { useMorningBriefing, useAskInsight } from '../hooks/analytics/useInsights'

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

export default function Analytics() {
  const [forecast, setForecast] = useState([])
  const [fcrData, setFcrData] = useState([])
  const [insights, setInsights] = useState(null)
  const [environmental, setEnvironmental] = useState([])
  
  const [loadingForecast, setLoadingForecast] = useState(true)
  const [loadingFcr, setLoadingFcr] = useState(true)
  const [loadingInsights, setLoadingInsights] = useState(true)
  const [loadingEnvironmental, setLoadingEnvironmental] = useState(true)

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

    // Fetch Environmental data
    fetchEnvironmental()
      .then(data => {
        setEnvironmental(data)
      })
      .catch(err => console.error('Failed to fetch environmental data:', err))
      .finally(() => setLoadingEnvironmental(false))
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

      {/* Environmental trend row */}
      <div className="chart-card">
        <div className="chart-header">
          <div>
            <div className="chart-title">Environmental Trends (Last 10 Days)</div>
            <div className="chart-subtitle">Real daily temperature and humidity averages from log entries</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className="badge badge-red">Temp</span>
            <span className="badge badge-blue">Humidity</span>
          </div>
        </div>

        {loadingEnvironmental ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
            <Loader2 size={30} color="#2e7d34" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : environmental.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200, fontSize: '0.85rem', color: '#5a7a5c' }}>
            No environmental log data found.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={environmental} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f5f0" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#7a917b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#7a917b' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: 12 }} />
              <Line type="monotone" dataKey="temp" stroke="#ef4444" strokeWidth={2} dot={false} name="Temperature (°C)" />
              <Line type="monotone" dataKey="humidity" stroke="#3b82f6" strokeWidth={2} dot={false} name="Humidity (%)" />
            </LineChart>
          </ResponsiveContainer>
        )}
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
