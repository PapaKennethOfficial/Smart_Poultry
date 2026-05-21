import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'
import {
  Egg, HeartPulse, PackageCheck, Wheat,
  Thermometer, Droplets, Wind, AlertTriangle, Loader2
} from 'lucide-react'
import { sensorData } from '../data/dummy'
import { useDashboardSummary } from '../hooks/dashboard/useDashboardSummary'
import { useEggChart } from '../hooks/dashboard/useEggChart'
import { useMortalityChart } from '../hooks/dashboard/useMortalityChart'
import { useAlerts } from '../hooks/alerts/useAlerts'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SEVERITY_COLOR = {
  CRITICAL: '#ef4444',
  HIGH:     '#ef4444',
  MEDIUM:   '#f59e0b',
  LOW:      '#3b82f6',
}

function severityColor(sev) {
  return SEVERITY_COLOR[sev] || '#8da58f'
}

function relativeTime(iso) {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1)   return 'just now'
  if (min < 60)  return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24)   return `${hr} hr${hr > 1 ? 's' : ''} ago`
  const day = Math.floor(hr / 24)
  return `${day} day${day > 1 ? 's' : ''} ago`
}

function titleForAlert(a) {
  // Backend Alert.type is a freeform string (e.g. "warning", "feed", "mortality").
  // Derive a short title from severity + type for the panel headline.
  const sev = a.severity ? a.severity.charAt(0) + a.severity.slice(1).toLowerCase() : 'Alert'
  const t = a.type ? a.type.charAt(0).toUpperCase() + a.type.slice(1) : ''
  return t ? `${sev} — ${t}` : sev
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, hint, icon: Icon, iconBg, iconColor, accent, loading }) {
  return (
    <div className="stat-card">
      <div className="card-accent" style={{ background: accent }} />
      <div className="card-icon" style={{ background: iconBg, width: 46, height: 46, borderRadius: 12 }}>
        <Icon size={22} color={iconColor} strokeWidth={1.75} />
      </div>
      <div className="card-label">{label}</div>
      <div className="card-value">
        {loading ? (
          <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: '#8da58f' }} />
        ) : value}
      </div>
      {hint && (
        <div className="card-change" style={{ color: '#8da58f' }}>{hint}</div>
      )}
    </div>
  )
}

// ─── Chart tooltip ───────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: '#0d1f0e', color: '#fff', borderRadius: 10,
        padding: '10px 14px', fontSize: '0.78rem', boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
      }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color }}>
            {p.name}: {Number(p.value || 0).toLocaleString()}
          </div>
        ))}
      </div>
    )
  }
  return null
}

// ─── Tiny placeholders for chart loading / error states ──────────────────────

function ChartFallback({ height, loading, error, empty }) {
  let label = ''
  if (loading) label = 'Loading…'
  else if (error) label = 'Could not load data'
  else if (empty) label = 'No data yet'
  return (
    <div style={{
      height,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#8da58f',
      fontSize: '0.85rem',
      gap: 8,
    }}>
      {loading && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
      {error && <AlertTriangle size={16} color="#ef4444" />}
      {label}
    </div>
  )
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const now = new Date()
  const dateLabel = now.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  const summary       = useDashboardSummary()
  const eggChart      = useEggChart(7)
  const mortalityChart= useMortalityChart(6)
  const alertsQuery   = useAlerts()

  const s = summary.data || {}
  const alerts = alertsQuery.data || []
  const criticalCount = alerts.filter(
    (a) => a.severity === 'CRITICAL' || a.severity === 'HIGH'
  ).length

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Farm Overview</div>
        <div className="page-desc">Today's snapshot — {dateLabel}</div>
      </div>

      {/* Stat cards — wired to GET /dashboard/summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        <StatCard
          label="Eggs Today"
          value={Number(s.totalEggs || 0).toLocaleString()}
          icon={Egg} iconBg="rgba(35,114,39,0.10)" iconColor="#237227" accent="#237227"
          loading={summary.isLoading}
        />
        <StatCard
          label="Mortality Rate"
          value={`${Number(s.mortalityRate || 0).toFixed(2)}%`}
          icon={HeartPulse} iconBg="rgba(255,170,0,0.13)" iconColor="#e09600" accent="#FFAA00"
          loading={summary.isLoading}
        />
        <StatCard
          label="Pending Deliveries"
          value={Number(s.pendingDeliveries || 0).toLocaleString()}
          icon={PackageCheck} iconBg="rgba(59,130,246,0.10)" iconColor="#3b82f6" accent="#3b82f6"
          loading={summary.isLoading}
        />
        <StatCard
          label="Feed Used (Today)"
          value={`${Number(s.feedUsed || 0).toLocaleString()} kg`}
          icon={Wheat} iconBg="rgba(132,190,136,0.18)" iconColor="#237227" accent="#84be88"
          loading={summary.isLoading}
        />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 14, marginBottom: 14 }}>
        {/* Egg production chart — wired to GET /dashboard/egg-chart?days=7 */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <div className="chart-title">Egg Production — Last 7 Days</div>
              <div className="chart-subtitle">Daily count vs target (1,200 eggs)</div>
            </div>
          </div>
          {eggChart.isLoading || eggChart.isError || !eggChart.data?.length ? (
            <ChartFallback
              height={210}
              loading={eggChart.isLoading}
              error={eggChart.isError}
              empty={!eggChart.data?.length}
            />
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={eggChart.data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eceacc" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#8da58f' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8da58f' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={1200} stroke="#FFAA00" strokeDasharray="4 4" label={{ value: 'Target', fontSize: 10, fill: '#FFAA00' }} />
                <Line type="monotone" dataKey="eggs" stroke="#237227" strokeWidth={2.5} dot={{ r: 4, fill: '#237227' }} name="Eggs" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Alerts panel — wired to GET /alerts (polls every 30s) */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <div className="chart-title">Live Alerts</div>
              <div className="chart-subtitle">
                {alertsQuery.isLoading
                  ? 'Loading…'
                  : `${alerts.length} active notification${alerts.length === 1 ? '' : 's'}`}
              </div>
            </div>
            {criticalCount > 0 && (
              <span className="badge badge-red">{criticalCount} Critical</span>
            )}
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 210 }}>
            {alertsQuery.isLoading && <ChartFallback height={180} loading />}
            {alertsQuery.isError && <ChartFallback height={180} error />}
            {!alertsQuery.isLoading && !alertsQuery.isError && alerts.length === 0 && (
              <ChartFallback height={180} empty />
            )}
            {alerts.map((alert) => (
              <div key={alert.id} className="alert-item">
                <span className="alert-dot" style={{ background: severityColor(alert.severity) }} />
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0d1f0e', marginBottom: 2 }}>
                    {titleForAlert(alert)}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#5e7a61', lineHeight: 1.45 }}>
                    {alert.message}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#8da58f', marginTop: 3 }}>
                    {relativeTime(alert.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Sensor cards — still on dummy data (not in this brief) */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <div className="chart-title">Environmental Sensors — House A</div>
              <div className="chart-subtitle">Today's readings over time</div>
            </div>
            <span className="badge badge-green">All sensors online</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
            {[
              { label: 'Temperature', value: '29°C', icon: Thermometer, color: '#ef4444', ok: true },
              { label: 'Humidity', value: '76%', icon: Droplets, color: '#3b82f6', ok: false },
              { label: 'Ammonia', value: '17 ppm', icon: Wind, color: '#FFAA00', ok: true },
            ].map((sn, i) => (
              <div key={i} style={{
                background: '#F7F6E5', borderRadius: 10,
                padding: '11px 12px', border: '1px solid #dddabd',
                display: 'flex', flexDirection: 'column', gap: 5
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <sn.icon size={14} color={sn.color} />
                  <span className={`badge ${sn.ok ? 'badge-green' : 'badge-amber'}`} style={{ fontSize: '0.60rem', padding: '1px 6px' }}>
                    {sn.ok ? 'OK' : 'HIGH'}
                  </span>
                </div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.05rem', fontWeight: 700, color: '#0d1f0e' }}>
                  {sn.value}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#8da58f' }}>{sn.label}</div>
              </div>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={110}>
            <LineChart data={sensorData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eceacc" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#8da58f' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#8da58f' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="temp" stroke="#ef4444" strokeWidth={1.5} dot={false} name="Temp °C" />
              <Line type="monotone" dataKey="humidity" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="Humidity %" />
              <Line type="monotone" dataKey="ammonia" stroke="#FFAA00" strokeWidth={1.5} dot={false} name="Ammonia ppm" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Mortality trend — wired to GET /dashboard/mortality-chart?weeks=6 */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <div className="chart-title">Weekly Mortality Trend</div>
              <div className="chart-subtitle">Deaths per week across all batches</div>
            </div>
          </div>
          {mortalityChart.isLoading || mortalityChart.isError || !mortalityChart.data?.length ? (
            <ChartFallback
              height={195}
              loading={mortalityChart.isLoading}
              error={mortalityChart.isError}
              empty={!mortalityChart.data?.length}
            />
          ) : (
            <ResponsiveContainer width="100%" height={195}>
              <BarChart data={mortalityChart.data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eceacc" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#8da58f' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8da58f' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill="#fca5a5" radius={[6, 6, 0, 0]} name="Deaths" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
