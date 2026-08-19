import { useCallback, useEffect, useRef, useState } from 'react'
import eggImg      from '../assets/egg.png'
import patternImg  from '../assets/patterns.png'

/*
 * SplashScreen — Smart Poultry animated intro
 *
 * Uses provided assets:
 *   egg.png      — hybrid organic/AI egg
 *   patterns.png — network/tech pattern overlay
 *
 * Sequence (total ~2.7 s):
 *   0 ms     → background visible, pattern drifts
 *   150 ms   → egg rolls in from the left
 *   700 ms   → text slides up + fades in
 *   2 100 ms → egg zooms out
 *   2 250 ms → background fade begins
 *   2 650 ms → onComplete() fires → landing page
 *
 * The original held for 7.6 s before handing off, which is a very long time
 * to make someone wait on an intro they did not ask for. Anywhere on the
 * overlay is also a skip target, and Esc/Enter/Space work for keyboards.
 */

const TIMINGS = {
  eggDelay:    150,
  textDelay:   700,
  holdEnd:     2100,  // scene fully assembled until here
  eggZoomMs:   450,   // egg zoom-out duration
  exitDelay:   150,   // gap between egg zoom start and background fade
  exitMs:      400,   // background fade duration
}

// Someone who has asked the OS to reduce motion gets the brand moment
// without the roll, the drift or the zoom — just a short cross-fade.
const REDUCED_TIMINGS = {
  eggDelay:    0,
  textDelay:   150,
  holdEnd:     1000,
  eggZoomMs:   1,
  exitDelay:   0,
  exitMs:      300,
}

export function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export default function SplashScreen({ onComplete }) {
  const [eggIn,      setEggIn]      = useState(false)
  const [textIn,     setTextIn]     = useState(false)
  const [eggExiting, setEggExiting] = useState(false)
  const [exiting,    setExiting]    = useState(false)

  // Read once on mount and keep it: the scene should not restyle itself
  // halfway through if the OS setting changes mid-animation.
  const [reduced] = useState(prefersReducedMotion)
  const timing = reduced ? REDUCED_TIMINGS : TIMINGS

  // onComplete unmounts this component, so it must never fire twice — a tap
  // landing in the same frame as the final timer would otherwise double-call.
  const doneRef = useRef(false)
  const finish = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    onComplete?.()
  }, [onComplete])

  // Skipping fades out rather than cutting, so a tap does not feel like a
  // glitch. The fade is short enough not to be a second wait.
  const skip = useCallback(() => {
    if (doneRef.current) return
    setEggExiting(true)
    setExiting(true)
    setTimeout(finish, Math.min(timing.exitMs, 260))
  }, [finish, timing.exitMs])

  useEffect(() => {
    const t1 = setTimeout(() => setEggIn(true),      timing.eggDelay)
    const t2 = setTimeout(() => setTextIn(true),     timing.textDelay)
    // Egg zooms out first, then background fades
    const t3 = setTimeout(() => setEggExiting(true), timing.holdEnd)
    const t4 = setTimeout(() => setExiting(true),    timing.holdEnd + timing.exitDelay)
    const t5 = setTimeout(finish,                    timing.holdEnd + timing.exitDelay + timing.exitMs)
    return () => [t1, t2, t3, t4, t5].forEach(clearTimeout)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Esc/Enter/Space skip from the keyboard. Bound on document rather than the
  // overlay so it works before anything inside has taken focus.
  useEffect(() => {
    const onKey = (e) => {
      if (['Escape', 'Enter', ' ', 'Spacebar'].includes(e.key)) skip()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [skip])

  return (
    <>
      <style>{KEYFRAMES}</style>

      {/* ── Root overlay ──────────────────────────────────────────── */}
      <div
        onClick={skip}
        role="presentation"
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
          cursor: 'pointer',
          /* Flyer background gradient: rich deep green */
          background: 'radial-gradient(ellipse at 30% 40%, #1e6b22 0%, #0f3d13 40%, #071f08 75%, #030d04 100%)',
          opacity: exiting ? 0 : 1,
          transition: exiting ? `opacity ${timing.exitMs}ms ease-in-out` : 'none',
          fontFamily: "'Space Grotesk', 'Inter', sans-serif",
        }}>

        {/* ── Pattern overlay — slow drift ──────────────────────── */}
        <div style={{
          position: 'absolute', inset: '-10%',   /* oversized so drift has no hard edge */
          backgroundImage: `url(${patternImg})`,
          backgroundRepeat: 'repeat',
          backgroundSize: '520px auto',
          opacity: 0.28,
          animation: reduced ? 'none' : 'sp_patternDrift 28s linear infinite',
          pointerEvents: 'none',
          mixBlendMode: 'screen',
        }} />

        {/* ── Radial centre glow ────────────────────────────────── */}
        <div style={{
          position: 'absolute', width: 560, height: 560, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(30,107,34,0.30) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* ── Content column ────────────────────────────────────── */}
        <div style={{
          position: 'relative', zIndex: 2,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 0,
        }}>

          {/* Egg */}
          <div style={{
            // Was a flat 420px, which overflowed every phone narrower than
            // that. Scales with the viewport now and never exceeds 420.
            width: 'min(62vw, 420px)', height: 'auto',
            opacity:   eggIn ? 1 : 0,
            transition: reduced ? `opacity 320ms ease-out` : 'none',
            // Roll in on entrance; zoom out on exit (eggExiting overrides)
            animation: reduced
              ? 'none'
              : eggExiting
                ? `sp_eggZoomOut ${timing.eggZoomMs}ms cubic-bezier(0.4,0,1,1) forwards`
                : eggIn
                  ? `sp_eggRoll 1.1s cubic-bezier(0.22,1,0.36,1) forwards`
                  : 'none',
            filter: 'drop-shadow(0 28px 56px rgba(0,0,0,0.75)) drop-shadow(0 8px 16px rgba(0,0,0,0.55))',
            marginBottom: 18,
          }}>
            <img src={eggImg} alt="Smart Poultry hybrid egg"
              style={{ width: '100%', height: 'auto', display: 'block' }} />
          </div>

          {/* Branding */}
          <div style={{
            textAlign: 'center',
            opacity:   textIn ? 1 : 0,
            transition: reduced ? 'opacity 320ms ease-out' : 'none',
            animation: reduced
              ? 'none'
              : textIn ? 'sp_textUp 0.75s cubic-bezier(0.34,1.1,0.64,1) forwards' : 'none',
          }}>
            {/* Title row — matches flyer: "Smart" white-bold, "Poultry" green-bold */}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 10, lineHeight: 1 }}>
              <span style={{
                fontSize: 'clamp(2rem, 5vw, 3rem)',
                fontWeight: 800,
                color: '#ffffff',
                letterSpacing: '-0.03em',
                textShadow: '0 2px 18px rgba(0,0,0,0.55)',
              }}>Smart</span>
              <span style={{
                fontSize: 'clamp(2rem, 5vw, 3rem)',
                fontWeight: 800,
                color: '#5ae060',          /* matches flyer bright green */
                letterSpacing: '-0.03em',
                textShadow: '0 0 28px rgba(90,224,96,0.50)',
              }}>Poultry</span>
            </div>

            {/* Subtitle — italic, muted white, matches flyer */}
            <div style={{
              marginTop: 8,
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: 'clamp(0.75rem, 2vw, 0.92rem)',
              color: 'rgba(255,255,255,0.50)',
              letterSpacing: '0.07em',
            }}>AI Farm Management</div>
          </div>
        </div>

        {/* A real button, so the skip is reachable by keyboard and announced
            by screen readers — the overlay click handler alone is neither. */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); skip() }}
          style={{
            position: 'absolute', bottom: 28, right: 28, zIndex: 3,
            padding: '8px 18px', borderRadius: 999,
            background: 'rgba(255,255,255,0.10)',
            border: '1px solid rgba(255,255,255,0.22)',
            color: 'rgba(255,255,255,0.82)',
            fontFamily: "'Inter', sans-serif",
            fontSize: '0.8rem', fontWeight: 500,
            cursor: 'pointer',
            opacity: exiting ? 0 : 1,
            transition: 'opacity 200ms ease',
          }}
        >
          Skip
        </button>
      </div>
    </>
  )
}

/* ── CSS Keyframes ──────────────────────────────────────────── */
const KEYFRAMES = `
  /* Pattern slow drift — diagonal float */
  @keyframes sp_patternDrift {
    0%   { transform: translate(0,   0);  }
    50%  { transform: translate(-3%, 2%); }
    100% { transform: translate(0,   0);  }
  }

  /* Egg rolls in from far left with settle bounce */
  @keyframes sp_eggRoll {
    0%   { transform: translateX(-110vw) rotate(-600deg); opacity: 0; }
    55%  { opacity: 1; }
    80%  { transform: translateX(10px)   rotate(12deg); }
    90%  { transform: translateX(-5px)   rotate(-5deg); }
    96%  { transform: translateX(2px)    rotate(2deg); }
    100% { transform: translateX(0)      rotate(0deg); opacity: 1; }
  }

  /* Egg exit — zoom out (shrink away) then fade */
  @keyframes sp_eggZoomOut {
    0%   { transform: scale(1);    opacity: 1; }
    40%  { transform: scale(1.08); opacity: 1; }  /* tiny anticipation pop */
    100% { transform: scale(0);    opacity: 0; }
  }

  /* Text slides up and fades in */
  @keyframes sp_textUp {
    0%   { opacity: 0; transform: translateY(24px); }
    100% { opacity: 1; transform: translateY(0); }
  }
`
