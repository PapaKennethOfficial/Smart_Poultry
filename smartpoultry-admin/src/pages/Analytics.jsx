import { useState, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Area, AreaChart, ComposedChart, ReferenceLine
} from 'recharts'
import { Brain, TrendingUp, Zap, Target, Loader2 } from 'lucide-react'
import { fetchForecast, fetchFCR, fetchInsights, fetchEnvironmental } from '../api/analytics'

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
    </div>
  )
}
