export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
}

export const DUKASCOPY_FOREX_AND_GOLD_SYMBOLS = [
  'AUDUSD', 'EURAUD', 'EURCAD', 'EURGBP', 'EURJPY', 'EURUSD',
  'GBPAUD', 'GBPCAD', 'GBPJPY', 'GBPUSD', 'NZDUSD', 'USDCAD',
  'USDCHF', 'USDJPY', 'XAUUSD',
] as const

export type DukascopySymbol = typeof DUKASCOPY_FOREX_AND_GOLD_SYMBOLS[number]

export const DUKASCOPY_MULTIPLIER: Record<DukascopySymbol, number> = {
  EURUSD: 100000,
  GBPUSD: 100000,
  USDCHF: 100000,
  AUDUSD: 100000,
  USDCAD: 100000,
  NZDUSD: 100000,
  EURGBP: 100000,
  EURAUD: 100000,
  EURCAD: 100000,
  GBPAUD: 100000,
  GBPCAD: 100000,
  USDJPY: 1000,
  EURJPY: 1000,
  GBPJPY: 1000,
  XAUUSD: 100,
}

export const DEFAULT_MARKET_DATA_START = '2010-01-01'

/** Filename for the locally-stored M1 data for a given symbol */
export function m1Filename(symbol: string): string {
  return `${symbol.toLowerCase()}-m1-2010-now.json`
}

export function dukascopyDayUrl(symbol: string, day: Date): string {
  return `https://datafeed.dukascopy.com/datafeed/${symbol}/${day.getUTCFullYear()}/${String(day.getUTCMonth()).padStart(2, '0')}/${String(day.getUTCDate()).padStart(2, '0')}/BID_candles_min_1.bi5`
}

export function getTodayUtcDateString() {
  return new Date().toISOString().slice(0, 10)
}

// ── LZ4 / bi5 decoding helpers (shared by sync route & candles route) ───────

export function lz4BlockDecode(src: Buffer): Buffer {
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

export function decodeLZ4Frame(buf: Buffer): Buffer {
  let p = 4
  if (buf.readUInt32LE(0) !== 0x184D2204) throw new Error('Not LZ4 frame')
  const flg = buf[p++]
  p++ // BD byte
  if ((flg >> 3) & 1) p += 8 // content size
  p++ // header checksum
  const chunks: Buffer[] = []
  while (p < buf.length) {
    const bsLE = buf.readUInt32LE(p); p += 4
    if (bsLE === 0) break
    const uncompressed = Boolean(bsLE & 0x80000000)
    const dataSize = bsLE & 0x7fffffff
    const block = buf.slice(p, p + dataSize); p += dataSize
    if ((flg >> 4) & 1) p += 4 // block checksum
    chunks.push(uncompressed ? block : lz4BlockDecode(block))
  }
  return Buffer.concat(chunks)
}

/** Parse raw decompressed bi5 bytes into M1 Candle array */
export function parseM1Records(buf: Buffer, mult: number, dayMs: number): Candle[] {
  const out: Candle[] = []
  for (let i = 0; i + 24 <= buf.length; i += 24) {
    const msOffset = buf.readUInt32BE(i)
    const open  = buf.readInt32BE(i + 4)  / mult
    const high  = buf.readInt32BE(i + 8)  / mult
    const low   = buf.readInt32BE(i + 12) / mult
    const close = buf.readInt32BE(i + 16) / mult
    if (open <= 0 || high <= 0 || low <= 0 || close <= 0) continue
    out.push({ time: Math.floor((dayMs + msOffset) / 1000), open, high, low, close })
  }
  return out
}

/** Fetch + decode one day of M1 candles from Dukascopy */
export async function fetchDayM1(
  symbol: string,
  day: Date,
  mult: number,
  log?: (msg: string) => void,
): Promise<Candle[]> {
  const url = dukascopyDayUrl(symbol, day)
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
    if (!res.ok) {
      log?.(`${symbol} ${day.toISOString().slice(0,10)} HTTP ${res.status}`)
      return []
    }
    const ab = await res.arrayBuffer()
    if (!ab.byteLength) return [] // weekend / holiday — normal
    return parseM1Records(decodeLZ4Frame(Buffer.from(ab)), mult, day.getTime())
  } catch (err) {
    log?.(`${symbol} ${day.toISOString().slice(0,10)} fetch error: ${String(err)}`)
    return []
  }
}

/** List all weekdays (Mon–Fri) between two date strings (inclusive) */
export function tradingDaysBetween(start: string, end: string): Date[] {
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
