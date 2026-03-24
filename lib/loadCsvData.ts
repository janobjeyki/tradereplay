import type { Candle } from '@/types'

let _cache: Candle[] | null = null

export type TimeFrame = 'm1' | 'm5' | 'm15' | 'm30' | 'h1' | 'h4' | 'd1' | 'w1' | 'M1'

/**
 * Fetches and parses the Dukascopy XAUUSD M1 CSV from /public/xauusd-m1-2025.csv
 * Data range: 2025-01-01 → 2025-12-31  (354,387 active M1 candles)
 * Timestamps are Unix milliseconds in the CSV → converted to seconds for lightweight-charts
 * Flat candles (weekends/holidays where high === low) are automatically skipped
 */
export async function loadXauUsdData(): Promise<Candle[]> {
  if (_cache) return _cache

  const res = await fetch('/xauusd-m1-2025.csv')
  if (!res.ok) throw new Error(`Failed to load CSV: ${res.status}`)

  const text = await res.text()
  const lines = text.trim().split('\n')
  const candles: Candle[] = []

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',')
    if (parts.length < 5) continue

    const tsMs  = parseInt(parts[0], 10)
    const open  = parseFloat(parts[1])
    const high  = parseFloat(parts[2])
    const low   = parseFloat(parts[3])
    const close = parseFloat(parts[4])

    if (!Number.isFinite(tsMs) || !Number.isFinite(open)) continue

    // Skip flat weekend/off-hours rows
    if (high === low && open === close) continue

    candles.push({
      time:  Math.floor(tsMs / 1000),  // lightweight-charts needs Unix seconds
      open,
      high,
      low,
      close,
    })
  }

  _cache = candles
  console.log(`[loadXauUsdData] Loaded ${candles.length} active M1 candles`)
  return candles
}

/**
 * Aggregates M1 candles to a target timeframe
 */
export function aggregateCandles(m1Candles: Candle[], timeframe: TimeFrame): Candle[] {
  if (timeframe === 'm1') return m1Candles

  const minutes = getMinutesForTimeframe(timeframe)
  if (!minutes) return m1Candles

  const secondsPerPeriod = minutes * 60
  const aggregated: Candle[] = []
  let current: Candle | null = null

  for (const candle of m1Candles) {
    if (!current) {
      // Start a new aggregate candle - align time to period boundary
      const roundedTime = Math.floor(candle.time / secondsPerPeriod) * secondsPerPeriod
      current = {
        time: roundedTime,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }
    } else {
      const currentRoundedTime: number = Math.floor(current.time / secondsPerPeriod) * secondsPerPeriod
      const candleRoundedTime: number = Math.floor(candle.time / secondsPerPeriod) * secondsPerPeriod

      if (currentRoundedTime === candleRoundedTime) {
        // Add to current aggregate candle
        current.high = Math.max(current.high, candle.high)
        current.low = Math.min(current.low, candle.low)
        current.close = candle.close
      } else {
        // Push current and start new aggregate candle
        aggregated.push(current)
        current = {
          time: candleRoundedTime,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
        }
      }
    }
  }

  if (current) aggregated.push(current)
  return aggregated
}

/**
 * Get minutes for each timeframe
 */
function getMinutesForTimeframe(timeframe: TimeFrame): number | null {
  switch (timeframe) {
    case 'm1': return 1
    case 'm5': return 5
    case 'm15': return 15
    case 'm30': return 30
    case 'h1': return 60
    case 'h4': return 240
    case 'd1': return 1440
    case 'w1': return 10080
    case 'M1': return 43200 // Approximate month in minutes (30 days)
    default: return null
  }
}
