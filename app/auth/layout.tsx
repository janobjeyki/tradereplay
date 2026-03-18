'use client'
import Link from 'next/link'
import { useTheme } from '@/contexts/ThemeContext'
import { ThemeToggle } from '@/components/ui'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme()
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{background:'var(--bg-primary)'}}>
      <div className="fixed inset-0 pointer-events-none" style={{background:'radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.07) 0%, transparent 60%)'}}/>
      <div className="fixed top-4 right-4">
        <ThemeToggle theme={theme} onToggle={toggleTheme}/>
      </div>
      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <Link href="/landing" className="inline-flex items-center gap-2.5 mb-2 group">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{background:'var(--accent)'}}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M3 13l3-5 3 3 3-6 3 4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="font-black text-lg tracking-tight" style={{color:'var(--text-primary)'}}>BackTest</span>
          </Link>
        </div>
        {children}
        <p className="text-center mt-5 text-xs" style={{color:'var(--text-muted)'}}>
          <Link href="/landing" style={{color:'var(--accent)'}}>← Back to home</Link>
        </p>
      </div>
    </div>
  )
}
