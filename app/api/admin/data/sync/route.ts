import { NextResponse } from 'next/server'
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

// Allow up to 5 minutes on Vercel Pro / self-hosted.
// On Vercel Hobby (60 s limit) run the standalone script instead.
export const maxDuration = 300

async function syncSymbol(
  symbol: keyof typeof DUKASCOPY_MULTIPLIER,
  outDir: string,
  days: Date[],
): Promise<{ symbol: string; candles: number }> {
  const mult = DUKASCOPY_MULTIPLIER[symbol]
  const all: { time: number; open: number; high: number; low: number; close: number }[] = []

  // Fetch in batches of 20 concurrent days
  for (let i = 0; i < days.length; i += 20) {
    const chunk = days.slice(i, i + 20)
    const results = await Promise.all(chunk.map((day) => fetchDayM1(symbol, day, mult)))
    for (const candles of results) all.push(...candles)
  }

  // Sort by time (should already be ordered but be safe)
  all.sort((a, b) => a.time - b.time)

  const outPath = path.join(outDir, m1Filename(symbol))
  await fs.writeFile(outPath, JSON.stringify(all))

  return { symbol, candles: all.length }
}

export async function POST() {
  const adminAuth = await requireAdminUser()
  if (adminAuth.error) return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status })

  const outDir = path.join(process.cwd(), 'public', 'data')
  await fs.mkdir(outDir, { recursive: true })

  const syncedTo = getTodayUtcDateString()
  const days = tradingDaysBetween(DEFAULT_MARKET_DATA_START, syncedTo)
  const result = []

  for (const symbol of DUKASCOPY_FOREX_AND_GOLD_SYMBOLS) {
    result.push(await syncSymbol(symbol, outDir, days))
  }

  return NextResponse.json({
    ok: true,
    syncedBy: adminAuth.user?.email ?? null,
    start: DEFAULT_MARKET_DATA_START,
    end: syncedTo,
    symbols: DUKASCOPY_FOREX_AND_GOLD_SYMBOLS,
    result,
  })
}
