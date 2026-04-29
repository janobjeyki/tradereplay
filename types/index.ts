// ── Database row types ──────────────────────────────────────────

export interface Profile {
  id: string
  display_name: string | null
  language: 'en' | 'ru' | 'uz'
  subscription_status: 'inactive' | 'active' | 'canceled'
  subscription_plan: string
  subscription_price: number
  payment_method: 'humo' | 'uzcard' | null
  card_holder_name: string | null
  card_last4: string | null
  card_exp_month: number | null
  card_exp_year: number | null
  payment_authorized_at: string | null
  subscription_started_at: string | null
  subscription_expires_at: string | null
  created_at: string
  updated_at: string
}

export interface SubscriptionTransaction {
  id: string
  user_id: string
  amount: number
  currency: string
  payment_method: 'humo' | 'uzcard'
  card_last4: string
  card_holder_name: string | null
  card_exp_month: number | null
  card_exp_year: number | null
  provider_card_id: string | null
  provider_card_token: string | null
  status: 'pending' | 'authorized' | 'failed' | 'canceled'
  reference: string
  created_at: string
}

export interface Strategy {
  id:          string
  user_id:     string
  name:        string
  description: string | null
  color:       string
  checklist:   string[] | null
  created_at:  string
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
  strategy_id:  string | null
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
  status: 'open' | 'pending' | 'closed'
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
  contractSize: number  // units per standard lot (forex=100000, gold=100, indices=10)
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
