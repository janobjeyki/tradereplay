import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/admin/requireAdmin'
import {
  DEFAULT_MARKET_DATA_START,
  DUKASCOPY_FOREX_AND_GOLD_SYMBOLS,
  DUKASCOPY_MULTIPLIER,
  fetchDayM1,
  getTodayUtcDateString,
  m1Filename,
  tradingDaysBetween,
} from '@/lib/marketData'
import { uploadSymbolData } from '@/lib/marketStorage'

// Allow up to 5 minutes per symbol call on Vercel Pro
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const adminAuth = await requireAdminUser()
  if (adminAuth.error) return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status })

  const requestedSymbol = req.nextUrl.searchParams.get('symbol')?.toUpperCase()

  const symbolsToSync = requestedSymbol
    ? DUKASCOPY_FOREX_AND_GOLD_SYMBOLS.filter(s => s === requestedSymbol)
    : [...DUKASCOPY_FOREX_AND_GOLD_SYMBOLS]

  if (symbolsToSync.length === 0) {
    return NextResponse.json({ error: `Unknown symbol: ${requestedSymbol}` }, { status: 400 })
  }

  const syncedTo = getTodayUtcDateString()
  const days     = tradingDaysBetween(DEFAULT_MARKET_DATA_START, syncedTo)
  const result   = []

  for (const symbol of symbolsToSync) {
    result.push(await syncSymbol(symbol, days))
  }

  return NextResponse.json({
    ok: true,
    syncedBy: adminAuth.user?.email ?? null,
    start: DEFAULT_MARKET_DATA_START,
    end: syncedTo,
    result,
  })
}

async function syncSymbol(
  symbol: keyof typeof DUKASCOPY_MULTIPLIER,
  days: Date[],
): Promise<{ symbol: string; candles: number; error?: string }> {
  try {
    const mult = DUKASCOPY_MULTIPLIER[symbol]
    const all: { time: number; open: number; high: number; low: number; close: number }[] = []

    // Fetch in batches of 30 concurrent days
    for (let i = 0; i < days.length; i += 30) {
      const chunk   = days.slice(i, i + 30)
      const results = await Promise.all(chunk.map(day => fetchDayM1(symbol, day, mult)))
      for (const candles of results) all.push(...candles)
    }

    all.sort((a, b) => a.time - b.time)

    // Upload to Supabase Storage (persistent, survives Lambda restarts)
    await uploadSymbolData(symbol, all)

    return { symbol, candles: all.length }
  } catch (err) {
    return { symbol, candles: 0, error: String(err) }
  }
}
