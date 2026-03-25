'use client'

import Link from 'next/link'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLang } from '@/contexts/LangContext'

function VerifyContent() {
  const { t }  = useLang()
  const params = useSearchParams()
  const email  = params.get('email') ?? 'your email'

  return (
    <div className="animate-fade-in text-center">
      <div className="w-16 h-16 rounded-2xl bg-[rgba(245,158,11,0.12)] border border-[rgba(245,158,11,0.3)]
        flex items-center justify-center text-3xl mx-auto mb-6">
        ✉️
      </div>
      <h1 className="font-black text-2xl tracking-tight mb-2.5">{t('verifyTitle')}</h1>
      <p className="text-sm text-[#8896a6] mb-1">{t('verifySubtitle')}</p>
      <p className="font-mono text-[#f59e0b] text-sm mb-5">{email}</p>
      <p className="text-sm text-[#5a6a7e] leading-relaxed mb-8 max-w-xs mx-auto">
        {t('verifyBody')}
      </p>
      <div className="flex flex-col items-center gap-3">
        <Link
          href="/auth/login"
          className="px-8 py-3 bg-[#f59e0b] text-black font-bold rounded-xl
            hover:bg-[#fbbf24] transition-all text-sm"
        >
          {t('continueToApp')} →
        </Link>
        <button
          className="text-sm text-[#8896a6] border border-[#232c3c] rounded-lg px-4 py-2
            hover:bg-[#181e27] hover:text-[#dde2ec] transition-all"
        >
          {t('resend')}
        </button>
        <Link href="/auth/login" className="text-xs text-[#f59e0b] hover:text-[#fbbf24] mt-1">
          {t('backToLogin')}
        </Link>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="text-center text-[#5a6a7e]">Loading…</div>}>
      <VerifyContent />
    </Suspense>
  )
}
