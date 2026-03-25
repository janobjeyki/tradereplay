'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/contexts/LangContext'
import { Button, Input, Alert } from '@/components/ui'

export default function LoginPage() {
  const { t } = useLang()
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleLogin() {
    if (!email || !password) { setError(t('fillAllFields')); return }
    setLoading(true); setError('')
    const { error: err } = await createClient().auth.signInWithPassword({ email, password })
    if (err) { setError(err.message); setLoading(false); return }
    router.push('/dashboard/sessions')
  }

  return (
    <div className="animate-fade-in w-full max-w-md mx-auto">
      <h1 className="font-black text-2xl tracking-tight text-left mb-1" style={{color:'var(--text-primary)'}}>{t('login')}</h1>
      <p className="text-left text-sm mb-7" style={{color:'var(--text-muted)'}}>
        {t('noAccount')}{' '}
        <Link href="/auth/register" style={{color:'var(--accent)'}}>{t('register')}</Link>
      </p>
      <div className="rounded-2xl p-6 flex flex-col gap-4" style={{background:'var(--bg-secondary)', border:'1px solid var(--border-subtle)'}}>
        <Alert type="error" message={error}/>
        <Input label={t('emailLabel')} type="email" placeholder="you@example.com" value={email}
          onChange={e=>{setEmail(e.target.value);setError('')}} onKeyDown={e=>e.key==='Enter'&&handleLogin()}/>
        <Input label={t('passwordLabel')} type="password" placeholder="••••••••" value={password}
          onChange={e=>{setPassword(e.target.value);setError('')}} onKeyDown={e=>e.key==='Enter'&&handleLogin()}/>
        <div className="text-right -mt-1">
          <span className="text-xs cursor-pointer" style={{color:'var(--accent)'}}>{t('forgotPassword')}</span>
        </div>
        <Button variant="primary" size="lg" className="w-full mt-1" loading={loading} onClick={handleLogin}>
          {t('continueBtn')}
        </Button>
      </div>
    </div>
  )
}
