import { cn } from '@/lib/utils'
import { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, forwardRef } from 'react'

// ── Button ────────────────────────────────────────────────────────
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'buy' | 'sell'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: ReactNode
}
export function Button({ variant = 'ghost', size = 'md', loading, children, className, disabled, ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
  const v: Record<string,string> = {
    primary: 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] active:scale-[0.98]',
    ghost:   'bg-transparent text-[var(--text-secondary)] border border-[var(--border-default)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',
    danger:  'bg-transparent text-[var(--red)] border border-[var(--red-muted)] hover:bg-[var(--red-muted)]',
    buy:     'bg-[var(--green)] text-white hover:opacity-90 w-full',
    sell:    'bg-[var(--red)]   text-white hover:opacity-90 w-full',
  }
  const s: Record<string,string> = { sm:'px-3 py-1.5 text-xs', md:'px-4 py-2 text-sm', lg:'px-6 py-3 text-[15px]' }
  return (
    <button className={cn(base, v[variant], s[size], className)} disabled={disabled||loading} {...props}>
      {loading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin-slow"/>}
      {children}
    </button>
  )
}

// ── Input ─────────────────────────────────────────────────────────
interface InputProps extends InputHTMLAttributes<HTMLInputElement> { label?: string; error?: string }
export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, className, ...props }, ref) => (
  <div className="flex flex-col gap-1.5">
    {label && <label className="text-[11px] tracking-wider uppercase" style={{color:'var(--text-muted)'}}>{label}</label>}
    <input ref={ref} className={cn(
      'rounded-lg px-3 py-2.5 text-sm outline-none transition-colors placeholder:opacity-40',
      error ? 'border-[var(--red)]' : '',
      className
    )} style={{
      background:'var(--bg-tertiary)', border:`1px solid var(--border-default)`,
      color:'var(--text-primary)',
    }}
    onFocus={e=>{e.currentTarget.style.borderColor='var(--accent)'}}
    onBlur={e=>{e.currentTarget.style.borderColor='var(--border-default)'}}
    {...props}/>
    {error && <p className="text-xs" style={{color:'var(--red)'}}>{error}</p>}
  </div>
))
Input.displayName = 'Input'

// ── Select ────────────────────────────────────────────────────────
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> { label?: string }
export function Select({ label, className, children, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-[11px] tracking-wider uppercase" style={{color:'var(--text-muted)'}}>{label}</label>}
      <select className={cn('rounded-lg px-3 py-2.5 text-sm outline-none cursor-pointer appearance-none', className)}
        style={{
          background:'var(--bg-tertiary)', border:`1px solid var(--border-default)`,
          color:'var(--text-primary)',
          backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236a87ac' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
          backgroundRepeat:'no-repeat', backgroundPosition:'right 12px center', paddingRight:'32px',
        }} {...props}>{children}</select>
    </div>
  )
}

// ── Badge ─────────────────────────────────────────────────────────
interface BadgeProps { variant?: 'blue'|'green'|'red'|'gray'; children: ReactNode; className?: string }
export function Badge({ variant='gray', children, className }: BadgeProps) {
  const v: Record<string,string> = {
    blue:  'bg-[var(--accent-muted)] text-[var(--accent)]',
    green: 'bg-[var(--green-muted)] text-[var(--green)]',
    red:   'bg-[var(--red-muted)]   text-[var(--red)]',
    gray:  'bg-[var(--bg-elevated)] text-[var(--text-secondary)]',
  }
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold', v[variant], className)}>{children}</span>
}

// ── Card ──────────────────────────────────────────────────────────
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-xl p-5', className)} style={{background:'var(--bg-secondary)', border:'1px solid var(--border-subtle)'}}>{children}</div>
}

// ── StatCard ──────────────────────────────────────────────────────
export function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl px-5 py-4" style={{background:'var(--bg-tertiary)', border:'1px solid var(--border-subtle)'}}>
      <p className="text-[10px] uppercase tracking-widest mb-1.5" style={{color:'var(--text-muted)'}}>{label}</p>
      <p className="font-mono text-2xl font-bold tracking-tight" style={{color: color ?? 'var(--text-primary)'}}>{value}</p>
    </div>
  )
}

// ── Alert ─────────────────────────────────────────────────────────
export function Alert({ type, message }: { type: 'error'|'success'; message: string }) {
  if (!message) return null
  return <div className="px-3.5 py-2.5 rounded-lg text-sm" style={{
    background: type==='error' ? 'var(--red-muted)' : 'var(--green-muted)',
    color:      type==='error' ? 'var(--red)'       : 'var(--green)',
  }}>{message}</div>
}

// ── Spinner ───────────────────────────────────────────────────────
export function Spinner({ size='md' }: { size?: 'sm'|'md'|'lg' }) {
  const s: Record<string,string> = { sm:'w-4 h-4', md:'w-8 h-8', lg:'w-12 h-12' }
  return <div className={cn('rounded-full animate-spin-slow', s[size])} style={{border:'2px solid var(--border-subtle)', borderTopColor:'var(--accent)'}}/>
}

// ── Modal ─────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, width='max-w-md' }: { open:boolean; onClose:()=>void; title:string; children:ReactNode; width?:string }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.75)', backdropFilter:'blur(8px)'}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className={cn('rounded-2xl p-7 w-full max-h-[92vh] overflow-y-auto animate-slide-up', width)}
        style={{background:'var(--bg-secondary)', border:'1px solid var(--border-default)'}}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-bold text-xl tracking-tight" style={{color:'var(--text-primary)'}}>{title}</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded text-xl leading-none transition-colors hover:bg-[var(--bg-elevated)]" style={{color:'var(--text-secondary)'}}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── TabBar ────────────────────────────────────────────────────────
export function TabBar({ tabs, active, onChange }: { tabs:{key:string;label:string}[]; active:string; onChange:(k:string)=>void }) {
  return (
    <div className="flex shrink-0" style={{borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-secondary)'}}>
      {tabs.map(tab => (
        <button key={tab.key} onClick={()=>onChange(tab.key)}
          className="px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px"
          style={{
            color:        active===tab.key ? 'var(--accent)' : 'var(--text-muted)',
            borderColor:  active===tab.key ? 'var(--accent)' : 'transparent',
          }}>
          {tab.label}
        </button>
      ))}
    </div>
  )
}

// ── ThemeToggle ───────────────────────────────────────────────────
export function ThemeToggle({ theme, onToggle }: { theme: 'dark'|'light'; onToggle: ()=>void }) {
  return (
    <button onClick={onToggle} title="Toggle theme"
      className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:bg-[var(--bg-elevated)]"
      style={{color:'var(--text-secondary)', border:'1px solid var(--border-default)'}}>
      {theme === 'dark' ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  )
}
