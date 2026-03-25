'use client'
import Link from 'next/link'
import { useTheme } from '@/contexts/ThemeContext'
import { ThemeToggle } from '@/components/ui'
import { TradeLabLogo } from '@/components/ui/Brand'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme()

  const shellBackground = theme === 'light'
    ? 'rgba(245, 249, 255, 0.92)'
    : 'rgba(17, 25, 39, 0.9)'

  const promoBackground = theme === 'light'
    ? 'linear-gradient(180deg, rgba(233, 240, 250, 0.98) 0%, rgba(222, 232, 247, 0.98) 100%)'
    : 'linear-gradient(180deg, rgba(18,28,44,0.96) 0%, rgba(11,17,32,0.96) 100%)'

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="fixed inset-0 pointer-events-none" style={{background:'radial-gradient(circle at 20% 20%, rgba(126,151,255,0.18) 0%, transparent 26%), radial-gradient(circle at 80% 15%, rgba(244,87,131,0.14) 0%, transparent 24%)'}}/>
      <div className="fixed top-4 right-4">
        <ThemeToggle theme={theme} onToggle={toggleTheme}/>
      </div>
      <div className="w-full max-w-5xl relative z-10 grid md:grid-cols-[1fr_420px] overflow-hidden rounded-[28px] border" style={{borderColor:'var(--border-default)', background:shellBackground, boxShadow:'var(--page-shadow)'}}>
        <div className="hidden md:flex flex-col justify-between px-10 py-12" style={{borderRight:'1px solid var(--border-subtle)', background:promoBackground}}>
          <div>
            <Link href="/landing" className="inline-flex items-center gap-2.5 mb-8 group">
              <TradeLabLogo className="w-[148px]" />
            </Link>
            <p className="text-[11px] uppercase tracking-[0.18em]" style={{color:'var(--text-muted)'}}>Trading workspace</p>
            <h1 className="font-black text-5xl leading-[1.02] mt-4">Enter the desk with a clearer edge.</h1>
            <p className="text-base mt-5 max-w-md" style={{color:'var(--text-secondary)'}}>
              Structured replay, cleaner analytics, and a more focused interface from the first screen.
            </p>
          </div>
          <div className="glass-card rounded-2xl p-5">
            <p className="text-sm font-semibold">Ready for sessions, analytics, and access control.</p>
            <p className="text-sm mt-2" style={{color:'var(--text-secondary)'}}>The auth flow now uses the same darker dashboard atmosphere as the app itself.</p>
          </div>
        </div>
        <div className="px-6 py-8 md:px-8 md:py-10 flex items-center">
          <div className="text-center mb-8 md:hidden">
            <Link href="/landing" className="inline-flex items-center gap-2.5 mb-2 group">
              <TradeLabLogo className="w-[144px]" />
            </Link>
          </div>
          <div className="w-full">
            {children}
            <p className="mt-5 text-xs text-left" style={{color:'var(--text-muted)'}}>
              <Link href="/landing" style={{color:'var(--accent)'}}>← Back to home</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
