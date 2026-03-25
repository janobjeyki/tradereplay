import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'

export function TradeLabLogo({ className }: { className?: string }) {
  const { theme } = useTheme()

  return (
    <img
      src={theme === 'light' ? '/brand/tradelab-light.png' : '/brand/tradelab-logo.png'}
      alt="TradeLab"
      className={cn('block object-contain', className)}
    />
  )
}

export function TradeLabWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={cn('font-black tracking-tight', compact ? 'text-lg' : 'text-2xl')}>
      <span style={{ color: 'var(--text-primary)' }}>Trade</span>
      <span style={{ color: 'var(--green)' }}>Lab</span>
    </span>
  )
}
