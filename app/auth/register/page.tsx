'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/contexts/LangContext'
import { Button, Input, Alert } from '@/components/ui'

export default function RegisterPage() {
  const { t } = useLang()
  const router = useRouter()
  const [email,   setEmail]   = useState('')
  const [pass,    setPass]    = useState('')
  const [confirm, setConfirm] = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRegister() {
    if (!email||!pass||!confirm) { setError(t('fillAllFields')); return }
    if (!email.includes('@'))    { setError(t('invalidEmail')); return }
    if (pass.length < 6)         { setError(t('passwordTooShort')); return }
    if (pass !== confirm)        { setError(t('passwordsMismatch')); return }
    setLoading(true); setError('')
    const { error: err } = await createClient().auth.signUp({
      email, password: pass,
      options: { emailRedirectTo: `${window.location.origin}/auth/verify` },
    })
    if (err) { setError(err.message); setLoading(false); return }
    router.push(`/auth/verify?email=${encodeURIComponent(email)}`)
  }

  return (
    <div className="animate-fade-in">
      <h1 className="font-black text-2xl tracking-tight text-center mb-1" style={{color:'var(--text-primary)'}}>{t('register')}</h1>
      <p className="text-center text-sm mb-7" style={{color:'var(--text-muted)'}}>
        {t('alreadyHaveAccount')}{' '}
        <Link href="/auth/login" style={{color:'var(--accent)'}}>{t('login')}</Link>
      </p>
      <div className="rounded-2xl p-6 flex flex-col gap-4" style={{background:'var(--bg-secondary)', border:'1px solid var(--border-subtle)'}}>
        <Alert type="error" message={error}/>
        <Input label={t('emailLabel')} type="email" placeholder="you@example.com" value={email} onChange={e=>{setEmail(e.target.value);setError('')}}/>
        <Input label={t('passwordLabel')} type="password" placeholder="••••••••" value={pass} onChange={e=>{setPass(e.target.value);setError('')}}/>
        <Input label={t('confirmPasswordLabel')} type="password" placeholder="••••••••" value={confirm}
          onChange={e=>{setConfirm(e.target.value);setError('')}} onKeyDown={e=>e.key==='Enter'&&handleRegister()}/>
        <Button variant="primary" size="lg" className="w-full mt-1" loading={loading} onClick={handleRegister}>
          {t('continueBtn')}
        </Button>
      </div>
    </div>
  )
}
