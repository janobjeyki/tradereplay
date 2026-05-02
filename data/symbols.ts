import type { Symbol } from '@/types'

export const SYMBOLS: Symbol[] = [
  // Major Pairs  (1 lot = 100,000 units)
  { value: 'EURUSD', label: 'EUR/USD', category: 'Major Pairs', basePrice: 1.0850, volatility: 0.0012, decimals: 5, pipSize: 0.0001, contractSize: 100000 },
  { value: 'GBPUSD', label: 'GBP/USD', category: 'Major Pairs', basePrice: 1.2730, volatility: 0.0015, decimals: 5, pipSize: 0.0001, contractSize: 100000 },
  { value: 'USDJPY', label: 'USD/JPY', category: 'Major Pairs', basePrice: 148.50, volatility: 0.14,   decimals: 3, pipSize: 0.01,   contractSize: 100000 },
  { value: 'USDCHF', label: 'USD/CHF', category: 'Major Pairs', basePrice: 0.8920, volatility: 0.0010, decimals: 5, pipSize: 0.0001, contractSize: 100000 },
  { value: 'AUDUSD', label: 'AUD/USD', category: 'Major Pairs', basePrice: 0.6580, volatility: 0.0010, decimals: 5, pipSize: 0.0001, contractSize: 100000 },
  { value: 'USDCAD', label: 'USD/CAD', category: 'Major Pairs', basePrice: 1.3620, volatility: 0.0012, decimals: 5, pipSize: 0.0001, contractSize: 100000 },
  { value: 'NZDUSD', label: 'NZD/USD', category: 'Major Pairs', basePrice: 0.6120, volatility: 0.0010, decimals: 5, pipSize: 0.0001, contractSize: 100000 },
  // Cross Pairs
  { value: 'EURGBP', label: 'EUR/GBP', category: 'Cross Pairs', basePrice: 0.8520, volatility: 0.0008, decimals: 5, pipSize: 0.0001, contractSize: 100000 },
  { value: 'EURJPY', label: 'EUR/JPY', category: 'Cross Pairs', basePrice: 161.20, volatility: 0.16,   decimals: 3, pipSize: 0.01,   contractSize: 100000 },
  { value: 'GBPJPY', label: 'GBP/JPY', category: 'Cross Pairs', basePrice: 189.40, volatility: 0.20,   decimals: 3, pipSize: 0.01,   contractSize: 100000 },
  { value: 'EURAUD', label: 'EUR/AUD', category: 'Cross Pairs', basePrice: 1.6480, volatility: 0.0015, decimals: 5, pipSize: 0.0001, contractSize: 100000 },
  { value: 'EURCAD', label: 'EUR/CAD', category: 'Cross Pairs', basePrice: 1.4780, volatility: 0.0013, decimals: 5, pipSize: 0.0001, contractSize: 100000 },
  { value: 'GBPAUD', label: 'GBP/AUD', category: 'Cross Pairs', basePrice: 1.9350, volatility: 0.0018, decimals: 5, pipSize: 0.0001, contractSize: 100000 },
  { value: 'GBPCAD', label: 'GBP/CAD', category: 'Cross Pairs', basePrice: 1.7340, volatility: 0.0015, decimals: 5, pipSize: 0.0001, contractSize: 100000 },
  // Metals  (1 lot = 100 troy oz)
  { value: 'XAUUSD', label: 'XAU/USD (Gold)', category: 'Metals', basePrice: 1950.0, volatility: 2.2, decimals: 2, pipSize: 0.01, contractSize: 100 },
]

export const SYMBOLS_BY_CATEGORY = SYMBOLS.reduce<Record<string, Symbol[]>>((acc, sym) => {
  if (!acc[sym.category]) acc[sym.category] = []
  acc[sym.category].push(sym)
  return acc
}, {})

export function getSymbol(value: string): Symbol {
  return SYMBOLS.find(s => s.value === value) ?? SYMBOLS[0]
}
