import { NextRequest, NextResponse } from 'next/server'

// ── Point multipliers per symbol ────────────────────────────────
const MULTIPLIER: Record<string, number> = {
  EURUSD:100000, GBPUSD:100000, USDCHF:100000, AUDUSD:100000,
  USDCAD:100000, NZDUSD:100000, EURGBP:100000, EURAUD:100000,
  EURCAD:100000, GBPAUD:100000, GBPCAD:100000,
  USDJPY:1000,   EURJPY:1000,   GBPJPY:1000,
  XAUUSD:100,    XAGUSD:1000,
  US30:10,       SPX500:100,    NAS100:100,    GER40:100,
}

// ── LZ4 frame decoder (handles Dukascopy bi5 format) ────────────
function lz4BlockDecode(src: Buffer): Buffer {
  const dst: number[] = []
  let sp = 0
  while (sp < src.length) {
    const token = src[sp++]
    // literals
    let litLen = token >>> 4
    if (litLen === 15) { let x: number; do { x = src[sp++]; litLen += x } while (x === 255) }
    for (let i = 0; i < litLen; i++) dst.push(src[sp++])
    if (sp >= src.length) break
    // match
    const offset = src[sp] | (src[sp + 1] << 8); sp += 2
    let matchLen = (token & 0xf) + 4
    if ((token & 0xf) === 15) { let x: number; do { x = src[sp++]; matchLen += x } while (x === 255) }
    const mStart = dst.length - offset
    for (let i = 0; i < matchLen; i++) dst.push(dst[mStart + i])
  }
  return Buffer.from(dst)
}

function decodeLZ4Frame(buf: Buffer): Buffer {
  let p = 0
  if (buf.readUInt32LE(0) !== 0x184D2204) throw new Error('Not LZ4 frame')
  p = 4
  const flg = buf[p++]
  p++ // BD byte
  if ((flg >> 3) & 1) p += 8  // content size
  p++ // header checksum
  const chunks: Buffer[] = []
  while (p < buf.length) {
    const bsLE = buf.readUInt32LE(p); p += 4
    if (bsLE === 0) break
    const uncompressed = Boolean(bsLE & 0x80000000)
    const dataSize = bsLE & 0x7fffffff
    const block = buf.slice(p, p + dataSize); p += dataSize
    if ((flg >> 4) & 1) p += 4  // block checksum
    chunks.push(uncompressed ? block : lz4BlockDecode(block))
  }
  return Buffer.concat(chunks)
}

// ── Parse decompressed candle records (24 bytes each) ───────────
interface MinCandle { time: number; open: number; high: number; low: number; close: number }

function parseRecords(buf: Buffer, mult: number, dayMs: number): MinCandle[] {
  const RECORD = 24
  const out: MinCandle[] = []
  for (let i = 0; i + RECORD <= buf.length; i += RECORD) {
    const msOffset = buf.readUInt32BE(i)
    const open     = buf.readInt32BE(i + 4)  / mult
    const high     = buf.readInt32BE(i + 8)  / mult
    const low      = buf.readInt32BE(i + 12) / mult
    const close    = buf.readInt32BE(i + 16) / mult
    if (open <= 0 || high <= 0 || low <= 0 || close <= 0) continue
    out.push({ time: Math.floor((dayMs + msOffset) / 1000), open, high, low, close })
  }
  return out
}

// ── Aggregate 1-min candles → H1 ───────────────────────────────
function toH1(mins: MinCandle[]): MinCandle[] {
  const map = new Map<number, MinCandle>()
  for (const c of mins) {
    const hKey = Math.floor(c.time / 3600) * 3600
    const h = map.get(hKey)
    if (!h) {
      map.set(hKey, { time: hKey, open: c.open, high: c.high, low: c.low, close: c.close })
    } else {
      if (c.high  > h.high) h.high  = c.high
      if (c.low   < h.low)  h.low   = c.low
      h.close = c.close
    }
  }
  return [...map.values()].sort((a, b) => a.time - b.time)
}

// ── Dukascopy URL builder ───────────────────────────────────────
function dukaUrl(sym: string, d: Date): string {
  const y  = d.getUTCFullYear()
  const mo = String(d.getUTCMonth()).padStart(2, '0')       // 0-based
  const da = String(d.getUTCDate()).padStart(2, '0')
  return `https://datafeed.dukascopy.com/datafeed/${sym}/${y}/${mo}/${da}/BID_candles_min_1.bi5`
}

// ── Enumerate trading days ──────────────────────────────────────
function tradingDays(start: string, end: string): Date[] {
  const days: Date[] = []
  const cur  = new Date(start + 'T00:00:00Z')
  const last = new Date(end   + 'T00:00:00Z')
  while (cur <= last) {
    const dow = cur.getUTCDay()
    if (dow !== 0 && dow !== 6) days.push(new Date(cur))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return days
}

// ── Fetch + decode one day ──────────────────────────────────────
async function fetchDay(sym: string, date: Date, mult: number): Promise<MinCandle[]> {
  try {
    const url = dukaUrl(sym, date)
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return []
    const ab  = await res.arrayBuffer()
    if (!ab.byteLength) return []
    const buf = Buffer.from(ab)
    const dec = decodeLZ4Frame(buf)
    return parseRecords(dec, mult, date.getTime())
  } catch {
    return []
  }
}

// ── Batch fetch (parallel, N at a time) ─────────────────────────
async function batchFetch(
  sym: string, days: Date[], mult: number, batchSize = 20
): Promise<MinCandle[]> {
  const all: MinCandle[] = []
  for (let i = 0; i < days.length; i += batchSize) {
    const chunk = days.slice(i, i + batchSize)
    const results = await Promise.all(chunk.map(d => fetchDay(sym, d, mult)))
    results.forEach(r => all.push(...r))
  }
  return all.sort((a, b) => a.time - b.time)
}

// ── Route handler ───────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const symbol    = (searchParams.get('symbol') ?? 'EURUSD').toUpperCase()
  const startDate = searchParams.get('start') ?? ''
  const endDate   = searchParams.get('end')   ?? ''

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'start and end required' }, { status: 400 })
  }

  const mult = MULTIPLIER[symbol] ?? 100000
  // Fetch 3 months of context before startDate + full selected range
  const contextStart = new Date(startDate + 'T00:00:00Z')
  contextStart.setUTCMonth(contextStart.getUTCMonth() - 3)
  const contextStartStr = contextStart.toISOString().slice(0, 10)

  const days = tradingDays(contextStartStr, endDate)

  // Cap at 400 days to avoid timeouts
  const cappedDays = days.slice(-400)

  const mins = await batchFetch(symbol, cappedDays, mult, 20)
  const h1   = toH1(mins)

  return NextResponse.json({ candles: h1, count: h1.length })
}
