import { NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'
import { requireAdminUser } from '@/lib/admin/auth'
import {
  Candle,
  DEFAULT_MARKET_DATA_START,
  DUKASCOPY_FOREX_AND_GOLD_SYMBOLS,
  DUKASCOPY_MULTIPLIER,
  dukascopyDayUrl,
  getTodayUtcDateString,
} from '@/lib/marketData'

function tradingDays(start: string, end: string): Date[] {
  const out: Date[] = []
  const cur = new Date(`${start}T00:00:00Z`)
  const last = new Date(`${end}T00:00:00Z`)
  while (cur <= last) {
    const dow = cur.getUTCDay()
    if (dow !== 0 && dow !== 6) out.push(new Date(cur))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return out
}

function lz4BlockDecode(src: Buffer): Buffer { const dst: number[] = []; let sp = 0; while (sp < src.length) { const token = src[sp++]; let litLen = token >>> 4; if (litLen === 15) { let x: number; do { x = src[sp++]; litLen += x } while (x === 255) } for (let i = 0; i < litLen; i++) dst.push(src[sp++]); if (sp >= src.length) break; const offset = src[sp] | (src[sp + 1] << 8); sp += 2; let matchLen = (token & 0xf) + 4; if ((token & 0xf) === 15) { let x: number; do { x = src[sp++]; matchLen += x } while (x === 255) } const mStart = dst.length - offset; for (let i = 0; i < matchLen; i++) dst.push(dst[mStart + i]) } return Buffer.from(dst) }
function decodeLZ4Frame(buf: Buffer): Buffer { let p = 4; if (buf.readUInt32LE(0) !== 0x184D2204) throw new Error('Not LZ4 frame'); const flg = buf[p++]; p++; if ((flg >> 3) & 1) p += 8; p++; const chunks: Buffer[] = []; while (p < buf.length) { const bsLE = buf.readUInt32LE(p); p += 4; if (bsLE === 0) break; const uncompressed = Boolean(bsLE & 0x80000000); const dataSize = bsLE & 0x7fffffff; const block = buf.slice(p, p + dataSize); p += dataSize; if ((flg >> 4) & 1) p += 4; chunks.push(uncompressed ? block : lz4BlockDecode(block)) } return Buffer.concat(chunks) }
function parseRecords(buf: Buffer, mult: number, dayMs: number): Candle[] { const out: Candle[] = []; for (let i = 0; i + 24 <= buf.length; i += 24) { const msOffset = buf.readUInt32BE(i); const open = buf.readInt32BE(i + 4) / mult; const high = buf.readInt32BE(i + 8) / mult; const low = buf.readInt32BE(i + 12) / mult; const close = buf.readInt32BE(i + 16) / mult; if (open <= 0 || high <= 0 || low <= 0 || close <= 0) continue; out.push({ time: Math.floor((dayMs + msOffset) / 1000), open, high, low, close }) } return out }
function toH1(mins: Candle[]): Candle[] { const map = new Map<number, Candle>(); for (const c of mins) { const key = Math.floor(c.time / 3600) * 3600; const h = map.get(key); if (!h) map.set(key, { ...c, time: key }); else { if (c.high > h.high) h.high = c.high; if (c.low < h.low) h.low = c.low; h.close = c.close } } return [...map.values()].sort((a, b) => a.time - b.time) }

async function fetchDay(sym: string, day: Date, mult: number): Promise<Candle[]> {
  try {
    const res = await fetch(dukascopyDayUrl(sym, day), { signal: AbortSignal.timeout(12000) })
    if (!res.ok) return []
    const ab = await res.arrayBuffer()
    if (!ab.byteLength) return []
    return parseRecords(decodeLZ4Frame(Buffer.from(ab)), mult, day.getTime())
  } catch {
    return []
  }
}

async function syncSymbol(symbol: keyof typeof DUKASCOPY_MULTIPLIER, outDir: string, days: Date[]) {
  const mins: Candle[] = []
  for (let i = 0; i < days.length; i += 20) {
    const chunk = days.slice(i, i + 20)
    const results = await Promise.all(chunk.map((day) => fetchDay(symbol, day, DUKASCOPY_MULTIPLIER[symbol])))
    for (const candles of results) mins.push(...candles)
  }
  const outPath = path.join(outDir, `${symbol.toLowerCase()}-h1-2010-now.json`)
  await fs.writeFile(outPath, JSON.stringify(toH1(mins)))
  return { symbol, candles: mins.length }
}

export async function POST() {
  const adminAuth = await requireAdminUser()
  if (adminAuth.error) return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status })

  const outDir = path.join(process.cwd(), 'public', 'data')
  await fs.mkdir(outDir, { recursive: true })

  const syncedTo = getTodayUtcDateString()
  const days = tradingDays(DEFAULT_MARKET_DATA_START, syncedTo)
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
