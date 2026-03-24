'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LangContext'
import { useTheme } from '@/contexts/ThemeContext'
import type { Language } from '@/types'
import { Button, Input, Select, Alert, ThemeToggle } from '@/components/ui'

export default function SettingsPage() {
  const { t, lang, setLang } = useLang()
  const { user, profile, signOut, refreshProfile } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [savedMsg,    setSavedMsg]    = useState('')
  const [saving,      setSaving]      = useState(false)
  const [npw,   setNpw]   = useState('')
  const [pwMsg, setPwMsg] = useState('')

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

  const cardStyle = { background:'var(--bg-secondary)', border:'1px solid var(--border-subtle)' }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-7 py-5 shrink-0" style={{borderBottom:'1px solid var(--border-subtle)'}}>
        <h1 className="font-black text-2xl tracking-tight" style={{color:'var(--text-primary)'}}>{t('accountSettings')}</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-7 py-6 max-w-xl">

        {/* Profile */}
        <div className="rounded-xl p-6 mb-4" style={cardStyle}>
          <h2 className="font-bold text-base mb-5" style={{color:'var(--text-primary)'}}>{t('accountSettings')}</h2>
          <div className="flex flex-col gap-4">
            {savedMsg && <Alert type="success" message={savedMsg}/>}
            <Input label={t('displayName')} value={displayName} placeholder="Your name" onChange={e=>setDisplayName(e.target.value)}/>
            <Input label={t('emailLabel')} value={user?.email??''} disabled type="email" className="opacity-50 cursor-not-allowed"/>
            <Select label={t('language')} value={lang} onChange={e=>setLang(e.target.value as Language)}>
              <option value="en">EN — English</option>
              <option value="ru">RU — Русский</option>
              <option value="uz">UZ — O'zbek</option>
            </Select>

            {/* Theme toggle row */}
            <div>
              <label className="text-[11px] tracking-wider uppercase block mb-2" style={{color:'var(--text-muted)'}}>
                Appearance
              </label>
              <div className="flex items-center gap-3">
                <ThemeToggle theme={theme} onToggle={toggleTheme}/>
                <span className="text-sm" style={{color:'var(--text-secondary)'}}>
                  {theme === 'dark' ? 'Dark mode' : 'Light mode'}
                </span>
              </div>
            </div>

            <Button variant="primary" className="w-fit" loading={saving} onClick={saveProfile}>{t('saveChanges')}</Button>
          </div>
        </div>

        {/* Subscription */}
        <div className="rounded-xl p-6 mb-4" style={cardStyle}>
          <h2 className="font-bold text-base mb-5" style={{color:'var(--text-primary)'}}>Subscription</h2>
          <div className="flex flex-col gap-3">
            <div className="rounded-lg px-4 py-3" style={{ background:'var(--bg-tertiary)', border:'1px solid var(--border-subtle)' }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold" style={{ color:'var(--text-primary)' }}>
                    {profile?.subscription_plan ?? 'Starter'}
                  </p>
                  <p className="text-xs mt-1" style={{ color:'var(--text-muted)' }}>
                    Status: {profile?.subscription_status ?? 'inactive'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold" style={{ color:'var(--text-primary)' }}>
                    ${Number(profile?.subscription_price ?? 0).toFixed(2)}
                  </p>
                  <p className="text-xs mt-1" style={{ color:'var(--text-muted)' }}>
                    {profile?.payment_method ? `via ${String(profile.payment_method).toUpperCase()}` : 'No payment method'}
                  </p>
                </div>
              </div>
            </div>
            <p className="text-sm" style={{ color:'var(--text-muted)' }}>
              An active subscription is required to create new sessions.
            </p>
          </div>
        </div>

        {/* Password */}
        <div className="rounded-xl p-6 mb-4" style={cardStyle}>
          <h2 className="font-bold text-base mb-5" style={{color:'var(--text-primary)'}}>{t('changePassword')}</h2>
          <div className="flex flex-col gap-4">
            {pwMsg && <Alert type={pwMsg.includes('updated') ? 'success' : 'error'} message={pwMsg}/>}
            <Input label={t('currentPassword')} type="password" placeholder="••••••••"/>
            <Input label={t('newPassword')} type="password" placeholder="••••••••" value={npw} onChange={e=>setNpw(e.target.value)}/>
            <Button variant="primary" className="w-fit" onClick={updatePassword}>{t('updatePassword')}</Button>
          </div>
        </div>

        {/* Danger zone */}
        <div className="rounded-xl p-6" style={{background:'var(--bg-secondary)', border:'1px solid var(--red-muted)'}}>
          <h2 className="font-bold text-base mb-2" style={{color:'var(--red)'}}>{t('dangerZone')}</h2>
          <p className="text-sm mb-4" style={{color:'var(--text-muted)'}}>{t('deleteWarning')}</p>
          <Button variant="danger" size="sm">{t('deleteAccount')}</Button>
        </div>
      </div>
    </div>
  )
}
