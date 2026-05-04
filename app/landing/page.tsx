'use client'

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

export default function LandingPage() {
  const { t, lang, setLang } = useLang()
  const { theme, toggleTheme } = useTheme()

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

  return (
    <div className="min-h-screen flex flex-col" style={{ color: 'var(--text-primary)' }}>

      {/* Nav */}
      <nav className="sticky top-0 z-50 px-4 sm:px-6 md:px-10 pt-4 sm:pt-6">
        <div className="glass-card rounded-[24px] flex items-center justify-between px-3 sm:px-5 py-3 sm:py-3.5 gap-2 sm:gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <TradeLabLogo className="w-[120px] sm:w-[150px]" />
          </div>

          <div className="hidden lg:flex items-center gap-7 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            <a href="#features" className="transition-colors hover:text-[var(--text-primary)]">{t('about')}</a>
            <a href="#how" className="transition-colors hover:text-[var(--text-primary)]">{t('howTitle')}</a>
            <a href="#pricing" className="transition-colors hover:text-[var(--text-primary)]">{t('pricing')}</a>
            <Link href="/support" className="transition-colors hover:text-[var(--text-primary)]">{t('contact')}</Link>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <select
              value={lang}
              onChange={e => setLang(e.target.value as Language)}
              className="hidden sm:block h-11 min-w-[76px] rounded-xl px-3.5 text-sm font-semibold outline-none cursor-pointer appearance-none pr-8 transition-colors"
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-secondary)',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236a87ac' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
              }}>
              <option value="en">EN</option>
              <option value="ru">RU</option>
              <option value="uz">UZ</option>
            </select>
            <ThemeToggle theme={theme} onToggle={toggleTheme} className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl hover:-translate-y-0.5" />
            <Link
              href="/auth/login"
              className="hidden sm:inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold transition-all hover:-translate-y-0.5"
              style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-default)', background: 'var(--bg-tertiary)' }}>
              {t('signIn')}
            </Link>
            <Link
              href="/auth/register"
              className="inline-flex h-10 sm:h-11 items-center justify-center rounded-xl px-3 sm:px-5 text-xs sm:text-sm font-bold transition-all hover:-translate-y-0.5 text-white whitespace-nowrap"
              style={{ background: 'var(--accent)', boxShadow: '0 14px 30px rgba(244, 87, 131, 0.24)' }}>
              {t('getStarted')}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="grid-bg flex flex-col items-center justify-center px-6 md:px-10 pt-20 pb-0 text-center relative overflow-hidden">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(244,87,131,0.08) 0%, transparent 62%)' }}
        />

        <span
          className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-1.5 rounded-full mb-7"
          style={{ background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: 'var(--accent)', boxShadow: '0 0 6px var(--accent)' }} />
          Candle-by-candle trading simulator
        </span>

        <h1
          className="font-black leading-[1.06] tracking-tight mb-2"
          style={{
            fontSize: 'clamp(40px, 6.5vw, 76px)',
            background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
          {t('heroH1')}
        </h1>
        <h1
          className="font-black leading-[1.06] tracking-tight mb-8"
          style={{ fontSize: 'clamp(40px, 6.5vw, 76px)', color: 'var(--accent)' }}>
          {t('heroH2')}
        </h1>

        <p className="text-lg max-w-xl leading-relaxed mb-10" style={{ color: 'var(--text-secondary)' }}>
          {t('heroSub')}
        </p>

        <div className="flex gap-3 flex-wrap justify-center">
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

        {/* Chart preview — floats into the stats bar */}
        <div
          className="mt-14 glass-card rounded-2xl p-4 w-full max-w-4xl relative z-10"
          style={{ boxShadow: '0 40px 80px rgba(0,0,0,0.45)' }}>
          <div className="flex gap-4 items-center mb-3 px-1">
            <span className="font-bold text-sm">XAU/USD</span>
            <span className="font-mono text-sm" style={{ color: 'var(--green)' }}>2,649.50</span>
            <span className="font-mono text-xs" style={{ color: 'var(--green)' }}>▲ +0.38%</span>
            <span className="ml-auto text-xs font-semibold px-2.5 py-1 rounded" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>M1</span>
          </div>
          <PreviewChart />
        </div>
      </section>

      {/* Stats bar */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
        <div className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <div key={i} className="flex flex-col items-center text-center">
              <span className="text-3xl font-black tracking-tight" style={{ color: 'var(--accent)' }}>{s.value}</span>
              <span className="text-sm mt-1.5" style={{ color: 'var(--text-muted)' }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <section id="features" className="px-6 md:px-10 py-24 max-w-6xl mx-auto w-full">
        <div className="text-center mb-16">
          <span className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: 'var(--accent)' }}>Features</span>
          <h2 className="text-3xl md:text-[42px] font-black mt-3 mb-5 tracking-tight leading-tight">
            Everything you need to become<br className="hidden md:block" /> a better trader
          </h2>
          <p className="text-base max-w-md mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            One platform to simulate, journal, and analyse your trading performance.
          </p>
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
      </section>

      {/* How it works */}
      <section
        id="how"
        className="px-6 md:px-10 py-24"
        style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: 'var(--accent)' }}>Process</span>
            <h2 className="text-3xl md:text-[42px] font-black mt-3 tracking-tight">{t('howTitle')}</h2>
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

      {/* Pricing */}
      <section id="pricing" className="px-6 md:px-10 py-24">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: 'var(--accent)' }}>Pricing</span>
            <h2 className="text-3xl md:text-[42px] font-black mt-3 mb-3 tracking-tight">{t('pricingTitle')}</h2>
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
          <h2 className="text-3xl md:text-[40px] font-black mb-4 tracking-tight leading-tight relative">
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
          <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>Powered by Dukascopy historical tick data</p>
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
