import type { Candle } from '@/types'

export type TimeFrame = 'm1' | 'm5' | 'm15' | 'm30' | 'h1' | 'h4' | 'd1' | 'w1' | 'M1'

/**
 * Aggregates M1 candles into any higher timeframe.
 * The workspace loads raw M1 data from /api/candles (served from local JSON),
 * stores it in originalCandlesRef, and calls this to switch timeframes on the fly.
 *
 * Monthly (M1) uses calendar-month bucketing so candles align to real months
 * rather than a fixed 30-day window that drifts across months.
 */
export function aggregateCandles(m1Candles: Candle[], timeframe: TimeFrame): Candle[] {
  if (timeframe === 'm1') return m1Candles

  // Monthly gets special calendar-aware bucketing
  if (timeframe === 'M1') return aggregateMonthly(m1Candles)

  const minutes = getMinutesForTimeframe(timeframe)
  if (!minutes) return m1Candles

  const secondsPerPeriod = minutes * 60
  const aggregated: Candle[] = []
  let current: Candle | null = null

  for (const candle of m1Candles) {
    const bucketTime = Math.floor(candle.time / secondsPerPeriod) * secondsPerPeriod

    if (!current || current.time !== bucketTime) {
      if (current) aggregated.push(current)
      current = {
        time:  bucketTime,
        open:  candle.open,
        high:  candle.high,
        low:   candle.low,
        close: candle.close,
      }
    } else {
      if (candle.high  > current.high) current.high  = candle.high
      if (candle.low   < current.low)  current.low   = candle.low
      current.close = candle.close
    }
  }

  if (current) aggregated.push(current)
  return aggregated
}

/** Calendar-month aggregation: bucket by UTC year+month, timestamp = month start */
function aggregateMonthly(m1Candles: Candle[]): Candle[] {
  const map = new Map<string, Candle>()

  for (const c of m1Candles) {
    const d     = new Date(c.time * 1000)
    const year  = d.getUTCFullYear()
    const month = d.getUTCMonth()
    const key   = `${year}-${month}`

    const existing = map.get(key)
    if (!existing) {
      // Timestamp = first second of this UTC month
      const monthStart = Math.floor(Date.UTC(year, month, 1) / 1000)
      map.set(key, { time: monthStart, open: c.open, high: c.high, low: c.low, close: c.close })
    } else {
      if (c.high  > existing.high) existing.high  = c.high
      if (c.low   < existing.low)  existing.low   = c.low
      existing.close = c.close
    }
  }

  return Array.from(map.values()).sort((a, b) => a.time - b.time)
}

function getMinutesForTimeframe(timeframe: TimeFrame): number | null {
  switch (timeframe) {
    case 'm1':  return 1
    case 'm5':  return 5
    case 'm15': return 15
    case 'm30': return 30
    case 'h1':  return 60
    case 'h4':  return 240
    case 'd1':  return 1440
    case 'w1':  return 10080
    default:    return null
  }
}
