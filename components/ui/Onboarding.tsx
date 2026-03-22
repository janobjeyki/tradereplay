'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const STEPS = [
  {
    icon: '📊',
    title: 'Welcome to BackTest',
    body: 'Practice trading with real historical data — candle by candle. Build genuine intuition without risking a cent.',
    cta: 'Get Started',
  },
  {
    icon: '🎯',
    title: 'Create a Strategy',
    body: 'Group your sessions by strategy. Track which approaches actually work over time in the Strategies tab.',
    cta: 'Next',
  },
  {
    icon: '📈',
    title: 'Start a Session',
    body: 'Pick a date range, assign a strategy, and start trading. Advance candles one by one or skip ahead.',
    cta: 'Next',
  },
  {
    icon: '🧠',
    title: 'Review Your Analytics',
    body: 'After trading, analyse your equity curve, win rate, risk/reward, and performance by day of week.',
    cta: 'Start Trading',
  },
]

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const router = useRouter()
  const cur = STEPS[step]
  const isLast = step === STEPS.length - 1

  const next = () => {
    if (isLast) {
      localStorage.setItem('bt_onboarded', '1')
      onDone()
      router.push('/dashboard/sessions')
    } else {
      setStep(s => s + 1)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
        borderRadius: 20,
        padding: '2.5rem 2.5rem 2rem',
        maxWidth: 440,
        width: '90vw',
        textAlign: 'center',
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
      }}>
        {/* Step dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 28 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 20 : 7, height: 7,
              borderRadius: 4,
              background: i === step ? 'var(--accent)' : 'var(--border-default)',
              transition: 'all 0.3s',
            }} />
          ))}
        </div>

        <div style={{ fontSize: 52, marginBottom: 20 }}>{cur.icon}</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 }}>
          {cur.title}
        </h2>
        <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 32 }}>
          {cur.body}
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} style={{
              padding: '10px 20px', borderRadius: 10, border: '1px solid var(--border-default)',
              background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
              fontSize: 14, fontWeight: 500,
            }}>Back</button>
          )}
          <button onClick={next} style={{
            padding: '12px 32px', borderRadius: 10, border: 'none',
            background: 'var(--accent)', color: '#fff', cursor: 'pointer',
            fontSize: 15, fontWeight: 700, flex: 1, maxWidth: 200,
          }}>{cur.cta}</button>
        </div>

        {step === 0 && (
          <button onClick={() => { localStorage.setItem('bt_onboarded', '1'); onDone() }}
            style={{ marginTop: 16, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>
            Skip tour
          </button>
        )}
      </div>
    </div>
  )
}
