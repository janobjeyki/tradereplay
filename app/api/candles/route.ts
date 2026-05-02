import { NextRequest, NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'
import { m1Filename, DUKASCOPY_MULTIPLIER } from '@/lib/marketData'
import { DATA_DIR } from '@/app/api/admin/data/sync/route'

interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const symbol    = (searchParams.get('symbol') ?? '').toUpperCase()
  const startDate = searchParams.get('start') ?? ''
  const endDate   = searchParams.get('end')   ?? ''

  if (!symbol || !startDate || !endDate) {
    return NextResponse.json({ error: 'symbol, start and end are required' }, { status: 400 })
  }

  if (!(symbol in DUKASCOPY_MULTIPLIER)) {
    return NextResponse.json({ error: `Unsupported symbol: ${symbol}` }, { status: 400 })
  }

  const filePath = path.join(DATA_DIR, m1Filename(symbol))

  let all: Candle[]
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    all = JSON.parse(raw) as Candle[]
  } catch {
    return NextResponse.json(
      { error: `No local data found for ${symbol}. Ask admin to run Sync All Market Data.` },
      { status: 404 },
    )
  }

  // Include 3 months of context before startDate so indicators can warm up
  const contextStart = new Date(`${startDate}T00:00:00Z`)
  contextStart.setUTCMonth(contextStart.getUTCMonth() - 3)
  const contextStartTs = Math.floor(contextStart.getTime() / 1000)
  const endTs = Math.floor(new Date(`${endDate}T00:00:00Z`).getTime() / 1000) + 86400

  // Binary search for start of window
  let lo = 0, hi = all.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (all[mid].time < contextStartTs) lo = mid + 1
    else hi = mid
  }
  const candles = all.slice(lo).filter(c => c.time <= endTs)

  return NextResponse.json({ candles, count: candles.length })
}
