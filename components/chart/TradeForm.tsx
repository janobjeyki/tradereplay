'use client'

import { useState } from 'react'
import type { Trade, Symbol } from '@/types'
import { calcPnl, fmtPrice } from '@/lib/utils'

interface Props {
  symbol:          Symbol
  sellPrice:       number
  buyPrice:        number
  balance:         number
  qty:             string
  setQty:          (v: string) => void
  slVal:           string
  setSlVal:        (v: string) => void
  tpVal:           string
  setTpVal:        (v: string) => void
  entryVal:        string
  setEntryVal:     (v: string) => void
  slError:         string
  tpError:         string
  accountBreached: boolean
  openTr:          Trade[]
  openPnl:         number
  onBuy:           () => Promise<boolean> | boolean
  onSell:          () => Promise<boolean> | boolean
  onSideChange?:   (side: 'buy' | 'sell' | null) => void
  onOrderTypeChange?: (t: 'market' | 'pending') => void
}

type OrderType = 'market' | 'pending'

const STEP = 0.5
const INITIAL_PROTECTIVE_OFFSET = 1

export function TradeForm({
  symbol, sellPrice, buyPrice, balance,
  qty, setQty, slVal, setSlVal, tpVal, setTpVal,
  entryVal, setEntryVal,
  slError, tpError, accountBreached, openTr, openPnl,
  onBuy, onSell, onSideChange, onOrderTypeChange,
}: Props) {
  const [orderType,  setOrderType]  = useState<OrderType>('market')
  const [activeSide, setActiveSide] = useState<'buy' | 'sell' | null>(null)

  const setSide = (s: 'buy' | 'sell' | null) => { setActiveSide(s); onSideChange?.(s) }
  const switchOrder = (t: OrderType) => { setOrderType(t); onOrderTypeChange?.(t) }
  const resetDraftFields = () => {
    setQty('0.10')
    setSlVal('')
    setTpVal('')
    setEntryVal('')
  }

  const marketPrice = activeSide === 'sell' ? sellPrice : buyPrice
  // For pending, use entryVal if set, else market price
  const entryNum   = orderType === 'pending' && entryVal ? parseFloat(entryVal) : marketPrice
  const side       = activeSide ?? 'buy'
  const qtyNum     = parseFloat(qty) || 0.01
  const cs         = symbol.contractSize
  const dec        = symbol.decimals
  const pipSize    = symbol.pipSize

  // Pending order type label
  const pendingLabel = (() => {
    if (orderType !== 'pending' || !entryVal) return null
    const ep = parseFloat(entryVal)
    if (isNaN(ep)) return null
    if (side === 'buy')  return ep > marketPrice ? 'Buy Stop'   : 'Buy Limit'
    return                       ep > marketPrice ? 'Sell Limit' : 'Sell Stop'
  })()

  // ── Risk stats (direction-aware) ─────────────────────────────
  const slNum  = slVal  ? parseFloat(slVal)  : null
  const tpNum  = tpVal  ? parseFloat(tpVal)  : null

  // For sell: profit = price goes DOWN. TP below entry = profit, SL above = loss
  const tpIsProfit = tpNum != null && (
    side === 'buy'  ? tpNum > entryNum :
                      tpNum < entryNum
  )
  const slIsLoss = slNum != null && (
    side === 'buy'  ? slNum < entryNum :
                      slNum > entryNum
  )

  const slPips = slNum != null ? Math.abs(entryNum - slNum) / pipSize : null
  const tpPips = tpNum != null ? Math.abs(entryNum - tpNum) / pipSize : null
  const slUsd  = slNum != null ? Math.abs(calcPnl(side, entryNum, slNum, qtyNum, cs)) : null
  const tpUsd  = tpNum != null ? Math.abs(calcPnl(side, entryNum, tpNum, qtyNum, cs)) : null
  const slPct  = slUsd != null && balance > 0 ? slUsd / balance * 100 : null
  const tpPct  = tpUsd != null && balance > 0 ? tpUsd / balance * 100 : null

  // Sign based on whether TP/SL is profit or loss
  const tpSign = tpIsProfit ? '+' : '−'
  const slSign = slIsLoss   ? '−' : '+'
  const tpColor = tpIsProfit ? 'var(--green)' : 'var(--red)'
  const slColor = slIsLoss   ? 'var(--red)'   : 'var(--green)'

  const adjustQty    = (d: number) => setQty(Math.max(0.01, (parseFloat(qty)||0.01)+d).toFixed(2))
  const adjustEntry  = (d: number) => setEntryVal(((parseFloat(entryVal)||marketPrice)+d).toFixed(dec))
  const getFirstProtectivePrice = (kind: 'sl' | 'tp') => {
    const dir = (
      (side === 'buy'  && kind === 'tp') ||
      (side === 'sell' && kind === 'sl')
    ) ? 1 : -1
    return entryNum + dir * INITIAL_PROTECTIVE_OFFSET
  }
  const isValidProtectivePrice = (kind: 'sl' | 'tp', price: number) => {
    if (kind === 'tp') return side === 'buy' ? price > entryNum : price < entryNum
    return side === 'buy' ? price < entryNum : price > entryNum
  }
  const getProtectiveStep = (kind: 'sl' | 'tp', action: 'plus' | 'minus') => {
    const awayFromEntry = (
      (side === 'buy'  && kind === 'tp') ||
      (side === 'sell' && kind === 'sl')
    ) ? STEP : -STEP
    return action === 'plus' ? awayFromEntry : -awayFromEntry
  }
  const adjustProtective = (kind: 'sl' | 'tp', current: number | null, action: 'plus' | 'minus', setValue: (v: string) => void) => {
    const next = current == null || !isValidProtectivePrice(kind, current)
      ? getFirstProtectivePrice(kind)
      : current + getProtectiveStep(kind, action)
    setValue(next.toFixed(dec))
  }
  const adjustSL = (action: 'plus' | 'minus') => adjustProtective('sl', slNum, action, setSlVal)
  const adjustTP = (action: 'plus' | 'minus') => adjustProtective('tp', tpNum, action, setTpVal)

  const entryFieldLabel = orderType === 'pending' ? 'Open Price' : 'Order Price'
  const entryFieldSuffix = orderType === 'pending'
    ? (pendingLabel ?? 'Price')
    : activeSide ? activeSide[0].toUpperCase() + activeSide.slice(1) : 'Price'

  const handleConfirm = async () => {
    let success = false
    if (activeSide === 'buy')  success = await onBuy()
    if (activeSide === 'sell') success = await onSell()
    if (!success) return
    resetDraftFields()
    setSide(null)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>

      {/* ── Sell / Buy cards ── */}
      <div style={{ display:'flex', position:'relative', gap: 6, padding: '10px 12px 0' }}>
        <button onClick={() => setSide(activeSide === 'buy' ? null : 'buy')} style={{
          flex: 1, padding: '10px 10px 10px', textAlign: 'left',
          borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
          border: activeSide === 'buy' ? '2px solid var(--accent)' : '2px solid var(--border-default)',
          background: activeSide === 'buy' ? 'rgba(59,130,246,0.14)' : 'var(--bg-tertiary)',
        }}>
          <p style={{ fontSize: 10, color: activeSide === 'buy' ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 700, marginBottom: 3, textTransform:'uppercase', letterSpacing:'0.05em' }}>Buy</p>
          <p style={{ fontSize: 14, fontWeight: 800, fontFamily: 'monospace', color: 'var(--accent)' }}>
            {buyPrice ? fmtPrice(buyPrice, dec) : '—'}
          </p>
        </button>

        {/* Spread */}
        <div style={{
          position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)',
          background:'var(--bg-elevated)', border:'1px solid var(--border-default)',
          borderRadius:4, padding:'2px 6px', fontSize:9, color:'var(--text-muted)',
          fontFamily:'monospace', whiteSpace:'nowrap', zIndex:1, marginTop:6,
        }}>
          {pipSize > 0 ? ((buyPrice-sellPrice)/pipSize).toFixed(1) : '0'} USD
        </div>

        {/* Sell */}
        <button onClick={() => setSide(activeSide === 'sell' ? null : 'sell')} style={{
          flex: 1, padding: '10px 10px 10px', textAlign: 'right',
          borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
          border: activeSide === 'sell' ? '2px solid var(--red)' : '2px solid var(--border-default)',
          background: activeSide === 'sell' ? 'rgba(239,68,68,0.14)' : 'var(--bg-tertiary)',
        }}>
          <p style={{ fontSize: 10, color: activeSide === 'sell' ? 'var(--red)' : 'var(--text-muted)', fontWeight: 700, marginBottom: 3, textTransform:'uppercase', letterSpacing:'0.05em' }}>Sell</p>
          <p style={{ fontSize: 14, fontWeight: 800, fontFamily: 'monospace', color: 'var(--red)' }}>
            {sellPrice ? fmtPrice(sellPrice, dec) : '—'}
          </p>
        </button>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ flex:1, overflowY:'auto', padding:'12px 12px 0' }}>

        {/* Market / Pending toggle */}
        <div style={{ display:'flex', background:'var(--bg-tertiary)', borderRadius:8, padding:3, marginBottom:14 }}>
          {(['market','pending'] as OrderType[]).map(t => (
            <button key={t} onClick={() => {
              resetDraftFields()
              switchOrder(t)
            }} style={{
              flex:1, padding:'6px', borderRadius:6, border:'none', cursor:'pointer',
              fontSize:12, fontWeight:600, transition:'all 0.15s',
              background: orderType===t ? 'var(--bg-secondary)' : 'transparent',
              color: orderType===t ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: orderType===t ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
            }}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
          ))}
        </div>

        {/* Pending: Entry price + order type label */}
        {orderType === 'pending' && (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <FieldLabel>{entryFieldLabel}</FieldLabel>
              {pendingLabel && (
                <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:4,
                  background: side==='buy'?'rgba(59,130,246,0.12)':'rgba(239,68,68,0.12)',
                  color: side==='buy'?'var(--accent)':'var(--red)' }}>
                  {pendingLabel}
                </span>
              )}
            </div>
            <PriceField
              value={entryVal}
              onChange={setEntryVal}
              placeholder={fmtPrice(marketPrice, dec)}
              suffix={entryFieldSuffix}
              onClear={entryVal ? () => setEntryVal('') : undefined}
              onMinus={() => adjustEntry(-STEP)}
              onPlus={() => adjustEntry(STEP)}
            />
            {entryVal && !isNaN(parseFloat(entryVal)) && (
              <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:8, marginTop:3 }}>
                {((parseFloat(entryVal)-marketPrice)/pipSize).toFixed(1)} pips from market
              </div>
            )}
          </>
        )}

        {/* Volume */}
        <FieldLabel>Volume</FieldLabel>
        <PriceField value={qty} onChange={setQty} suffix="Lots" onMinus={() => adjustQty(-0.01)} onPlus={() => adjustQty(0.01)} />

        {/* Take Profit */}
        <FieldLabel>Take Profit</FieldLabel>
        <PriceField
          value={tpVal} onChange={setTpVal} placeholder="Not set" suffix="Price"
          onClear={tpVal ? () => setTpVal('') : undefined}
          onMinus={() => adjustTP('minus')} onPlus={() => adjustTP('plus')}
          error={tpError} color={tpColor}
        />
        {tpNum != null && tpUsd != null && (
          <div style={{ display:'flex', gap:5, marginTop:4, marginBottom:10, flexWrap:'wrap' }}>
            {tpPips != null && <StatPill value={`${tpSign}${tpPips.toFixed(1)} pips`} color={tpColor} />}
            <StatPill value={`${tpSign}$${tpUsd.toFixed(2)}`} color={tpColor} />
            {tpPct  != null && <StatPill value={`${tpSign}${tpPct.toFixed(2)}%`}      color={tpColor} />}
          </div>
        )}

        {/* Stop Loss */}
        <FieldLabel>Stop Loss</FieldLabel>
        <PriceField
          value={slVal} onChange={setSlVal} placeholder="Not set" suffix="Price"
          onClear={slVal ? () => setSlVal('') : undefined}
          onMinus={() => adjustSL('minus')} onPlus={() => adjustSL('plus')}
          error={slError} color={slColor}
        />
        {slNum != null && slUsd != null && (
          <div style={{ display:'flex', gap:5, marginTop:4, marginBottom:10, flexWrap:'wrap' }}>
            {slPips != null && <StatPill value={`${slSign}${slPips.toFixed(1)} pips`} color={slColor} />}
            <StatPill value={`${slSign}$${slUsd.toFixed(2)}`} color={slColor} />
            {slPct  != null && <StatPill value={`${slSign}${slPct.toFixed(2)}%`}      color={slColor} />}
          </div>
        )}

        {/* R:R */}
        {slUsd != null && tpUsd != null && slUsd > 0 && (
          <div style={{
            display:'flex', justifyContent:'space-between', alignItems:'center',
            background:'var(--bg-tertiary)', borderRadius:8, padding:'8px 12px', marginBottom:12,
          }}>
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>Risk / Reward</span>
            <span style={{ fontSize:13, fontWeight:800,
              color: tpUsd/slUsd>=2?'var(--green)':tpUsd/slUsd>=1?'var(--accent)':'var(--red)' }}>
              1 : {(tpUsd/slUsd).toFixed(2)}
            </span>
          </div>
        )}

        {/* Open positions */}
        {openTr.length > 0 && (
          <div style={{ background:'var(--bg-tertiary)', borderRadius:8, padding:'8px 12px', marginBottom:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:11 }}>
              <span style={{ color:'var(--text-muted)' }}>Open ({openTr.length})</span>
              <span style={{ fontWeight:700, color:openPnl>=0?'var(--green)':'var(--red)' }}>
                {openPnl>=0?'+':''}{openPnl.toFixed(2)} USD
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom confirm ── */}
      <div style={{ padding:'10px 12px 12px', borderTop:'1px solid var(--border-subtle)', flexShrink:0 }}>
        {activeSide ? (
          <>
            <button onClick={handleConfirm} disabled={accountBreached} style={{
              width:'100%', padding:'13px', borderRadius:10, border:'none',
              background: activeSide==='buy'?'var(--accent)':'var(--red)',
              color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer',
              marginBottom:8, opacity:accountBreached?0.4:1, transition:'all 0.15s',
            }}>
              Confirm {activeSide==='buy'?'Buy':'Sell'} {qtyNum.toFixed(2)} lots
              {pendingLabel ? ` · ${pendingLabel}` : ''}
            </button>
            <button onClick={() => setSide(null)} style={{
              width:'100%', padding:'10px', borderRadius:10,
              border:'1px solid var(--border-default)',
              background:'transparent', color:'var(--text-muted)', fontSize:13, cursor:'pointer',
            }}>Cancel</button>
          </>
        ) : (
          <p style={{ textAlign:'center', fontSize:12, color:'var(--text-muted)', padding:'6px 0' }}>
            Select Sell or Buy above to place an order
          </p>
        )}
      </div>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', marginBottom:6 }}>{children}</p>
}

function PriceField({ value, onChange, placeholder, suffix, onClear, onMinus, onPlus, error, color }: {
  value: string; onChange: (v: string) => void; placeholder?: string; suffix?: string
  onClear?: () => void; onMinus: () => void; onPlus: () => void; error?: string; color?: string
}) {
  return (
    <div style={{ marginBottom:4 }}>
      <div style={{
        display:'flex', alignItems:'center',
        background:'var(--bg-primary)',
        border:`1px solid ${error?'var(--red)':'var(--border-default)'}`,
        borderRadius:8, overflow:'hidden',
      }}>
        <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={{ flex:1, padding:'9px 10px', background:'transparent', border:'none',
            fontSize:13, fontFamily:'monospace',
            color: value ? (color??'var(--text-primary)') : 'var(--text-muted)',
            outline:'none', minWidth:0 }} />
        {onClear && (
          <button onClick={onClear} style={{ padding:'0 6px', background:'none', border:'none',
            color:'var(--text-muted)', cursor:'pointer', fontSize:14, lineHeight:1 }}>×</button>
        )}
        {suffix && (
          <span style={{ padding:'0 8px', fontSize:11, color:'var(--text-muted)',
            borderLeft:'1px solid var(--border-subtle)', alignSelf:'stretch',
            display:'flex', alignItems:'center' }}>{suffix}</span>
        )}
        <button onClick={onMinus} style={{ padding:'0 9px', background:'none',
          borderLeft:'1px solid var(--border-subtle)',
          color:'var(--text-muted)', cursor:'pointer', fontSize:16, lineHeight:1,
          alignSelf:'stretch', display:'flex', alignItems:'center' }}>−</button>
        <button onClick={onPlus} style={{ padding:'0 9px', background:'none',
          borderLeft:'1px solid var(--border-subtle)',
          color:'var(--text-muted)', cursor:'pointer', fontSize:16, lineHeight:1,
          alignSelf:'stretch', display:'flex', alignItems:'center' }}>+</button>
      </div>
      {error && <p style={{ fontSize:10, color:'var(--red)', marginTop:3 }}>{error}</p>}
    </div>
  )
}

function StatPill({ value, color }: { value: string; color: string }) {
  return (
    <span style={{ fontSize:10, fontWeight:600, color,
      background:`${color}15`, borderRadius:4, padding:'2px 6px' }}>{value}</span>
  )
}
