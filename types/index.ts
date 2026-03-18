// ── Database row types ──────────────────────────────────────────

export interface Profile {
  id: string
  display_name: string | null
  language: 'en' | 'ru' | 'uz'
  created_at: string
  updated_at: string
}

export interface Session {
  id: string
  user_id: string
  name: string
  symbol: string
  start_date: string
  end_date: string
  start_capital: number
  end_capital: number
  candle_index: number
  is_completed: boolean
  created_at: string
  updated_at: string
}

export interface Trade {
  id: string
  session_id: string
  user_id: string
  side: 'buy' | 'sell'
  entry_price: number
  exit_price: number | null
  quantity: number
  stop_loss: number | null
  take_profit: number | null
  pnl: number | null
  status: 'open' | 'closed'
  opened_at_idx: number
  closed_at_idx: number | null
  weekday: string | null
  created_at: string
  updated_at: string
}

export interface CandleCache {
  session_id: string
  candles: Candle[]
  created_at: string
}

// ── App types ───────────────────────────────────────────────────

export interface Candle {
  time: number // unix timestamp
  open: number
  high: number
  low: number
  close: number
}

export interface Symbol {
  value: string
  label: string
  category: string
  basePrice: number
  volatility: number
  decimals: number
  pipSize: number
}

export type Language = 'en' | 'ru' | 'uz'

export interface SessionStats {
  totalPnl: number
  winRate: number
  profitFactor: number
  avgRR: number
  totalTrades: number
  wins: number
  losses: number
  equity: EquityPoint[]
  byDay: Record<string, DayStats>
}

export interface EquityPoint {
  index: number
  value: number
}

export interface DayStats {
  pnl: number
  wins: number
  total: number
}

export interface WorkspaceState {
  session: Session
  candles: Candle[]
  currentIndex: number
  trades: Trade[]
  balance: number
}
