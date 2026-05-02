import { NextResponse } from 'next/server'
import { DUKASCOPY_FOREX_AND_GOLD_SYMBOLS } from '@/lib/marketData'
import { listStoredSymbols } from '@/lib/marketStorage'

export async function GET() {
  const stored = await listStoredSymbols()
  const storedMap = new Map(stored.map(s => [s.symbol, s]))

  const symbols = DUKASCOPY_FOREX_AND_GOLD_SYMBOLS.map(symbol => {
    const info = storedMap.get(symbol)
    return {
      symbol,
      downloaded: !!info,
      updatedAt:  info?.updatedAt ?? null,
      bytes:      info?.bytes ?? 0,
    }
  })

  return NextResponse.json({ symbols: symbols.sort((a, b) => a.symbol.localeCompare(b.symbol)) })
}
