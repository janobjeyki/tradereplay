'use client'

import { useEffect, useRef } from 'react'
import { useTheme } from '@/contexts/ThemeContext'

export function PreviewChart() {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef     = useRef<any>(null)
  const { theme }    = useTheme()

  function getColors() {
    const d = theme === 'dark'
    return {
      bg:   d ? '#0b1120' : '#ffffff',
      grid: d ? '#1e2d45' : '#e2eaf6',
      text: d ? '#4a6280' : '#7090b0',
      bdr:  d ? '#1e2d45' : '#c8d8ee',
    }
  }

  // Init chart once
  useEffect(() => {
    if (!containerRef.current) return
    let cleanup: (() => void) | undefined

    import('lightweight-charts').then(({ createChart, CrosshairMode }) => {
      if (!containerRef.current) return
      const c = getColors()
      const chart = createChart(containerRef.current, {
        layout:  { background: { color: c.bg }, textColor: c.text },
        grid:    { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
        crosshair: { mode: CrosshairMode.Magnet },
        rightPriceScale: { borderColor: c.bdr, scaleMargins: { top: 0.1, bottom: 0.1 } },
        timeScale: { borderColor: c.bdr, timeVisible: true, secondsVisible: false },
        width:  containerRef.current.clientWidth,
        height: 200,
        handleScroll: false,
        handleScale:  false,
      })

      const series = chart.addCandlestickSeries({
        upColor: '#22c55e', downColor: '#ef4444',
        borderUpColor: '#22c55e', borderDownColor: '#ef4444',
        wickUpColor: '#22c55e', wickDownColor: '#ef4444',
      })

      chartRef.current = chart

      // Synthetic XAUUSD-looking preview data
      {
        const d: any[] = []
        let p = 2624.25
        const base = 1735772400 // Jan 2 2025 00:00 UTC
        for (let i = 0; i < 400; i++) {
          const o  = p
          const mv = (Math.random() - 0.494) * 2.2
          const cl = +(o + mv).toFixed(2)
          const h  = +(Math.max(o, cl) + Math.random() * 1.1).toFixed(2)
          const l  = +(Math.min(o, cl) - Math.random() * 1.1).toFixed(2)
          d.push({ time: base + i * 60, open: o, high: h, low: l, close: cl })
          p = cl
        }
        series.setData(d)
        chart.timeScale().fitContent()
      }

      const ro = new ResizeObserver(entries => {
        for (const e of entries) chart.resize(e.contentRect.width, 200)
      })
      ro.observe(containerRef.current!)
      cleanup = () => { ro.disconnect(); chart.remove() }
    })

    return () => cleanup?.()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Theme change → update chart colors
  useEffect(() => {
    if (!chartRef.current) return
    const c = getColors()
    chartRef.current.applyOptions({
      layout:  { background: { color: c.bg }, textColor: c.text },
      grid:    { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      rightPriceScale: { borderColor: c.bdr },
      timeScale: { borderColor: c.bdr },
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme])

  return <div ref={containerRef} style={{ width: '100%', height: '200px' }} />
}
