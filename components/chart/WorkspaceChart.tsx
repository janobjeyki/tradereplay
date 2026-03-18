'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import type { Candle, Trade, Symbol } from '@/types'
import { useTheme } from '@/contexts/ThemeContext'

interface Props {
  candles:    Candle[]
  openTrades: Trade[]
  symbol:     Symbol
  onSetSL?: (tradeId: string, price: number) => void
  onSetTP?: (tradeId: string, price: number) => void
}

export function WorkspaceChart({ candles, openTrades, symbol, onSetSL, onSetTP }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef     = useRef<any>(null)
  const seriesRef    = useRef<any>(null)
  const priceLines   = useRef<Map<string, any>>(new Map())
  const initializedRef = useRef(false)
  const contentFittedRef = useRef(false)
  const draggingRef = useRef<{tradeId: string, type: 'sl' | 'tp'} | null>(null)
  const { theme }    = useTheme()
  const [cursortyle, setCursorStyle] = useState('default')

  // Reference to store price offset during drag
  const priceOffsetRef = useRef<number>(0)

  const getColors = useCallback(() => {
    const d = theme === 'dark'
    return {
      bg:     d ? '#060a14' : '#ffffff',
      grid:   d ? '#1e2d45' : '#e8eff8',
      text:   d ? '#4a6280' : '#7090b0',
      border: d ? '#1e2d45' : '#c8d8ee',
    }
  }, [theme])

  // Initialize chart — wait for container to have real dimensions
  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return

    let chart: any = null
    let series: any = null
    let ro: ResizeObserver | null = null

    function initChart(width: number, height: number) {
      if (initializedRef.current || !containerRef.current) return
      initializedRef.current = true

      import('lightweight-charts').then(lc => {
        if (!containerRef.current) return
        const c = getColors()

        chart = lc.createChart(containerRef.current, {
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

        series = chart.addCandlestickSeries({
          upColor:         '#22c55e',
          downColor:       '#ef4444',
          borderUpColor:   '#22c55e',
          borderDownColor: '#ef4444',
          wickUpColor:     '#22c55e',
          wickDownColor:   '#ef4444',
        })

        chartRef.current  = chart
        seriesRef.current = series

        // Add drag handlers for SL/TP lines
        if (containerRef.current) {
          const handleMouseDown = (e: MouseEvent) => {
            if (!chartRef.current || !seriesRef.current) return
            
            const rect = containerRef.current!.getBoundingClientRect()
            const y = e.clientY - rect.top
            
            // Find which line was clicked
            for (const [key, line] of priceLines.current) {
              if (!line) continue
              const [tradeId, type] = key.split(':')
              const trade = openTrades.find(t => t.id === tradeId)
              if (!trade) continue
              
              const price = type === 'sl' ? trade.stop_loss : type === 'tp' ? trade.take_profit : null
              if (!price) continue
              
              // Get y coordinate of the price
              const coord = seriesRef.current.priceToCoordinate(price)
              if (coord && Math.abs(coord - y) < 10) {
                // Store the offset between mouse and line
                priceOffsetRef.current = price
                draggingRef.current = { tradeId, type: type as 'sl' | 'tp' }
                setCursorStyle('ns-resize')
                e.preventDefault()
                break
              }
            }
          }
          
          const handleMouseMove = (e: MouseEvent) => {
            if (!draggingRef.current || !chartRef.current || !seriesRef.current) return
            
            const rect = containerRef.current!.getBoundingClientRect()
            const y = e.clientY - rect.top
            
            // Get price scale dimensions
            const barsData = seriesRef.current.data() as any[]
            if (!barsData || barsData.length === 0) return
            
            // Find price range with margin for proper scaling
            let minPrice = Infinity
            let maxPrice = -Infinity
            for (const bar of barsData) {
              minPrice = Math.min(minPrice, bar.low)
              maxPrice = Math.max(maxPrice, bar.high)
            }
            
            if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice)) return
            
            // Add 2% margin
            const range = maxPrice - minPrice
            const margin = range * 0.02
            const topPrice = maxPrice + margin
            const bottomPrice = minPrice - margin
            
            // Get coordinates
            const topY = seriesRef.current.priceToCoordinate(topPrice) ?? 0
            const bottomY = seriesRef.current.priceToCoordinate(bottomPrice) ?? rect.height
            
            // Convert Y to price
            const pixelRange = bottomY - topY
            if (Math.abs(pixelRange) < 1) return
            
            const priceRange = bottomPrice - topPrice
            const newPrice = topPrice + ((y - topY) / pixelRange) * priceRange
            
            if (Number.isFinite(newPrice)) {
              const key = `${draggingRef.current.tradeId}:${draggingRef.current.type}`
              const line = priceLines.current.get(key)
              if (line) {
                line.applyOptions({ price: newPrice })
              }
            }
          }
          
          const handleMouseUp = () => {
            if (!draggingRef.current || !seriesRef.current) return
            
            const rect = containerRef.current!.getBoundingClientRect()
            const y = (window as any).__lastMouseY - rect.top
            
            // Calculate final price
            const barsData = seriesRef.current.data() as any[]
            if (!barsData || barsData.length === 0) return
            
            let minPrice = Infinity
            let maxPrice = -Infinity
            for (const bar of barsData) {
              minPrice = Math.min(minPrice, bar.low)
              maxPrice = Math.max(maxPrice, bar.high)
            }
            
            if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice)) return
            
            const range = maxPrice - minPrice
            const margin = range * 0.02
            const topPrice = maxPrice + margin
            const bottomPrice = minPrice - margin
            
            const topY = seriesRef.current.priceToCoordinate(topPrice) ?? 0
            const bottomY = seriesRef.current.priceToCoordinate(bottomPrice) ?? rect.height
            
            const pixelRange = bottomY - topY
            if (Math.abs(pixelRange) >= 1) {
              const priceRange = bottomPrice - topPrice
              const finalPrice = topPrice + ((y - topY) / pixelRange) * priceRange
              
              if (Number.isFinite(finalPrice)) {
                const { tradeId, type } = draggingRef.current
                if (type === 'sl' && onSetSL) {
                  onSetSL(tradeId, finalPrice)
                } else if (type === 'tp' && onSetTP) {
                  onSetTP(tradeId, finalPrice)
                }
              }
            }
            
            draggingRef.current = null
            setCursorStyle('default')
          }
          
          const handleMouseTrack = (e: MouseEvent) => {
            (window as any).__lastMouseY = e.clientY
          }
          
          containerRef.current.addEventListener('mousedown', handleMouseDown)
          document.addEventListener('mousemove', handleMouseMove)
          document.addEventListener('mousemove', handleMouseTrack)
          document.addEventListener('mouseup', handleMouseUp)
        }

        // Set data immediately if candles are already available
        if (candles.length > 0) {
          series.setData(candles.map(c => ({
            time: c.time as any, open: c.open, high: c.high, low: c.low, close: c.close,
          })))
          const ts = chart.timeScale()
          ts.fitContent()
          contentFittedRef.current = true
        }
      })
    }

    // Use ResizeObserver to get real dimensions — fires as soon as element has size
    ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          if (!initializedRef.current) {
            initChart(width, height)
          } else if (chartRef.current) {
            chartRef.current.resize(width, height)
          }
        }
      }
    })
    ro.observe(containerRef.current)

    // Fallback: if ResizeObserver fires too late, try after a short delay
    const timer = setTimeout(() => {
      if (!initializedRef.current && containerRef.current) {
        const w = containerRef.current.clientWidth
        const h = containerRef.current.clientHeight
        if (w > 0 && h > 0) initChart(w, h)
        else initChart(containerRef.current.offsetWidth || 900, containerRef.current.offsetHeight || 500)
      }
    }, 100)

    return () => {
      clearTimeout(timer)
      ro?.disconnect()
      if (containerRef.current) {
        containerRef.current.removeEventListener('mousedown', () => {})
      }
      document.removeEventListener('mousemove', () => {})
      document.removeEventListener('mouseup', () => {})
      chartRef.current?.remove()
      chartRef.current  = null
      seriesRef.current = null
      initializedRef.current = false
      contentFittedRef.current = false
      draggingRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Apply theme colors when theme changes
  useEffect(() => {
    if (!chartRef.current) return
    const c = getColors()
    chartRef.current.applyOptions({
      layout:  { background: { color: c.bg }, textColor: c.text },
      grid:    { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { borderColor: c.border },
      timeScale: { borderColor: c.border },
    })
  }, [theme, getColors])

  // Update candles whenever the slice changes — only update data, never trigger fitContent
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current || !candles.length) return

    seriesRef.current.setData(
      candles.map(c => ({
        time:  c.time as any,
        open:  c.open,
        high:  c.high,
        low:   c.low,
        close: c.close,
      }))
    )
    // Do NOT call fitContent here - it would reset the view position
  }, [candles])

  // Update SL/TP price lines and entry prices
  useEffect(() => {
    if (!seriesRef.current) return
    
    // Remove old lines
    for (const line of priceLines.current.values()) {
      try { seriesRef.current.removePriceLine(line) } catch {}
    }
    priceLines.current.clear()
    
    import('lightweight-charts').then(({ LineStyle }) => {
      if (!seriesRef.current) return
      
      openTrades.forEach(tr => {
        // Entry price line (solid amber)
        try {
          const entryLine = seriesRef.current.createPriceLine({
            price: tr.entry_price,
            color: '#f59e0b',
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: true,
            title: 'Entry',
          })
          priceLines.current.set(`${tr.id}:entry`, entryLine)
        } catch {}
        
        // SL line (dashed red, draggable)
        if (tr.stop_loss) {
          try {
            const slLine = seriesRef.current.createPriceLine({
              price: tr.stop_loss,
              color: '#ef4444',
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
              title: 'SL',
            })
            priceLines.current.set(`${tr.id}:sl`, slLine)
          } catch {}
        }
        
        // TP line (dashed green, draggable)
        if (tr.take_profit) {
          try {
            const tpLine = seriesRef.current.createPriceLine({
              price: tr.take_profit,
              color: '#22c55e',
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
              title: 'TP',
            })
            priceLines.current.set(`${tr.id}:tp`, tpLine)
          } catch {}
        }
      })
    })
  }, [openTrades])

  // Show cursor hint when hovering over draggable lines
  useEffect(() => {
    if (!containerRef.current || !chartRef.current || !seriesRef.current) return
    
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingRef.current) return // Already dragging
      
      const rect = containerRef.current!.getBoundingClientRect()
      const y = e.clientY - rect.top
      
      // Check if near any SL/TP line
      let isNearLine = false
      for (const [key] of priceLines.current) {
        const [tradeId, type] = key.split(':')
        if (type === 'entry') continue // Entry lines not draggable
        
        const trade = openTrades.find(t => t.id === tradeId)
        if (!trade) continue
        
        const price = type === 'sl' ? trade.stop_loss : trade.take_profit
        if (!price) continue
        
        // Get line's y coordinate
        const lineY = seriesRef.current.priceToCoordinate(price)
        if (lineY && Math.abs(lineY - y) < 8) {
          isNearLine = true
          break
        }
      }
      
      setCursorStyle(isNearLine ? 'ns-resize' : 'default')
    }
    
    containerRef.current.addEventListener('mousemove', handleMouseMove)
    return () => containerRef.current?.removeEventListener('mousemove', handleMouseMove)
  }, [openTrades])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', minHeight: 0, display: 'block', cursor: cursortyle }}
    />
  )
}
