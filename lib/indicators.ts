import type { Candle } from '@/types'

// ── SMA ─────────────────────────────────────────────────────────
export function sma(candles: Candle[], period: number): (number | null)[] {
  return candles.map((_, i) => {
    if (i < period - 1) return null
    return candles.slice(i - period + 1, i + 1).reduce((a, c) => a + c.close, 0) / period
  })
}

// ── EMA ─────────────────────────────────────────────────────────
export function ema(candles: Candle[], period: number): (number | null)[] {
  const result: (number | null)[] = []
  const k = 2 / (period + 1)
  let prev: number | null = null
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) { result.push(null); continue }
    if (prev === null) {
      prev = candles.slice(0, period).reduce((a, c) => a + c.close, 0) / period
    } else {
      prev = candles[i].close * k + prev * (1 - k)
    }
    result.push(prev)
  }
  return result
}

// ── Bollinger Bands ──────────────────────────────────────────────
export function bollingerBands(candles: Candle[], period = 20, mult = 2) {
  const mid = sma(candles, period)
  return candles.map((_, i) => {
    if (mid[i] === null) return { upper: null as number | null, middle: null as number | null, lower: null as number | null }
    const slice = candles.slice(i - period + 1, i + 1)
    const m = mid[i]!
    const std = Math.sqrt(slice.reduce((a, c) => a + (c.close - m) ** 2, 0) / period)
    return { upper: m + mult * std, middle: m, lower: m - mult * std }
  })
}

// ── RSI ──────────────────────────────────────────────────────────
export function rsi(candles: Candle[], period = 14): (number | null)[] {
  const result: (number | null)[] = []
  let avgGain = 0, avgLoss = 0
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) { result.push(null); continue }
    const d = candles[i].close - candles[i - 1].close
    const gain = Math.max(d, 0), loss = Math.max(-d, 0)
    if (i <= period) {
      avgGain += gain / period
      avgLoss += loss / period
      if (i < period) { result.push(null); continue }
      result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss))
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period
      avgLoss = (avgLoss * (period - 1) + loss) / period
      result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss))
    }
  }
  return result
}

// ── MACD ─────────────────────────────────────────────────────────
export function macd(candles: Candle[], fast = 12, slow = 26, sig = 9) {
  const ef = ema(candles, fast)
  const es = ema(candles, slow)
  const macdLine = candles.map((_, i) =>
    ef[i] !== null && es[i] !== null ? ef[i]! - es[i]! : null
  )
  // EMA of MACD line
  const k = 2 / (sig + 1)
  let prev: number | null = null, count = 0
  const signalLine: (number | null)[] = []
  for (let i = 0; i < macdLine.length; i++) {
    const m = macdLine[i]
    if (m === null) { signalLine.push(null); continue }
    count++
    if (count < sig) { signalLine.push(null); continue }
    if (prev === null) {
      const vals = macdLine.filter(v => v !== null).slice(0, sig) as number[]
      if (vals.length < sig) { signalLine.push(null); continue }
      prev = vals.reduce((a, v) => a + v, 0) / sig
    } else {
      prev = m * k + prev * (1 - k)
    }
    signalLine.push(prev)
  }
  return candles.map((_, i) => {
    const m = macdLine[i], s = signalLine[i]
    return { macd: m, signal: s, hist: m !== null && s !== null ? m - s : null }
  })
}

// ── VWAP (resets daily) ──────────────────────────────────────────
export function vwap(candles: Candle[]): (number | null)[] {
  let cumPV = 0, cumVol = 0, lastDay = -1
  return candles.map(c => {
    const day = Math.floor(c.time / 86400)
    if (day !== lastDay) { cumPV = 0; cumVol = 0; lastDay = day }
    const tp = (c.high + c.low + c.close) / 3
    const vol = Math.max((c.high - c.low) * 10000, 1)
    cumPV += tp * vol; cumVol += vol
    return cumPV / cumVol
  })
}

// ── Volume (approximated from candle range) ──────────────────────
export function volume(candles: Candle[]): number[] {
  return candles.map(c => Math.round((c.high - c.low) * 10000))
}

// ── To lightweight-charts format ─────────────────────────────────
export function toLineSeries(
  candles: Candle[],
  values: (number | null)[],
): { time: number; value: number }[] {
  return candles
    .map((c, i) => ({ time: c.time, value: values[i] }))
    .filter(d => d.value !== null) as { time: number; value: number }[]
}
