'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { type Language } from '@/types'
import { getT, type TranslationKey } from '@/lib/i18n'

interface LangContextValue {
  lang: Language
  setLang: (l: Language) => void
  t: (key: TranslationKey) => string
}

const LangContext = createContext<LangContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (k) => k,
})

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('en')

  useEffect(() => {
    const stored = localStorage.getItem('lang') as Language | null
    if (stored && ['en', 'ru', 'uz'].includes(stored)) setLangState(stored)
  }, [])

  function setLang(l: Language) {
    setLangState(l)
    localStorage.setItem('lang', l)
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t: getT(lang) }}>
      {children}
    </LangContext.Provider>
  )
}

export const useLang = () => useContext(LangContext)
