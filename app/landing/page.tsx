'use client'

import Link from 'next/link'
import { useLang } from '@/contexts/LangContext'
import { useTheme } from '@/contexts/ThemeContext'
import { ThemeToggle } from '@/components/ui'
import { PreviewChart } from '@/components/chart/PreviewChart'
import type { Language } from '@/types'
import { TradeLabLogo } from '@/components/ui/Brand'

export default function LandingPage() {
  const { t, lang, setLang } = useLang()
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="min-h-screen flex flex-col" style={{color:'var(--text-primary)'}}>

      {/* Nav */}
      <nav className="sticky top-0 z-50 px-4 sm:px-6 md:px-10 pt-4 sm:pt-6">
        <div className="glass-card rounded-[24px] flex items-center justify-between px-3 sm:px-5 py-3 sm:py-3.5 gap-2 sm:gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <TradeLabLogo className="w-[120px] sm:w-[150px]" />
          </div>

          <div className="hidden lg:flex items-center gap-7 text-sm font-medium" style={{color:'var(--text-secondary)'}}>
            <a href="#about" className="transition-colors hover:text-[var(--text-primary)]">{t('about')}</a>
            <a href="#pricing" className="transition-colors hover:text-[var(--text-primary)]">{t('pricing')}</a>
            <Link href="/support" className="transition-colors hover:text-[var(--text-primary)]">{t('contact')}</Link>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <select
              value={lang}
              onChange={e=>setLang(e.target.value as Language)}
              className="hidden sm:block h-11 min-w-[76px] rounded-xl px-3.5 text-sm font-semibold outline-none cursor-pointer appearance-none pr-8 transition-colors"
              style={{
                background:'var(--bg-tertiary)',
                border:'1px solid var(--border-default)',
                color:'var(--text-secondary)',
                backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236a87ac' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                backgroundRepeat:'no-repeat',
                backgroundPosition:'right 12px center'
              }}>
              <option value="en">EN</option>
              <option value="ru">RU</option>
              <option value="uz">UZ</option>
            </select>
            <ThemeToggle
              theme={theme}
              onToggle={toggleTheme}
              className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl hover:-translate-y-0.5"
            />
            <Link
              href="/auth/login"
              className="hidden sm:inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold transition-all hover:-translate-y-0.5"
              style={{color:'var(--text-secondary)', border:'1px solid var(--border-default)', background:'var(--bg-tertiary)'}}>
              {t('signIn')}
            </Link>
            <Link
              href="/auth/register"
              className="inline-flex h-10 sm:h-11 items-center justify-center rounded-xl px-3 sm:px-5 text-xs sm:text-sm font-bold transition-all hover:-translate-y-0.5 text-white whitespace-nowrap"
              style={{background:'var(--accent)', boxShadow:'0 14px 30px rgba(244, 87, 131, 0.24)'}}>
              {t('getStarted')}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="grid-bg flex-1 flex flex-col items-center justify-center px-6 md:px-10 py-16 md:py-20 text-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full pointer-events-none"
          style={{background:'radial-gradient(circle, rgba(244,87,131,0.08) 0%, transparent 68%)'}}/>

        <span className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-1.5 rounded-full mb-5"
          style={{background:'var(--accent-muted)', color:'var(--accent)', border:'1px solid var(--accent-border)'}}>
          ✦ &nbsp;Candle-by-candle trading simulator
        </span>

        <h1 className="font-black leading-[1.08] tracking-tight mb-1.5" style={{fontSize:'clamp(36px,6vw,60px)',
          background:'linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%)',
          WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent'}}>
          {t('heroH1')}
        </h1>
        <h1 className="font-black leading-[1.08] tracking-tight mb-7" style={{fontSize:'clamp(36px,6vw,60px)', color:'var(--accent)'}}>
          {t('heroH2')}
        </h1>
        <p className="text-lg max-w-lg leading-relaxed mb-10" style={{color:'var(--text-secondary)'}}>{t('heroSub')}</p>

        <div className="flex gap-3 flex-wrap justify-center">
          <Link href="/auth/register" className="px-7 py-3.5 font-bold rounded-xl text-white transition-all hover:-translate-y-0.5 text-[15px]"
            style={{background:'var(--accent)'}}>
            {t('heroCta')}
          </Link>
          <Link href="/auth/login" className="px-6 py-3.5 font-medium rounded-xl transition-all text-[15px]"
            style={{color:'var(--text-secondary)', border:'1px solid var(--border-default)'}}>
            {t('signIn')}
          </Link>
        </div>

        {/* Chart preview */}
        <div className="mt-14 glass-card rounded-2xl p-4 w-full max-w-3xl">
          <div className="flex gap-4 items-center mb-3 px-1">
            <span className="font-bold text-sm">XAU/USD</span>
            <span className="font-mono text-sm" style={{color:'var(--green)'}}>2,649.50</span>
            <span className="font-mono text-xs" style={{color:'var(--green)'}}>▲ +0.38%</span>
            <span className="ml-auto text-xs font-semibold px-2.5 py-1 rounded"
              style={{background:'var(--accent-muted)', color:'var(--accent)'}}>M1</span>
          </div>
          <PreviewChart />
        </div>
      </section>

      {/* Features */}
      <section id="about" className="px-10 py-16 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {e:'📊', t1:t('feat1Title'), d:t('feat1Desc')},
            {e:'📡', t1:t('feat2Title'), d:t('feat2Desc')},
            {e:'📈', t1:t('feat3Title'), d:t('feat3Desc')},
          ].map((f,i) => (
            <div key={i} className="glass-card rounded-xl p-7 transition-all">
              <div className="text-3xl mb-4">{f.e}</div>
              <h3 className="font-bold text-[17px] mb-2.5 tracking-tight">{f.t1}</h3>
              <p className="leading-relaxed text-sm" style={{color:'var(--text-secondary)'}}>{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="px-10 pb-16 max-w-5xl mx-auto w-full">
        <div className="rounded-2xl p-7" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>Starter</p>
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-3xl font-black">99,000 UZS / month</h2>
              <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                Candle replay, saved sessions, trade journal, strategy checklists, and analytics.
              </p>
            </div>
            <Link href="/auth/register" className="inline-flex rounded-xl px-5 py-3 text-sm font-bold text-white" style={{ background: 'var(--accent)' }}>
              Start Practice
            </Link>
          </div>
        </div>
      </section>

      <footer className="px-10 py-5 flex justify-between items-center flex-wrap gap-3" style={{borderTop:'1px solid var(--border-subtle)'}}>
        <span className="font-black" style={{color:'var(--text-secondary)'}}>TradeLab</span>
        <div className="flex flex-wrap items-center gap-4 text-xs" style={{color:'var(--text-muted)'}}>
          <span>Powered by Dukascopy historical tick data</span>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/refund-policy">Refunds</Link>
          <Link href="/support">Support</Link>
        </div>
      </footer>
    </div>
  )
}
