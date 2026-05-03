'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LangContext'
import { useTheme } from '@/contexts/ThemeContext'
import type { Language } from '@/types'
import { Button, Input, Select, Alert, ThemeToggle } from '@/components/ui'
import { START_PLAN_LABEL, START_PLAN_PRICE_UZS } from '@/lib/payments/plans'

function planDisplayName(plan: string | null | undefined) {
  if (!plan) return START_PLAN_LABEL
  return plan.charAt(0).toUpperCase() + plan.slice(1)
}

export default function SettingsPage() {
  const { t, lang, setLang } = useLang()
  const { user, profile, refreshProfile } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [savedMsg,    setSavedMsg]    = useState('')
  const [saving,      setSaving]      = useState(false)
  const [npw,         setNpw]         = useState('')
  const [pwMsg,       setPwMsg]       = useState('')

  useEffect(() => { if (profile) setDisplayName(profile.display_name ?? '') }, [profile])

  async function saveProfile() {
    setSaving(true); setSavedMsg('')
    await createClient().from('profiles').update({ display_name: displayName, language: lang }).eq('id', user!.id)
    await refreshProfile()
    setSavedMsg('Saved!'); setSaving(false)
    setTimeout(() => setSavedMsg(''), 3000)
  }

  async function updatePassword() {
    if (!npw || npw.length < 6) { setPwMsg('New password must be at least 6 characters'); return }
    const { error } = await createClient().auth.updateUser({ password: npw })
    setPwMsg(error ? error.message : 'Password updated!')
    setNpw(''); setTimeout(() => setPwMsg(''), 4000)
  }

  const cardStyle = { background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 sm:px-7 py-4 sm:py-5 shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 className="font-black text-xl sm:text-2xl tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {t('accountSettings')}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-7 py-6 w-full max-w-xl">

        {/* Profile */}
        <div className="rounded-xl p-5 sm:p-6 mb-4" style={cardStyle}>
          <h2 className="font-bold text-base mb-4" style={{ color: 'var(--text-primary)' }}>Profile</h2>
          <div className="flex flex-col gap-4">
            {savedMsg && <Alert type="success" message={savedMsg} />}
            <Input label={t('displayName')} value={displayName} placeholder="Your name"
              onChange={e => setDisplayName(e.target.value)} />
            <Input label={t('emailLabel')} value={user?.email ?? ''} disabled type="email"
              className="opacity-50 cursor-not-allowed" />
            <Select label={t('language')} value={lang} onChange={e => setLang(e.target.value as Language)}>
              <option value="en">EN — English</option>
              <option value="ru">RU — Русский</option>
              <option value="uz">UZ — O&apos;zbek</option>
            </Select>
            <div>
              <label className="text-[11px] tracking-wider uppercase block mb-2" style={{ color: 'var(--text-muted)' }}>
                Appearance
              </label>
              <div className="flex items-center gap-3">
                <ThemeToggle theme={theme} onToggle={toggleTheme} />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {theme === 'dark' ? 'Dark mode' : 'Light mode'}
                </span>
              </div>
            </div>
            <Button variant="primary" className="w-fit" loading={saving} onClick={saveProfile}>
              {t('saveChanges')}
            </Button>
          </div>
        </div>

        {/* Subscription */}
        <div className="rounded-xl p-5 sm:p-6 mb-4" style={cardStyle}>
          <h2 className="font-bold text-base mb-4" style={{ color: 'var(--text-primary)' }}>Subscription</h2>
          <div className="flex flex-col gap-3">
            <div className="rounded-lg px-4 py-3" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {planDisplayName(profile?.subscription_plan)}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Status: {profile?.subscription_status ?? 'inactive'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {(Number(profile?.subscription_price ?? 0) || START_PLAN_PRICE_UZS).toLocaleString()} UZS
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {profile?.payment_method ? `Click / ${String(profile.payment_method).toUpperCase()}` : 'No payment method'}
                  </p>
                  {profile?.subscription_expires_at && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      Renews {new Date(profile.subscription_expires_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <Button variant="ghost" className="w-fit" onClick={() => router.push('/dashboard/subscription')}>
              Manage Subscription
            </Button>
          </div>
        </div>

        {/* Password */}
        <div className="rounded-xl p-5 sm:p-6" style={cardStyle}>
          <h2 className="font-bold text-base mb-4" style={{ color: 'var(--text-primary)' }}>{t('changePassword')}</h2>
          <div className="flex flex-col gap-4">
            {pwMsg && <Alert type={pwMsg.includes('updated') ? 'success' : 'error'} message={pwMsg} />}
            <Input label={t('newPassword')} type="password" placeholder="Min. 6 characters"
              value={npw} onChange={e => setNpw(e.target.value)} />
            <Button variant="primary" className="w-fit" onClick={updatePassword}>
              {t('updatePassword')}
            </Button>
          </div>
        </div>

      </div>
    </div>
  )
}
