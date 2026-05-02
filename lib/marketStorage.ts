/**
 * Market data storage — Supabase Storage bucket "market-data".
 *
 * Setup (one-time, in Supabase dashboard):
 *   Storage → New bucket → Name: "market-data" → Public: OFF
 *
 * Files stored as:  market-data/{symbol}-m1-2010-now.json
 *
 * On /api/candles requests:
 *   1. Check /tmp cache — return immediately if hit
 *   2. Download from Supabase Storage → write to /tmp → return
 *
 * This means cold Lambda loads pay the download cost once, then
 * subsequent requests in the same container are instant from /tmp.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { createAdminClient } from '@/lib/supabase/admin'
import { m1Filename } from '@/lib/marketData'

const BUCKET   = 'market-data'
const TMP_DIR  = '/tmp/market-data'

export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
}

// ── Upload ────────────────────────────────────────────────────────────────────

/** Upload a candle array for one symbol to Supabase Storage. */
export async function uploadSymbolData(symbol: string, candles: Candle[]): Promise<void> {
  const supabase = createAdminClient()
  const filename = m1Filename(symbol)
  const body     = Buffer.from(JSON.stringify(candles))

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, body, {
      contentType: 'application/json',
      upsert: true,
    })

  if (error) throw new Error(`Storage upload failed for ${symbol}: ${error.message}`)
}

// ── Download + cache ──────────────────────────────────────────────────────────

/** 
 * Get candles for a symbol. Checks /tmp first, then Supabase Storage.
 * Throws if the file doesn't exist in storage.
 */
export async function getSymbolData(symbol: string): Promise<Candle[]> {
  await fs.mkdir(TMP_DIR, { recursive: true })
  const tmpPath = path.join(TMP_DIR, m1Filename(symbol))

  // 1. Try /tmp cache
  try {
    const raw = await fs.readFile(tmpPath, 'utf8')
    return JSON.parse(raw) as Candle[]
  } catch {
    // Cache miss — fall through to storage
  }

  // 2. Download from Supabase Storage
  const supabase = createAdminClient()
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(m1Filename(symbol))

  if (error || !data) {
    throw new Error(`No data found for ${symbol} in storage. Run Sync All Market Data.`)
  }

  const text = await data.text()

  // 3. Write to /tmp for next request in same Lambda
  await fs.writeFile(tmpPath, text)

  return JSON.parse(text) as Candle[]
}

// ── Metadata ──────────────────────────────────────────────────────────────────

/** Check if a symbol's file exists in Supabase Storage (without downloading it). */
export async function symbolExistsInStorage(symbol: string): Promise<boolean> {
  const supabase = createAdminClient()
  const { data } = await supabase.storage
    .from(BUCKET)
    .list('', { search: m1Filename(symbol) })
  return (data ?? []).some(f => f.name === m1Filename(symbol))
}

/** List all symbols currently stored, with their file sizes. */
export async function listStoredSymbols(): Promise<{ symbol: string; bytes: number; updatedAt: string }[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.storage.from(BUCKET).list()
  if (error || !data) return []

  return data
    .filter(f => f.name.endsWith('-m1-2010-now.json'))
    .map(f => ({
      symbol:    f.name.replace('-m1-2010-now.json', '').toUpperCase(),
      bytes:     f.metadata?.size ?? 0,
      updatedAt: f.updated_at ?? f.created_at ?? '',
    }))
}
