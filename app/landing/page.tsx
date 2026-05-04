'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/contexts/LangContext'
import { useTheme } from '@/contexts/ThemeContext'
import { ThemeToggle } from '@/components/ui'
import { PreviewChart } from '@/components/chart/PreviewChart'
import type { Language } from '@/types'
import { TradeLabLogo } from '@/components/ui/Brand'

function CheckIcon() {
  return (
    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
      <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ArrowRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M7 0l1.92 4.36L13 5l-3.5 3 1 4.5L7 10.36 2.5 12.5l1-4.5L0 5l4.08-.64L7 0z" />
    </svg>
  )
}

function CandleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <rect x="3" y="5" width="4.5" height="10" rx="1.2" />
      <line x1="5.25" y1="2" x2="5.25" y2="5" />
      <line x1="5.25" y1="15" x2="5.25" y2="18" />
      <rect x="12.5" y="7" width="4.5" height="7" rx="1.2" />
      <line x1="14.75" y1="3.5" x2="14.75" y2="7" />
      <line x1="14.75" y1="14" x2="14.75" y2="17" />
    </svg>
  )
}

function DatabaseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <ellipse cx="10" cy="5" rx="7" ry="2.5" />
      <path d="M3 5v5c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5V5" />
      <path d="M3 10v5c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5v-5" />
    </svg>
  )
}

function AnalyticsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="2,15 6,10 10,13 14,6 18,9" />
      <line x1="2" y1="18" x2="18" y2="18" />
    </svg>
  )
}

function ChecklistIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 10l2.5 2.5 5-5" />
      <rect x="2" y="2" width="16" height="16" rx="3" />
    </svg>
  )
}

function JournalIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M4 18V4a2 2 0 012-2h8a2 2 0 012 2v14" />
      <path d="M2 18h16" />
      <line x1="8" y1="7" x2="12" y2="7" />
      <line x1="8" y1="10.5" x2="12" y2="10.5" />
    </svg>
  )
}

function SessionsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="16" height="11" rx="2" />
      <line x1="7" y1="18" x2="13" y2="18" />
      <line x1="10" y1="14" x2="10" y2="18" />
    </svg>
  )
}

/**
 * Static SVG mock of a backtesting session — meant to look like a screenshot
 * of the actual TradeLab workspace (toolbar + chart + trade markers + transport).
 */
function BacktestingMock() {
  // Pre-computed candles so the SVG is deterministic and static.
  const candles = [
    { o: 50, c: 58, h: 62, l: 47 },
    { o: 58, c: 55, h: 61, l: 52 },
    { o: 55, c: 64, h: 67, l: 54 },
    { o: 64, c: 60, h: 66, l: 58 },
    { o: 60, c: 70, h: 72, l: 59 },
    { o: 70, c: 68, h: 73, l: 65 },
    { o: 68, c: 76, h: 79, l: 67 },
    { o: 76, c: 74, h: 78, l: 71 },
    { o: 74, c: 82, h: 85, l: 73 },
    { o: 82, c: 79, h: 84, l: 77 },
    { o: 79, c: 88, h: 91, l: 78 },
    { o: 88, c: 86, h: 90, l: 84 },
    { o: 86, c: 95, h: 98, l: 85 },
    { o: 95, c: 92, h: 97, l: 90 },
    { o: 92, c: 100, h: 104, l: 91 },
    { o: 100, c: 98, h: 103, l: 95 },
    { o: 98, c: 108, h: 112, l: 97 },
    { o: 108, c: 105, h: 110, l: 103 },
    { o: 105, c: 114, h: 118, l: 104 },
    { o: 114, c: 112, h: 117, l: 109 },
    { o: 112, c: 120, h: 124, l: 111 },
    { o: 120, c: 118, h: 123, l: 116 },
    { o: 118, c: 126, h: 130, l: 117 },
    { o: 126, c: 124, h: 129, l: 122 },
    { o: 124, c: 132, h: 136, l: 123 },
    { o: 132, c: 138, h: 142, l: 130 },
    { o: 138, c: 145, h: 149, l: 136 },
    { o: 145, c: 142, h: 148, l: 140 },
    { o: 142, c: 150, h: 154, l: 141 },
    { o: 150, c: 156, h: 160, l: 148 },
  ]

  const w = 1000
  const h = 380
  const cw = w - 80 // chart width (leave 80px for price axis)
  const ch = h - 40 // chart height (leave 40px for time axis)
  const candleW = cw / candles.length
  const minP = 30
  const maxP = 175
  const py = (price: number) => ch - ((price - minP) / (maxP - minP)) * ch + 12

  // Entry / SL / TP for a long trade entered around candle 18
  const entry = 102
  const sl = 92
  const tp = 152

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
      }}>
      {/* Top toolbar */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 text-[12px]"
        style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-tertiary)' }}>
        <span className="font-bold">XAU/USD</span>
        <span className="font-mono" style={{ color: 'var(--green)' }}>2,649.50</span>
        <span className="font-mono text-[11px]" style={{ color: 'var(--green)' }}>▲ +0.38%</span>
        <div className="flex items-center gap-1 ml-2">
          {['M1', 'M5', 'M15', 'H1', 'H4', 'D1'].map((tf, i) => (
            <span
              key={tf}
              className="px-2 py-0.5 rounded text-[11px] font-semibold"
              style={{
                background: i === 0 ? 'var(--accent-muted)' : 'transparent',
                color: i === 0 ? 'var(--accent)' : 'var(--text-muted)',
                border: i === 0 ? '1px solid var(--accent-border)' : '1px solid transparent',
              }}>
              {tf}
            </span>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <span>Balance: <span style={{ color: 'var(--text-primary)' }} className="font-mono font-bold">$10,420.50</span></span>
          <span>P&L: <span style={{ color: 'var(--green)' }} className="font-mono font-bold">+$420.50</span></span>
        </div>
      </div>

      {/* Chart */}
      <div className="px-4 pt-4">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto block" preserveAspectRatio="none">
          {/* Grid */}
          {[0, 1, 2, 3, 4, 5].map(i => (
            <line
              key={`gh-${i}`}
              x1="0" x2={cw}
              y1={(ch / 5) * i + 12} y2={(ch / 5) * i + 12}
              stroke="var(--border-subtle)" strokeDasharray="2 4" strokeWidth="1"
            />
          ))}
          {[0, 1, 2, 3, 4, 5].map(i => (
            <line
              key={`gv-${i}`}
              x1={(cw / 5) * i} x2={(cw / 5) * i}
              y1="12" y2={ch + 12}
              stroke="var(--border-subtle)" strokeDasharray="2 4" strokeWidth="1"
            />
          ))}

          {/* TP zone */}
          <rect x="0" y={py(tp)} width={cw} height={py(entry) - py(tp)} fill="var(--green-muted)" />
          {/* SL zone */}
          <rect x="0" y={py(entry)} width={cw} height={py(sl) - py(entry)} fill="var(--red-muted)" />

          {/* TP / Entry / SL lines */}
          <line x1="0" x2={cw} y1={py(tp)}    y2={py(tp)}    stroke="var(--green)"  strokeWidth="1.2" strokeDasharray="6 4" />
          <line x1="0" x2={cw} y1={py(entry)} y2={py(entry)} stroke="var(--accent)" strokeWidth="1.4" />
          <line x1="0" x2={cw} y1={py(sl)}    y2={py(sl)}    stroke="var(--red)"    strokeWidth="1.2" strokeDasharray="6 4" />

          {/* Candles */}
          {candles.map((cd, i) => {
            const x = i * candleW + candleW / 2
            const bullish = cd.c >= cd.o
            const color = bullish ? 'var(--green)' : 'var(--red)'
            return (
              <g key={i}>
                <line x1={x} x2={x} y1={py(cd.h)} y2={py(cd.l)} stroke={color} strokeWidth="1.2" />
                <rect
                  x={x - candleW * 0.32}
                  y={py(Math.max(cd.o, cd.c))}
                  width={candleW * 0.64}
                  height={Math.max(2, Math.abs(py(cd.o) - py(cd.c)))}
                  fill={color}
                />
              </g>
            )
          })}

          {/* Entry marker */}
          <g transform={`translate(${17 * candleW + candleW / 2}, ${py(entry)})`}>
            <circle r="6" fill="var(--accent)" stroke="white" strokeWidth="2" />
            <text x="10" y="-8" fontSize="11" fontWeight="700" fill="var(--accent)">BUY @ 102.0</text>
          </g>

          {/* Price axis labels */}
          <g fontSize="10" fontFamily="monospace" fill="var(--text-muted)" textAnchor="start">
            <rect x={cw + 6}  y={py(tp)    - 8}  width="68" height="16" rx="3" fill="var(--green-muted)"  stroke="var(--green)" strokeWidth="1" />
            <text x={cw + 10} y={py(tp)    + 3} fill="var(--green)" fontWeight="700">TP 152.0</text>

            <rect x={cw + 6}  y={py(entry) - 8}  width="68" height="16" rx="3" fill="var(--accent-muted)" stroke="var(--accent)" strokeWidth="1" />
            <text x={cw + 10} y={py(entry) + 3} fill="var(--accent)" fontWeight="700">ENTRY 102</text>

            <rect x={cw + 6}  y={py(sl)    - 8}  width="68" height="16" rx="3" fill="var(--red-muted)"   stroke="var(--red)" strokeWidth="1" />
            <text x={cw + 10} y={py(sl)    + 3} fill="var(--red)" fontWeight="700">SL 92.0</text>
          </g>
        </svg>
      </div>

      {/* Transport bar */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-2.5 mt-2"
        style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-tertiary)' }}>
        <div className="flex items-center gap-2 text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
          <span style={{ color: 'var(--text-secondary)' }} className="font-semibold">2024-03-15 14:32 UTC</span>
          <span>·</span>
          <span>Candle 1842 / 4320</span>
        </div>
        <div className="flex items-center gap-1.5">
          {['⏮', '⏪', '▶', '⏩', '⏭'].map((sym, i) => (
            <button
              key={i}
              className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-bold"
              style={{
                background: i === 2 ? 'var(--accent)' : 'var(--bg-elevated)',
                color: i === 2 ? '#fff' : 'var(--text-secondary)',
                border: '1px solid var(--border-default)',
              }}>
              {sym}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {['BUY', 'SELL'].map((side, i) => (
            <span
              key={side}
              className="px-3 py-1 rounded-md text-[10px] font-bold"
              style={{
                background: i === 0 ? 'var(--green-muted)' : 'var(--red-muted)',
                color: i === 0 ? 'var(--green)' : 'var(--red)',
                border: `1px solid ${i === 0 ? 'var(--green)' : 'var(--red)'}`,
              }}>
              {side}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const { t, lang, setLang } = useLang()
  const { theme, toggleTheme } = useTheme()

  // Scroll-aware navbar: hide when scrolling down, show when scrolling up.
  const [navHidden, setNavHidden] = useState(false)
  const [navScrolled, setNavScrolled] = useState(false)
  useEffect(() => {
    let lastY = window.scrollY
    let ticking = false
    function onScroll() {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const y = window.scrollY
        setNavScrolled(y > 12)
        if (y < 80) {
          setNavHidden(false)
        } else if (y > lastY + 6) {
          setNavHidden(true)
        } else if (y < lastY - 6) {
          setNavHidden(false)
        }
        lastY = y
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const features = [
    { Icon: CandleIcon, title: t('feat1Title'), desc: t('feat1Desc') },
    { Icon: DatabaseIcon, title: t('feat2Title'), desc: t('feat2Desc') },
    { Icon: AnalyticsIcon, title: t('feat3Title'), desc: t('feat3Desc') },
    { Icon: ChecklistIcon, title: t('feat4Title'), desc: t('feat4Desc') },
    { Icon: JournalIcon, title: t('feat5Title'), desc: t('feat5Desc') },
    { Icon: SessionsIcon, title: t('feat6Title'), desc: t('feat6Desc') },
  ]

  const stats = [
    { value: '18', label: t('statsInstruments') },
    { value: '10+', label: t('statsYears') },
    { value: 'M1–D1', label: t('statsTimeframes') },
    { value: '100%', label: t('statsFree') },
  ]

  const steps = [
    { n: '01', title: t('step1Title'), desc: t('step1Desc') },
    { n: '02', title: t('step2Title'), desc: t('step2Desc') },
    { n: '03', title: t('step3Title'), desc: t('step3Desc') },
  ]

  const pricingFeatures = [
    t('pricingFeatReplay'),
    t('pricingFeatSessions'),
    t('pricingFeatJournal'),
    t('pricingFeatChecklist'),
    t('pricingFeatAnalytics'),
    t('pricingFeatData'),
  ]

  const bigFeatures = [
    {
      eyebrow: t('bf1Eyebrow'), title: t('bf1Title'), desc: t('bf1Desc'),
      bullets: [t('bf1B1'), t('bf1B2'), t('bf1B3')],
    },
    {
      eyebrow: t('bf2Eyebrow'), title: t('bf2Title'), desc: t('bf2Desc'),
      bullets: [t('bf2B1'), t('bf2B2'), t('bf2B3')],
    },
    {
      eyebrow: t('bf3Eyebrow'), title: t('bf3Title'), desc: t('bf3Desc'),
      bullets: [t('bf3B1'), t('bf3B2'), t('bf3B3')],
    },
  ]

  const testimonials = [
    { quote: t('tm1Quote'), name: 'Marcus Chen',   role: t('tm1Role') },
    { quote: t('tm2Quote'), name: 'Sara Petrov',   role: t('tm2Role') },
    { quote: t('tm3Quote'), name: 'Daniel Okafor', role: t('tm3Role') },
  ]

  return (
    <div className="min-h-screen flex flex-col" style={{ color: 'var(--text-primary)' }}>

      {/* Nav — fixed to top, hides on scroll-down, slides back on scroll-up */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 md:px-10 pt-3 sm:pt-4 transition-transform duration-300 ease-out"
        style={{ transform: navHidden ? 'translateY(-130%)' : 'translateY(0)' }}>
        <div
          className="rounded-2xl flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 gap-2 sm:gap-4 transition-all duration-300"
          style={{
            background: navScrolled
              ? 'linear-gradient(180deg, rgba(26,36,55,0.92) 0%, rgba(18,26,40,0.92) 100%)'
              : 'linear-gradient(180deg, rgba(26,36,55,0.78) 0%, rgba(18,26,40,0.78) 100%)',
            border: '1px solid var(--border-default)',
            boxShadow: navScrolled ? '0 12px 30px rgba(8,12,22,0.35)' : 'none',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
          }}>
          <div className="flex items-center gap-2.5 shrink-0">
            <TradeLabLogo className="w-[110px] sm:w-[130px]" />
          </div>

          <div className="hidden lg:flex items-center gap-6 text-[13px] font-medium" style={{ color: 'var(--text-secondary)' }}>
            <a href="#features" className="transition-colors hover:text-[var(--text-primary)]">{t('about')}</a>
            <a href="#how" className="transition-colors hover:text-[var(--text-primary)]">{t('howTitle')}</a>
            <a href="#testimonials" className="transition-colors hover:text-[var(--text-primary)]">{t('reviews')}</a>
            <a href="#pricing" className="transition-colors hover:text-[var(--text-primary)]">{t('pricing')}</a>
            <Link href="/support" className="transition-colors hover:text-[var(--text-primary)]">{t('contact')}</Link>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <select
              value={lang}
              onChange={e => setLang(e.target.value as Language)}
              className="hidden sm:block h-9 min-w-[68px] rounded-lg px-3 text-[12px] font-semibold outline-none cursor-pointer appearance-none pr-7 transition-colors"
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-secondary)',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236a87ac' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 10px center',
              }}>
              <option value="en">EN</option>
              <option value="ru">RU</option>
              <option value="uz">UZ</option>
            </select>
            <ThemeToggle theme={theme} onToggle={toggleTheme} className="h-9 w-9 sm:h-9 sm:w-9 rounded-lg hover:-translate-y-0.5" />
            <Link
              href="/auth/login"
              className="hidden sm:inline-flex h-9 items-center justify-center rounded-lg px-4 text-[12px] font-semibold transition-all hover:-translate-y-0.5"
              style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-default)', background: 'var(--bg-tertiary)' }}>
              {t('signIn')}
            </Link>
            <Link
              href="/auth/register"
              className="inline-flex h-9 items-center justify-center rounded-lg px-3 sm:px-4 text-[12px] font-bold transition-all hover:-translate-y-0.5 text-white whitespace-nowrap"
              style={{ background: 'var(--accent)', boxShadow: '0 10px 22px rgba(244, 87, 131, 0.24)' }}>
              {t('getStarted')}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero — extra top padding for fixed nav */}
      <section className="grid-bg flex flex-col items-center justify-center px-6 md:px-10 pt-32 sm:pt-36 pb-0 text-center relative overflow-hidden">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1100px] h-[1100px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(244,87,131,0.10) 0%, transparent 60%)' }}
        />

        <span
          className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-1.5 rounded-full mb-7 relative z-10"
          style={{ background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: 'var(--accent)', boxShadow: '0 0 6px var(--accent)' }} />
          {t('heroBadge')}
        </span>

        {/* leading-[1.18] + paddingBottom prevents descenders (g, y) from being clipped by background-clip:text */}
        <h1
          className="font-black tracking-tight max-w-5xl relative z-10"
          style={{
            fontSize: 'clamp(40px, 7vw, 84px)',
            lineHeight: 1.18,
            paddingBottom: '0.12em',
            background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
          {t('heroH1')}
        </h1>
        <h1
          className="font-black tracking-tight mb-8 relative z-10"
          style={{
            fontSize: 'clamp(40px, 7vw, 84px)',
            lineHeight: 1.18,
            paddingBottom: '0.12em',
            color: 'var(--accent)',
          }}>
          {t('heroH2')}
        </h1>

        <p className="text-lg md:text-xl max-w-2xl leading-relaxed mb-10 relative z-10" style={{ color: 'var(--text-secondary)' }}>
          {t('heroSub')}
        </p>

        <div className="flex gap-3 flex-wrap justify-center relative z-10">
          <Link
            href="/auth/register"
            className="inline-flex items-center gap-2 px-8 py-4 font-bold rounded-xl text-white transition-all hover:-translate-y-0.5 text-[15px]"
            style={{ background: 'var(--accent)', boxShadow: '0 16px 40px rgba(244, 87, 131, 0.32)' }}>
            {t('heroCta')}
            <ArrowRight />
          </Link>
          <Link
            href="/auth/login"
            className="px-7 py-4 font-medium rounded-xl transition-all text-[15px] hover:-translate-y-0.5"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-default)', background: 'var(--bg-tertiary)' }}>
            {t('signIn')}
          </Link>
        </div>

        {/* Rating row */}
        <div className="flex items-center gap-4 mt-8 text-sm relative z-10" style={{ color: 'var(--text-muted)' }}>
          <div className="flex items-center gap-1" style={{ color: 'var(--accent)' }}>
            <StarIcon /><StarIcon /><StarIcon /><StarIcon /><StarIcon />
          </div>
          <span>{t('heroRating')}</span>
        </div>

        {/* Static backtesting session preview */}
        <div
          className="mt-16 w-full max-w-5xl relative z-10"
          style={{ filter: 'drop-shadow(0 50px 100px rgba(0,0,0,0.45))' }}>
          <BacktestingMock />
        </div>
      </section>

      {/* Stats bar */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
        <div className="max-w-5xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <div key={i} className="flex flex-col items-center text-center">
              <span className="text-4xl font-black tracking-tight" style={{ color: 'var(--accent)' }}>{s.value}</span>
              <span className="text-sm mt-1.5" style={{ color: 'var(--text-muted)' }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Big alternating feature blocks */}
      <section id="features" className="px-6 md:px-10 py-24 max-w-6xl mx-auto w-full">
        <div className="text-center mb-20">
          <span className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: 'var(--accent)' }}>{t('bigFeatEyebrow')}</span>
          <h2 className="text-3xl md:text-[44px] font-black mt-3 mb-5 tracking-tight" style={{ lineHeight: 1.15, paddingBottom: '0.1em' }}>
            {t('bigFeatTitle')}
          </h2>
          <p className="text-base md:text-lg max-w-xl mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('bigFeatSub')}
          </p>
        </div>

        <div className="space-y-24">
          {bigFeatures.map((f, i) => (
            <div key={i} className={`grid md:grid-cols-2 gap-10 md:gap-16 items-center ${i % 2 === 1 ? 'md:[&>*:first-child]:order-2' : ''}`}>
              <div>
                <span className="text-xs font-bold uppercase tracking-[0.22em] block mb-4" style={{ color: 'var(--accent)' }}>
                  {f.eyebrow}
                </span>
                <h3
                  className="text-3xl md:text-[36px] font-black tracking-tight mb-5 whitespace-pre-line"
                  style={{ lineHeight: 1.15, paddingBottom: '0.1em' }}>
                  {f.title}
                </h3>
                <p className="text-base md:text-lg leading-relaxed mb-7" style={{ color: 'var(--text-secondary)' }}>
                  {f.desc}
                </p>
                <ul className="space-y-3">
                  {f.bullets.map((b, j) => (
                    <li key={j} className="flex items-center gap-3 text-sm md:text-base">
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                        <CheckIcon />
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Mock visual */}
              <div className="glass-card rounded-2xl p-5 md:p-6" style={{ boxShadow: '0 30px 60px rgba(0,0,0,0.35)' }}>
                {i === 0 && (
                  <div>
                    <div className="flex gap-2 mb-3">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--red)' }} />
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--accent)' }} />
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--green)' }} />
                    </div>
                    <PreviewChart />
                    <div className="flex items-center justify-center gap-3 mt-4">
                      <button className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>⏮</button>
                      <button className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>⏯</button>
                      <button className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: 'var(--accent)' }}>▶</button>
                      <button className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>⏭</button>
                    </div>
                  </div>
                )}
                {i === 1 && (
                  <div className="space-y-2.5">
                    {[
                      { sym: 'XAU/USD', side: 'LONG', r: '+2.4R', win: true },
                      { sym: 'EUR/USD', side: 'SHORT', r: '+1.1R', win: true },
                      { sym: 'GBP/JPY', side: 'LONG',  r: '−0.8R', win: false },
                      { sym: 'US100',   side: 'LONG',  r: '+3.2R', win: true },
                      { sym: 'BTC/USD', side: 'SHORT', r: '−1.0R', win: false },
                    ].map((tr, k) => (
                      <div key={k} className="flex items-center gap-3 px-3.5 py-3 rounded-xl" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                        <span className="font-bold text-sm w-20">{tr.sym}</span>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded"
                          style={{ background: tr.side === 'LONG' ? 'var(--green-muted)' : 'var(--red-muted)', color: tr.side === 'LONG' ? 'var(--green)' : 'var(--red)' }}>
                          {tr.side}
                        </span>
                        <span className="ml-auto font-mono text-sm font-bold" style={{ color: tr.win ? 'var(--green)' : 'var(--red)' }}>{tr.r}</span>
                      </div>
                    ))}
                  </div>
                )}
                {i === 2 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { l: 'Win rate',     v: '62%',  c: 'var(--green)' },
                        { l: 'Expectancy',   v: '+0.84R', c: 'var(--green)' },
                        { l: 'Profit factor', v: '2.31',   c: 'var(--accent)' },
                        { l: 'Max DD',       v: '−4.2R', c: 'var(--red)' },
                      ].map((m, k) => (
                        <div key={k} className="px-4 py-3 rounded-xl" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                          <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{m.l}</div>
                          <div className="text-xl font-black font-mono" style={{ color: m.c }}>{m.v}</div>
                        </div>
                      ))}
                    </div>
                    <div className="px-4 py-4 rounded-xl" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                      <div className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>{t('equityCurve')}</div>
                      <svg viewBox="0 0 200 50" className="w-full h-14">
                        <polyline
                          fill="none"
                          stroke="var(--accent)"
                          strokeWidth="2"
                          points="0,40 20,38 40,32 60,28 80,30 100,22 120,18 140,20 160,12 180,8 200,4"
                        />
                        <polyline
                          fill="var(--accent-muted)"
                          stroke="none"
                          points="0,40 20,38 40,32 60,28 80,30 100,22 120,18 140,20 160,12 180,8 200,4 200,50 0,50"
                        />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature grid */}
      <section
        className="px-6 md:px-10 py-24"
        style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: 'var(--accent)' }}>{t('featGridEyebrow')}</span>
            <h2 className="text-3xl md:text-[42px] font-black mt-3 tracking-tight" style={{ lineHeight: 1.15, paddingBottom: '0.1em' }}>
              {t('featGridTitle')}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(({ Icon, title, desc }, i) => (
              <div
                key={i}
                className="glass-card rounded-2xl p-7 transition-all hover:-translate-y-1 group">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-colors"
                  style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                  <Icon />
                </div>
                <h3 className="font-bold text-[17px] mb-2.5 tracking-tight">{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="px-6 md:px-10 py-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: 'var(--accent)' }}>Process</span>
            <h2 className="text-3xl md:text-[42px] font-black mt-3 tracking-tight" style={{ lineHeight: 1.15, paddingBottom: '0.1em' }}>{t('howTitle')}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-6">
            {steps.map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center px-4">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 text-xl font-black shrink-0"
                  style={{ background: 'var(--accent)', color: 'white', boxShadow: '0 10px 28px rgba(244,87,131,0.32)' }}>
                  {step.n}
                </div>
                <h3 className="font-bold text-lg mb-2.5 tracking-tight">{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section
        id="testimonials"
        className="px-6 md:px-10 py-24"
        style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: 'var(--accent)' }}>{t('testimonialsEyebrow')}</span>
            <h2 className="text-3xl md:text-[42px] font-black mt-3 mb-4 tracking-tight" style={{ lineHeight: 1.15, paddingBottom: '0.1em' }}>
              {t('testimonialsTitle')}
            </h2>
            <p className="text-base max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
              {t('testimonialsSub')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map((tm, i) => (
              <div key={i} className="glass-card rounded-2xl p-7 flex flex-col">
                <div className="flex items-center gap-1 mb-4" style={{ color: 'var(--accent)' }}>
                  <StarIcon /><StarIcon /><StarIcon /><StarIcon /><StarIcon />
                </div>
                <p className="text-[15px] leading-relaxed mb-6 flex-1" style={{ color: 'var(--text-primary)' }}>
                  “{tm.quote}”
                </p>
                <div className="flex items-center gap-3 pt-5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white"
                    style={{ background: 'var(--accent)' }}>
                    {tm.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-sm">{tm.name}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{tm.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 md:px-10 py-24">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: 'var(--accent)' }}>{t('pricing')}</span>
            <h2 className="text-3xl md:text-[42px] font-black mt-3 mb-3 tracking-tight" style={{ lineHeight: 1.15, paddingBottom: '0.1em' }}>{t('pricingTitle')}</h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('pricingEverything')}</p>
          </div>

          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="p-8 md:p-10" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="flex items-end justify-between flex-wrap gap-5">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.18em] mb-3" style={{ color: 'var(--text-muted)' }}>
                    Start Plan
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="text-5xl font-black tracking-tight">99,000</span>
                    <span className="text-lg font-semibold pb-1" style={{ color: 'var(--text-secondary)' }}>
                      UZS {t('pricingMonthly')}
                    </span>
                  </div>
                </div>
                <Link
                  href="/auth/register"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-white font-bold text-sm transition-all hover:-translate-y-0.5"
                  style={{ background: 'var(--accent)', boxShadow: '0 14px 30px rgba(244,87,131,0.3)' }}>
                  {t('pricingCta')}
                  <ArrowRight />
                </Link>
              </div>
            </div>

            <div className="p-8 md:p-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
                {pricingFeatures.map((feat, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                      <CheckIcon />
                    </span>
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{feat}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="px-6 md:px-10 pb-24">
        <div
          className="max-w-5xl mx-auto rounded-2xl p-10 md:p-16 text-center relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(244,87,131,0.14) 0%, rgba(244,87,131,0.04) 100%)',
            border: '1px solid var(--accent-border)',
          }}>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 65% 35%, rgba(244,87,131,0.1) 0%, transparent 65%)' }}
          />
          <h2 className="text-3xl md:text-[40px] font-black mb-4 tracking-tight relative" style={{ lineHeight: 1.15, paddingBottom: '0.1em' }}>
            {t('ctaTitle')}
          </h2>
          <p className="text-base mb-9 relative" style={{ color: 'var(--text-secondary)' }}>{t('ctaSub')}</p>
          <Link
            href="/auth/register"
            className="inline-flex items-center gap-2.5 px-9 py-4 rounded-xl text-white font-bold text-[15px] transition-all hover:-translate-y-0.5 relative"
            style={{ background: 'var(--accent)', boxShadow: '0 16px 40px rgba(244,87,131,0.36)' }}>
            {t('ctaBtn')}
            <ArrowRight />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 md:px-10 py-6" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <span className="font-black text-base" style={{ color: 'var(--text-secondary)' }}>TradeLab</span>
          <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>{t('footerTagline')}</p>
          <div className="flex flex-wrap items-center justify-center gap-5 text-xs" style={{ color: 'var(--text-muted)' }}>
            <Link href="/terms" className="transition-colors hover:text-[var(--text-secondary)]">Terms</Link>
            <Link href="/privacy" className="transition-colors hover:text-[var(--text-secondary)]">Privacy</Link>
            <Link href="/refund-policy" className="transition-colors hover:text-[var(--text-secondary)]">Refunds</Link>
            <Link href="/support" className="transition-colors hover:text-[var(--text-secondary)]">Support</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
