import { useState } from 'react'
import { Sparkles, Loader2, X, AlertTriangle } from 'lucide-react'
import { explainChart } from '../api/aiAnalytics'

/**
 * "Explain this" button for a chart panel.
 *
 * Place it as the LAST child of a .chart-card, after the chart:
 *
 *   <div className="chart-card">
 *     <div className="chart-header">…</div>
 *     <ResponsiveContainer>…</ResponsiveContainer>
 *     <ExplainChart chartId="egg_trend" />
 *   </div>
 *
 * Deliberately NOT inside .chart-header — that is a flex row, and the
 * explanation panel would become a flex item sitting beside the title.
 *
 * One LLM call, only when clicked. The server recomputes the chart's data from
 * the database — we send an id and a window, never numbers — so the
 * explanation always describes real data even if the page is stale.
 */
export default function ExplainChart({ chartId, window: windowSize, label = 'Explain this' }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const run = async () => {
    // Re-opening after a successful call reuses the answer rather than
    // spending another request.
    if (result) { setOpen((v) => !v); return }
    setLoading(true)
    setError(null)
    setOpen(true)
    try {
      const data = await explainChart(chartId, windowSize ? { window: windowSize } : {})
      setResult(data)
    } catch (err) {
      setError(
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        err?.message ||
        'Could not generate an explanation.'
      )
    } finally {
      setLoading(false)
    }
  }

  const refresh = async () => {
    setResult(null)
    setError(null)
    setLoading(true)
    try {
      const data = await explainChart(chartId, { window: windowSize, refresh: true })
      setResult(data)
    } catch (err) {
      setError(
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        err?.message ||
        'Could not generate an explanation.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginTop: 14 }}>
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="btn-outline"
        style={{ padding: '6px 12px', fontSize: '0.76rem', gap: 6, flexShrink: 0 }}
        aria-expanded={open}
        title="Explain what this chart is showing"
      >
        {loading
          ? <Loader2 size={14} className="spin" />
          : <Sparkles size={14} />}
        {loading ? 'Reading…' : label}
      </button>

      {open && (
        <div
          style={{
            width: '100%',
            marginTop: 12,
            padding: '14px 16px',
            borderRadius: 12,
            background: 'rgba(35, 114, 39, 0.05)',
            border: '1px solid rgba(35, 114, 39, 0.18)',
            fontSize: '0.85rem',
            lineHeight: 1.6,
            color: 'var(--text-body, #2a3d2b)',
            position: 'relative',
          }}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close explanation"
            style={{
              position: 'absolute', top: 8, right: 8,
              background: 'transparent', border: 'none',
              cursor: 'pointer', color: 'var(--text-subtle, #8da58f)',
              padding: 4, lineHeight: 0,
            }}
          >
            <X size={14} />
          </button>

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Loader2 size={14} className="spin" />
              Reading the chart…
            </div>
          )}

          {error && !loading && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <AlertTriangle size={15} style={{ marginTop: 2, flexShrink: 0 }} color="#b45309" />
              <div>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>Couldn't explain this chart</div>
                <div style={{ fontSize: '0.8rem' }}>{error}</div>
                <button
                  type="button"
                  onClick={refresh}
                  className="btn-outline"
                  style={{ marginTop: 8, padding: '5px 11px', fontSize: '0.74rem' }}
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {result && !loading && !error && (
            <>
              <div style={{ whiteSpace: 'pre-wrap', paddingRight: 18 }}>{result.explanation}</div>
              <div
                style={{
                  marginTop: 10, paddingTop: 8,
                  borderTop: '1px solid rgba(35,114,39,0.14)',
                  fontSize: '0.7rem', color: 'var(--text-subtle, #8da58f)',
                  display: 'flex', justifyContent: 'space-between',
                  gap: 10, flexWrap: 'wrap',
                }}
              >
                <span>
                  {result.cached ? 'Saved answer' : 'Generated'} from the last {result.window} {result.window_unit} of data
                  {result.model ? ` · ${result.model}` : ''}
                </span>
                <button
                  type="button"
                  onClick={refresh}
                  style={{
                    background: 'transparent', border: 'none', padding: 0,
                    cursor: 'pointer', color: 'inherit', textDecoration: 'underline',
                    fontSize: '0.7rem',
                  }}
                >
                  Regenerate
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
