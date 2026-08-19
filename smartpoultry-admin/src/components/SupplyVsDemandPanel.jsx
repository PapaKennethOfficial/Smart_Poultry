import { useState, useEffect } from 'react'
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { Loader2, AlertTriangle, TrendingUp } from 'lucide-react'
import { fetchSupplyVsDemand } from '../api/analytics'
import ExplainChart from './ExplainChart'

/**
 * Eggs produced against eggs ordered, on one time axis.
 *
 * This is the only view in the system that joins the farm half to the
 * commerce half. Everything else reports on one or the other.
 */
export default function SupplyVsDemandPanel() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [days, setDays] = useState(30)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchSupplyVsDemand(days)
      .then((d) => { if (!cancelled) setData(d) })
      .catch((e) => { if (!cancelled) setError(e?.response?.data?.message || e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [days])

  const coverage = data?.coveragePct
  const short = data?.daysShort ?? 0

  return (
    <div className="chart-card" style={{ marginBottom: 16 }}>
      <div className="chart-header">
        <div>
          <div className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={16} /> Supply vs Demand
          </div>
          <div className="chart-subtitle">
            Production against demand, each shown relative to its own normal day
            (100 = average). Dashed lines are the Prophet forecast.
          </div>
        </div>
        <div className="filter-tabs">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              className={`filter-tab ${days === d ? 'active' : ''}`}
              onClick={() => setDays(d)}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Headline read — the answer before the chart */}
      {!loading && !error && data && (
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 14 }}>
          <Stat label="Produced" value={data.totalProduced?.toLocaleString()} />
          <Stat label="Ordered" value={data.totalOrdered?.toLocaleString()} />
          <Stat
            label="Coverage"
            value={coverage == null ? '—' : `${coverage}%`}
            hint={coverage == null ? 'no orders yet'
              : coverage >= 100 ? 'production covered demand'
              : 'production fell short'}
          />
          <Stat
            label="Days short"
            value={short}
            hint={short === 0 ? 'never ran out' : 'demand exceeded production'}
          />
          <Stat
            label="Forecast"
            value={data.forecastAvailable ? `${data.forecastDays}d` : '—'}
            hint={data.forecastAvailable ? 'Prophet projection' : 'model not trained yet'}
          />
        </div>
      )}

      {loading ? (
        <div style={{ height: 240, display: 'grid', placeItems: 'center' }}>
          <Loader2 size={22} className="spin" color="#8da58f" />
        </div>
      ) : error ? (
        <div style={{ height: 240, display: 'grid', placeItems: 'center', color: '#b91c1c', fontSize: '0.85rem', gap: 8 }}>
          <AlertTriangle size={18} />{error}
        </div>
      ) : !data?.series?.length ? (
        <div style={{ height: 240, display: 'grid', placeItems: 'center', color: '#8da58f', fontSize: '0.85rem', textAlign: 'center', padding: 20 }}>
          No overlapping data yet. This chart needs both logbook entries and
          customer orders in the selected period.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data.series} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eceacc" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#8da58f' }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 10, fill: '#8da58f' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}`}
              width={40}
            />
            <Tooltip
              contentStyle={{ borderRadius: 10, border: '1px solid #dddabd', fontSize: '0.78rem' }}
              content={<SupplyTooltip />}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="plainline" />

            {/* 100 is "a normal day" for each series. Both lines sitting near it
                means both are behaving typically; a gap is the real signal. */}
            <ReferenceLine
              y={100}
              stroke="#b9b48f"
              strokeDasharray="4 4"
              label={{ value: 'normal', fontSize: 9, fill: '#8da58f', position: 'insideTopLeft' }}
            />

            <Line
              type="monotone" dataKey="producedIndex" name="Produced"
              stroke="#237227" strokeWidth={2} dot={false} connectNulls={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone" dataKey="orderedIndex" name="Ordered"
              stroke="#a06800" strokeWidth={2} dot={false} connectNulls={false}
              activeDot={{ r: 4 }}
            />

            {/* Forecast continues the same colours, dashed. Separate dataKeys so
                the solid history and the dashed projection can differ in style
                on one continuous line. */}
            <Line
              type="monotone" dataKey="forecastProducedIndex" name="Produced (forecast)"
              stroke="#237227" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls
            />
            <Line
              type="monotone" dataKey="forecastOrderedIndex" name="Ordered (forecast)"
              stroke="#a06800" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {!loading && !error && data?.worstShortfall && data.worstShortfall.surplus < 0 && (
        <div style={{
          marginTop: 10, padding: '9px 12px', borderRadius: 'var(--r-sm)',
          background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.2)',
          fontSize: '0.8rem', color: '#8b2f2f',
        }}>
          Worst day was {data.worstShortfall.day}: {data.worstShortfall.ordered.toLocaleString()} ordered
          against {data.worstShortfall.produced.toLocaleString()} produced —
          short by {Math.abs(data.worstShortfall.surplus).toLocaleString()}.
        </div>
      )}

      <ExplainChart chartId="supply_vs_demand" window={days} />
    </div>
  )
}

/**
 * The plotted values are indexes, which are meaningless to read directly.
 * The tooltip therefore leads with the ACTUAL counts and gives the index as
 * supporting context.
 */
function SupplyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null

  const line = (name, value, unit, index, color) =>
    value == null ? null : (
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, color }}>
        <span>{name}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {Number(value).toLocaleString()} {unit}
          {index != null && <span style={{ opacity: 0.65 }}> · {index}</span>}
        </span>
      </div>
    )

  return (
    <div style={{
      background: '#fff', border: '1px solid #dddabd', borderRadius: 10,
      padding: '9px 12px', fontSize: '0.76rem', minWidth: 190,
      boxShadow: '0 4px 16px rgba(35,114,39,0.12)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 5 }}>
        {label}{row.isForecast && <span style={{ fontWeight: 500, opacity: 0.7 }}> · forecast</span>}
      </div>
      {line('Produced', row.produced, 'eggs', row.producedIndex, '#237227')}
      {line('Ordered', row.ordered, 'units', row.orderedIndex, '#a06800')}
      {line('Produced', row.forecastProduced, 'eggs', null, '#237227')}
      {line('Ordered', row.forecastOrdered, 'units', null, '#a06800')}
      {row.surplus != null && (
        <div style={{
          marginTop: 5, paddingTop: 5, borderTop: '1px solid #eceacc',
          color: row.surplus < 0 ? '#c0392b' : '#237227', fontWeight: 600,
        }}>
          {row.surplus < 0 ? 'Short by ' : 'Surplus '}
          {Math.abs(row.surplus).toLocaleString()}
        </div>
      )}
      <div style={{ marginTop: 5, fontSize: '0.66rem', color: '#8da58f' }}>
        Index: 100 = that measure's average day
      </div>
    </div>
  )
}

function Stat({ label, value, hint }) {
  return (
    <div>
      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8da58f', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0a260d', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: '0.7rem', color: '#8da58f' }}>{hint}</div>}
    </div>
  )
}
