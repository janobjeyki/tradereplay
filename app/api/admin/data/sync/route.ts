import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/admin/requireAdmin'
import {
  DEFAULT_MARKET_DATA_START,
  DUKASCOPY_FOREX_AND_GOLD_SYMBOLS,
  DUKASCOPY_MULTIPLIER,
  fetchDayM1,
  getTodayUtcDateString,
  tradingDaysBetween,
} from '@/lib/marketData'
import { uploadSymbolData, getSymbolData } from '@/lib/marketStorage'

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
    const mult    = DUKASCOPY_MULTIPLIER[symbol as keyof typeof DUKASCOPY_MULTIPLIER]
    const today   = getTodayUtcDateString()
    const end     = `${year}-12-31` < today ? `${year}-12-31` : today
    const days    = tradingDaysBetween(`${year}-01-01`, end)

    const fetchErrors: string[] = []
    const log = (msg: string) => { if (fetchErrors.length < 5) fetchErrors.push(msg) }

    // Download this year's M1 data
    const yearCandles: { time: number; open: number; high: number; low: number; close: number }[] = []
    for (let i = 0; i < days.length; i += 30) {
      const chunk   = days.slice(i, i + 30)
      const results = await Promise.all(chunk.map(day => fetchDayM1(symbol, day, mult, log)))
      for (const c of results) yearCandles.push(...c)
    }
    yearCandles.sort((a, b) => a.time - b.time)

    // If we got zero candles and had fetch errors, the upstream feed is likely blocked
    if (yearCandles.length === 0 && fetchErrors.length > 0) {
      return NextResponse.json({
        ok: false, symbol, year, candles: 0,
        error: `Market data feed unreachable from server. Sample errors: ${fetchErrors.slice(0, 3).join(' | ')}`,
        fetchErrors,
      }, { status: 502 })
    }

    // Merge with existing stored data (other years)
    let existing: typeof yearCandles = []
    try { existing = await getSymbolData(symbol) } catch { /* first sync for this symbol */ }

    const yearStartTs = new Date(`${year}-01-01T00:00:00Z`).getTime() / 1000
    const yearStopTs  = new Date(`${year + 1}-01-01T00:00:00Z`).getTime() / 1000
    const kept        = existing.filter(c => c.time < yearStartTs || c.time >= yearStopTs)
    const merged      = [...kept, ...yearCandles].sort((a, b) => a.time - b.time)

    await uploadSymbolData(symbol, merged)

    return NextResponse.json({
      ok: true, symbol, year,
      candles: yearCandles.length,
      total: merged.length,
      fetchErrors: fetchErrors.length > 0 ? fetchErrors : undefined,
    })
  } catch (err) {
    return NextResponse.json({ ok: false, symbol, year, error: String(err) }, { status: 500 })
  }
}
