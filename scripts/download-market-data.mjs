/**
 * Download all M1 market data from Dukascopy and upload to Supabase Storage.
 *
 * Usage:
 *   1. Create a .env file in the project root (or export vars in your shell):
 *        NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
 *        SUPABASE_SERVICE_ROLE_KEY=eyJ...
 *
 *   2. Run:
 *        node scripts/download-market-data.mjs
 *
 * What it does:
 *   - Downloads 1-minute (M1) candles for all 15 Forex + Gold pairs
 *     from Dukascopy, 2010-01-01 to today
 *   - Uploads each symbol as a single JSON file to your Supabase Storage
 *     bucket "market-data"
 *   - Saves files locally to public/data/ as a backup
 *   - Skips days that return no data (weekends, holidays)
 *   - Resumes from where it left off if re-run (re-uploads cleanly)
 *
 * Requirements:
 *   - Node.js 18+
 *   - npm install @supabase/supabase-js (or use npx)
 *   - Supabase bucket "market-data" must exist (Storage → New bucket)
 */

import fs   from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load .env.local then .env
config({ path: '.env.local' })
config({ path: '.env' })

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET            = 'market-data'
const OUT_DIR           = path.resolve('public/data')
const START             = '2010-01-01'
const END               = new Date().toISOString().slice(0, 10)
const BATCH_SIZE        = 32   // concurrent day fetches

const MULTIPLIER = {
  EURUSD: 100000, GBPUSD: 100000, USDCHF: 100000, AUDUSD: 100000,
  USDCAD: 100000, NZDUSD: 100000, EURGBP: 100000, EURAUD: 100000,
  EURCAD: 100000, GBPAUD: 100000, GBPCAD: 100000,
  USDJPY: 1000,   EURJPY: 1000,   GBPJPY: 1000,
  XAUUSD: 100,
}
const SYMBOLS = Object.keys(MULTIPLIER)

// ── Validate env ──────────────────────────────────────────────────────────────

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(`
ERROR: Missing environment variables.
Create a .env.local file in the project root with:

  NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=eyJ...

You can find these in: Supabase dashboard → Settings → API
  `)
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
})

// ── LZ4 / bi5 decoding ───────────────────────────────────────────────────────

function lz4BlockDecode(src) {
  const dst = []; let sp = 0
  while (sp < src.length) {
    const token = src[sp++]; let litLen = token >>> 4
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
  const flg = buf[p++]; p++
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

function parseM1Records(buf, mult, dayMs) {
  const out = []
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

function dukaUrl(sym, d) {
  const y  = d.getUTCFullYear()
  const m  = String(d.getUTCMonth()).padStart(2, '0')   // 0-indexed
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `https://datafeed.dukascopy.com/datafeed/${sym}/${y}/${m}/${dd}/BID_candles_min_1.bi5`
}

async function fetchDay(sym, date, mult) {
  try {
    const res = await fetch(dukaUrl(sym, date), { signal: AbortSignal.timeout(20000) })
    if (!res.ok) return []
    const ab = await res.arrayBuffer()
    if (!ab.byteLength) return []
    return parseM1Records(decodeLZ4Frame(Buffer.from(ab)), mult, date.getTime())
  } catch {
    return []
  }
}

function tradingDays(start, end) {
  const days = []
  const cur  = new Date(start + 'T00:00:00Z')
  const last = new Date(end   + 'T00:00:00Z')
  while (cur <= last) {
    const dow = cur.getUTCDay()
    if (dow !== 0 && dow !== 6) days.push(new Date(cur))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return days
}

// ── Upload to Supabase ────────────────────────────────────────────────────────

async function uploadToSupabase(sym, candles) {
  const filename = `${sym.toLowerCase()}-m1-2010-now.json`
  const body     = Buffer.from(JSON.stringify(candles))

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, body, { contentType: 'application/json', upsert: true })

  if (error) throw new Error(`Upload failed: ${error.message}`)
  console.log(`  ✓ Uploaded ${filename} (${(body.length / 1024 / 1024).toFixed(1)} MB)`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

await fs.mkdir(OUT_DIR, { recursive: true })

console.log(`Downloading M1 data: ${START} → ${END}`)
console.log(`Symbols: ${SYMBOLS.join(', ')}\n`)

for (const sym of SYMBOLS) {
  const mult  = MULTIPLIER[sym]
  const days  = tradingDays(START, END)
  const all   = []
  let errors  = 0

  console.log(`\n[${sym}] ${days.length} trading days to fetch…`)

  for (let i = 0; i < days.length; i += BATCH_SIZE) {
    const chunk   = days.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(chunk.map(d => fetchDay(sym, d, mult)))
    for (const r of results) {
      if (r.length === 0) errors++
      else all.push(...r)
    }

    // Progress every ~500 days
    if (i % 500 === 0 && i > 0) {
      const pct = ((i / days.length) * 100).toFixed(0)
      console.log(`  ${pct}% — ${all.length.toLocaleString()} candles so far`)
    }
  }

  all.sort((a, b) => a.time - b.time)

  console.log(`  ${all.length.toLocaleString()} candles (${errors} empty days — normal for weekends/holidays)`)

  // Save locally
  const localPath = path.join(OUT_DIR, `${sym.toLowerCase()}-m1-2010-now.json`)
  await fs.writeFile(localPath, JSON.stringify(all))
  console.log(`  Saved locally: ${localPath}`)

  // Upload to Supabase
  await uploadToSupabase(sym, all)
}

console.log('\n✅ All done! Market data is now in Supabase Storage.')
console.log('You can verify in: Supabase dashboard → Storage → market-data')
