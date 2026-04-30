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

export function dukascopyDayUrl(symbol: string, day: Date): string {
  return `https://datafeed.dukascopy.com/datafeed/${symbol}/${day.getUTCFullYear()}/${String(day.getUTCMonth()).padStart(2, '0')}/${String(day.getUTCDate()).padStart(2, '0')}/BID_candles_min_1.bi5`
}

export function getTodayUtcDateString() {
  return new Date().toISOString().slice(0, 10)
}
