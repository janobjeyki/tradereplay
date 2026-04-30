import { NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'
import { DEFAULT_MARKET_DATA_START, DUKASCOPY_FOREX_AND_GOLD_SYMBOLS, getTodayUtcDateString } from '@/lib/marketData'

interface Candle { time: number }

export async function GET() {
  const dir = path.join(process.cwd(), 'public', 'data')
  let entries: string[] = []
  try {
    entries = await fs.readdir(dir)
  } catch {
    entries = []
  }

  const files = entries.filter(file => file.endsWith('-h1-2010-now.json'))
  const bySymbol = new Map(files.map((file) => [file.replace('-h1-2010-now.json', '').toUpperCase(), file]))

  const symbols: { symbol: string; start: string; end: string; downloaded: boolean }[] = []
  for (const symbol of DUKASCOPY_FOREX_AND_GOLD_SYMBOLS) {
    const file = bySymbol.get(symbol)
    if (!file) {
      symbols.push({ symbol, start: DEFAULT_MARKET_DATA_START, end: getTodayUtcDateString(), downloaded: false })
      continue
    }
    try {
      const raw = await fs.readFile(path.join(dir, file), 'utf8')
      const candles = JSON.parse(raw) as Candle[]
      if (!candles.length) {
        symbols.push({ symbol, start: DEFAULT_MARKET_DATA_START, end: getTodayUtcDateString(), downloaded: false })
        continue
      }
      const start = new Date(candles[0].time * 1000).toISOString().slice(0, 10)
      const end = new Date(candles[candles.length - 1].time * 1000).toISOString().slice(0, 10)
      symbols.push({ symbol, start, end, downloaded: true })
    } catch {
      symbols.push({ symbol, start: DEFAULT_MARKET_DATA_START, end: getTodayUtcDateString(), downloaded: false })
    }
  }

  return NextResponse.json({ symbols: symbols.sort((a, b) => a.symbol.localeCompare(b.symbol)) })
}
