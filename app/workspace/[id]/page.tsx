'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LangContext'
import { useTheme } from '@/contexts/ThemeContext'
import { ThemeToggle } from '@/components/ui'
import type { Session, Trade, Candle, Symbol } from '@/types'
import type { TimeFrame } from '@/lib/loadCsvData'
import { getSymbol } from '@/data/symbols'
import { loadXauUsdData, aggregateCandles } from '@/lib/loadCsvData'
import { calcPnl, checkSlTp, fmtPrice, fmtMoney, interpolateDate, cn } from '@/lib/utils'
import { Spinner, Badge, TabBar } from '@/components/ui'
import { WorkspaceChart } from '@/components/chart/WorkspaceChart'

const SKIP_OPTIONS = [3, 5, 10, 15, 30, 60, 120, 240]
const WEEKDAYS     = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const TIMEFRAMES: TimeFrame[] = ['m1', 'm5', 'm15', 'm30', 'h1', 'h4', 'd1', 'w1', 'M1']
const TIMEZONES = [
  { value: 'UTC',  label: 'UTC',          offset: 0  },
  { value: 'EST',  label: 'EST (NYC)',     offset: -5 },
  { value: 'EDT',  label: 'EDT (NYC)',     offset: -4 },
  { value: 'GMT',  label: 'GMT (London)',  offset: 0  },
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

  const [session,         setSession]         = useState<Session | null>(null)
  const [candles,         setCandles]         = useState<Candle[]>([])
  const [idx,             setIdx]             = useState(0)
  const [trades,          setTrades]          = useState<Trade[]>([])
  const [balance,         setBalance]         = useState(0)
  const [skipVal,         setSkipVal]         = useState(5)
  const [tradeTab,        setTradeTab]        = useState('open')
  const [loading,         setLoading]         = useState(true)
  const [qty,             setQty]             = useState('0.10')
  const [slVal,           setSlVal]           = useState('')
  const [tpVal,           setTpVal]           = useState('')
  const [timeframe,       setTimeframe]       = useState<TimeFrame>('m1')
  const [timezone,        setTimezone]        = useState('UTC')
  const [accountBreached, setAccountBreached] = useState(false)
  const [slError,         setSlError]         = useState('')
  const [tpError,         setTpError]         = useState('')

  // originalCandlesRef: ALL m1 candles from year-start → session end_date
  const originalCandlesRef  = useRef<Candle[]>([])
  // playableStartIdxRef: index into originalCandlesRef where session start_date begins
  const playableStartIdxRef = useRef<number>(0)

  const stateRef = useRef({ candles, idx, trades, balance })
  const symRef   = useRef<Symbol>(getSymbol('XAUUSD'))

  useEffect(() => { stateRef.current = { candles, idx, trades, balance } }, [candles, idx, trades, balance])
  useEffect(() => { if (user && id) init() }, [user, id])

  // ── Fix 2: Timeframe change — preserve timestamp using last candle <= currentTs ──
  useEffect(() => {
    if (!originalCandlesRef.current.length) return

    // Capture the *current* visible timestamp BEFORE re-aggregating
    const currentTs = stateRef.current.candles[stateRef.current.idx - 1]?.time ?? null
    const aggregated = aggregateCandles(originalCandlesRef.current, timeframe)
    setCandles(aggregated)

    if (currentTs != null) {
      // Find the last aggregated candle whose open time <= currentTs
      // (opposite of >= which caused jumping forward on higher TFs)
      let newIdx = playableStartIdxRef.current > 0
        ? Math.max(1, playableStartIdxRef.current)
        : 1
      for (let i = 0; i < aggregated.length; i++) {
        if (aggregated[i].time <= currentTs) newIdx = i + 1
        else break
      }
      setIdx(Math.min(newIdx, aggregated.length))
    }
  }, [timeframe])

  async function init() {
    const { data: sess } = await supabase.from('sessions').select('*').eq('id', id).single()
    if (!sess) { router.push('/dashboard/sessions'); return }
    const s = sess as Session
    setSession(s)
    setBalance(s.end_capital)
    symRef.current = getSymbol(s.symbol)

    let m1: Candle[]
    try {
      m1 = await loadXauUsdData()
    } catch {
      const { data: cache } = await supabase.from('candle_cache').select('candles').eq('session_id', id).single()
      m1 = (cache?.candles as Candle[]) ?? []
    }

    if (!m1.length) {
      alert('Failed to load chart data. Make sure xauusd-m1-2025.csv is in the public/ folder.')
      router.push('/dashboard/sessions')
      return
    }

    const startTs = Math.floor(new Date(s.start_date).getTime() / 1000)
    const endTs   = Math.floor(new Date(s.end_date).getTime()   / 1000) + 86400

    // Fix 1: include ALL candles from the very first available candle up to end_date
    // so the chart shows full history context before start_date
    const allUpToEnd = m1.filter(c => c.time <= endTs)

    if (!allUpToEnd.length) {
      alert('No candles found for the selected date range.')
      router.push('/dashboard/sessions')
      return
    }

    // Find where the playable session starts (first candle >= start_date)
    let playableStart = allUpToEnd.findIndex(c => c.time >= startTs)
    if (playableStart < 0) playableStart = allUpToEnd.length

    originalCandlesRef.current  = allUpToEnd
    playableStartIdxRef.current = playableStart

    setCandles(allUpToEnd)

    // Initial idx = playableStart (shows all history up to start_date, nothing playable yet)
    // If session was already in progress (candle_index > 0), offset by playableStart
    const savedProgress = s.candle_index > 0 ? s.candle_index : 0
    setIdx(Math.min(playableStart + savedProgress, allUpToEnd.length))

    const { data: openTrades } = await supabase
      .from('trades').select('*').eq('session_id', id).eq('status', 'open')
    setTrades((openTrades as Trade[]) ?? [])
    setLoading(false)
  }

  // ── Advance candles + Fix 4: breach on equity ≤ 0 ───────────────
  const advance = useCallback(async (steps: number) => {
    if (accountBreached) return
    const { candles: c, idx: i, trades: tr, balance: bal } = stateRef.current
    if (!c.length) return
    const cs  = symRef.current.contractSize
    const end = Math.min(i + steps, c.length)
    const slice = c.slice(i, end)
    let updatedTrades = [...tr]
    let deltaBal      = 0

    for (const candle of slice) {
      updatedTrades = updatedTrades.map(trade => {
        if (trade.status !== 'open') return trade
        const exitPrice = checkSlTp(trade, candle)
        if (exitPrice !== null) {
          const pnl = calcPnl(trade.side, trade.entry_price, exitPrice, trade.quantity, cs)
          deltaBal += pnl
          return { ...trade, status: 'closed' as const, exit_price: exitPrice, pnl, closed_at_idx: end }
        }
        return trade
      })
    }

    const justClosed = updatedTrades.filter((t2, i2) => t2.status === 'closed' && tr[i2]?.status === 'open')
    for (const trade of justClosed) {
      await supabase.from('trades').update({
        status: 'closed', exit_price: trade.exit_price, pnl: trade.pnl, closed_at_idx: end,
      }).eq('id', trade.id)
    }

    const newBal = parseFloat(Math.max(0, bal + deltaBal).toFixed(2))

    // Fix 4: compute equity = newBal + unrealized PnL of still-open trades at last candle
    const lastCandle  = c[end - 1]
    const stillOpen   = updatedTrades.filter(t => t.status === 'open')
    const unrealised  = lastCandle
      ? stillOpen.reduce((a, t) => a + calcPnl(t.side, t.entry_price, lastCandle.close, t.quantity, cs), 0)
      : 0
    const equity      = newBal + unrealised
    const breached    = equity <= 0

    setBalance(newBal)
    setTrades(updatedTrades)
    setIdx(end)
    if (breached) setAccountBreached(true)

    // Progress is relative to the playable portion only
    const playable    = c.length - playableStartIdxRef.current
    const progress    = Math.max(0, end - playableStartIdxRef.current)
    await supabase.from('sessions').update({
      candle_index: progress,
      end_capital:  newBal,
      is_completed: end >= c.length || breached,
    }).eq('id', id)
  }, [id, supabase, accountBreached])

  async function execTrade(side: 'buy' | 'sell') {
    if (accountBreached) return
    const { candles: c, idx: i } = stateRef.current
    const cur = c[i - 1]
    if (!cur || !session) return
    const entry = cur.close

    if (slVal) {
      const sl = parseFloat(slVal)
      if (!isNaN(sl)) {
        if (side === 'buy'  && sl >= entry) { setSlError('SL must be below entry for a buy'); return }
        if (side === 'sell' && sl <= entry) { setSlError('SL must be above entry for a sell'); return }
      }
    }
    setSlError('')

    if (tpVal) {
      const tp = parseFloat(tpVal)
      if (!isNaN(tp)) {
        if (side === 'buy'  && tp <= entry) { setTpError('TP must be above entry for a buy'); return }
        if (side === 'sell' && tp >= entry) { setTpError('TP must be below entry for a sell'); return }
      }
    }
    setTpError('')

    const day = WEEKDAYS[new Date().getDay() - 1] ?? WEEKDAYS[0]
    const { data } = await supabase.from('trades').insert({
      session_id: id, user_id: user!.id, side,
      entry_price: entry,
      quantity:    parseFloat(qty) || 0.1,
      stop_loss:   slVal ? parseFloat(slVal) : null,
      take_profit: tpVal ? parseFloat(tpVal) : null,
      status: 'open', opened_at_idx: i, weekday: day,
    }).select().single()
    if (data) setTrades(prev => [...prev, data as Trade])
  }

  async function closeTrade(tradeId: string) {
    const { candles: c, idx: i, balance: bal } = stateRef.current
    const cur   = c[i - 1]
    const trade = stateRef.current.trades.find(t => t.id === tradeId)
    if (!cur || !trade) return
    const cs     = symRef.current.contractSize
    const pnl    = calcPnl(trade.side, trade.entry_price, cur.close, trade.quantity, cs)
    const newBal = parseFloat(Math.max(0, bal + pnl).toFixed(2))

    // Fix 4: after closing, check equity with remaining open trades
    const remaining  = stateRef.current.trades.filter(t => t.status === 'open' && t.id !== tradeId)
    const unrealised = remaining.reduce((a, t) => a + calcPnl(t.side, t.entry_price, cur.close, t.quantity, cs), 0)
    const breached   = newBal + unrealised <= 0

    await supabase.from('trades').update({
      status: 'closed', exit_price: cur.close, pnl, closed_at_idx: i,
    }).eq('id', tradeId)
    await supabase.from('sessions').update({ end_capital: newBal }).eq('id', id)

    setTrades(prev => prev.map(t =>
      t.id === tradeId ? { ...t, status: 'closed' as const, exit_price: cur.close, pnl, closed_at_idx: i } : t
    ))
    setBalance(newBal)
    if (breached) setAccountBreached(true)
  }

  const handleSetSL = async (tradeId: string, price: number) => {
    if (price !== 0) {
      const trade = stateRef.current.trades.find(t => t.id === tradeId)
      if (trade) {
        if (trade.side === 'buy'  && price >= trade.entry_price) return
        if (trade.side === 'sell' && price <= trade.entry_price) return
      }
    }
    const val = price === 0 ? null : parseFloat(price.toFixed(symRef.current.decimals))
    await supabase.from('trades').update({ stop_loss: val }).eq('id', tradeId)
    setTrades(prev => prev.map(t => t.id === tradeId ? { ...t, stop_loss: val } : t))
  }

  const handleSetTP = async (tradeId: string, price: number) => {
    if (price !== 0) {
      const trade = stateRef.current.trades.find(t => t.id === tradeId)
      if (trade) {
        if (trade.side === 'buy'  && price <= trade.entry_price) return
        if (trade.side === 'sell' && price >= trade.entry_price) return
      }
    }
    const val = price === 0 ? null : parseFloat(price.toFixed(symRef.current.decimals))
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

  const sym      = symRef.current
  const cur      = candles[idx - 1]
  const playable = candles.length - playableStartIdxRef.current
  const progress = playable > 0
    ? Math.round(Math.max(0, idx - playableStartIdxRef.current) / playable * 100)
    : 0
  const done     = idx >= candles.length
  const openTr   = trades.filter(t => t.status === 'open')
  const closedTr = trades.filter(t => t.status === 'closed')
  const openPnl  = cur
    ? openTr.reduce((a, tr) => a + calcPnl(tr.side, tr.entry_price, cur.close, tr.quantity, sym.contractSize), 0)
    : 0

  // Fix 4: equity shown in top bar
  const equity = parseFloat((balance + openPnl).toFixed(2))

  const getFormattedDate = (timestamp: number, tzValue: string) => {
    const tzInfo = TIMEZONES.find(tz => tz.value === tzValue)
    if (!tzInfo) return new Date(timestamp * 1000).toLocaleString('en-GB')
    const tzDate = new Date(timestamp * 1000 + tzInfo.offset * 3600 * 1000)
    return tzDate.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const dateStr = cur?.time
    ? getFormattedDate(cur.time, timezone)
    : interpolateDate(session.start_date, session.end_date, idx, candles.length)

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{background:'var(--bg-primary)'}}>

      {/* Account Breached Modal — Fix 4 */}
      {accountBreached && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '2px solid #ef4444',
            borderRadius: 16,
            padding: '2.5rem 2rem',
            maxWidth: 380,
            textAlign: 'center',
            boxShadow: '0 8px 40px rgba(239,68,68,0.3)',
          }}>
            <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 16 }}>💥</div>
            <h2 style={{ color: '#ef4444', fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>
              Account Breached
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
              Your equity has reached $0.<br />You have blown your account.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => router.push('/dashboard/sessions')} style={{
                background: '#ef4444', color: '#fff', border: 'none',
                borderRadius: 8, padding: '10px 20px', fontWeight: 700,
                cursor: 'pointer', fontSize: 14,
              }}>
                Back to Sessions
              </button>
              <button onClick={() => setAccountBreached(false)} style={{
                background: 'transparent', color: 'var(--text-muted)',
                border: '1px solid var(--border-default)',
                borderRadius: 8, padding: '10px 20px', fontWeight: 600,
                cursor: 'pointer', fontSize: 14,
              }}>
                Dismiss
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
                  lb==='C' ? (cur.close>=cur.open?'var(--green)':'var(--red)') :
                  'var(--text-primary)'}}>
                  {fmtPrice(v, sym.decimals)}
                </span>
              </div>
            ))}
          </div>
        )}

        <span className="font-mono text-[10px]" style={{color:'var(--text-muted)'}}>{dateStr}</span>

        <div className="ml-auto flex items-center gap-4 shrink-0">
          {/* Balance */}
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-wide" style={{color:'var(--text-muted)'}}>{t('balance')}</p>
            <p className="font-mono font-bold text-base" style={{color:'var(--accent)'}}>{fmtMoney(balance)}</p>
          </div>
          {/* Fix 4: Equity */}
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-wide" style={{color:'var(--text-muted)'}}>Equity</p>
            <p className="font-mono font-bold text-base" style={{color: equity >= balance ? 'var(--green)' : 'var(--red)'}}>
              {fmtMoney(equity)}
            </p>
          </div>
          {openPnl !== 0 && (
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-wide" style={{color:'var(--text-muted)'}}>{t('openPnl')}</p>
              <p className="font-mono font-semibold text-sm" style={{color: openPnl>=0?'var(--green)':'var(--red)'}}>
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

          {/* Candle controls */}
          <div className="flex items-center gap-3 px-4 py-2.5 shrink-0 flex-wrap"
            style={{borderTop:'1px solid var(--border-subtle)', background:'var(--bg-secondary)'}}>
            <button onClick={() => advance(1)} disabled={done || accountBreached}
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
              <button onClick={() => advance(skipVal)} disabled={done || accountBreached}
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

            {done && !accountBreached && (
              <span className="text-xs font-semibold px-3 py-1 rounded-full"
                style={{background:'var(--accent-muted)', color:'var(--accent)', border:'1px solid var(--accent-border)'}}>
                {t('allCandlesRevealed')}
              </span>
            )}

            {/* Progress + Fix 3: current time label + timezone */}
            <div className="ml-auto flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full overflow-hidden" style={{background:'var(--border-subtle)', minWidth: 80}}>
                <div className="h-full rounded-full transition-all duration-300"
                  style={{width:`${progress}%`, background:'var(--accent)'}}/>
              </div>
              {/* Fix 3: current candle time shown before timezone picker */}
              {cur?.time && (
                <span className="font-mono text-[10px] whitespace-nowrap"
                  style={{color:'var(--text-muted)'}}>
                  {getFormattedDate(cur.time, timezone)}
                </span>
              )}
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

          {/* Price card */}
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

          {/* Trade panel */}
          <div className="rounded-xl p-4 flex flex-col gap-3" style={{background:'var(--bg-tertiary)', border:'1px solid var(--border-subtle)'}}>
            <div>
              <p className="text-[9px] uppercase tracking-widest mb-1.5" style={{color:'var(--text-muted)'}}>{t('quantity')}</p>
              <input type="number" value={qty} step="0.01" min="0.01"
                onChange={e=>setQty(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm font-mono outline-none transition-colors"
                style={{background:'var(--bg-primary)', border:'1px solid var(--border-default)', color:'var(--text-primary)'}}
                onFocus={e=>{e.currentTarget.style.borderColor='var(--accent)'}}
                onBlur={e=>{e.currentTarget.style.borderColor='var(--border-default)'}}
              />
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest mb-1.5" style={{color:'var(--text-muted)'}}>
                {t('stopLoss')} <span style={{fontWeight:400, opacity:0.6}}>(optional)</span>
              </p>
              <input type="number" value={slVal} step="0.1" placeholder="—"
                onChange={e=>{ setSlVal(e.target.value); setSlError('') }}
                className="w-full rounded-lg px-3 py-2 text-sm font-mono outline-none transition-colors"
                style={{background:'var(--bg-primary)', border: slError?'1px solid var(--red)':'1px solid var(--border-default)', color:'var(--text-primary)'}}
                onFocus={e=>{e.currentTarget.style.borderColor='var(--red)'}}
                onBlur={e=>{e.currentTarget.style.borderColor=slError?'var(--red)':'var(--border-default)'}}
              />
              {slError && <p style={{color:'var(--red)', fontSize:10, marginTop:3}}>{slError}</p>}
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest mb-1.5" style={{color:'var(--text-muted)'}}>
                {t('takeProfit')} <span style={{fontWeight:400, opacity:0.6}}>(optional)</span>
              </p>
              <input type="number" value={tpVal} step="0.1" placeholder="—"
                onChange={e=>{ setTpVal(e.target.value); setTpError('') }}
                className="w-full rounded-lg px-3 py-2 text-sm font-mono outline-none transition-colors"
                style={{background:'var(--bg-primary)', border: tpError?'1px solid var(--red)':'1px solid var(--border-default)', color:'var(--text-primary)'}}
                onFocus={e=>{e.currentTarget.style.borderColor='var(--green)'}}
                onBlur={e=>{e.currentTarget.style.borderColor=tpError?'var(--red)':'var(--border-default)'}}
              />
              {tpError && <p style={{color:'var(--red)', fontSize:10, marginTop:3}}>{tpError}</p>}
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <button onClick={() => execTrade('buy')} disabled={accountBreached}
                className="w-full py-3 font-bold text-sm rounded-lg text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{background:'var(--green)'}}>
                {t('buy')}
              </button>
              <button onClick={() => execTrade('sell')} disabled={accountBreached}
                className="w-full py-3 font-bold text-sm rounded-lg text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
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
