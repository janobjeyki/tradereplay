'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LangContext'
import { useTheme } from '@/contexts/ThemeContext'
import { ThemeToggle } from '@/components/ui'
import { cn } from '@/lib/utils'

const NAV = [
  { href:'/dashboard/sessions',  key:'sessions'  as const,
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="2.5" rx="1.2" fill="currentColor" opacity=".7"/><rect x="1" y="7" width="10" height="2.5" rx="1.2" fill="currentColor"/><rect x="1" y="11" width="12" height="2.5" rx="1.2" fill="currentColor" opacity=".7"/></svg> },
  { href:'/dashboard/analytics', key:'analytics' as const,
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><polyline points="1,13 4,8 7,10 10,5 13,7 15,3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { href:'/dashboard/settings',  key:'settings'  as const,
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.93 2.93l1.41 1.41M11.66 11.66l1.41 1.41M2.93 13.07l1.41-1.41M11.66 4.34l1.41-1.41" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const { user, signOut } = useAuth()
  const { t }    = useLang()
  const { theme, toggleTheme } = useTheme()

  async function handleLogout() {
    await signOut()
    router.push('/auth/login')
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{background:'var(--bg-primary)'}}>

      {/* Sidebar */}
      <aside className="w-52 shrink-0 flex flex-col overflow-hidden" style={{background:'var(--bg-secondary)', borderRight:'1px solid var(--border-subtle)'}}>

        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-3.5" style={{borderBottom:'1px solid var(--border-subtle)'}}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:'var(--accent)'}}>
              <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
                <path d="M3 13l3-5 3 3 3-6 3 4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="font-black text-base tracking-tight" style={{color:'var(--text-primary)'}}>BackTest</span>
          </div>
          <ThemeToggle theme={theme} onToggle={toggleTheme}/>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-2.5 overflow-y-auto">
          {NAV.map(item => {
            const active = pathname.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium mb-0.5 transition-all"
                style={{
                  background: active ? 'var(--accent-muted)' : 'transparent',
                  color:      active ? 'var(--accent)'       : 'var(--text-secondary)',
                }}
                onMouseEnter={e => { if(!active)(e.currentTarget.style.background='var(--bg-elevated)') }}
                onMouseLeave={e => { if(!active)(e.currentTarget.style.background='transparent') }}
              >
                {item.icon}
                {t(item.key)}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-2 py-2" style={{borderTop:'1px solid var(--border-subtle)'}}>
          <div className="px-3 py-2 mb-1">
            <p className="text-xs truncate" style={{color:'var(--text-muted)'}}>{user?.email}</p>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={{color:'var(--red)'}}
            onMouseEnter={e=>{e.currentTarget.style.background='var(--bg-elevated)'}}
            onMouseLeave={e=>{e.currentTarget.style.background='transparent'}}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t('logout')}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        {children}
      </main>
    </div>
  )
}
