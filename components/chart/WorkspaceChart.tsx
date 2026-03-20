'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import type { Candle, Trade, Symbol } from '@/types'
import { useTheme } from '@/contexts/ThemeContext'
import { calcPnl } from '@/lib/utils'

interface LineYPositions {
  entryY: number | null
  slY:    number | null
  tpY:    number | null
}

interface Props {
  candles:       Candle[]
  openTrades:    Trade[]
  symbol:        Symbol
  onSetSL?:      (tradeId: string, price: number) => void
  onSetTP?:      (tradeId: string, price: number) => void
  onCloseTrade?: (tradeId: string) => void
}

// Colours matching TradingView paper-trading
const TV_ENTRY_BUY  = '#2962ff'
const TV_ENTRY_SELL = '#ef5350'
const TV_TP         = '#0d9488'   // teal
const TV_SL         = '#f59e0b'   // amber

export function WorkspaceChart({ candles, openTrades, symbol, onSetSL, onSetTP, onCloseTrade }: Props) {
  const containerRef   = useRef<HTMLDivElement>(null)
  const chartRef       = useRef<any>(null)
  const seriesRef      = useRef<any>(null)
  const priceLines     = useRef<Map<string, any>>(new Map())
  const initializedRef = useRef(false)
  const draggingRef    = useRef<{ tradeId: string; type: 'sl' | 'tp' } | null>(null)
  const { theme }      = useTheme()
  const [cursorStyle, setCursorStyle] = useState('default')
  const [linePos, setLinePos]         = useState<Map<string, LineYPositions>>(new Map())
  const rafRef        = useRef<number>(0)
  const openTradesRef = useRef<Trade[]>(openTrades)
  const prevPosRef    = useRef<Map<string, LineYPositions>>(new Map())

  useEffect(() => { openTradesRef.current = openTrades }, [openTrades])

  const getColors = useCallback(() => {
    const d = theme === 'dark'
    return {
      bg:     d ? '#060a14' : '#ffffff',
      text:   d ? '#4a6280' : '#7090b0',
      border: d ? '#1e2d45' : '#c8d8ee',
    }
  }, [theme])

  const syncPositions = useCallback(() => {
    if (!seriesRef.current) return
    const next = new Map<string, LineYPositions>()
    for (const tr of openTradesRef.current) {
      next.set(tr.id, {
        entryY: seriesRef.current.priceToCoordinate(tr.entry_price) ?? null,
        slY:    tr.stop_loss   ? (seriesRef.current.priceToCoordinate(tr.stop_loss)   ?? null) : null,
        tpY:    tr.take_profit ? (seriesRef.current.priceToCoordinate(tr.take_profit) ?? null) : null,
      })
    }
    let changed = next.size !== prevPosRef.current.size
    if (!changed) {
      for (const [id, pos] of next) {
        const prev = prevPosRef.current.get(id)
        if (!prev) { changed = true; break }
        if (
          Math.abs((pos.entryY ?? 0) - (prev.entryY ?? 0)) > 0.5 ||
          Math.abs((pos.slY    ?? 0) - (prev.slY    ?? 0)) > 0.5 ||
          Math.abs((pos.tpY    ?? 0) - (prev.tpY    ?? 0)) > 0.5
        ) { changed = true; break }
      }
    }
    if (changed) {
      prevPosRef.current = next
      setLinePos(new Map(next))
    }
  }, [])

  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return

    let ro: ResizeObserver | null = null

    function initChart(width: number, height: number) {
      if (initializedRef.current || !containerRef.current) return
      initializedRef.current = true

      import('lightweight-charts').then(lc => {
        if (!containerRef.current) return
        const c = getColors()

        const chart = lc.createChart(containerRef.current, {
          layout:  { background: { color: c.bg }, textColor: c.text },
          grid:    { vertLines: { visible: false }, horzLines: { visible: false } },
          crosshair: { mode: lc.CrosshairMode.Normal },
          rightPriceScale: {
            borderColor: c.border,
            scaleMargins: { top: 0.1, bottom: 0.1 },
            autoScale: true,
          },
          timeScale: {
            borderColor:    c.border,
            timeVisible:    true,
            secondsVisible: false,
            rightOffset:    8,
            barSpacing:     6,
          },
          width,
          height,
        })

        const series = chart.addCandlestickSeries({
          upColor:         '#22c55e',
          downColor:       '#ef4444',
          borderUpColor:   '#22c55e',
          borderDownColor: '#ef4444',
          wickUpColor:     '#22c55e',
          wickDownColor:   '#ef4444',
        })

        chartRef.current  = chart
        seriesRef.current = series

        chart.subscribeCrosshairMove(syncPositions)
        chart.timeScale().subscribeVisibleTimeRangeChange(syncPositions)

        const loop = () => { syncPositions(); rafRef.current = requestAnimationFrame(loop) }
        rafRef.current = requestAnimationFrame(loop)

        const el = containerRef.current!

        const onMouseDown = (e: MouseEvent) => {
          if (!seriesRef.current) return
          const rect = el.getBoundingClientRect()
          const y    = e.clientY - rect.top
          for (const [key] of priceLines.current) {
            const [tradeId, type] = key.split(':')
            if (type === 'entry') continue
            const trade = openTradesRef.current.find(t => t.id === tradeId)
            if (!trade) continue
            const price = type === 'sl' ? trade.stop_loss : trade.take_profit
            if (!price) continue
            const coord = seriesRef.current.priceToCoordinate(price)
            if (coord != null && Math.abs(coord - y) < 10) {
              draggingRef.current = { tradeId, type: type as 'sl' | 'tp' }
              setCursorStyle('ns-resize')
              e.preventDefault()
              break
            }
          }
        }

        const onMouseMove = (e: MouseEvent) => {
          ;(window as any).__lastMouseY = e.clientY
          if (!draggingRef.current || !seriesRef.current) return
          const rect     = el.getBoundingClientRect()
          const y        = e.clientY - rect.top
          const newPrice = seriesRef.current.coordinateToPrice(y)
          if (newPrice == null || !Number.isFinite(newPrice)) return
          const line = priceLines.current.get(
            `${draggingRef.current.tradeId}:${draggingRef.current.type}`
          )
          if (line) line.applyOptions({ price: newPrice })
        }

        const onMouseUp = () => {
          if (!draggingRef.current || !seriesRef.current) return
          const rect       = el.getBoundingClientRect()
          const y          = ((window as any).__lastMouseY ?? 0) - rect.top
          const finalPrice = seriesRef.current.coordinateToPrice(y)
          if (finalPrice != null && Number.isFinite(finalPrice)) {
            const { tradeId, type } = draggingRef.current
            if (type === 'sl' && onSetSL) onSetSL(tradeId, finalPrice)
            if (type === 'tp' && onSetTP) onSetTP(tradeId, finalPrice)
          }
          draggingRef.current = null
          setCursorStyle('default')
        }

        el.addEventListener('mousedown', onMouseDown)
        document.addEventListener('mousemove', onMouseMove)
        document.addEventListener('mouseup', onMouseUp)

        if (candles.length > 0) {
          series.setData(candles.map(c => ({
            time: c.time as any, open: c.open, high: c.high, low: c.low, close: c.close,
          })))
          chart.timeScale().fitContent()
        }
      })
    }

    ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          if (!initializedRef.current) initChart(width, height)
          else chartRef.current?.resize(width, height)
        }
      }
    })
    ro.observe(containerRef.current)

    const timer = setTimeout(() => {
      if (!initializedRef.current && containerRef.current) {
        const w = containerRef.current.clientWidth  || containerRef.current.offsetWidth  || 900
        const h = containerRef.current.clientHeight || containerRef.current.offsetHeight || 500
        initChart(w, h)
      }
    }, 100)

    return () => {
      clearTimeout(timer)
      ro?.disconnect()
      cancelAnimationFrame(rafRef.current)
      chartRef.current?.remove()
      chartRef.current       = null
      seriesRef.current      = null
      initializedRef.current = false
      draggingRef.current    = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!chartRef.current) return
    const c = getColors()
    chartRef.current.applyOptions({
      layout:          { background: { color: c.bg }, textColor: c.text },
      grid:            { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { borderColor: c.border },
      timeScale:       { borderColor: c.border },
    })
  }, [theme, getColors])

  useEffect(() => {
    if (!seriesRef.current || !candles.length) return
    seriesRef.current.setData(
      candles.map(c => ({ time: c.time as any, open: c.open, high: c.high, low: c.low, close: c.close }))
    )
  }, [candles])

  useEffect(() => {
    if (!seriesRef.current) return
    for (const line of priceLines.current.values()) {
      try { seriesRef.current.removePriceLine(line) } catch {}
    }
    priceLines.current.clear()

    import('lightweight-charts').then(({ LineStyle }) => {
      if (!seriesRef.current) return
      openTrades.forEach(tr => {
        const entryColor = tr.side === 'buy' ? TV_ENTRY_BUY : TV_ENTRY_SELL

        try {
          priceLines.current.set(`${tr.id}:entry`, seriesRef.current.createPriceLine({
            price: tr.entry_price,
            color: entryColor,
            lineWidth: 1, lineStyle: LineStyle.Solid,
            axisLabelVisible: true, title: '',
          }))
        } catch {}

        if (tr.stop_loss) {
          try {
            priceLines.current.set(`${tr.id}:sl`, seriesRef.current.createPriceLine({
              price: tr.stop_loss,
              color: TV_SL,
              lineWidth: 1, lineStyle: LineStyle.Dashed,
              axisLabelVisible: true, title: '',
            }))
          } catch {}
        }

        if (tr.take_profit) {
          try {
            priceLines.current.set(`${tr.id}:tp`, seriesRef.current.createPriceLine({
              price: tr.take_profit,
              color: TV_TP,
              lineWidth: 1, lineStyle: LineStyle.Dashed,
              axisLabelVisible: true, title: '',
            }))
          } catch {}
        }
      })
      syncPositions()
    })
  }, [openTrades, syncPositions])

  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const onMove = (e: MouseEvent) => {
      if (draggingRef.current || !seriesRef.current) return
      const rect = el.getBoundingClientRect()
      const y    = e.clientY - rect.top
      let near   = false
      for (const [key] of priceLines.current) {
        const [tradeId, type] = key.split(':')
        if (type === 'entry') continue
        const trade = openTrades.find(t => t.id === tradeId)
        if (!trade) continue
        const price = type === 'sl' ? trade.stop_loss : trade.take_profit
        if (!price) continue
        const ly = seriesRef.current.priceToCoordinate(price)
        if (ly != null && Math.abs(ly - y) < 8) { near = true; break }
      }
      setCursorStyle(near ? 'ns-resize' : 'default')
    }
    el.addEventListener('mousemove', onMove)
    return () => el.removeEventListener('mousemove', onMove)
  }, [openTrades])

  const lastPrice = candles.length > 0 ? candles[candles.length - 1].close : 0

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 0, position: 'relative' }}>
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', display: 'block', cursor: cursorStyle }}
      />

      {/* TradingView-style overlay */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {openTrades.map(trade => {
          const pos = linePos.get(trade.id)
          if (!pos) return null

          const unrealizedPnl = calcPnl(trade.side, trade.entry_price, lastPrice, trade.quantity)
          const isBuy         = trade.side === 'buy'
          const entryColor    = isBuy ? TV_ENTRY_BUY : TV_ENTRY_SELL

          const tpPnl = trade.take_profit
            ? calcPnl(trade.side, trade.entry_price, trade.take_profit, trade.quantity)
            : null
          const slPnl = trade.stop_loss
            ? calcPnl(trade.side, trade.entry_price, trade.stop_loss, trade.quantity)
            : null

          return (
            <div key={trade.id}>

              {/* Entry line widget */}
              {pos.entryY != null && pos.entryY > 4 && (
                <LineWidget top={pos.entryY}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center',
                    background: entryColor, borderRadius: 3, height: 24,
                    padding: '0 4px 0 7px', gap: 4,
                    fontSize: 11, fontWeight: 600, color: '#fff',
                    whiteSpace: 'nowrap', userSelect: 'none',
                    boxShadow: '0 1px 5px rgba(0,0,0,0.45)',
                  }}>
                    <span style={{ opacity: 0.7, fontSize: 10 }}>⇅</span>
                    <TvPillBtn label="TP" onClick={() => onSetTP?.(trade.id, lastPrice + (isBuy ? 5 : -5))} />
                    <TvPillBtn label="SL" onClick={() => onSetSL?.(trade.id, lastPrice + (isBuy ? -5 : 5))} />
                    <span style={{ opacity: 0.9 }}>{isBuy ? '+' : '−'}{trade.quantity}</span>
                    <span style={{ color: unrealizedPnl >= 0 ? '#bbf7d0' : '#fecaca', fontWeight: 700, margin: '0 2px' }}>
                      {unrealizedPnl >= 0 ? '+' : ''}{unrealizedPnl.toFixed(2)} USD
                    </span>
                    <TvCloseBtn onClick={() => onCloseTrade?.(trade.id)} />
                  </div>
                </LineWidget>
              )}

              {/* SL line widget – amber */}
              {pos.slY != null && pos.slY > 4 && trade.stop_loss && slPnl != null && (
                <LineWidget top={pos.slY}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center',
                    background: TV_SL, borderRadius: 3, height: 24,
                    padding: '0 4px 0 8px', gap: 6,
                    fontSize: 11, fontWeight: 600, color: '#fff',
                    whiteSpace: 'nowrap', userSelect: 'none',
                    boxShadow: '0 1px 5px rgba(0,0,0,0.35)',
                  }}>
                    <span style={{ opacity: 0.9 }}>{trade.quantity}</span>
                    <span style={{ color: slPnl >= 0 ? '#d1fae5' : '#fee2e2', fontWeight: 700 }}>
                      {slPnl >= 0 ? '+' : ''}{slPnl.toFixed(2)} USD
                    </span>
                    <TvCloseBtn onClick={() => onSetSL?.(trade.id, 0)} />
                  </div>
                </LineWidget>
              )}

              {/* TP line widget – teal */}
              {pos.tpY != null && pos.tpY > 4 && trade.take_profit && tpPnl != null && (
                <LineWidget top={pos.tpY}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center',
                    background: TV_TP, borderRadius: 3, height: 24,
                    padding: '0 4px 0 8px', gap: 6,
                    fontSize: 11, fontWeight: 600, color: '#fff',
                    whiteSpace: 'nowrap', userSelect: 'none',
                    boxShadow: '0 1px 5px rgba(0,0,0,0.35)',
                  }}>
                    <span style={{ opacity: 0.9 }}>{trade.quantity}</span>
                    <span style={{ color: tpPnl >= 0 ? '#d1fae5' : '#fee2e2', fontWeight: 700 }}>
                      {tpPnl >= 0 ? '+' : ''}{tpPnl.toFixed(2)} USD
                    </span>
                    <TvCloseBtn onClick={() => onSetTP?.(trade.id, 0)} />
                  </div>
                </LineWidget>
              )}

            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Shared layout wrapper keeps each widget vertically centred on its line ──
function LineWidget({ top, children }: { top: number; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'absolute',
      top: top - 12,
      left: 8,
      height: 24,
      display: 'flex',
      alignItems: 'center',
      pointerEvents: 'auto',
    }}>
      {children}
    </div>
  )
}

function TvPillBtn({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: 2,
      color: '#fff', fontSize: 10, fontWeight: 700,
      padding: '2px 5px', cursor: 'pointer', lineHeight: '14px',
    }}>
      {label}
    </button>
  )
}

function TvCloseBtn({ onClick }: { onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: 'rgba(0,0,0,0.22)', border: 'none', borderRadius: 2,
      color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: 300,
      width: 18, height: 18,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', padding: 0, flexShrink: 0, lineHeight: 1,
    }}>
      ×
    </button>
  )
}
