'use client'

import { useEffect, useRef, useCallback, useState, useMemo, forwardRef, useImperativeHandle } from 'react'
import type { Candle, Trade, Symbol } from '@/types'
import { useTheme } from '@/contexts/ThemeContext'
import { calcPnl } from '@/lib/utils'
import { sma, ema, bollingerBands, toLineSeries } from '@/lib/indicators'
import type { IndicatorConfig } from './IndicatorPanes'

interface LineYPositions {
  entryY: number | null
  slY:    number | null
  tpY:    number | null
}

export interface ChartHandle {
  chartRef: React.MutableRefObject<any>
}

interface Props {
  candles:       Candle[]
  openTrades:    Trade[]
  symbol:        Symbol
  lastPrice?:    number
  indicatorConfig?: IndicatorConfig
  onSetSL?:      (tradeId: string, price: number) => void
  onSetTP?:      (tradeId: string, price: number) => void
  onCloseTrade?: (tradeId: string) => void
  // Preview lines before trade execution (dashed)
  previewSL?:    number | null
  previewTP?:    number | null
  previewEntry?: number | null
  previewSide?:  'buy' | 'sell' | null
  previewEntryLabel?: string | null
  onPreviewSL?:   (price: number) => void
  onPreviewTP?:   (price: number) => void
  onPreviewEntry?: (price: number) => void
}

// Colours matching TradingView paper-trading
const TV_ENTRY_BUY  = '#2962ff'
const TV_ENTRY_SELL = '#ef5350'
const TV_TP         = '#0d9488'   // teal
const TV_SL         = '#ef4444'   // red (matches SL widget + price line)

type DragType = 'sl' | 'tp' | 'entry'

export const WorkspaceChart = forwardRef<ChartHandle, Props>(function WorkspaceChart(
  { candles, openTrades, symbol, lastPrice: lastPriceProp, onSetSL, onSetTP, onCloseTrade, indicatorConfig,
    previewSL, previewTP, previewEntry, previewSide, previewEntryLabel, onPreviewSL, onPreviewTP, onPreviewEntry },
  ref
) {
  const containerRef    = useRef<HTMLDivElement>(null)
  const chartRef        = useRef<any>(null)
  const seriesRef       = useRef<any>(null)
  const priceLines      = useRef<Map<string, any>>(new Map())
  const initializedRef  = useRef(false)
  const draggingRef     = useRef<{ tradeId: string; type: DragType } | null>(null)
  const draggingPriceRef= useRef<number | null>(null)
  const { theme }       = useTheme()
  const [cursorStyle, setCursorStyle] = useState('default')
  const [hideCrosshair, setHideCrosshair] = useState(false)
  const [linePos, setLinePos]         = useState<Map<string, LineYPositions>>(new Map())
  const rafRef          = useRef<number>(0)
  const syncQueuedRef   = useRef(false)
  const openTradesRef   = useRef<Trade[]>(openTrades)
  const prevPosRef      = useRef<Map<string, LineYPositions>>(new Map())
  const previewDraggingRef = useRef<'sl' | 'tp' | 'entry' | null>(null)

  // Fix 6: temp line shown while dragging from entry line to create SL/TP
  const [dragLine, setDragLine] = useState<{ y: number; isTP: boolean } | null>(null)
  // Expose chartRef to parent
  useImperativeHandle(ref, () => ({ chartRef: chartRef }))

  useEffect(() => { openTradesRef.current = openTrades }, [openTrades])

  const normalizePreviewPrice = useCallback((kind: 'sl' | 'tp' | 'entry', price: number) => {
    if (kind === 'entry' || previewEntry == null || !previewSide) return price
    const minStep = Math.max(1 / Math.pow(10, symbol.decimals), symbol.pipSize)
    if (kind === 'tp') {
      return previewSide === 'buy'
        ? Math.max(price, previewEntry + minStep)
        : Math.min(price, previewEntry - minStep)
    }
    return previewSide === 'buy'
      ? Math.min(price, previewEntry - minStep)
      : Math.max(price, previewEntry + minStep)
  }, [previewEntry, previewSide, symbol.decimals, symbol.pipSize])

  const getColors = useCallback(() => {
    const d = theme === 'dark'
    return {
      bg:     d ? '#060a14' : '#ffffff',
      text:   d ? '#4a6280' : '#7090b0',
      border: d ? '#1e2d45' : '#c8d8ee',
    }
  }, [theme])

  // Sync Y positions — uses draggingPriceRef so overlay tracks live during drag
  const syncPositions = useCallback(() => {
    if (!seriesRef.current) return
    const next = new Map<string, LineYPositions>()
    const drag = draggingRef.current

    for (const tr of openTradesRef.current) {
      const isDragSL = drag?.tradeId === tr.id && drag?.type === 'sl'
      const isDragTP = drag?.tradeId === tr.id && drag?.type === 'tp'
      const slPrice  = isDragSL && draggingPriceRef.current != null ? draggingPriceRef.current : tr.stop_loss
      const tpPrice  = isDragTP && draggingPriceRef.current != null ? draggingPriceRef.current : tr.take_profit

      next.set(tr.id, {
        entryY: seriesRef.current.priceToCoordinate(tr.entry_price) ?? null,
        slY:    slPrice ? (seriesRef.current.priceToCoordinate(slPrice) ?? null) : null,
        tpY:    tpPrice ? (seriesRef.current.priceToCoordinate(tpPrice) ?? null) : null,
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

  const scheduleSyncPositions = useCallback(() => {
    if (syncQueuedRef.current) return
    syncQueuedRef.current = true
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      syncQueuedRef.current = false
      syncPositions()
    })
  }, [syncPositions])

  // ── Initialize chart ─────────────────────────────────────────────
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
          crosshair: {
            mode: lc.CrosshairMode.Normal,
            vertLine: {
              visible: true,
              labelVisible: true,
            },
            horzLine: {
              visible: true,
              labelVisible: true,
            },
          },
          rightPriceScale: {
            borderColor: c.border,
            scaleMargins: { top: 0.1, bottom: 0.1 },
            autoScale: true,
          },
          // Fix 2: disable price-axis drag so SL/TP can't be moved from axis
          handleScale: {
            axisPressedMouseMove: { price: true, time: true },
            mouseWheel: true,
            pinch: true,
          },
          handleScroll: {
            mouseWheel: true,
            pressedMouseMove: true,
            horzTouchDrag: true,
            vertTouchDrag: false,
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
          upColor:          '#22c55e',
          downColor:        '#ef4444',
          borderUpColor:    '#22c55e',
          borderDownColor:  '#ef4444',
          wickUpColor:      '#22c55e',
          wickDownColor:    '#ef4444',
          lastValueVisible: false,   // we draw our own stable M1 price line
          priceLineVisible: false,   // hide the dashed last-candle line
        })

        chartRef.current  = chart
        seriesRef.current = series

        chart.subscribeCrosshairMove(scheduleSyncPositions)
        chart.timeScale().subscribeVisibleTimeRangeChange(scheduleSyncPositions)

        const el = containerRef.current!

        // ── Fix 2: capture phase intercepts before chart panning starts ──
        const onMouseDown = (e: MouseEvent) => {
          // Don't intercept if click is on or inside any button element
          const path = e.composedPath() as HTMLElement[]
          if (path.some(el => el.tagName === 'BUTTON')) return
          if (!seriesRef.current) return
          const rect = el.getBoundingClientRect()
          const y    = e.clientY - rect.top

          // Check entry lines first (Fix 6: drag entry to create SL/TP)
          for (const tr of openTradesRef.current) {
            const entryY = seriesRef.current.priceToCoordinate(tr.entry_price)
            if (entryY != null && Math.abs(entryY - y) < 10) {
              draggingRef.current  = { tradeId: tr.id, type: 'entry' }
              draggingPriceRef.current = tr.entry_price
              setCursorStyle('ns-resize')
              e.stopPropagation()
              e.preventDefault()
              scheduleSyncPositions()
              // Disable chart panning while we drag
              chartRef.current?.applyOptions({ handleScroll: { pressedMouseMove: false } })
              return
            }
          }

          // Check SL / TP lines
          for (const [key] of priceLines.current) {
            const [tradeId, type] = key.split(':')
            if (type === 'entry') continue
            const trade = openTradesRef.current.find(t => t.id === tradeId)
            if (!trade) continue
            const price = type === 'sl' ? trade.stop_loss : trade.take_profit
            if (!price) continue
            const coord = seriesRef.current.priceToCoordinate(price)
            if (coord != null && Math.abs(coord - y) < 10) {
              draggingRef.current      = { tradeId, type: type as DragType }
              draggingPriceRef.current = price
              setCursorStyle('ns-resize')
              e.stopPropagation()
              e.preventDefault()
              scheduleSyncPositions()
              chartRef.current?.applyOptions({ handleScroll: { pressedMouseMove: false } })
              return
            }
          }
        }

        const onMouseMove = (e: MouseEvent) => {
          ;(window as any).__lastMouseY = e.clientY
          if (!draggingRef.current || !seriesRef.current) return
          setHideCrosshair(true)
          const rect     = el.getBoundingClientRect()
          const y        = e.clientY - rect.top
          const newPrice = seriesRef.current.coordinateToPrice(y)
          if (newPrice == null || !Number.isFinite(newPrice)) return

          const { tradeId, type } = draggingRef.current

          if (type === 'sl' || type === 'tp') {
            // Move the actual chart price line and update overlay via draggingPriceRef
            draggingPriceRef.current = newPrice
            const line = priceLines.current.get(`${tradeId}:${type}`)
            if (line) line.applyOptions({ price: newPrice })
            scheduleSyncPositions()
          } else if (type === 'entry') {
            // Fix 6: show temp line indicating where SL/TP will be set
            draggingPriceRef.current = newPrice
            const trade = openTradesRef.current.find(t => t.id === tradeId)
            if (trade) {
              const isBuy   = trade.side === 'buy'
              const isAbove = newPrice > trade.entry_price
              // buy + above entry = TP; buy + below = SL; sell inverted
              const isTP = (isBuy && isAbove) || (!isBuy && !isAbove)
              setDragLine({ y, isTP })
            }
            scheduleSyncPositions()
          }
        }

        const onMouseUp = () => {
          // Re-enable chart panning
          chartRef.current?.applyOptions({ handleScroll: { pressedMouseMove: true } })

          if (!draggingRef.current || !seriesRef.current) return
          const rect       = el.getBoundingClientRect()
          const y          = ((window as any).__lastMouseY ?? 0) - rect.top
          const finalPrice = seriesRef.current.coordinateToPrice(y)

          if (finalPrice != null && Number.isFinite(finalPrice)) {
            const { tradeId, type } = draggingRef.current

            if (type === 'sl') {
              onSetSL?.(tradeId, finalPrice)
            } else if (type === 'tp') {
              onSetTP?.(tradeId, finalPrice)
            } else if (type === 'entry') {
              // Fix 6: commit SL or TP depending on drag direction
              const trade = openTradesRef.current.find(t => t.id === tradeId)
              if (trade && Math.abs(finalPrice - trade.entry_price) > 0.001) {
                const isBuy   = trade.side === 'buy'
                const isAbove = finalPrice > trade.entry_price
                const isTP    = (isBuy && isAbove) || (!isBuy && !isAbove)
                if (isTP) onSetTP?.(tradeId, finalPrice)
                else       onSetSL?.(tradeId, finalPrice)
              }
            }
          }

          draggingRef.current      = null
          draggingPriceRef.current = null
          setDragLine(null)
          setCursorStyle('default')
          setHideCrosshair(false)
          scheduleSyncPositions()
        }

        // Fix 2: capture:true so we intercept before lightweight-charts handles it
        el.addEventListener('mousedown', onMouseDown, { capture: true })
        document.addEventListener('mousemove', onMouseMove)
        document.addEventListener('mouseup',   onMouseUp)

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
  }, [getColors, scheduleSyncPositions])

  // ── Theme ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current) return
    const c = getColors()
    chartRef.current.applyOptions({
      layout:          { background: { color: c.bg }, textColor: c.text },
      grid:            { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { borderColor: c.border },
      timeScale:       { borderColor: c.border },
      crosshair:       {
        vertLine: { visible: !hideCrosshair, labelVisible: !hideCrosshair },
        horzLine: { visible: !hideCrosshair, labelVisible: !hideCrosshair },
      },
    })
  }, [theme, getColors, hideCrosshair])

  // ── Candles ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!seriesRef.current || !candles.length) return
    seriesRef.current.setData(
      candles.map(c => ({ time: c.time as any, open: c.open, high: c.high, low: c.low, close: c.close }))
    )
    scheduleSyncPositions()
  }, [candles, scheduleSyncPositions])

  // ── Price lines ──────────────────────────────────────────────────
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
            lineWidth: 2, lineStyle: LineStyle.Solid,
            axisLabelVisible: true, title: tr.side === 'buy' ? '▲ Buy' : '▼ Sell',
          }))
        } catch {}

        if (tr.stop_loss) {
          try {
            priceLines.current.set(`${tr.id}:sl`, seriesRef.current.createPriceLine({
              price: tr.stop_loss,
              color: TV_SL,
              lineWidth: 2, lineStyle: LineStyle.Dashed,
              axisLabelVisible: true, title: '✕ SL',
            }))
          } catch {}
        }

        if (tr.take_profit) {
          try {
            priceLines.current.set(`${tr.id}:tp`, seriesRef.current.createPriceLine({
              price: tr.take_profit,
              color: TV_TP,
              lineWidth: 2, lineStyle: LineStyle.Dashed,
              axisLabelVisible: true, title: '✓ TP',
            }))
          } catch {}
        }
      })
      scheduleSyncPositions()
    })
  }, [openTrades, scheduleSyncPositions])
  // ── Live M1 price line — stable across TF switches ───────────────
  const m1PriceLineRef = useRef<any>(null)
  useEffect(() => {
    if (!seriesRef.current || !lastPriceProp) return
    import('lightweight-charts').then(({ LineStyle }) => {
      if (!seriesRef.current) return
      try {
        if (m1PriceLineRef.current) {
          m1PriceLineRef.current.applyOptions({ price: lastPriceProp })
        } else {
          m1PriceLineRef.current = seriesRef.current.createPriceLine({
            price:            lastPriceProp,
            color:            '#3b82f6',
            lineWidth:        1,
            lineStyle:        LineStyle.Dotted,
            axisLabelVisible: true,
            title:            '',
          })
        }
      } catch {}
    })
    scheduleSyncPositions()
  }, [lastPriceProp, scheduleSyncPositions])

  // ── Cursor: change to ns-resize when hovering near any draggable line ──
  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const isNearPriceLine = (y: number) => {
      if (!seriesRef.current) return false
      for (const tr of openTrades) {
        const entryY = seriesRef.current.priceToCoordinate(tr.entry_price)
        if (entryY != null && Math.abs(entryY - y) < 10) return true
      }
      for (const [key] of priceLines.current) {
        const [tradeId, type] = key.split(':')
        if (type === 'entry') continue
        const trade = openTrades.find(t => t.id === tradeId)
        if (!trade) continue
        const price = type === 'sl' ? trade.stop_loss : trade.take_profit
        if (!price) continue
        const ly = seriesRef.current.priceToCoordinate(price)
        if (ly != null && Math.abs(ly - y) < 10) return true
      }
      const previewPrices = [previewEntry, previewSL, previewTP]
      for (const price of previewPrices) {
        if (price == null) continue
        const ly = seriesRef.current.priceToCoordinate(price)
        if (ly != null && Math.abs(ly - y) < 10) return true
      }
      return false
    }
    const onMove = (e: MouseEvent) => {
      if (!seriesRef.current) return
      if (draggingRef.current || previewDraggingRef.current) {
        setCursorStyle('ns-resize')
        setHideCrosshair(true)
        return
      }
      const rect = el.getBoundingClientRect()
      const y    = e.clientY - rect.top
      const near   = isNearPriceLine(y)
      setCursorStyle(near ? 'ns-resize' : 'default')
      setHideCrosshair(near)
    }
    const onLeave = () => {
      if (draggingRef.current || previewDraggingRef.current) return
      setCursorStyle('default')
      setHideCrosshair(false)
    }
    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
    return () => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
    }
  }, [openTrades, previewEntry, previewSL, previewTP])




  // ── Preview price lines (dashed, before trade execution) ────────────
  const previewLinesRef = useRef<{ sl: any; tp: any; entry: any }>({ sl: null, tp: null, entry: null })

  useEffect(() => {
    if (!seriesRef.current) return
    import('lightweight-charts').then(({ LineStyle }) => {
      if (!seriesRef.current) return
      const pl = previewLinesRef.current
      const upsert = (key: 'sl' | 'tp' | 'entry', price: number | null | undefined, color: string) => {
        if (price != null && price > 0) {
          const entryTitle = previewEntryLabel
            ? `${previewSide === 'buy' ? '▲' : '▼'} ${previewEntryLabel}`
            : (previewSide === 'buy' ? '▲ Buy' : '▼ Sell')
          const title = key === 'entry' ? entryTitle : key === 'sl' ? '✕ SL' : '✓ TP'
          if (pl[key]) { pl[key].applyOptions({ price }) }
          else {
            try {
              pl[key] = seriesRef.current.createPriceLine({
                price, color, lineWidth: 1, lineStyle: LineStyle.Dashed,
                axisLabelVisible: true,
                title,
              })
            } catch {}
          }
          if (pl[key]) pl[key].applyOptions({ color, title })
        } else if (pl[key]) {
          try { seriesRef.current?.removePriceLine(pl[key]) } catch {}
          pl[key] = null
        }
      }
      const entryClr = (previewSide === 'sell' ? TV_ENTRY_SELL : TV_ENTRY_BUY) + 'cc'
      upsert('entry', previewEntry, entryClr)
      upsert('sl',    previewSL,    TV_SL + 'cc')
      upsert('tp',    previewTP,    TV_TP + 'cc')
    })
  }, [previewSL, previewTP, previewEntry, previewSide, previewEntryLabel])

  // Drag preview SL/TP/Entry lines on chart to update form inputs
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return
      if (!seriesRef.current) return
      const rect = el.getBoundingClientRect()
      const y    = e.clientY - rect.top
      const slCoord    = previewSL    != null ? seriesRef.current.priceToCoordinate(previewSL)    : null
      const tpCoord    = previewTP    != null ? seriesRef.current.priceToCoordinate(previewTP)    : null
      const entryCoord = previewEntry != null ? seriesRef.current.priceToCoordinate(previewEntry) : null
      if (slCoord != null && Math.abs(slCoord - y) < 12) {
        previewDraggingRef.current = 'sl'
        setCursorStyle('ns-resize')
        e.preventDefault()
        e.stopPropagation()
        chartRef.current?.applyOptions({ handleScroll: { pressedMouseMove: false } })
      } else if (tpCoord != null && Math.abs(tpCoord - y) < 12) {
        previewDraggingRef.current = 'tp'
        setCursorStyle('ns-resize')
        e.preventDefault()
        e.stopPropagation()
        chartRef.current?.applyOptions({ handleScroll: { pressedMouseMove: false } })
      } else if (entryCoord != null && Math.abs(entryCoord - y) < 12) {
        previewDraggingRef.current = 'entry'
        setCursorStyle('ns-resize')
        e.preventDefault()
        e.stopPropagation()
        chartRef.current?.applyOptions({ handleScroll: { pressedMouseMove: false } })
      }
    }
    const onMove = (e: MouseEvent) => {
      const dragging = previewDraggingRef.current
      if (!dragging || !seriesRef.current) return
      e.preventDefault()
      setHideCrosshair(true)
      const rect  = el.getBoundingClientRect()
      const price = seriesRef.current.coordinateToPrice(e.clientY - rect.top)
      if (price == null) return
      const normalizedPrice = normalizePreviewPrice(dragging, price)
      if (dragging === 'sl')    onPreviewSL?.   (normalizedPrice)
      if (dragging === 'tp')    onPreviewTP?.   (normalizedPrice)
      if (dragging === 'entry') onPreviewEntry?.(price)
    }
    const onUp = () => {
      previewDraggingRef.current = null
      setCursorStyle('default')
      setHideCrosshair(false)
      chartRef.current?.applyOptions({ handleScroll: { pressedMouseMove: true } })
    }

    el.addEventListener('mousedown', onDown, { capture: true })
    window.addEventListener('mousemove', onMove, { passive: false })
    window.addEventListener('mouseup',   onUp)
    return () => {
      el.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [normalizePreviewPrice, previewSL, previewTP, previewEntry, onPreviewSL, onPreviewTP, onPreviewEntry])

  // ── Overlay indicator series ──────────────────────────────────────
  const overlaySeriesRef = useRef<Map<string,any>>(new Map())
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current || !candles.length) return
    import('lightweight-charts').then(({ LineStyle }) => {
      if (!seriesRef.current || !chartRef.current) return
      const ov  = overlaySeriesRef.current
      const ic  = indicatorConfig

      const ensure = (key: string, color: string, dashed = false) => {
        if (!ov.has(key)) {
          const s = chartRef.current.addLineSeries({
            color, lineWidth: 1,
            lineStyle: dashed ? LineStyle.Dashed : LineStyle.Solid,
            priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
          })
          ov.set(key, s)
        }
        return ov.get(key)
      }
      const remove = (key: string) => {
        if (ov.has(key)) { try { chartRef.current?.removeSeries(ov.get(key)) } catch {}; ov.delete(key) }
      }

      // SMA — single period
      if (ic?.sma?.enabled) {
        // remove old keys if period changed
        [9,20,50,100,200].filter(p => p !== ic.sma.period).forEach(p => remove(`sma_${p}`))
        ensure(`sma_${ic.sma.period}`, ic.sma.color || '#f59e0b').setData(toLineSeries(candles, sma(candles, ic.sma.period)))
      } else {
        [9,20,50,100,200].forEach(p => remove(`sma_${p}`))
      }

      // EMA — single period
      if (ic?.ema?.enabled) {
        [9,12,21,26,50,200].filter(p => p !== ic.ema.period).forEach(p => remove(`ema_${p}`))
        ensure(`ema_${ic.ema.period}`, ic.ema.color || '#a78bfa').setData(toLineSeries(candles, ema(candles, ic.ema.period)))
      } else {
        [9,12,21,26,50,200].forEach(p => remove(`ema_${p}`))
      }

      // Bollinger Bands
      if (ic?.bb?.enabled) {
        const bb = bollingerBands(candles, ic.bb.period, ic.bb.mult)
        ensure('bb_upper',  '#a78bfa', true).setData(candles.map((c,i)=>({time:c.time as any,value:bb[i].upper})).filter(d=>d.value!=null))
        ensure('bb_middle', '#a78bfa').setData(candles.map((c,i)=>({time:c.time as any,value:bb[i].middle})).filter(d=>d.value!=null))
        ensure('bb_lower',  '#a78bfa', true).setData(candles.map((c,i)=>({time:c.time as any,value:bb[i].lower})).filter(d=>d.value!=null))
      } else {
        ['bb_upper','bb_middle','bb_lower'].forEach(k => remove(k))
      }
    })
  }, [candles, indicatorConfig])

  // Use prop if provided (stable M1 price), fallback to last candle close
  const lastPrice = lastPriceProp ?? (candles.length > 0 ? candles[candles.length - 1].close : 0)

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 0, position: 'relative' }}>
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', display: 'block', cursor: cursorStyle }}
      />

      {/* Overlay */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>

        {/* Fix 6: temp dashed line while dragging from entry line */}
        {dragLine && (
          <div style={{
            position:  'absolute',
            top:       dragLine.y,
            left:      0,
            right:     72,
            height:    0,
            borderTop: `2px dashed ${dragLine.isTP ? TV_TP : TV_SL}`,
            opacity:   0.7,
          }} />
        )}

        {openTrades.map(trade => {
          const pos = linePos.get(trade.id)
          if (!pos) return null

          const unrealizedPnl = trade.status === 'open'
            ? calcPnl(trade.side, trade.entry_price, lastPrice, trade.quantity, symbol.contractSize)
            : 0
          const isBuy         = trade.side === 'buy'
          const entryColor    = isBuy ? TV_ENTRY_BUY : TV_ENTRY_SELL

          const tpPnl = trade.take_profit
            ? calcPnl(trade.side, trade.entry_price, trade.take_profit, trade.quantity, symbol.contractSize)
            : null
          const slPnl = trade.stop_loss
            ? calcPnl(trade.side, trade.entry_price, trade.stop_loss, trade.quantity, symbol.contractSize)
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
                    {/* Drag hint */}
                    <span style={{ opacity: 0.7, fontSize: 10, cursor: 'ns-resize' }} title="Drag to set SL/TP">⇅</span>
                    <TvPillBtn label="TP" onClick={() => onSetTP?.(trade.id, lastPrice + (isBuy ? 5 : -5))} />
                    <TvPillBtn label="SL" onClick={() => onSetSL?.(trade.id, lastPrice + (isBuy ? -5 : 5))} />
                    <span style={{ opacity: 0.9 }}>{isBuy ? '+' : '−'}{trade.quantity}</span>
                    <span style={{ color: trade.status === 'pending' ? 'rgba(255,255,255,0.8)' : unrealizedPnl >= 0 ? '#bbf7d0' : '#fecaca', fontWeight: 700, margin: '0 2px' }}>
                      {trade.status === 'pending' ? 'Pending' : `${unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)} USD`}
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
                    <span style={{ opacity: 0.75, fontSize: 10 }}>SL</span>
                    <span style={{ opacity: 0.9 }}>{trade.stop_loss!.toFixed(2)}</span>
                    <span style={{ opacity: 0.4, fontSize: 9 }}>│</span>
                    <span style={{ color: '#fee2e2', fontWeight: 700 }}>
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
                    <span style={{ opacity: 0.75, fontSize: 10 }}>TP</span>
                    <span style={{ opacity: 0.9 }}>{trade.take_profit!.toFixed(2)}</span>
                    <span style={{ opacity: 0.4, fontSize: 9 }}>│</span>
                    <span style={{ color: '#d1fae5', fontWeight: 700 }}>
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
})

// ── Sub-components ───────────────────────────────────────────────

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
    <button
      type="button"
      onClick={e => { e.preventDefault(); e.stopPropagation(); onClick?.() }}
      onMouseDown={e => { e.preventDefault(); e.stopPropagation() }}
      onPointerDown={e => { e.preventDefault(); e.stopPropagation() }}
      style={{
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
    <button
      type="button"
      onClick={e => { e.preventDefault(); e.stopPropagation(); onClick?.() }}
      onMouseDown={e => { e.preventDefault(); e.stopPropagation() }}
      onPointerDown={e => { e.preventDefault(); e.stopPropagation() }}
      style={{
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
