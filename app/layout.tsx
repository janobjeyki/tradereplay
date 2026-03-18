import type { Metadata } from 'next'
import './globals.css'
import { LangProvider }  from '@/contexts/LangContext'
import { AuthProvider }  from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'

export const metadata: Metadata = {
  title: 'BackTest — Candle Replay Platform',
  description: 'Replay real Dukascopy historical data candle-by-candle.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <ThemeProvider>
          <AuthProvider>
            <LangProvider>
              {children}
            </LangProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
