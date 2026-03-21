'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
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
import { WorkspaceChart, type ChartHandle } from '@/components/chart/WorkspaceChart'
import { IndicatorPanes, DEFAULT_INDICATOR_CONFIG, type IndicatorConfig } from '@/components/chart/IndicatorPanes'

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

const TF_SECONDS: Record<TimeFrame, number> = {
  m1: 60, m5: 300, m15: 900, m30: 1800,
  h1: 3600, h4: 14400, d1: 86400, w1: 604800, M1: 2592000,
}

export default function WorkspacePage() {
  const params   = useParams()
  const id       = params.id as string
  const router   = useRouter()
  const { user } = useAuth()
  const { t }    = useLang()
  const { theme, toggleTheme } = useTheme()
  const supabase = createClient()

  const [session,         setSession]         = useState<Session | null>(null)
  // m1Loaded triggers recompute of aggregatedCandles when data arrives
  const [m1Loaded,        setM1Loaded]        = useState(false)
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
  const chartHandleRef     = useRef<ChartHandle>(null)
  const [indicatorConfig, setIndicatorConfig] = useState<IndicatorConfig>(DEFAULT_INDICATOR_CONFIG)
  const [showIndicators,  setShowIndicators]  = useState(false)

  // ── Single source of truth: absolute index into originalCandlesRef (M1) ──
  // This is STATE so it triggers re-renders. All derived values (price, time) 
  // come from this — it never changes when TF switches, only when advancing.
  const [m1AbsIdx, setM1AbsIdx] = useState(0)

  const originalCandlesRef  = useRef<Candle[]>([])
  const playableStartIdxRef = useRef<number>(0)
  const stateRef            = useRef({ trades, balance, m1AbsIdx })
  const symRef              = useRef<Symbol>(getSymbol('XAUUSD'))

  useEffect(() => {
    stateRef.current = { trades, balance, m1AbsIdx }
  }, [trades, balance, m1AbsIdx])

  useEffect(() => { if (user && id) init() }, [user, id])

  // Aggregated candles — recomputed only when timeframe or data changes (NOT on every advance)
  const aggregatedCandles = useMemo(() => {
    if (!m1Loaded || !originalCandlesRef.current.length) return []
    return aggregateCandles(originalCandlesRef.current, timeframe)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe, m1Loaded])

  // Display idx — O(n) scan, but only over aggregated array
  const displayIdx = useMemo(() => {
    if (!aggregatedCandles.length) return 0
    const curM1Ts = originalCandlesRef.current[m1AbsIdx]?.time ?? 0
    let newIdx = Math.max(1, playableStartIdxRef.current)
    for (let i = 0; i < aggregatedCandles.length; i++) {
      if (aggregatedCandles[i].time <= curM1Ts) newIdx = i + 1
      else break
    }
    return Math.min(newIdx, aggregatedCandles.length)
  }, [aggregatedCandles, m1AbsIdx])

  async function init() {
    const { data: sess } = await supabase.from('sessions').select('*').eq('id', id).single()
    if (!sess) { router.push('/dashboard/sessions'); return }
    const s = sess as Session
    setSession(s)
    setBalance(s.end_capital)
    symRef.current = getSymbol(s.symbol)

    let m1: Candle[]
    try { m1 = await loadXauUsdData() }
    catch {
      const { data: cache } = await supabase.from('candle_cache').select('candles').eq('session_id', id).single()
      m1 = (cache?.candles as Candle[]) ?? []
    }
    if (!m1.length) {
      alert('Failed to load chart data.')
      router.push('/dashboard/sessions'); return
    }

    const startTs    = Math.floor(new Date(s.start_date).getTime() / 1000)
    const endTs      = Math.floor(new Date(s.end_date).getTime()   / 1000) + 86400
    const allUpToEnd = m1.filter(c => c.time <= endTs)
    if (!allUpToEnd.length) {
      alert('No candles found for the selected date range.')
      router.push('/dashboard/sessions'); return
    }

    let playableStart = allUpToEnd.findIndex(c => c.time >= startTs)
    if (playableStart < 0) playableStart = allUpToEnd.length

    originalCandlesRef.current  = allUpToEnd
    playableStartIdxRef.current = playableStart

    // Restore saved absolute M1 index
    let savedM1Abs = playableStart
    if (s.candle_index > playableStart) {
      // New format: already absolute
      savedM1Abs = Math.min(s.candle_index, allUpToEnd.length - 1)
    } else if (s.candle_index > 0) {
      // Legacy format: relative count
      savedM1Abs = Math.min(playableStart + s.candle_index, allUpToEnd.length - 1)
    }

    setM1AbsIdx(savedM1Abs)
    setM1Loaded(true)  // triggers aggregatedCandles recompute

    const { data: openTrades } = await supabase
      .from('trades').select('*').eq('session_id', id).eq('status', 'open')
    setTrades((openTrades as Trade[]) ?? [])
    setLoading(false)
  }

  const closeAllOpenTrades = useCallback(async (
    openTrades: Trade[], exitPrice: number, atIdx: number,
  ): Promise<number> => {
    const cs = symRef.current.contractSize
    let delta = 0
    for (const trade of openTrades) {
      const pnl = calcPnl(trade.side, trade.entry_price, exitPrice, trade.quantity, cs)
      delta += pnl
      await supabase.from('trades').update({
        status: 'closed', exit_price: exitPrice, pnl, closed_at_idx: atIdx,
      }).eq('id', trade.id)
    }
    return delta
  }, [supabase])

  const advanceCandlesRef = useRef<Candle[]>([])
  const advanceIdxRef     = useRef<number>(0)
  useEffect(() => { advanceCandlesRef.current = aggregatedCandles }, [aggregatedCandles])
  useEffect(() => { advanceIdxRef.current = displayIdx }, [displayIdx])

  const advance = useCallback(async (steps: number) => {
    if (accountBreached) return
    const c   = advanceCandlesRef.current
    const i   = advanceIdxRef.current
    const { trades: tr, balance: bal, m1AbsIdx: curM1Abs } = stateRef.current
    if (!c.length) return
    const m1All = originalCandlesRef.current
    const cs    = symRef.current.contractSize
    const end   = Math.min(i + steps, c.length)
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

    // Advance M1 absolute index by steps × TF_SECONDS worth of M1 candles
    const targetTs = (m1All[curM1Abs]?.time ?? 0) + steps * TF_SECONDS[timeframe]
    let newM1Abs   = curM1Abs
    for (let j = m1All.length - 1; j >= 0; j--) {
      if (m1All[j].time <= targetTs) { newM1Abs = j; break }
    }

    const newBal     = parseFloat(Math.max(0, bal + deltaBal).toFixed(2))
    const lastCandle = c[end - 1]
    const stillOpen  = updatedTrades.filter(t => t.status === 'open')
    const unrealised = lastCandle
      ? stillOpen.reduce((a, t) => a + calcPnl(t.side, t.entry_price, lastCandle.close, t.quantity, cs), 0)
      : 0
    const breached = newBal + unrealised <= 0

    let finalBal    = newBal
    let finalTrades = updatedTrades
    if (breached && stillOpen.length > 0 && lastCandle) {
      const closePnl = await closeAllOpenTrades(stillOpen, lastCandle.close, end)
      finalBal    = parseFloat(Math.max(0, newBal + closePnl).toFixed(2))
      finalTrades = updatedTrades.map(t =>
        t.status === 'open'
          ? { ...t, status: 'closed' as const, exit_price: lastCandle.close,
              pnl: calcPnl(t.side, t.entry_price, lastCandle.close, t.quantity, cs),
              closed_at_idx: end }
          : t
      )
    }

    setBalance(finalBal)
    setTrades(finalTrades)
    setM1AbsIdx(newM1Abs)   // ← single state update drives price + time
    if (breached) setAccountBreached(true)

    await supabase.from('sessions').update({
      candle_index: newM1Abs,   // absolute M1 index
      end_capital:  finalBal,
      is_completed: end >= c.length || breached,
    }).eq('id', id)
  }, [id, supabase, accountBreached, timeframe, closeAllOpenTrades])

  async function execTrade(side: 'buy' | 'sell') {
    if (accountBreached) return
    const c = advanceCandlesRef.current
    const i = advanceIdxRef.current
    const cur = c[i - 1]
    if (!cur || !session) return
    // Use real M1 price as entry
    const m1Now = originalCandlesRef.current[stateRef.current.m1AbsIdx]
    const entry = m1Now?.close ?? cur.close

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
    const c   = advanceCandlesRef.current
    const i   = advanceIdxRef.current
    const bal = stateRef.current.balance
    const cur = c[i - 1]
    const trade = stateRef.current.trades.find(t => t.id === tradeId)
    if (!cur || !trade) return
    const cs       = symRef.current.contractSize
    const m1Now    = originalCandlesRef.current[stateRef.current.m1AbsIdx]
    const exitPrice = m1Now?.close ?? cur.close
    const pnl      = calcPnl(trade.side, trade.entry_price, exitPrice, trade.quantity, cs)
    const newBal   = parseFloat(Math.max(0, bal + pnl).toFixed(2))

    const remaining  = stateRef.current.trades.filter(t => t.status === 'open' && t.id !== tradeId)
    const unrealised = remaining.reduce((a, t) => a + calcPnl(t.side, t.entry_price, exitPrice, t.quantity, cs), 0)
    const breached   = newBal + unrealised <= 0

    await supabase.from('trades').update({
      status: 'closed', exit_price: exitPrice, pnl, closed_at_idx: i,
    }).eq('id', tradeId)
    await supabase.from('sessions').update({ end_capital: newBal }).eq('id', id)

    let finalBal = newBal
    let closedRemaining: Trade[] = []
    if (breached && remaining.length > 0) {
      const closePnl = await closeAllOpenTrades(remaining, exitPrice, i)
      finalBal = parseFloat(Math.max(0, newBal + closePnl).toFixed(2))
      closedRemaining = remaining.map(t => ({
        ...t, status: 'closed' as const, exit_price: exitPrice,
        pnl: calcPnl(t.side, t.entry_price, exitPrice, t.quantity, cs), closed_at_idx: i,
      }))
    }

    setTrades(prev => prev.map(t => {
      if (t.id === tradeId) return { ...t, status: 'closed' as const, exit_price: exitPrice, pnl, closed_at_idx: i }
      return closedRemaining.find(r => r.id === t.id) ?? t
    }))
    setBalance(finalBal)
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

  const sym     = symRef.current
  const m1All   = originalCandlesRef.current
  const m1Candle  = m1All[m1AbsIdx]
  const m1Price   = m1Candle?.close  ?? 0
  const m1Time    = m1Candle?.time   ?? 0
  const m1High    = m1Candle?.high   ?? 0
  const m1Low     = m1Candle?.low    ?? 0
  const m1Open    = m1Candle?.open   ?? 0

  const done     = m1AbsIdx >= m1All.length - 1
  const openTr   = trades.filter(t => t.status === 'open')
  const closedTr = trades.filter(t => t.status === 'closed')
  const realizedPnl = parseFloat(closedTr.reduce((a, tr) => a + (tr.pnl ?? 0), 0).toFixed(2))
  const openPnl  = m1Price
    ? openTr.reduce((a, tr) => a + calcPnl(tr.side, tr.entry_price, m1Price, tr.quantity, sym.contractSize), 0)
    : 0
  const equity   = parseFloat((balance + openPnl).toFixed(2))

  const m1Total    = m1All.length
  const m1Playable = m1Total - playableStartIdxRef.current

  const progress   = m1Playable > 0
    ? Math.round(Math.max(0, m1AbsIdx - playableStartIdxRef.current) / m1Playable * 100)
    : 0

  const formatTime = (ts: number, tzValue: string) => {
    if (!ts) return '—'
    const off = TIMEZONES.find(z => z.value === tzValue)?.offset ?? 0
    const d   = new Date(ts * 1000 + off * 3600 * 1000)
    return d.toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
  }

  const dateStr = formatTime(m1Time, timezone)

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{background:'var(--bg-primary)'}}>

      {accountBreached && (
        <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'var(--bg-secondary)', border:'2px solid #ef4444', borderRadius:16, padding:'2.5rem 2rem', maxWidth:380, textAlign:'center', boxShadow:'0 8px 40px rgba(239,68,68,0.3)' }}>
            <div style={{ fontSize:52, lineHeight:1, marginBottom:16 }}>💥</div>
            <h2 style={{ color:'#ef4444', fontSize:22, fontWeight:700, margin:'0 0 8px' }}>Account Breached</h2>
            <p style={{ color:'var(--text-muted)', fontSize:14, marginBottom:24, lineHeight:1.6 }}>
              Your equity reached $0.<br/>All positions have been closed.
            </p>
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <button onClick={() => router.push('/dashboard/sessions')} style={{ background:'#ef4444', color:'#fff', border:'none', borderRadius:8, padding:'10px 20px', fontWeight:700, cursor:'pointer', fontSize:14 }}>Back to Sessions</button>
              <button onClick={() => setAccountBreached(false)} style={{ background:'transparent', color:'var(--text-muted)', border:'1px solid var(--border-default)', borderRadius:8, padding:'10px 20px', fontWeight:600, cursor:'pointer', fontSize:14 }}>Dismiss</button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 shrink-0 flex-wrap min-h-[44px]"
        style={{borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-secondary)'}}>
        <button onClick={() => router.push('/dashboard/sessions')}
          className="text-sm rounded-lg px-3 py-1.5 transition-all shrink-0"
          style={{color:'var(--text-secondary)', border:'1px solid var(--border-default)'}}>← Back</button>
        <Badge variant="blue">{session.symbol}</Badge>
        <span className="text-xs truncate max-w-[180px]" style={{color:'var(--text-muted)'}}>{session.name}</span>

        {/* OHLC — all from M1 candle, never from aggregated */}
        {m1Candle && (
          <div className="flex gap-3 ml-1">
            {([['O', m1Open],['H', m1High],['L', m1Low],['C', m1Price]] as [string,number][]).map(([lb,v]) => (
              <div key={lb} className="flex gap-1 items-baseline">
                <span className="text-[9px] uppercase leading-none" style={{color:'var(--text-muted)'}}>{lb}</span>
                <span className="font-mono text-[11px]" style={{color:
                  lb==='H' ? 'var(--green)' : lb==='L' ? 'var(--red)' :
                  lb==='C' ? (m1Price >= m1Open ? 'var(--green)' : 'var(--red)') : 'var(--text-primary)'}}>
                  {fmtPrice(v, sym.decimals)}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-4 shrink-0">
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-wide" style={{color:'var(--text-muted)'}}>Equity</p>
            <p className="font-mono font-bold text-base" style={{color:'var(--accent)'}}>
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
          {realizedPnl !== 0 && (
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-wide" style={{color:'var(--text-muted)'}}>Realized P&L</p>
              <p className="font-mono font-semibold text-sm" style={{color: realizedPnl>=0?'var(--green)':'var(--red)'}}>
                {realizedPnl>=0?'+':''}{realizedPnl.toFixed(2)}
              </p>
            </div>
          )}
          <ThemeToggle theme={theme} onToggle={toggleTheme}/>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex:1, display:'flex', overflow:'hidden', minHeight:0 }}>
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0, minHeight:0 }}>

          <div style={{ flex:1, minHeight:0, overflow:'hidden', position:'relative' }}>
            {/* TF picker */}
            <div style={{ position:'absolute', top:8, left:8, zIndex:10, display:'flex', gap:4, flexWrap:'wrap' }}>
              {TIMEFRAMES.map(tf => (
                <button key={tf} onClick={() => setTimeframe(tf)} style={{
                  padding:'2px 7px', fontSize:11, borderRadius:4, cursor:'pointer', transition:'all 0.15s',
                  fontWeight: timeframe===tf ? 700 : 400,
                  border: timeframe===tf ? '1px solid var(--accent)' : '1px solid var(--border-default)',
                  background: timeframe===tf ? 'var(--accent-muted)' : 'var(--bg-secondary)',
                  color: timeframe===tf ? 'var(--accent)' : 'var(--text-muted)',
                }}>{tf.toUpperCase()}</button>
              ))}
              <button onClick={() => setShowIndicators(p => !p)} style={{
                padding:'2px 9px', fontSize:11, borderRadius:4, cursor:'pointer', marginLeft:4,
                fontWeight:600,
                border: showIndicators ? '1px solid var(--accent)' : '1px solid var(--border-default)',
                background: showIndicators ? 'var(--accent-muted)' : 'var(--bg-secondary)',
                color: showIndicators ? 'var(--accent)' : 'var(--text-muted)',
              }}>Indicators</button>
            </div>

            {/* Indicator panel */}
            {showIndicators && (
              <div style={{
                position:'absolute', top:36, left:8, zIndex:20, minWidth:220,
                background:'var(--bg-secondary)', border:'1px solid var(--border-default)',
                borderRadius:8, padding:'12px 14px', boxShadow:'0 4px 20px rgba(0,0,0,0.35)',
                display:'flex', flexDirection:'column', gap:5,
              }}>
                <p style={{fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:2}}>Overlay</p>
                {([
                  { label:'SMA (20, 50, 200)', key:'sma'  as const },
                  { label:'EMA (9, 21)',        key:'ema'  as const },
                  { label:'Bollinger Bands',    key:'bb'   as const },
                  { label:'VWAP',               key:'vwap' as const },
                ] as const).map(({label,key}) => (
                  <label key={key} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:12,color:'var(--text-primary)'}}>
                    <input type="checkbox" checked={(indicatorConfig[key] as any).enabled}
                      onChange={e => setIndicatorConfig(prev => ({...prev,[key]:{...prev[key as keyof IndicatorConfig],enabled:e.target.checked}}))}
                      style={{accentColor:'var(--accent)',width:13,height:13}} />
                    {label}
                  </label>
                ))}
                <p style={{fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',margin:'4px 0 2px'}}>Sub-pane</p>
                {([
                  { label:`RSI (${indicatorConfig.rsi.period})`, key:'rsi'    as const },
                  { label:`MACD (${indicatorConfig.macd.fast},${indicatorConfig.macd.slow})`, key:'macd' as const },
                  { label:'Volume',                              key:'volume' as const },
                ] as const).map(({label,key}) => (
                  <label key={key} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:12,color:'var(--text-primary)'}}>
                    <input type="checkbox" checked={indicatorConfig[key].enabled}
                      onChange={e => setIndicatorConfig(prev => ({...prev,[key]:{...prev[key as keyof IndicatorConfig],enabled:e.target.checked}}))}
                      style={{accentColor:'var(--accent)',width:13,height:13}} />
                    {label}
                  </label>
                ))}
                <button onClick={() => setShowIndicators(false)} style={{marginTop:4,padding:'3px 0',fontSize:11,background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer',textAlign:'right'}}>Close ×</button>
              </div>
            )}
            <WorkspaceChart
              ref={chartHandleRef}
              candles={aggregatedCandles.slice(0, displayIdx)}
              openTrades={openTr}
              symbol={sym}
              lastPrice={m1Price || undefined}
              indicatorConfig={indicatorConfig}
              onSetSL={handleSetSL}
              onSetTP={handleSetTP}
              onCloseTrade={closeTrade}
            />
          </div>

          {/* Controls */}
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
                style={{border:'1px solid var(--border-default)', color:'var(--text-secondary)'}}>→</button>
            </div>

            {done && !accountBreached && (
              <span className="text-xs font-semibold px-3 py-1 rounded-full"
                style={{background:'var(--accent-muted)', color:'var(--accent)', border:'1px solid var(--accent-border)'}}>
                {t('allCandlesRevealed')}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <span className="font-mono text-[10px] whitespace-nowrap" style={{color:'var(--text-muted)'}}>
                {formatTime(m1Time, timezone)}
              </span>
              <select value={timezone} onChange={e=>setTimezone(e.target.value)}
                className="rounded-lg px-2 py-1 text-xs outline-none cursor-pointer"
                style={{background:'var(--bg-tertiary)', border:'1px solid var(--border-default)', color:'var(--text-primary)'}}>
                {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
              </select>
            </div>
          </div>

          {/* Indicator sub-panes */}
          <IndicatorPanes
            candles={aggregatedCandles.slice(0, displayIdx)}
            config={indicatorConfig}
            mainChartRef={chartHandleRef.current?.chartRef ?? { current: null } as any}
          />

          {/* Trades table */}
          <div className="h-48 flex flex-col shrink-0" style={{borderTop:'1px solid var(--border-subtle)'}}>
            <TabBar
              tabs={[{key:'open', label:`${t('openPositions')} (${openTr.length})`}, {key:'closed', label:`${t('closedTrades')} (${closedTr.length})`}]}
              active={tradeTab} onChange={setTradeTab}
            />
            <div className="flex-1 overflow-y-auto text-xs">
              {tradeTab === 'open' ? (
                openTr.length === 0
                  ? <div className="flex items-center justify-center h-full text-sm" style={{color:'var(--text-muted)'}}>{t('noOpenTrades')}</div>
                  : <table className="w-full">
                      <thead className="sticky top-0" style={{background:'var(--bg-secondary)'}}>
                        <tr>{['Side','Entry','SL','TP','Qty','Unreal. P&L',''].map((h,i)=>(
                          <th key={i} className="text-left px-3 py-1.5 font-normal text-[9px] uppercase tracking-widest" style={{color:'var(--text-muted)'}}>{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {openTr.map(tr => {
                          const upnl = m1Price ? calcPnl(tr.side, tr.entry_price, m1Price, tr.quantity, sym.contractSize) : 0
                          return (
                            <tr key={tr.id} style={{borderBottom:'1px solid var(--border-subtle)'}}>
                              <td className="px-3 py-2"><Badge variant={tr.side==='buy'?'green':'red'}>{tr.side.toUpperCase()}</Badge></td>
                              <td className="px-3 py-2 font-mono">{fmtPrice(tr.entry_price, sym.decimals)}</td>
                              <td className="px-3 py-2 font-mono">
                                {tr.stop_loss ? (
                                  <span style={{display:'inline-flex', alignItems:'center', gap:5}}>
                                    <span style={{color:'var(--red)'}}>{fmtPrice(tr.stop_loss, sym.decimals)}</span>
                                    <button onClick={() => handleSetSL(tr.id, 0)} title="Remove SL" style={{
                                      background:'#ef4444', border:'none', borderRadius:5,
                                      width:16, height:16, display:'inline-flex', alignItems:'center',
                                      justifyContent:'center', cursor:'pointer', padding:0, flexShrink:0,
                                    }}>
                                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                                        <path d="M1 1l6 6M7 1L1 7" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                                      </svg>
                                    </button>
                                  </span>
                                ) : <span style={{color:'var(--text-muted)'}}>—</span>}
                              </td>
                              <td className="px-3 py-2 font-mono">
                                {tr.take_profit ? (
                                  <span style={{display:'inline-flex', alignItems:'center', gap:5}}>
                                    <span style={{color:'var(--green)'}}>{fmtPrice(tr.take_profit, sym.decimals)}</span>
                                    <button onClick={() => handleSetTP(tr.id, 0)} title="Remove TP" style={{
                                      background:'#ef4444', border:'none', borderRadius:5,
                                      width:16, height:16, display:'inline-flex', alignItems:'center',
                                      justifyContent:'center', cursor:'pointer', padding:0, flexShrink:0,
                                    }}>
                                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                                        <path d="M1 1l6 6M7 1L1 7" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                                      </svg>
                                    </button>
                                  </span>
                                ) : <span style={{color:'var(--text-muted)'}}>—</span>}
                              </td>
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
              ) : (
                closedTr.length === 0
                  ? <div className="flex items-center justify-center h-full text-sm" style={{color:'var(--text-muted)'}}>{t('noClosedTrades')}</div>
                  : <table className="w-full">
                      <thead className="sticky top-0" style={{background:'var(--bg-secondary)'}}>
                        <tr>{['Side','Entry','Exit','Qty','P&L'].map((h,i)=>(
                          <th key={i} className="text-left px-3 py-1.5 font-normal text-[9px] uppercase tracking-widest" style={{color:'var(--text-muted)'}}>{h}</th>
                        ))}</tr>
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
              {m1Price ? fmtPrice(m1Price, sym.decimals) : '—'}
            </p>
            <div className="flex gap-4 mt-2.5">
              <div>
                <p className="text-[9px] uppercase" style={{color:'var(--text-muted)'}}>High</p>
                <p className="font-mono text-xs" style={{color:'var(--green)'}}>{m1High ? fmtPrice(m1High, sym.decimals) : '—'}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase" style={{color:'var(--text-muted)'}}>Low</p>
                <p className="font-mono text-xs" style={{color:'var(--red)'}}>{m1Low ? fmtPrice(m1Low, sym.decimals) : '—'}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl p-4 flex flex-col gap-3" style={{background:'var(--bg-tertiary)', border:'1px solid var(--border-subtle)'}}>
            <div>
              <p className="text-[9px] uppercase tracking-widest mb-1.5" style={{color:'var(--text-muted)'}}>{t('quantity')}</p>
              <input type="number" value={qty} step="0.01" min="0.01" onChange={e=>setQty(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm font-mono outline-none transition-colors"
                style={{background:'var(--bg-primary)', border:'1px solid var(--border-default)', color:'var(--text-primary)'}}
                onFocus={e=>{e.currentTarget.style.borderColor='var(--accent)'}}
                onBlur={e=>{e.currentTarget.style.borderColor='var(--border-default)'}}/>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest mb-1.5" style={{color:'var(--text-muted)'}}>
                {t('stopLoss')} <span style={{fontWeight:400,opacity:0.6}}>(optional)</span>
              </p>
              <input type="number" value={slVal} step="0.1" placeholder="—"
                onChange={e=>{setSlVal(e.target.value);setSlError('')}}
                className="w-full rounded-lg px-3 py-2 text-sm font-mono outline-none transition-colors"
                style={{background:'var(--bg-primary)', border:slError?'1px solid var(--red)':'1px solid var(--border-default)', color:'var(--text-primary)'}}
                onFocus={e=>{e.currentTarget.style.borderColor='var(--red)'}}
                onBlur={e=>{e.currentTarget.style.borderColor=slError?'var(--red)':'var(--border-default)'}}/>
              {slError && <p style={{color:'var(--red)',fontSize:10,marginTop:3}}>{slError}</p>}
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest mb-1.5" style={{color:'var(--text-muted)'}}>
                {t('takeProfit')} <span style={{fontWeight:400,opacity:0.6}}>(optional)</span>
              </p>
              <input type="number" value={tpVal} step="0.1" placeholder="—"
                onChange={e=>{setTpVal(e.target.value);setTpError('')}}
                className="w-full rounded-lg px-3 py-2 text-sm font-mono outline-none transition-colors"
                style={{background:'var(--bg-primary)', border:tpError?'1px solid var(--red)':'1px solid var(--border-default)', color:'var(--text-primary)'}}
                onFocus={e=>{e.currentTarget.style.borderColor='var(--green)'}}
                onBlur={e=>{e.currentTarget.style.borderColor=tpError?'var(--red)':'var(--border-default)'}}/>
              {tpError && <p style={{color:'var(--red)',fontSize:10,marginTop:3}}>{tpError}</p>}
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <button onClick={() => execTrade('buy')} disabled={accountBreached}
                className="w-full py-3 font-bold text-sm rounded-lg text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{background:'var(--green)'}}>{t('buy')}</button>
              <button onClick={() => execTrade('sell')} disabled={accountBreached}
                className="w-full py-3 font-bold text-sm rounded-lg text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{background:'var(--red)'}}>{t('sell')}</button>
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
