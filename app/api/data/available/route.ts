import { DATA_DIR } from '@/app/api/admin/data/sync/route'
import { NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'
import {
  DEFAULT_MARKET_DATA_START,
  DUKASCOPY_FOREX_AND_GOLD_SYMBOLS,
  getTodayUtcDateString,
  m1Filename,
} from '@/lib/marketData'

interface Candle { time: number }

export async function GET() {
  const dir = DATA_DIR

  const symbols: { symbol: string; start: string; end: string; downloaded: boolean; candleCount: number }[] = []

  for (const symbol of DUKASCOPY_FOREX_AND_GOLD_SYMBOLS) {
    const filePath = path.join(dir, m1Filename(symbol))
    try {
      const raw = await fs.readFile(filePath, 'utf8')
      const candles = JSON.parse(raw) as Candle[]
      if (!candles.length) {
        symbols.push({ symbol, start: DEFAULT_MARKET_DATA_START, end: getTodayUtcDateString(), downloaded: false, candleCount: 0 })
        continue
      }
      const start = new Date(candles[0].time * 1000).toISOString().slice(0, 10)
      const end   = new Date(candles[candles.length - 1].time * 1000).toISOString().slice(0, 10)
      symbols.push({ symbol, start, end, downloaded: true, candleCount: candles.length })
    } catch {
      symbols.push({ symbol, start: DEFAULT_MARKET_DATA_START, end: getTodayUtcDateString(), downloaded: false, candleCount: 0 })
    }
  }

  return NextResponse.json({ symbols: symbols.sort((a, b) => a.symbol.localeCompare(b.symbol)) })
}
