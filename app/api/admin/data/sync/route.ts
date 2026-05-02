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
import { uploadSymbolData, getSymbolData } from '@/lib/marketStorage'

// Each request handles one symbol + one year — easily fits in 60s (Hobby)
// or 300s (Pro). The admin panel loops over all years client-side.
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const adminAuth = await requireAdminUser()
  if (adminAuth.error) return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status })

  const params = req.nextUrl.searchParams
  const symbol = params.get('symbol')?.toUpperCase()
  const year   = parseInt(params.get('year') ?? '', 10)

  if (!symbol || !DUKASCOPY_FOREX_AND_GOLD_SYMBOLS.includes(symbol as any)) {
    return NextResponse.json({ error: `Unknown symbol: ${symbol}` }, { status: 400 })
  }
  if (!year || year < 2010 || year > new Date().getUTCFullYear()) {
    return NextResponse.json({ error: `Invalid year: ${year}` }, { status: 400 })
  }

  try {
    const mult     = DUKASCOPY_MULTIPLIER[symbol as keyof typeof DUKASCOPY_MULTIPLIER]
    const today    = getTodayUtcDateString()
    const yearEnd  = `${year}-12-31`
    const end      = yearEnd < today ? yearEnd : today
    const start    = `${year}-01-01`
    const days     = tradingDaysBetween(start, end)

    // Download this year's M1 data
    const yearCandles: { time: number; open: number; high: number; low: number; close: number }[] = []
    for (let i = 0; i < days.length; i += 30) {
      const chunk   = days.slice(i, i + 30)
      const results = await Promise.all(chunk.map(day => fetchDayM1(symbol, day, mult)))
      for (const c of results) yearCandles.push(...c)
    }
    yearCandles.sort((a, b) => a.time - b.time)

    // Merge with existing stored data for other years
    let existing: typeof yearCandles = []
    try { existing = await getSymbolData(symbol) } catch { /* first sync */ }

    // Remove any candles already stored for this year, then merge
    const yearStart = new Date(`${year}-01-01T00:00:00Z`).getTime() / 1000
    const yearStop  = new Date(`${year + 1}-01-01T00:00:00Z`).getTime() / 1000
    const kept      = existing.filter(c => c.time < yearStart || c.time >= yearStop)
    const merged    = [...kept, ...yearCandles].sort((a, b) => a.time - b.time)

    await uploadSymbolData(symbol, merged)

    return NextResponse.json({ ok: true, symbol, year, candles: yearCandles.length, total: merged.length })
  } catch (err) {
    return NextResponse.json({ ok: false, symbol, year, error: String(err) }, { status: 500 })
  }
}
