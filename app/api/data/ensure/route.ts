import { NextRequest, NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'

interface Candle { time: number; open: number; high: number; low: number; close: number }

const MULTIPLIER: Record<string, number> = {
  EURUSD: 100000, GBPUSD: 100000, USDCHF: 100000, AUDUSD: 100000,
  USDCAD: 100000, NZDUSD: 100000, EURGBP: 100000, EURAUD: 100000,
  EURCAD: 100000, GBPAUD: 100000, GBPCAD: 100000,
  USDJPY: 1000, EURJPY: 1000, GBPJPY: 1000,
  XAUUSD: 100,
}

function dukaUrl(sym: string, d: Date): string {
  return `https://datafeed.dukascopy.com/datafeed/${sym}/${d.getUTCFullYear()}/${String(d.getUTCMonth()).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/BID_candles_min_1.bi5`
}
function tradingDays(start: string, end: string): Date[] {
  const out: Date[] = []
  const cur = new Date(start + 'T00:00:00Z')
  const last = new Date(end + 'T00:00:00Z')
  while (cur <= last) {
    const dow = cur.getUTCDay()
    if (dow !== 0 && dow !== 6) out.push(new Date(cur))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return out
}
function lz4BlockDecode(src: Buffer): Buffer {
  const dst: number[] = []
  let sp = 0
  while (sp < src.length) {
    const token = src[sp++]
    let litLen = token >>> 4
    if (litLen === 15) { let x: number; do { x = src[sp++]; litLen += x } while (x === 255) }
    for (let i = 0; i < litLen; i++) dst.push(src[sp++])
    if (sp >= src.length) break
    const offset = src[sp] | (src[sp + 1] << 8); sp += 2
    let matchLen = (token & 0xf) + 4
    if ((token & 0xf) === 15) { let x: number; do { x = src[sp++]; matchLen += x } while (x === 255) }
    const mStart = dst.length - offset
    for (let i = 0; i < matchLen; i++) dst.push(dst[mStart + i])
  }
  return Buffer.from(dst)
}
function decodeLZ4Frame(buf: Buffer): Buffer {
  let p = 4
  if (buf.readUInt32LE(0) !== 0x184D2204) throw new Error('Not LZ4 frame')
  const flg = buf[p++]
  p++
  if ((flg >> 3) & 1) p += 8
  p++
  const chunks: Buffer[] = []
  while (p < buf.length) {
    const bsLE = buf.readUInt32LE(p); p += 4
    if (bsLE === 0) break
    const uncompressed = Boolean(bsLE & 0x80000000)
    const dataSize = bsLE & 0x7fffffff
    const block = buf.slice(p, p + dataSize); p += dataSize
    if ((flg >> 4) & 1) p += 4
    chunks.push(uncompressed ? block : lz4BlockDecode(block))
  }
  return Buffer.concat(chunks)
}
function parseRecords(buf: Buffer, mult: number, dayMs: number): Candle[] {
  const out: Candle[] = []
  for (let i = 0; i + 24 <= buf.length; i += 24) {
    const msOffset = buf.readUInt32BE(i)
    const open = buf.readInt32BE(i + 4) / mult
    const high = buf.readInt32BE(i + 8) / mult
    const low = buf.readInt32BE(i + 12) / mult
    const close = buf.readInt32BE(i + 16) / mult
    if (open <= 0 || high <= 0 || low <= 0 || close <= 0) continue
    out.push({ time: Math.floor((dayMs + msOffset) / 1000), open, high, low, close })
  }
  return out
}
function toH1(mins: Candle[]): Candle[] {
  const map = new Map<number, Candle>()
  for (const c of mins) {
    const key = Math.floor(c.time / 3600) * 3600
    const h = map.get(key)
    if (!h) map.set(key, { ...c, time: key })
    else {
      if (c.high > h.high) h.high = c.high
      if (c.low < h.low) h.low = c.low
      h.close = c.close
    }
  }
  return [...map.values()].sort((a, b) => a.time - b.time)
}
async function fetchDay(sym: string, day: Date, mult: number): Promise<Candle[]> {
  try {
    const res = await fetch(dukaUrl(sym, day), { signal: AbortSignal.timeout(12000) })
    if (!res.ok) return []
    const ab = await res.arrayBuffer()
    if (!ab.byteLength) return []
    return parseRecords(decodeLZ4Frame(Buffer.from(ab)), mult, day.getTime())
  } catch {
    return []
  }
}

export async function POST(req: NextRequest) {
  const symbol = ((await req.json())?.symbol ?? '').toUpperCase()
  if (!MULTIPLIER[symbol]) return NextResponse.json({ error: 'Unsupported symbol' }, { status: 400 })

  const outDir = path.join(process.cwd(), 'public', 'data')
  const outPath = path.join(outDir, `${symbol.toLowerCase()}-h1-2010-now.json`)
  try {
    await fs.access(outPath)
    return NextResponse.json({ ok: true, downloaded: true, cached: true })
  } catch {}

  await fs.mkdir(outDir, { recursive: true })
  const days = tradingDays('2010-01-01', new Date().toISOString().slice(0, 10))
  const mins: Candle[] = []
  for (let i = 0; i < days.length; i += 20) {
    const chunk = days.slice(i, i + 20)
    const results = await Promise.all(chunk.map((d) => fetchDay(symbol, d, MULTIPLIER[symbol])))
    for (const candles of results) mins.push(...candles)
  }
  const h1 = toH1(mins)
  await fs.writeFile(outPath, JSON.stringify(h1))
  return NextResponse.json({ ok: true, downloaded: true, cached: false, count: h1.length })
}
