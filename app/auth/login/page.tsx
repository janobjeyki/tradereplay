'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/contexts/LangContext'
import { Button, Input, Alert } from '@/components/ui'
import { TradeLabLogo } from '@/components/ui/Brand'

export default function LoginPage() {
  const { t } = useLang()
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetMode, setResetMode] = useState(false)

  async function handleLogin() {
    if (!email || !password) { setError(t('fillAllFields')); return }
    setLoading(true); setError('')
    const { error: err } = await createClient().auth.signInWithPassword({ email, password })
    if (err) { setError(err.message); setLoading(false); return }
    router.push('/dashboard/sessions')
  }

  async function handleForgotPassword() {
    if (!email) { setError('Enter your email address first'); return }
    setLoading(true); setError('')
    const { error: err } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/verify?type=recovery`,
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setResetSent(true)
  }

  return (
    <div className="flex flex-col gap-6">
      <TradeLabLogo className="w-[130px] mx-auto" />
      <div className="text-center">
        <h1 className="font-black text-2xl">{resetMode ? 'Reset Password' : t('welcomeBack')}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {resetMode ? 'Enter your email and we\'ll send a reset link' : t('signInContinue')}
        </p>
      </div>

      {error && <Alert type="error" message={error} />}
      {resetSent && (
        <Alert type="success" message="Password reset email sent! Check your inbox." />
      )}

      <div className="flex flex-col gap-3">
        <Input
          label={t('emailLabel')}
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => { setEmail(e.target.value); setError('') }}
          onKeyDown={e => { if (e.key === 'Enter' && !resetMode) handleLogin() }}
        />
        {!resetMode && (
          <Input
            label={t('passwordLabel')}
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            onKeyDown={e => { if (e.key === 'Enter') handleLogin() }}
          />
        )}
      </div>

      {!resetMode ? (
        <>
          <div className="text-right -mt-1">
            <button
              type="button"
              className="text-xs cursor-pointer bg-transparent border-none p-0"
              style={{ color: 'var(--accent)' }}
              onClick={() => { setResetMode(true); setError('') }}>
              {t('forgotPassword')}
            </button>
          </div>
          <Button variant="primary" size="lg" className="w-full" loading={loading} onClick={handleLogin}>
            {t('continueBtn')}
          </Button>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <Button variant="primary" size="lg" className="w-full" loading={loading} onClick={handleForgotPassword}>
            Send Reset Link
          </Button>
          <Button variant="ghost" size="lg" className="w-full" onClick={() => { setResetMode(false); setResetSent(false); setError('') }}>
            Back to Login
          </Button>
        </div>
      )}

      <p className="text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        {t('noAccount')}{' '}
        <Link href="/auth/register" style={{ color: 'var(--accent)' }}>{t('signUpLink')}</Link>
      </p>
    </div>
  )
}
