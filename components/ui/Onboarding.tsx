'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

// Step 0: welcome modal (centered)
// Steps 1+: spotlight tooltip pointing at a DOM element
const TOUR_STEPS = [
  {
    type: 'center' as const,
    icon: '🚀',
    title: 'Welcome to BackTest',
    body: 'Practice trading with real historical market data — candle by candle. Build genuine trading intuition without risking a cent.',
    cta: 'Show me around',
  },
  {
    type: 'tooltip' as const,
    target: '[data-tour="sessions"]',
    title: 'Sessions',
    body: 'Each session is one backtesting run. Pick a date range and trade through history one candle at a time.',
    placement: 'right' as const,
  },
  {
    type: 'tooltip' as const,
    target: '[data-tour="strategy"]',
    title: 'Strategies',
    body: 'Group sessions by strategy. See which setups actually work over time — win rate, PnL, trade count across all sessions.',
    placement: 'right' as const,
  },
  {
    type: 'tooltip' as const,
    target: '[data-tour="analytics"]',
    title: 'Analytics',
    body: 'Deep-dive into any session. Equity curve, monthly breakdown, daily performance, and a full trade journal.',
    placement: 'right' as const,
  },
  {
    type: 'center' as const,
    icon: '🎯',
    title: "You're all set",
    body: 'Start by creating a strategy, then create your first session. The market is waiting.',
    cta: 'Start Trading',
  },
]

interface TooltipPos { top: number; left: number; arrow: 'left' | 'top' | 'bottom' | 'right' }

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step,    setStep]    = useState(0)
  const [tPos,    setTPos]    = useState<TooltipPos | null>(null)
  const [spotlight, setSpotlight] = useState<DOMRect | null>(null)
  const router = useRouter()

  const cur     = TOUR_STEPS[step]
  const isLast  = step === TOUR_STEPS.length - 1
  const total   = TOUR_STEPS.length

  // Position tooltip relative to target element
  useEffect(() => {
    if (cur.type !== 'tooltip') { setTPos(null); setSpotlight(null); return }
    const el = document.querySelector(cur.target)
    if (!el) { setTPos(null); setSpotlight(null); return }

    const rect = el.getBoundingClientRect()
    setSpotlight(rect)

    const pad = 16
    if (cur.placement === 'right') {
      setTPos({
        top:  rect.top + rect.height / 2 - 60,
        left: rect.right + pad,
        arrow: 'left',
      })
    } else if (cur.placement === 'bottom') {
      setTPos({
        top:  rect.bottom + pad,
        left: rect.left + rect.width / 2 - 140,
        arrow: 'top',
      })
    }
  }, [step, cur])

  const finish = () => {
    localStorage.setItem('bt_onboarded', '1')
    onDone()
  }

  const next = () => {
    if (isLast) { finish(); router.push('/dashboard/sessions') }
    else setStep(s => s + 1)
  }

  return (
    <>
      {/* Backdrop — darkens everything except spotlight */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 9990, pointerEvents: 'all' }} onClick={() => {}} />

      {/* SVG cutout spotlight */}
      {spotlight && (
        <svg style={{ position: 'fixed', inset: 0, zIndex: 9991, pointerEvents: 'none', width: '100vw', height: '100vh' }}>
          <defs>
            <mask id="spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={spotlight.left - 6} y={spotlight.top - 6}
                width={spotlight.width + 12} height={spotlight.height + 12}
                rx={10} fill="black"
              />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.65)" mask="url(#spotlight-mask)" />
          {/* Highlight ring */}
          <rect
            x={spotlight.left - 6} y={spotlight.top - 6}
            width={spotlight.width + 12} height={spotlight.height + 12}
            rx={10} fill="none" stroke="var(--accent)" strokeWidth={2} opacity={0.8}
          />
        </svg>
      )}

      {/* Centered modal (step 0 and last) */}
      {cur.type === 'center' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: spotlight ? 'transparent' : 'rgba(0,0,0,0.65)',
          backdropFilter: spotlight ? 'none' : 'blur(4px)',
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
            borderRadius: 20,
            padding: '2.5rem 2.5rem 2rem',
            maxWidth: 420, width: '90vw',
            textAlign: 'center',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            animation: 'fadeIn 0.25s ease',
          }}>
            {/* Progress dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginBottom: 24 }}>
              {TOUR_STEPS.map((_, i) => (
                <div key={i} style={{
                  width: i === step ? 18 : 6, height: 6, borderRadius: 3,
                  background: i === step ? 'var(--accent)' : i < step ? 'var(--accent-muted)' : 'var(--border-default)',
                  transition: 'all 0.3s',
                }} />
              ))}
            </div>
            <div style={{ fontSize: 48, marginBottom: 18 }}>{(cur as any).icon}</div>
            <h2 style={{ fontSize: 21, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>{cur.title}</h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 28 }}>{cur.body}</p>
            <button onClick={next} style={{
              width: '100%', padding: '12px', borderRadius: 12, border: 'none',
              background: 'var(--accent)', color: '#fff', cursor: 'pointer',
              fontSize: 15, fontWeight: 700,
            }}>{(cur as any).cta}</button>
            {step === 0 && (
              <button onClick={finish} style={{
                marginTop: 12, background: 'none', border: 'none',
                color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12,
              }}>Skip tour</button>
            )}
          </div>
        </div>
      )}

      {/* Tooltip pointing at element */}
      {cur.type === 'tooltip' && tPos && (
        <div style={{
          position: 'fixed',
          top: tPos.top, left: tPos.left,
          zIndex: 9999,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-default)',
          borderRadius: 14,
          padding: '18px 20px',
          maxWidth: 260,
          boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
          animation: 'fadeIn 0.2s ease',
        }}>
          {/* Arrow */}
          {tPos.arrow === 'left' && (
            <div style={{
              position: 'absolute', left: -8, top: 28,
              width: 0, height: 0,
              borderTop: '8px solid transparent',
              borderBottom: '8px solid transparent',
              borderRight: '8px solid var(--bg-secondary)',
            }} />
          )}

          {/* Step counter */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {step} / {total - 1}
            </span>
            <button onClick={finish} style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0,
            }}>×</button>
          </div>

          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{cur.title}</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 16 }}>{cur.body}</p>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep(s => s - 1)} style={{
              flex: 1, padding: '7px', borderRadius: 8,
              background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)',
              color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13,
            }}>← Back</button>
            <button onClick={next} style={{
              flex: 2, padding: '7px', borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: '#fff', cursor: 'pointer',
              fontSize: 13, fontWeight: 700,
            }}>{isLast ? 'Done' : 'Next →'}</button>
          </div>
        </div>
      )}
    </>
  )
}
