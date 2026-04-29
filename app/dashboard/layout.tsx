'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LangContext'
import { useTheme } from '@/contexts/ThemeContext'
import { Badge, ThemeToggle } from '@/components/ui'
import { Onboarding } from '@/components/ui/Onboarding'
import { TradeLabLogo } from '@/components/ui/Brand'

const NAV = [
  { href:'/dashboard/sessions',  label:'Sessions', sub:'Sessions and replay', icon: 'sessions' },
  { href:'/dashboard/strategy',  label:'Strategies', sub:'Your playbooks', icon: 'strategies' },
  { href:'/dashboard/analytics', label:'Analytics', sub:'Performance view', icon: 'analytics' },
  { href:'/dashboard/subscription', label:'Subscription', sub:'Access and billing', icon: 'subscription' },
  { href:'/dashboard/settings',  label:'Settings', sub:'Theme and account', icon: 'settings' },
]

const ADMIN_EMAILS = ['bekhruzjke@gmail.com']

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/dashboard/sessions': { title: 'Trading Dashboard', subtitle: 'Create sessions, control replay, and launch into the chart quickly.' },
  '/dashboard/strategy': { title: 'Strategy Library', subtitle: 'Organize ideas, compare systems, and track what really works.' },
  '/dashboard/analytics': { title: 'Performance Statistics', subtitle: 'Review equity, monthly performance, and recent trade behavior.' },
  '/dashboard/subscription': { title: 'Subscription Center', subtitle: 'Manage Click card binding and access status.' },
  '/dashboard/settings': { title: 'Account Settings', subtitle: 'Profile, password, language, and visual preferences live here.' },
  '/dashboard/admin': { title: 'Admin Panel', subtitle: 'Manage users, gift access, extend subscriptions, and inspect payments.' },
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const { user, signOut, profile } = useAuth()
  const { t }    = useLang()
  const { theme, toggleTheme } = useTheme()
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('bt_onboarded')) {
      setShowOnboarding(true)
    }
  }, [])

  async function handleLogout() {
    await signOut()
    router.push('/auth/login')
  }

  const meta = PAGE_META[pathname] ?? {
    title: 'BackTest Dashboard',
    subtitle: 'A focused control room for replay, analytics, and account access.',
  }
  const isAdmin = ADMIN_EMAILS.includes((user?.email || '').toLowerCase())
  const navItems = isAdmin
    ? [...NAV, { href:'/dashboard/admin', label:'Admin', sub:'Users and access', icon: 'admin' }]
    : NAV

  const workspaceLabel = pathname.replace('/dashboard/', '') || 'sessions'

  return (
    <>
      {showOnboarding && <Onboarding onDone={() => setShowOnboarding(false)} />}
      <div className="app-shell">
        <div className="dashboard-shell">
          <aside className="shell-sidebar flex flex-col border-r" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="px-7 pt-7 pb-5">
              <div className="flex flex-col gap-2">
                <TradeLabLogo className="w-[140px]" />
                <p className="text-[11px] pl-1" style={{ color:'var(--text-muted)' }}>Trading desk</p>
              </div>
            </div>

            <nav className="flex-1 px-4">
              <div className="flex flex-col gap-2.5">
                {navItems.map(item => {
                  const active = pathname.startsWith(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      data-tour={item.href.split('/').pop()}
                      className="rounded-2xl px-4 py-3 transition-all"
                      style={{
                        background: active
                          ? theme === 'light'
                            ? 'linear-gradient(135deg, rgba(70,88,122,0.96), rgba(84,102,136,0.92))'
                            : 'linear-gradient(135deg, rgba(49,70,108,0.95), rgba(37,50,80,0.9))'
                          : theme === 'light'
                            ? 'rgba(255,255,255,0.08)'
                            : 'transparent',
                        border: active
                          ? `1px solid ${theme === 'light' ? 'rgba(72, 89, 123, 0.36)' : 'var(--border-strong)'}`
                          : `1px solid ${theme === 'light' ? 'rgba(126, 147, 184, 0.14)' : 'transparent'}`,
                        boxShadow: active && theme === 'light' ? '0 8px 18px rgba(72, 93, 132, 0.12)' : 'none',
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-xl flex items-center justify-center text-sm" style={{
                          background: active
                            ? theme === 'light'
                              ? 'rgba(245, 113, 150, 0.18)'
                              : 'var(--accent-muted)'
                            : theme === 'light'
                              ? 'rgba(229, 236, 247, 0.9)'
                              : 'var(--bg-tertiary)',
                          color: active
                            ? theme === 'light'
                              ? '#ff8dad'
                              : 'var(--accent)'
                            : theme === 'light'
                              ? '#4e648c'
                              : 'var(--text-secondary)',
                        }}>
                          <NavIcon name={item.icon as NavIconName} active={active} theme={theme} />
                        </span>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: active ? '#f8fbff' : theme === 'light' ? '#263754' : 'var(--text-secondary)' }}>{item.label}</p>
                          <p className="text-xs" style={{ color: active ? 'rgba(233,241,255,0.74)' : theme === 'light' ? '#6c7f9f' : 'var(--text-muted)' }}>{item.sub}</p>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </nav>

          </aside>

          <main className="shell-main">
            <div className="page-header">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="neon-dot" />
                  <p className="text-xs uppercase tracking-[0.18em]" style={{ color:'var(--text-muted)' }}>Dashboard / Overview</p>
                </div>
                <div>
                  <h1 className="font-black text-[34px] leading-tight">{meta.title}</h1>
                  <p className="text-sm mt-2 max-w-2xl" style={{ color:'var(--text-secondary)' }}>{meta.subtitle}</p>
                </div>
              </div>
            </div>
            {children}
          </main>

          <aside className="shell-aside border-l px-6 py-8" style={{ borderColor:'var(--border-subtle)' }}>
            <div className="glass-card rounded-[28px] p-6 text-center">
              <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-2xl font-black" style={{ background:'linear-gradient(135deg, rgba(126,151,255,0.3), rgba(70,215,164,0.2))', border:'2px solid rgba(255,255,255,0.1)' }}>
                {(profile?.display_name || user?.email || 'T').slice(0, 1).toUpperCase()}
              </div>
              <p className="font-black text-3xl mt-4 break-words">{profile?.display_name || user?.email?.split('@')[0] || 'Trader'}</p>
              <p className="text-sm mt-1 break-all" style={{ color:'var(--text-secondary)', overflowWrap:'anywhere' }}>{user?.email}</p>
              <div className="grid grid-cols-3 gap-3 mt-6 text-center">
                <div>
                  <p className="text-[11px] uppercase tracking-widest" style={{ color:'var(--text-muted)' }}>Plan</p>
                  <p className="font-semibold mt-2">{profile?.subscription_plan ?? 'Starter'}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest" style={{ color:'var(--text-muted)' }}>Mode</p>
                  <p className="font-semibold mt-2">{theme}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest" style={{ color:'var(--text-muted)' }}>Lang</p>
                  <p className="font-semibold mt-2">{profile?.language ?? 'en'}</p>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[26px] leading-none">Desk Status</h3>
                <Badge variant={profile?.subscription_status === 'active' ? 'green' : 'red'}>
                  {profile?.subscription_status === 'active' ? 'Active' : 'Locked'}
                </Badge>
              </div>
              <div className="mt-4 grid gap-3">
                {[
                  { label: 'Subscription', value: profile?.subscription_status ?? 'inactive' },
                  { label: 'Payment', value: profile?.payment_method ? String(profile.payment_method).toUpperCase() : 'Not linked' },
                  { label: 'Workspace', value: workspaceLabel },
                ].map(item => (
                  <div key={item.label} className="glass-card rounded-2xl px-4 py-3.5">
                    <p className="text-[11px] uppercase tracking-widest" style={{ color:'var(--text-muted)' }}>{item.label}</p>
                    <p className="font-semibold mt-2">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 glass-card rounded-2xl p-4" style={theme === 'light' ? { background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(242,247,255,0.98) 100%)' } : undefined}>
                <p className="text-[11px] uppercase tracking-widest" style={{ color:'var(--text-muted)' }}>Theme</p>
                <div className="flex items-center justify-between mt-3">
                  <div>
                    <p className="text-sm font-semibold">{theme === 'dark' ? 'Dark' : 'Light'}</p>
                    <p className="text-xs" style={{ color:'var(--text-muted)' }}>System-ready palette</p>
                  </div>
                  <ThemeToggle theme={theme} onToggle={toggleTheme}/>
                </div>
              </div>

              <button onClick={handleLogout}
                className="mt-3 flex items-center justify-center gap-2 w-full px-4 py-3 rounded-2xl text-sm font-medium transition-all"
                style={{ color:'var(--red)', border:'1px solid var(--border-default)', background: theme === 'light' ? 'rgba(255,255,255,0.72)' : 'var(--bg-tertiary)' }}>
                {t('logout')}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}

type NavIconName = 'sessions' | 'strategies' | 'analytics' | 'subscription' | 'settings' | 'admin'

function NavIcon({ name, active, theme }: { name: NavIconName; active: boolean; theme: 'dark' | 'light' }) {
  const color = active ? (theme === 'light' ? '#ff8dad' : 'var(--accent)') : theme === 'light' ? '#4e648c' : 'var(--text-secondary)'

  switch (name) {
    case 'sessions':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M7 3v3M17 3v3M4 9h16M6 6h12a2 2 0 0 1 2 2v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8a2 2 0 0 1 2-2Z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    case 'strategies':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 18V9m7 9V6m7 12v-5" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
          <circle cx="5" cy="18" r="1.7" fill={color} />
          <circle cx="12" cy="6" r="1.7" fill={color} />
          <circle cx="19" cy="13" r="1.7" fill={color} />
        </svg>
      )
    case 'analytics':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 18h16M6 15l3-3 3 2 5-6 1 1" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M18 8h3v3" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    case 'subscription':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3.5" y="6" width="17" height="12" rx="2.5" stroke={color} strokeWidth="1.8"/>
          <path d="M3.5 10h17" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
          <path d="M7 15h3.5" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      )
    case 'settings':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 8.7A3.3 3.3 0 1 0 12 15.3A3.3 3.3 0 1 0 12 8.7Z" stroke={color} strokeWidth="1.8"/>
          <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.8 1.8 0 0 1 0 2.5 1.8 1.8 0 0 1-2.5 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a1.8 1.8 0 0 1-3.6 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1.8 1.8 0 0 1-2.5 0 1.8 1.8 0 0 1 0-2.5l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a1.8 1.8 0 0 1 0-3.6h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1.8 1.8 0 0 1 0-2.5 1.8 1.8 0 0 1 2.5 0l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a1.8 1.8 0 0 1 3.6 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1.8 1.8 0 0 1 2.5 0 1.8 1.8 0 0 1 0 2.5l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a1.8 1.8 0 0 1 0 3.6h-.2a1 1 0 0 0-.9.6Z" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    case 'admin':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3l7 3v5c0 4.2-2.8 7.9-7 10-4.2-2.1-7-5.8-7-10V6l7-3Z" stroke={color} strokeWidth="1.7" strokeLinejoin="round"/>
          <path d="M9 12l2 2 4-4" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
  }
}
