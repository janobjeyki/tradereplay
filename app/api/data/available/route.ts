import { NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'

interface Candle { time: number }

export async function GET() {
  const dir = path.join(process.cwd(), 'public', 'data')
  const entries = await fs.readdir(dir)
  const files = entries.filter(f => f.endsWith('-h1-2010-now.json'))

  const symbols: { symbol: string; start: string; end: string }[] = []
  for (const file of files) {
    const symbol = file.replace('-h1-2010-now.json', '').toUpperCase()
    try {
      const raw = await fs.readFile(path.join(dir, file), 'utf8')
      const candles = JSON.parse(raw) as Candle[]
      if (!candles.length) continue
      const start = new Date(candles[0].time * 1000).toISOString().slice(0, 10)
      const end = new Date(candles[candles.length - 1].time * 1000).toISOString().slice(0, 10)
      symbols.push({ symbol, start, end })
    } catch {}
  }

  symbols.sort((a, b) => a.symbol.localeCompare(b.symbol))
  return NextResponse.json({ symbols })
}
