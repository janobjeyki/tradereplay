import { NextRequest, NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'
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

// Vercel serverless — allow up to 5 min per symbol call
export const maxDuration = 300

// On Vercel the deployment filesystem is read-only.
// We write to /tmp which persists within the same Lambda instance.
// Subsequent Lambda instances won't have the file — use the standalone
// script (scripts/download-market-data.mjs) for persistent storage on
// a self-hosted server, or store data in a database / object storage.
export const DATA_DIR = '/tmp/market-data'

export async function POST(req: NextRequest) {
  const adminAuth = await requireAdminUser()
  if (adminAuth.error) return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status })

  // Accept an optional ?symbol=EURUSD to sync a single symbol.
  // The admin panel calls this endpoint once per symbol so each call
  // finishes well within the timeout.
  const { searchParams } = req.nextUrl
  const requestedSymbol = searchParams.get('symbol')?.toUpperCase()

  const symbolsToSync = requestedSymbol
    ? DUKASCOPY_FOREX_AND_GOLD_SYMBOLS.filter(s => s === requestedSymbol)
    : [...DUKASCOPY_FOREX_AND_GOLD_SYMBOLS]

  if (symbolsToSync.length === 0) {
    return NextResponse.json({ error: `Unknown symbol: ${requestedSymbol}` }, { status: 400 })
  }

  await fs.mkdir(DATA_DIR, { recursive: true })

  const syncedTo = getTodayUtcDateString()
  const days = tradingDaysBetween(DEFAULT_MARKET_DATA_START, syncedTo)
  const result = []

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
      const chunk = days.slice(i, i + 30)
      const results = await Promise.all(chunk.map(day => fetchDayM1(symbol, day, mult)))
      for (const candles of results) all.push(...candles)
    }

    all.sort((a, b) => a.time - b.time)

    const outPath = path.join(DATA_DIR, m1Filename(symbol))
    await fs.writeFile(outPath, JSON.stringify(all))

    return { symbol, candles: all.length }
  } catch (err) {
    return { symbol, candles: 0, error: String(err) }
  }
}
