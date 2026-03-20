import type { Candle, Trade, SessionStats, EquityPoint, DayStats } from '@/types'

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

// ── Candle generation ────────────────────────────────────────────
export function generateCandles(count: number, basePrice: number, volatility: number): Candle[] {
  const candles: Candle[] = []
  let price = basePrice
  const now = Math.floor(Date.now() / 1000) - count * 3600

  for (let i = 0; i < count; i++) {
    const open = price
    const move = (Math.random() - 0.495) * volatility * 2.2
    const close = parseFloat((open + move).toFixed(5))
    const high = parseFloat((Math.max(open, close) + Math.random() * volatility * 0.65).toFixed(5))
    const low  = parseFloat((Math.min(open, close) - Math.random() * volatility * 0.65).toFixed(5))
    candles.push({ time: now + i * 3600, open, high, low, close })
    price = close
  }
  return candles
}

// ── P&L calculation ──────────────────────────────────────────────
// contractSize: units per standard lot
//   forex  = 100,000  (e.g. EURUSD, GBPUSD)
//   gold   = 100      (XAUUSD — 100 troy oz / lot)
//   silver = 5,000    (XAGUSD)
//   index  = 10       ($10 per point per lot)
export function calcPnl(
  side: 'buy' | 'sell',
  entry: number,
  exit: number,
  qty: number,
  contractSize = 100000,
): number {
  const raw = (side === 'buy' ? exit - entry : entry - exit) * qty * contractSize
  return parseFloat(raw.toFixed(2))
}

// ── Session stats ────────────────────────────────────────────────
export function computeStats(trades: Trade[], startCapital: number): SessionStats | null {
  const closed = trades.filter(t => t.status === 'closed' && t.pnl !== null)
  if (!closed.length) return null

  const wins   = closed.filter(t => (t.pnl ?? 0) > 0)
  const losses = closed.filter(t => (t.pnl ?? 0) <= 0)
  const grossWin  = wins.reduce((a, t) => a + (t.pnl ?? 0), 0)
  const grossLoss = Math.abs(losses.reduce((a, t) => a + (t.pnl ?? 0), 0))
  const pf  = grossLoss === 0 ? grossWin : grossWin / grossLoss
  const avgW = wins.length   ? grossWin  / wins.length   : 0
  const avgL = losses.length ? grossLoss / losses.length : 1
  const rr  = avgL === 0 ? avgW : avgW / avgL

  let bal = startCapital
  const equity: EquityPoint[] = [{ index: 0, value: startCapital }]
  closed.forEach((tr, i) => {
    bal += (tr.pnl ?? 0)
    equity.push({ index: i + 1, value: parseFloat(bal.toFixed(2)) })
  })

  const byDay: Record<string, DayStats> = {}
  WEEKDAYS.forEach(d => { byDay[d] = { pnl: 0, wins: 0, total: 0 } })
  closed.forEach(tr => {
    const d = tr.weekday ?? WEEKDAYS[2]
    if (!byDay[d]) byDay[d] = { pnl: 0, wins: 0, total: 0 }
    byDay[d].pnl += (tr.pnl ?? 0)
    byDay[d].total++
    if ((tr.pnl ?? 0) > 0) byDay[d].wins++
  })
  WEEKDAYS.forEach(d => { byDay[d].pnl = parseFloat(byDay[d].pnl.toFixed(2)) })

  return {
    totalPnl: parseFloat(closed.reduce((a, t) => a + (t.pnl ?? 0), 0).toFixed(2)),
    winRate: parseFloat((wins.length / closed.length * 100).toFixed(1)),
    profitFactor: parseFloat(pf.toFixed(2)),
    avgRR: parseFloat(rr.toFixed(2)),
    totalTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    equity,
    byDay,
  }
}

// ── Format helpers ───────────────────────────────────────────────
export function fmtPrice(value: number, decimals: number): string {
  return value.toFixed(decimals)
}

export function fmtPnl(value: number): string {
  return (value >= 0 ? '+' : '') + value.toFixed(2)
}

export function fmtMoney(value: number): string {
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function interpolateDate(startDt: string, endDt: string, current: number, total: number): string {
  const s = new Date(startDt).getTime()
  const e = new Date(endDt).getTime()
  const d = new Date(s + (current / total) * (e - s))
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── SL/TP check ──────────────────────────────────────────────────
export function checkSlTp(trade: Trade, candle: Candle): number | null {
  if (trade.status !== 'open') return null
  if (trade.side === 'buy') {
    if (trade.take_profit && candle.high >= trade.take_profit) return trade.take_profit
    if (trade.stop_loss   && candle.low  <= trade.stop_loss)   return trade.stop_loss
  } else {
    if (trade.take_profit && candle.low  <= trade.take_profit) return trade.take_profit
    if (trade.stop_loss   && candle.high >= trade.stop_loss)   return trade.stop_loss
  }
  return null
}

// ── Class helper ─────────────────────────────────────────────────
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
