'use client'

import { useState, useCallback } from 'react'
import type { Trade, Symbol } from '@/types'
import { calcPnl, fmtPrice } from '@/lib/utils'

interface Props {
  symbol:         Symbol
  sellPrice:      number
  buyPrice:       number
  balance:        number
  qty:            string
  setQty:         (v: string) => void
  slVal:          string
  setSlVal:       (v: string) => void
  tpVal:          string
  setTpVal:       (v: string) => void
  slError:        string
  tpError:        string
  accountBreached: boolean
  openTr:         Trade[]
  openPnl:        number
  onBuy:          () => void
  onSell:         () => void
  onSideChange?:  (side: 'buy' | 'sell' | null) => void
}

type OrderType = 'market' | 'pending'

const STEP = 0.5  // price step for +/− buttons on TP/SL

export function TradeForm({
  symbol, sellPrice, buyPrice, balance,
  qty, setQty, slVal, setSlVal, tpVal, setTpVal,
  slError, tpError, accountBreached, openTr, openPnl,
  onBuy, onSell, onSideChange,
}: Props) {
  const [orderType,   setOrderType]   = useState<OrderType>('market')
  const [activeSide,  setActiveSide]  = useState<'buy' | 'sell' | null>(null)
  const setSide = (s: 'buy' | 'sell' | null) => { setActiveSide(s); onSideChange?.(s) }

  const price     = activeSide === 'sell' ? sellPrice : buyPrice
  const qtyNum    = parseFloat(qty) || 0.01
  const cs        = symbol.contractSize
  const dec       = symbol.decimals
  const pipSize   = symbol.pipSize

  // ── Derived risk stats ────────────────────────────────────────
  const slNum = slVal ? parseFloat(slVal) : null
  const tpNum = tpVal ? parseFloat(tpVal) : null
  const side  = activeSide ?? 'buy'

  const slPips = slNum ? Math.abs(price - slNum) / pipSize : null
  const tpPips = tpNum ? Math.abs(price - tpNum) / pipSize : null
  const slUsd  = slNum ? Math.abs(calcPnl(side, price, slNum, qtyNum, cs)) : null
  const tpUsd  = tpNum ? Math.abs(calcPnl(side, price, tpNum, qtyNum, cs)) : null
  const slPct  = slUsd && balance > 0 ? (slUsd / balance * 100) : null
  const tpPct  = tpUsd && balance > 0 ? (tpUsd / balance * 100) : null

  const adjustQty = (delta: number) => {
    const v = Math.max(0.01, parseFloat(qty || '0.01') + delta)
    setQty(v.toFixed(2))
  }
  const adjustSL = (delta: number) => {
    const base = slNum ?? price
    setSlVal((base + delta).toFixed(dec))
  }
  const adjustTP = (delta: number) => {
    const base = tpNum ?? price
    setTpVal((base + delta).toFixed(dec))
  }

  const handleConfirm = () => {
    if (activeSide === 'buy')  onBuy()
    if (activeSide === 'sell') onSell()
    setSide(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Sell / Buy price cards */}
      <div style={{ display: 'flex', position: 'relative', borderBottom: '1px solid var(--border-subtle)' }}>
        {/* Sell */}
        <button
          onClick={() => setSide(activeSide === 'sell' ? null : 'sell')}
          style={{
            flex: 1, padding: '14px 12px', textAlign: 'left', border: 'none', cursor: 'pointer',
            background: activeSide === 'sell' ? 'rgba(239,68,68,0.12)' : 'transparent',
            borderBottom: activeSide === 'sell' ? '2px solid var(--red)' : '2px solid transparent',
            transition: 'all 0.15s',
          }}>
          <p style={{ fontSize: 11, color: activeSide === 'sell' ? 'var(--red)' : 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>Sell</p>
          <p style={{ fontSize: 15, fontWeight: 800, fontFamily: 'monospace', color: 'var(--red)' }}>
            {sellPrice ? fmtPrice(sellPrice, dec) : '—'}
          </p>
        </button>

        {/* Spread badge */}
        <div style={{
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
          background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
          borderRadius: 4, padding: '2px 6px', fontSize: 10, color: 'var(--text-muted)',
          fontFamily: 'monospace', whiteSpace: 'nowrap', zIndex: 1,
        }}>
          {symbol.pipSize > 0 ? ((buyPrice - sellPrice) / symbol.pipSize).toFixed(1) : '0'} USD
        </div>

        {/* Buy */}
        <button
          onClick={() => setSide(activeSide === 'buy' ? null : 'buy')}
          style={{
            flex: 1, padding: '14px 12px', textAlign: 'right', border: 'none', cursor: 'pointer',
            background: activeSide === 'buy' ? 'rgba(59,130,246,0.12)' : 'transparent',
            borderBottom: activeSide === 'buy' ? '2px solid var(--accent)' : '2px solid transparent',
            transition: 'all 0.15s',
          }}>
          <p style={{ fontSize: 11, color: activeSide === 'buy' ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>Buy</p>
          <p style={{ fontSize: 15, fontWeight: 800, fontFamily: 'monospace', color: 'var(--accent)' }}>
            {buyPrice ? fmtPrice(buyPrice, dec) : '—'}
          </p>
        </button>
      </div>

      {/* Scrollable form body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 0' }}>

        {/* Market / Pending toggle */}
        <div style={{
          display: 'flex', background: 'var(--bg-tertiary)', borderRadius: 8, padding: 3,
          marginBottom: 14,
        }}>
          {(['market', 'pending'] as OrderType[]).map(t => (
            <button key={t} onClick={() => setOrderType(t)} style={{
              flex: 1, padding: '6px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
              background: orderType === t ? 'var(--bg-secondary)' : 'transparent',
              color: orderType === t ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: orderType === t ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
            }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Volume */}
        <FieldLabel>Volume</FieldLabel>
        <PriceField
          value={qty}
          onChange={setQty}
          suffix="Lots"
          onMinus={() => adjustQty(-0.01)}
          onPlus={() => adjustQty(0.01)}
        />

        {/* Take Profit */}
        <FieldLabel>Take Profit</FieldLabel>
        <PriceField
          value={tpVal}
          onChange={v => setTpVal(v)}
          placeholder="Not set"
          suffix="Price"
          onClear={tpVal ? () => setTpVal('') : undefined}
          onMinus={() => adjustTP(-STEP)}
          onPlus={() => adjustTP(STEP)}
          error={tpError}
          color="var(--green)"
        />
        {tpNum != null && tpUsd != null && (
          <div style={{ display: 'flex', gap: 6, marginTop: 4, marginBottom: 10, flexWrap: 'wrap' }}>
            {tpPips != null && <StatPill value={`+${tpPips.toFixed(1)} pips`} color="var(--green)" />}
            <StatPill value={`+$${tpUsd.toFixed(2)}`} color="var(--green)" />
            {tpPct != null && <StatPill value={`+${tpPct.toFixed(2)}%`} color="var(--green)" />}
          </div>
        )}

        {/* Stop Loss */}
        <FieldLabel>Stop Loss</FieldLabel>
        <PriceField
          value={slVal}
          onChange={v => setSlVal(v)}
          placeholder="Not set"
          suffix="Price"
          onClear={slVal ? () => setSlVal('') : undefined}
          onMinus={() => adjustSL(-STEP)}
          onPlus={() => adjustSL(STEP)}
          error={slError}
          color="var(--red)"
        />
        {slNum != null && slUsd != null && (
          <div style={{ display: 'flex', gap: 6, marginTop: 4, marginBottom: 10, flexWrap: 'wrap' }}>
            {slPips != null && <StatPill value={`-${slPips.toFixed(1)} pips`} color="var(--red)" />}
            <StatPill value={`-$${slUsd.toFixed(2)}`} color="var(--red)" />
            {slPct != null && <StatPill value={`-${slPct.toFixed(2)}%`} color="var(--red)" />}
          </div>
        )}

        {/* R:R summary */}
        {slUsd != null && tpUsd != null && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'var(--bg-tertiary)', borderRadius: 8, padding: '8px 12px', marginBottom: 12,
          }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Risk / Reward</span>
            <span style={{
              fontSize: 13, fontWeight: 800,
              color: tpUsd / slUsd >= 2 ? 'var(--green)' : tpUsd / slUsd >= 1 ? 'var(--accent)' : 'var(--red)',
            }}>
              1 : {(tpUsd / slUsd).toFixed(2)}
            </span>
          </div>
        )}

        {/* Open positions summary */}
        {openTr.length > 0 && (
          <div style={{
            background: 'var(--bg-tertiary)', borderRadius: 8, padding: '8px 12px', marginBottom: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: 'var(--text-muted)' }}>Open ({openTr.length})</span>
              <span style={{ fontWeight: 700, color: openPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {openPnl >= 0 ? '+' : ''}{openPnl.toFixed(2)} USD
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom confirm buttons */}
      <div style={{ padding: '10px 12px 12px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        {activeSide ? (
          <>
            <button
              onClick={handleConfirm}
              disabled={accountBreached}
              style={{
                width: '100%', padding: '13px', borderRadius: 10, border: 'none',
                background: activeSide === 'buy' ? 'var(--accent)' : 'var(--red)',
                color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer',
                marginBottom: 8, opacity: accountBreached ? 0.4 : 1,
                transition: 'all 0.15s',
              }}>
              Confirm {activeSide === 'buy' ? 'Buy' : 'Sell'} {qtyNum.toFixed(2)} lots
            </button>
            <button onClick={() => setSide(null)} style={{
              width: '100%', padding: '10px', borderRadius: 10, border: '1px solid var(--border-default)',
              background: 'transparent', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
            }}>Cancel</button>
          </>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setActiveSide('sell'); onSell() }} disabled={accountBreached} style={{
              flex: 1, padding: '13px 8px', borderRadius: 10, border: 'none',
              background: 'var(--red)', color: '#fff', fontSize: 13, fontWeight: 800,
              cursor: 'pointer', opacity: accountBreached ? 0.4 : 1,
            }}>Sell</button>
            <button onClick={() => { setActiveSide('buy'); onBuy() }} disabled={accountBreached} style={{
              flex: 1, padding: '13px 8px', borderRadius: 10, border: 'none',
              background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 800,
              cursor: 'pointer', opacity: accountBreached ? 0.4 : 1,
            }}>Buy</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
      {children}
    </p>
  )
}

function PriceField({
  value, onChange, placeholder, suffix, onClear, onMinus, onPlus, error, color,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  suffix?: string
  onClear?: () => void
  onMinus: () => void
  onPlus:  () => void
  error?:  string
  color?:  string
}) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        background: 'var(--bg-primary)',
        border: `1px solid ${error ? 'var(--red)' : 'var(--border-default)'}`,
        borderRadius: 8, overflow: 'hidden',
      }}>
        {/* Value input */}
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1, padding: '9px 10px', background: 'transparent', border: 'none',
            fontSize: 13, fontFamily: 'monospace', color: value ? (color ?? 'var(--text-primary)') : 'var(--text-muted)',
            outline: 'none', minWidth: 0,
          }}
        />
        {/* Clear button */}
        {onClear && (
          <button onClick={onClear} style={{
            padding: '0 6px', background: 'none', border: 'none',
            color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, lineHeight: 1,
          }}>×</button>
        )}
        {/* Suffix label */}
        {suffix && (
          <span style={{
            padding: '0 8px', fontSize: 11, color: 'var(--text-muted)',
            borderLeft: '1px solid var(--border-subtle)', alignSelf: 'stretch',
            display: 'flex', alignItems: 'center',
          }}>{suffix}</span>
        )}
        {/* − + buttons */}
        <button onClick={onMinus} style={{
          padding: '0 9px', background: 'none',
          borderLeft: '1px solid var(--border-subtle)', border: 'none',
          borderLeft: '1px solid var(--border-subtle)',
          color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1,
          alignSelf: 'stretch', display: 'flex', alignItems: 'center',
        }}>−</button>
        <button onClick={onPlus} style={{
          padding: '0 9px', background: 'none',
          borderLeft: '1px solid var(--border-subtle)', border: 'none',
          borderLeft: '1px solid var(--border-subtle)',
          color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1,
          alignSelf: 'stretch', display: 'flex', alignItems: 'center',
        }}>+</button>
      </div>
      {error && <p style={{ fontSize: 10, color: 'var(--red)', marginTop: 3 }}>{error}</p>}
    </div>
  )
}

function StatPill({ value, color }: { value: string; color: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, color,
      background: `${color}15`,
      borderRadius: 4, padding: '2px 6px',
    }}>{value}</span>
  )
}
