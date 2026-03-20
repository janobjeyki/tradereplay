'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LangContext'
import { useTheme } from '@/contexts/ThemeContext'
import { ThemeToggle } from '@/components/ui'
import type { Session, Trade, Candle } from '@/types'
import type { TimeFrame } from '@/lib/loadCsvData'
import { getSymbol } from '@/data/symbols'
import { loadXauUsdData, aggregateCandles } from '@/lib/loadCsvData'
import { calcPnl, checkSlTp, fmtPrice, fmtMoney, interpolateDate, isValidSL, isValidTP, cn } from '@/lib/utils'
import { Spinner, Badge, TabBar } from '@/components/ui'
import { WorkspaceChart } from '@/components/chart/WorkspaceChart'

const SKIP_OPTIONS = [3, 5, 10, 15, 30, 60, 120, 240]
const WEEKDAYS     = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const TIMEFRAMES: TimeFrame[] = ['m1', 'm5', 'm15', 'm30', 'h1', 'h4', 'd1', 'w1', 'M1']
const TIMEZONES = [
  { value: 'UTC',  label: 'UTC',          offset: 0  },
  { value: 'EST',  label: 'EST (NYC)',     offset: -5 },
  { value: 'EDT',  label: 'EDT (NYC)',     offset: -4 },
  { value: 'GMT',  label: 'GMT (London)', offset: 0  },
  { value: 'BST',  label: 'BST (London)', offset: 1  },
  { value: 'CET',  label: 'CET (Europe)', offset: 1  },
  { value: 'CEST', label: 'CEST (Europe)',offset: 2  },
  { value: 'JST',  label: 'JST (Tokyo)',  offset: 9  },
  { value: 'AEDT', label: 'AEDT (Sydney)',offset: 11 },
]

export default function WorkspacePage() {
  const params   = useParams()
  const id       = params.id as string
  const router   = useRouter()
  const { user } = useAuth()
  const { t }    = useLang()
  const { theme, toggleTheme } = useTheme()
  const supabase = createClient()

  const [session,  setSession]  = useState<Session | null>(null)
  const [candles,  setCandles]  = useState<Candle[]>([])
  const [idx,      setIdx]      = useState(80)
  const [trades,   setTrades]   = useState<Trade[]>([])
  const [balance,  setBalance]  = useState(0)
  const [skipVal,  setSkipVal]  = useState(5)
  const [tradeTab, setTradeTab] = useState('open')
  const [loading,  setLoading]  = useState(true)
  const [qty,      setQty]      = useState('0.10')
  const [slVal,    setSlVal]    = useState('')
  const [tpVal,    setTpVal]    = useState('')
  const [timeframe, setTimeframe] = useState<TimeFrame>('m1')
  const [timezone, setTimezone] = useState('UTC')
  // Account breach modal
  const [breached, setBreached] = useState(false)

  const stateRef = useRef({ candles, idx, trades, balance })
  const originalCandlesRef = useRef<Candle[]>([])
  useEffect(() => { stateRef.current = { candles, idx, trades, balance } }, [candles, idx, trades, balance])

  useEffect(() => { if (user && id) init() }, [user, id])

  // Fix 1: preserve current time position when switching timeframes
  useEffect(() => {
    if (!originalCandlesRef.current.length) return
    const currentTime = stateRef.current.candles[stateRef.current.idx - 1]?.time
    const aggregated  = aggregateCandles(originalCandlesRef.current, timeframe)
    setCandles(aggregated)

    if (currentTime) {
      // Find the index of the first candle >= current time
      let newIdx = aggregated.findIndex(c => c.time >= currentTime)
      if (newIdx === -1) newIdx = aggregated.length - 1
      setIdx(Math.max(1, Math.min(newIdx + 1, aggregated.length)))
    } else {
      setIdx(Math.min(80, aggregated.length))
    }
  }, [timeframe])

  async function init() {
    const { data: sess } = await supabase.from('sessions').select('*').eq('id', id).single()
    if (!sess) { router.push('/dashboard/sessions'); return }
    const s = sess as Session
    setSession(s)
    setBalance(s.end_capital)

    let c: Candle[]
    try {
      c = await loadXauUsdData()
    } catch {
      const { data: cache } = await supabase.from('candle_cache').select('candles').eq('session_id', id).single()
      c = (cache?.candles as Candle[]) ?? []
    }

    if (!c.length) {
      alert('Failed to load chart data. Make sure xauusd-m1-2025.csv is in the public/ folder.')
      router.push('/dashboard/sessions')
      return
    }

    const startTs  = Math.floor(new Date(s.start_date).getTime() / 1000)
    const endTs    = Math.floor(new Date(s.end_date).getTime()   / 1000) + 86400
    const filtered = c.filter(candle => candle.time >= startTs && candle.time <= endTs)

    if (!filtered.length) {
      alert('No candles found for the selected date range.')
      router.push('/dashboard/sessions')
      return
    }

    originalCandlesRef.current = filtered
    setCandles(filtered)
    setIdx(s.candle_index > 0 ? Math.min(s.candle_index, filtered.length) : 80)

    const { data: openTrades } = await supabase
      .from('trades').select('*').eq('session_id', id).eq('status', 'open')
    setTrades((openTrades as Trade[]) ?? [])
    setLoading(false)
  }

  const advance = useCallback(async (steps: number) => {
    const { candles: c, idx: i, trades: tr, balance: bal } = stateRef.current
    if (!c.length) return
    const end   = Math.min(i + steps, c.length)
    const slice = c.slice(i, end)

    const sym = getSymbol(stateRef.current.candles.length > 0
      ? (session?.symbol ?? 'XAUUSD') : 'XAUUSD')

    let updatedTrades = [...tr]
    let deltaBal      = 0

    for (const candle of slice) {
      updatedTrades = updatedTrades.map(trade => {
        if (trade.status !== 'open') return trade
        const exitPrice = checkSlTp(trade, candle)
        if (exitPrice !== null) {
          const pnl = calcPnl(trade.side, trade.entry_price, exitPrice, trade.quantity, sym.contractSize)
          deltaBal += pnl
          return { ...trade, status: 'closed' as const, exit_price: exitPrice, pnl, closed_at_idx: end }
        }
        return trade
      })
    }

    const justClosed = updatedTrades.filter((tr2, i2) => tr2.status === 'closed' && tr[i2]?.status === 'open')
    for (const trade of justClosed) {
      await supabase.from('trades').update({
        status: 'closed', exit_price: trade.exit_price, pnl: trade.pnl, closed_at_idx: end,
      }).eq('id', trade.id)
    }

    const newBal = parseFloat((bal + deltaBal).toFixed(2))

    // Fix 3: account breach
    if (newBal <= 0) {
      setBreached(true)
      // Force-close all remaining open trades
      const stillOpen = updatedTrades.filter(t => t.status === 'open')
      for (const trade of stillOpen) {
        await supabase.from('trades').update({ status: 'closed', exit_price: 0, pnl: 0 }).eq('id', trade.id)
      }
      const allClosed = updatedTrades.map(t =>
        t.status === 'open' ? { ...t, status: 'closed' as const, exit_price: 0, pnl: 0 } : t
      )
      setTrades(allClosed)
      setBalance(0)
      await supabase.from('sessions').update({ candle_index: end, end_capital: 0 }).eq('id', id)
      return
    }

    setBalance(newBal)
    setTrades(updatedTrades)
    setIdx(end)

    await supabase.from('sessions').update({
      candle_index: end, end_capital: newBal, is_completed: end >= c.length,
    }).eq('id', id)
  }, [id, supabase, session])

  async function execTrade(side: 'buy' | 'sell') {
    // Fix 3: block trading if breached
    if (breached) return

    const { candles: c, idx: i } = stateRef.current
    const cur = c[i - 1]
    if (!cur || !session) return

    const sym   = getSymbol(session.symbol)
    const entry = cur.close
    const parsedSl = slVal ? parseFloat(slVal) : null
    const parsedTp = tpVal ? parseFloat(tpVal) : null

    // Fix 5: validate SL/TP direction
    if (parsedSl !== null && !isValidSL(side, entry, parsedSl)) {
      alert(side === 'buy'
        ? 'Stop Loss must be below entry price for a Buy order.'
        : 'Stop Loss must be above entry price for a Sell order.')
      return
    }
    if (parsedTp !== null && !isValidTP(side, entry, parsedTp)) {
      alert(side === 'buy'
        ? 'Take Profit must be above entry price for a Buy order.'
        : 'Take Profit must be below entry price for a Sell order.')
      return
    }

    const day = WEEKDAYS[new Date().getDay() - 1] ?? WEEKDAYS[0]
    const { data } = await supabase.from('trades').insert({
      session_id: id, user_id: user!.id, side,
      entry_price: entry,
      quantity: parseFloat(qty) || 0.1,
      stop_loss:   parsedSl,
      take_profit: parsedTp,
      status: 'open', opened_at_idx: i, weekday: day,
    }).select().single()
    if (data) setTrades(prev => [...prev, data as Trade])
  }

  async function closeTrade(tradeId: string) {
    const { candles: c, idx: i, balance: bal } = stateRef.current
    const cur   = c[i - 1]
    const trade = stateRef.current.trades.find(t => t.id === tradeId)
    if (!cur || !trade) return
    const sym    = getSymbol(session?.symbol ?? 'XAUUSD')
    const pnl    = calcPnl(trade.side, trade.entry_price, cur.close, trade.quantity, sym.contractSize)
    const newBal = parseFloat((bal + pnl).toFixed(2))
    await supabase.from('trades').update({
      status: 'closed', exit_price: cur.close, pnl, closed_at_idx: i,
    }).eq('id', tradeId)
    await supabase.from('sessions').update({ end_capital: newBal }).eq('id', id)
    setTrades(prev => prev.map(t =>
      t.id === tradeId ? { ...t, status: 'closed' as const, exit_price: cur.close, pnl, closed_at_idx: i } : t
    ))
    setBalance(newBal)

    // Fix 3: check breach after manual close
    if (newBal <= 0) setBreached(true)
  }

  const handleSetSL = async (tradeId: string, price: number) => {
    const val = price === 0 ? null : price
    // Fix 5: validate direction
    if (val !== null) {
      const trade = stateRef.current.trades.find(t => t.id === tradeId)
      if (trade && !isValidSL(trade.side, trade.entry_price, val)) return
    }
    await supabase.from('trades').update({ stop_loss: val }).eq('id', tradeId)
    setTrades(prev => prev.map(t => t.id === tradeId ? { ...t, stop_loss: val } : t))
  }

  const handleSetTP = async (tradeId: string, price: number) => {
    const val = price === 0 ? null : price
    // Fix 5: validate direction
    if (val !== null) {
      const trade = stateRef.current.trades.find(t => t.id === tradeId)
      if (trade && !isValidTP(trade.side, trade.entry_price, val)) return
    }
    await supabase.from('trades').update({ take_profit: val }).eq('id', tradeId)
    setTrades(prev => prev.map(t => t.id === tradeId ? { ...t, take_profit: val } : t))
  }

  if (loading || !session) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4" style={{background:'var(--bg-primary)'}}>
        <Spinner size="lg"/>
        <p className="text-sm" style={{color:'var(--text-muted)'}}>{t('loading')}</p>
      </div>
    )
  }

  const sym      = getSymbol(session.symbol)
  const cur      = candles[idx - 1]
  const done     = idx >= candles.length
  const openTr   = trades.filter(t => t.status === 'open')
  const closedTr = trades.filter(t => t.status === 'closed')
  const openPnl  = cur
    ? openTr.reduce((a, tr) => a + calcPnl(tr.side, tr.entry_price, cur.close, tr.quantity, sym.contractSize), 0)
    : 0
  const progress = Math.round((idx / candles.length) * 100)

  const getFormattedDate = (timestamp: number, tzValue: string) => {
    const tzInfo = TIMEZONES.find(tz => tz.value === tzValue)
    if (!tzInfo) return new Date(timestamp * 1000).toLocaleString('en-GB')
    const utcDate = new Date(timestamp * 1000)
    const tzDate  = new Date(utcDate.getTime() + tzInfo.offset * 3600000)
    return tzDate.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  }

  const dateStr = cur?.time
    ? getFormattedDate(cur.time, timezone)
    : interpolateDate(session.start_date, session.end_date, idx, candles.length)

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{background:'var(--bg-primary)'}}>

      {/* ── Account Breach Modal ── */}
      {breached && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--red)',
            borderRadius: 16,
            padding: '40px 48px',
            textAlign: 'center',
            maxWidth: 420,
            boxShadow: '0 8px 40px rgba(239,68,68,0.3)',
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>💥</div>
            <h2 style={{ color: 'var(--red)', fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
              Account Breached
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              Your balance has reached $0. All positions have been closed.
              You cannot place new trades in this session.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={() => router.push('/dashboard/sessions')}
                style={{
                  background: 'var(--red)', color: '#fff',
                  border: 'none', borderRadius: 8,
                  padding: '10px 24px', fontWeight: 700,
                  fontSize: 14, cursor: 'pointer',
                }}
              >
                Back to Sessions
              </button>
              <button
                onClick={() => setBreached(false)}
                style={{
                  background: 'transparent', color: 'var(--text-secondary)',
                  border: '1px solid var(--border-default)', borderRadius: 8,
                  padding: '10px 24px', fontWeight: 600,
                  fontSize: 14, cursor: 'pointer',
                }}
              >
                View Chart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 shrink-0 flex-wrap min-h-[44px]"
        style={{borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-secondary)'}}>
        <button onClick={() => router.push('/dashboard/sessions')}
          className="text-sm rounded-lg px-3 py-1.5 transition-all shrink-0"
          style={{color:'var(--text-secondary)', border:'1px solid var(--border-default)'}}>
          ← Back
        </button>

        <Badge variant="blue">{session.symbol}</Badge>
        <span className="text-xs truncate max-w-[180px]" style={{color:'var(--text-muted)'}}>{session.name}</span>

        {cur && (
          <div className="flex gap-3 ml-1">
            {([['O',cur.open],['H',cur.high],['L',cur.low],['C',cur.close]] as [string,number][]).map(([lb,v]) => (
              <div key={lb} className="flex gap-1 items-baseline">
                <span className="text-[9px] uppercase leading-none" style={{color:'var(--text-muted)'}}>{lb}</span>
                <span className="font-mono text-[11px]" style={{color:
                  lb==='H' ? 'var(--green)' :
                  lb==='L' ? 'var(--red)'   :
                  lb==='C' ? (cur.close>=cur.open ? 'var(--green)' : 'var(--red)') :
                  'var(--text-primary)'}}>
                  {fmtPrice(v, sym.decimals)}
                </span>
              </div>
            ))}
          </div>
        )}

        <span className="font-mono text-[10px]" style={{color:'var(--text-muted)'}}>{dateStr}</span>

        <div className="ml-auto flex items-center gap-4 shrink-0">
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-wide" style={{color:'var(--text-muted)'}}>{t('balance')}</p>
            <p className="font-mono font-bold text-base" style={{color: balance <= 0 ? 'var(--red)' : 'var(--accent)'}}>{fmtMoney(balance)}</p>
          </div>
          {openPnl !== 0 && (
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-wide" style={{color:'var(--text-muted)'}}>{t('openPnl')}</p>
              <p className="font-mono font-semibold text-sm" style={{color: openPnl>=0 ? 'var(--green)' : 'var(--red)'}}>
                {openPnl>=0?'+':''}{openPnl.toFixed(2)}
              </p>
            </div>
          )}
          <ThemeToggle theme={theme} onToggle={toggleTheme}/>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Chart column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, minHeight: 0 }}>

          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
            <WorkspaceChart
              candles={candles.slice(0, idx)}
              openTrades={openTr}
              symbol={sym}
              onSetSL={handleSetSL}
              onSetTP={handleSetTP}
              onCloseTrade={closeTrade}
            />
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 px-4 py-2.5 shrink-0 flex-wrap"
            style={{borderTop:'1px solid var(--border-subtle)', background:'var(--bg-secondary)'}}>
            <button onClick={() => advance(1)} disabled={done || breached}
              className="px-4 py-2 font-bold text-sm rounded-lg text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{background:'var(--accent)'}}>
              {t('nextCandle')}
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{color:'var(--text-muted)'}}>{t('skip')}</span>
              <select value={skipVal} onChange={e=>setSkipVal(Number(e.target.value))}
                className="rounded-lg px-2 py-1.5 text-xs outline-none w-16 cursor-pointer"
                style={{background:'var(--bg-tertiary)', border:'1px solid var(--border-default)', color:'var(--text-primary)'}}>
                {SKIP_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="text-xs" style={{color:'var(--text-muted)'}}>{t('candles')}</span>
              <button onClick={() => advance(skipVal)} disabled={done || breached}
                className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{border:'1px solid var(--border-default)', color:'var(--text-secondary)'}}>
                →
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{color:'var(--text-muted)'}}>Timeframe</span>
              <select value={timeframe} onChange={e=>setTimeframe(e.target.value as TimeFrame)}
                className="rounded-lg px-2 py-1.5 text-xs outline-none cursor-pointer"
                style={{background:'var(--bg-tertiary)', border:'1px solid var(--border-default)', color:'var(--text-primary)'}}>
                {TIMEFRAMES.map(tf => <option key={tf} value={tf}>{tf.toUpperCase()}</option>)}
              </select>
            </div>
            {done && (
              <span className="text-xs font-semibold px-3 py-1 rounded-full"
                style={{background:'var(--accent-muted)', color:'var(--accent)', border:'1px solid var(--accent-border)'}}>
                {t('allCandlesRevealed')}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2 min-w-[200px]">
              <div className="flex-1 h-1 rounded-full overflow-hidden" style={{background:'var(--border-subtle)'}}>
                <div className="h-full rounded-full transition-all duration-300" style={{width:`${progress}%`, background:'var(--accent)'}}/>
              </div>
              <span className="text-xs" style={{color:'var(--text-muted)'}}>Timezone</span>
              <select value={timezone} onChange={e=>setTimezone(e.target.value)}
                className="rounded-lg px-2 py-1 text-xs outline-none cursor-pointer"
                style={{background:'var(--bg-tertiary)', border:'1px solid var(--border-default)', color:'var(--text-primary)'}}>
                {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
              </select>
            </div>
          </div>

          {/* Trades table */}
          <div className="h-48 flex flex-col shrink-0" style={{borderTop:'1px solid var(--border-subtle)'}}>
            <TabBar
              tabs={[
                {key:'open',   label:`${t('openPositions')} (${openTr.length})`},
                {key:'closed', label:`${t('closedTrades')} (${closedTr.length})`},
              ]}
              active={tradeTab} onChange={setTradeTab}
            />
            <div className="flex-1 overflow-y-auto text-xs">
              {tradeTab === 'open' ? (
                openTr.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-sm" style={{color:'var(--text-muted)'}}>{t('noOpenTrades')}</div>
                ) : (
                  <table className="w-full">
                    <thead className="sticky top-0" style={{background:'var(--bg-secondary)'}}>
                      <tr>
                        {['Side','Entry','SL','TP','Qty','Unreal. P&L',''].map((h,i) => (
                          <th key={i} className="text-left px-3 py-1.5 font-normal text-[9px] uppercase tracking-widest" style={{color:'var(--text-muted)'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {openTr.map(tr => {
                        const upnl = cur ? calcPnl(tr.side, tr.entry_price, cur.close, tr.quantity, sym.contractSize) : 0
                        return (
                          <tr key={tr.id} style={{borderBottom:'1px solid var(--border-subtle)'}}>
                            <td className="px-3 py-2"><Badge variant={tr.side==='buy'?'green':'red'}>{tr.side.toUpperCase()}</Badge></td>
                            <td className="px-3 py-2 font-mono">{fmtPrice(tr.entry_price, sym.decimals)}</td>
                            <td className="px-3 py-2 font-mono" style={{color:'var(--text-muted)'}}>{tr.stop_loss   ? fmtPrice(tr.stop_loss,   sym.decimals) : '—'}</td>
                            <td className="px-3 py-2 font-mono" style={{color:'var(--text-muted)'}}>{tr.take_profit ? fmtPrice(tr.take_profit, sym.decimals) : '—'}</td>
                            <td className="px-3 py-2 font-mono">{tr.quantity}L</td>
                            <td className="px-3 py-2 font-mono font-semibold" style={{color: upnl>=0?'var(--green)':'var(--red)'}}>
                              {upnl>=0?'+':''}{upnl.toFixed(2)}
                            </td>
                            <td className="px-3 py-2">
                              <button onClick={() => closeTrade(tr.id)}
                                className="rounded px-2 py-0.5 text-[10px] transition-colors"
                                style={{color:'var(--red)', border:'1px solid var(--red-muted)'}}>
                                {t('close')}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )
              ) : (
                closedTr.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-sm" style={{color:'var(--text-muted)'}}>{t('noClosedTrades')}</div>
                ) : (
                  <table className="w-full">
                    <thead className="sticky top-0" style={{background:'var(--bg-secondary)'}}>
                      <tr>
                        {['Side','Entry','Exit','Qty','P&L'].map((h,i) => (
                          <th key={i} className="text-left px-3 py-1.5 font-normal text-[9px] uppercase tracking-widest" style={{color:'var(--text-muted)'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {closedTr.map(tr => (
                        <tr key={tr.id} style={{borderBottom:'1px solid var(--border-subtle)'}}>
                          <td className="px-3 py-2"><Badge variant={tr.side==='buy'?'green':'red'}>{tr.side.toUpperCase()}</Badge></td>
                          <td className="px-3 py-2 font-mono">{fmtPrice(tr.entry_price, sym.decimals)}</td>
                          <td className="px-3 py-2 font-mono">{tr.exit_price ? fmtPrice(tr.exit_price, sym.decimals) : '—'}</td>
                          <td className="px-3 py-2 font-mono">{tr.quantity}L</td>
                          <td className="px-3 py-2 font-mono font-semibold" style={{color:(tr.pnl??0)>=0?'var(--green)':'var(--red)'}}>
                            {(tr.pnl??0)>=0?'+':''}{(tr.pnl??0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="w-52 shrink-0 flex flex-col gap-3 overflow-y-auto p-3"
          style={{borderLeft:'1px solid var(--border-subtle)', background:'var(--bg-secondary)'}}>

          <div className="rounded-xl p-4" style={{background:'var(--bg-tertiary)', border:'1px solid var(--border-subtle)'}}>
            <p className="text-[9px] uppercase tracking-widest mb-1.5" style={{color:'var(--text-muted)'}}>{t('currentPrice')}</p>
            <p className="font-mono text-xl font-bold" style={{color:'var(--accent)'}}>
              {cur ? fmtPrice(cur.close, sym.decimals) : '—'}
            </p>
            <div className="flex gap-4 mt-2.5">
              <div>
                <p className="text-[9px] uppercase" style={{color:'var(--text-muted)'}}>High</p>
                <p className="font-mono text-xs" style={{color:'var(--green)'}}>{cur ? fmtPrice(cur.high, sym.decimals) : '—'}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase" style={{color:'var(--text-muted)'}}>Low</p>
                <p className="font-mono text-xs" style={{color:'var(--red)'}}>{cur ? fmtPrice(cur.low, sym.decimals) : '—'}</p>
              </div>
            </div>
          </div>

          {/* Trade panel — disabled when breached */}
          <div className="rounded-xl p-4 flex flex-col gap-3"
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-subtle)',
              opacity: breached ? 0.5 : 1,
              pointerEvents: breached ? 'none' : 'auto',
            }}>
            {[
              {label:t('quantity'),   val:qty,   setVal:setQty,   step:'0.01', min:'0.01', focusColor:'var(--accent)'},
              {label:t('stopLoss'),   val:slVal, setVal:setSlVal, step:'0.1',  focusColor:'var(--red)'},
              {label:t('takeProfit'), val:tpVal, setVal:setTpVal, step:'0.1',  focusColor:'var(--green)'},
            ].map(f => (
              <div key={f.label}>
                <p className="text-[9px] uppercase tracking-widest mb-1.5" style={{color:'var(--text-muted)'}}>{f.label}</p>
                <input type="number" value={f.val} step={f.step} min={f.min}
                  onChange={e=>f.setVal(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm font-mono outline-none transition-colors"
                  style={{background:'var(--bg-primary)', border:'1px solid var(--border-default)', color:'var(--text-primary)'}}
                  onFocus={e=>{e.currentTarget.style.borderColor=f.focusColor}}
                  onBlur={e=>{e.currentTarget.style.borderColor='var(--border-default)'}}
                />
              </div>
            ))}
            <div className="flex flex-col gap-2 pt-1">
              <button onClick={() => execTrade('buy')}
                className="w-full py-3 font-bold text-sm rounded-lg text-white transition-all active:scale-[0.98]"
                style={{background:'var(--green)'}}>
                {t('buy')}
              </button>
              <button onClick={() => execTrade('sell')}
                className="w-full py-3 font-bold text-sm rounded-lg text-white transition-all active:scale-[0.98]"
                style={{background:'var(--red)'}}>
                {t('sell')}
              </button>
            </div>
          </div>

          {openTr.length > 0 && (
            <div className="rounded-xl p-4" style={{background:'var(--bg-tertiary)', border:'1px solid var(--border-subtle)'}}>
              <p className="text-[9px] uppercase tracking-widest mb-1.5" style={{color:'var(--text-muted)'}}>Open ({openTr.length})</p>
              <p className="font-mono text-sm font-semibold" style={{color: openPnl>=0?'var(--green)':'var(--red)'}}>
                {openPnl>=0?'+':''}{openPnl.toFixed(2)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
