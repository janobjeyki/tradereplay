import fs from 'node:fs/promises'
import path from 'node:path'

const MULTIPLIER = {
  EURUSD: 100000, GBPUSD: 100000, USDCHF: 100000, AUDUSD: 100000,
  USDCAD: 100000, NZDUSD: 100000, EURGBP: 100000, EURAUD: 100000,
  EURCAD: 100000, GBPAUD: 100000, GBPCAD: 100000,
  USDJPY: 1000, EURJPY: 1000, GBPJPY: 1000,
  XAUUSD: 100,
}

const SYMBOLS = Object.keys(MULTIPLIER)
const START = '2010-01-01'
const END = new Date().toISOString().slice(0, 10)
const OUT_DIR = path.resolve('public/data')

function lz4BlockDecode(src) {
  const dst = []
  let sp = 0
  while (sp < src.length) {
    const token = src[sp++]
    let litLen = token >>> 4
    if (litLen === 15) { let x; do { x = src[sp++]; litLen += x } while (x === 255) }
    for (let i = 0; i < litLen; i++) dst.push(src[sp++])
    if (sp >= src.length) break
    const offset = src[sp] | (src[sp + 1] << 8); sp += 2
    let matchLen = (token & 0xf) + 4
    if ((token & 0xf) === 15) { let x; do { x = src[sp++]; matchLen += x } while (x === 255) }
    const mStart = dst.length - offset
    for (let i = 0; i < matchLen; i++) dst.push(dst[mStart + i])
  }
  return Buffer.from(dst)
}

function decodeLZ4Frame(buf) {
  let p = 4
  if (buf.readUInt32LE(0) !== 0x184D2204) throw new Error('Not LZ4 frame')
  const flg = buf[p++]
  p++
  if ((flg >> 3) & 1) p += 8
  p++
  const chunks = []
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

function parseRecords(buf, mult, dayMs) {
  const out = []
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

function toH1(mins) {
  const map = new Map()
  for (const c of mins) {
    const hKey = Math.floor(c.time / 3600) * 3600
    const h = map.get(hKey)
    if (!h) map.set(hKey, { time: hKey, open: c.open, high: c.high, low: c.low, close: c.close })
    else {
      if (c.high > h.high) h.high = c.high
      if (c.low < h.low) h.low = c.low
      h.close = c.close
    }
  }
  return Array.from(map.values()).sort((a, b) => a.time - b.time)
}

function tradingDays(start, end) {
  const days = []
  const cur = new Date(start + 'T00:00:00Z')
  const last = new Date(end + 'T00:00:00Z')
  while (cur <= last) {
    const dow = cur.getUTCDay()
    if (dow !== 0 && dow !== 6) days.push(new Date(cur))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return days
}

function dukaUrl(sym, d) {
  return `https://datafeed.dukascopy.com/datafeed/${sym}/${d.getUTCFullYear()}/${String(d.getUTCMonth()).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/BID_candles_min_1.bi5`
}

async function fetchDay(sym, date, mult) {
  try {
    const res = await fetch(dukaUrl(sym, date), { signal: AbortSignal.timeout(12000) })
    if (!res.ok) return []
    const ab = await res.arrayBuffer()
    if (!ab.byteLength) return []
    return parseRecords(decodeLZ4Frame(Buffer.from(ab)), mult, date.getTime())
  } catch {
    return []
  }
}

async function downloadSymbol(sym) {
  const mult = MULTIPLIER[sym]
  const days = tradingDays(START, END)
  const all = []
  for (let i = 0; i < days.length; i += 20) {
    const chunk = days.slice(i, i + 20)
    const results = await Promise.all(chunk.map((d) => fetchDay(sym, d, mult)))
    for (const r of results) all.push(...r)
    if ((i / 20) % 10 === 0) console.log(`${sym}: ${Math.min(i + 20, days.length)}/${days.length} days`)
  }
  const h1 = toH1(all)
  const outPath = path.join(OUT_DIR, `${sym.toLowerCase()}-h1-2010-now.json`)
  await fs.writeFile(outPath, JSON.stringify(h1))
  console.log(`${sym}: wrote ${h1.length} H1 candles -> ${outPath}`)
}

await fs.mkdir(OUT_DIR, { recursive: true })
for (const sym of SYMBOLS) {
  await downloadSymbol(sym)
}
console.log('Done')
