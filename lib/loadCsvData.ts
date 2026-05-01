import type { Candle } from '@/types'

export type TimeFrame = 'm1' | 'm5' | 'm15' | 'm30' | 'h1' | 'h4' | 'd1' | 'w1' | 'M1'

/**
 * Aggregates M1 candles into any higher timeframe.
 * The workspace loads raw M1 data from /api/candles (served from local JSON),
 * stores it in originalCandlesRef, and calls this to switch timeframes on the fly.
 */
export function aggregateCandles(m1Candles: Candle[], timeframe: TimeFrame): Candle[] {
  if (timeframe === 'm1') return m1Candles

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
    case 'M1':  return 43200 // ~30-day month
    default:    return null
  }
}
