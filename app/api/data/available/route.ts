import { NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'

interface Candle { time: number }

const DUKASCOPY_PAIRS = [
  'AUDUSD', 'EURAUD', 'EURCAD', 'EURGBP', 'EURJPY', 'EURUSD',
  'GBPAUD', 'GBPCAD', 'GBPJPY', 'GBPUSD', 'NZDUSD', 'USDCAD',
  'USDCHF', 'USDJPY', 'XAUUSD',
] as const

export async function GET() {
  const dir = path.join(process.cwd(), 'public', 'data')
  const entries = await fs.readdir(dir)
  const files = entries.filter(f => f.endsWith('-h1-2010-now.json'))
  const bySymbol = new Map(files.map((f) => [f.replace('-h1-2010-now.json', '').toUpperCase(), f]))

  const symbols: { symbol: string; start: string; end: string; downloaded: boolean }[] = []
  for (const symbol of DUKASCOPY_PAIRS) {
    const file = bySymbol.get(symbol)
    if (!file) {
      symbols.push({ symbol, start: '2010-01-01', end: new Date().toISOString().slice(0, 10), downloaded: false })
      continue
    }
    try {
      const raw = await fs.readFile(path.join(dir, file), 'utf8')
      const candles = JSON.parse(raw) as Candle[]
      if (!candles.length) {
        symbols.push({ symbol, start: '2010-01-01', end: new Date().toISOString().slice(0, 10), downloaded: false })
        continue
      }
      const start = new Date(candles[0].time * 1000).toISOString().slice(0, 10)
      const end = new Date(candles[candles.length - 1].time * 1000).toISOString().slice(0, 10)
      symbols.push({ symbol, start, end, downloaded: true })
    } catch {
      symbols.push({ symbol, start: '2010-01-01', end: new Date().toISOString().slice(0, 10), downloaded: false })
    }
  }

  symbols.sort((a, b) => a.symbol.localeCompare(b.symbol))
  return NextResponse.json({ symbols })
}
