'use client'

import { useEffect, useRef } from 'react'
import type { Candle } from '@/types'
import { useTheme } from '@/contexts/ThemeContext'
import { rsi, macd, volume, toLineSeries } from '@/lib/indicators'

export interface IndicatorConfig {
  rsi:    { enabled: boolean; period: number }
  macd:   { enabled: boolean; fast: number; slow: number; signal: number }
  volume: { enabled: boolean }
}

interface Props {
  candles:    Candle[]
  config:     IndicatorConfig
  mainChartRef: React.MutableRefObject<any>
}

const PANE_H = 120

export function IndicatorPanes({ candles, config, mainChartRef }: Props) {
  const { theme } = useTheme()
  const rsiRef    = useRef<HTMLDivElement>(null)
  const macdRef   = useRef<HTMLDivElement>(null)
  const volRef    = useRef<HTMLDivElement>(null)
  const rsiChart  = useRef<any>(null)
  const macdChart = useRef<any>(null)
  const volChart  = useRef<any>(null)
  const cleanupRef = useRef<(() => void)[]>([])

  const getColors = () => {
    const d = theme === 'dark'
    return {
      bg:     d ? '#060a14' : '#ffffff',
      text:   d ? '#4a6280' : '#7090b0',
      border: d ? '#1e2d45' : '#c8d8ee',
    }
  }

  const destroyAll = () => {
    cleanupRef.current.forEach(fn => fn())
    cleanupRef.current = []
    if (rsiChart.current)  { try { rsiChart.current.remove()  } catch {} rsiChart.current  = null }
    if (macdChart.current) { try { macdChart.current.remove() } catch {} macdChart.current = null }
    if (volChart.current)  { try { volChart.current.remove()  } catch {} volChart.current  = null }
  }

  useEffect(() => {
    if (!candles.length) return
    destroyAll()

    import('lightweight-charts').then(lc => {
      const c = getColors()
      const baseOpts = {
        layout:    { background: { color: c.bg }, textColor: c.text },
        grid:      { vertLines: { visible: false }, horzLines: { color: c.border } },
        crosshair: { mode: lc.CrosshairMode.Normal },
        rightPriceScale: { borderColor: c.border, scaleMargins: { top: 0.1, bottom: 0.1 } },
        timeScale: { borderColor: c.border, timeVisible: true, secondsVisible: false, visible: false },
        handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: { price: true, time: true } },
      }

      const syncToMain = (chart: any) => {
        if (!mainChartRef.current) return
        const handler = (range: any) => {
          if (range) try { chart.timeScale().setVisibleLogicalRange(range) } catch {}
        }
        mainChartRef.current.timeScale().subscribeVisibleLogicalRangeChange(handler)
        cleanupRef.current.push(() => {
          try { mainChartRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange(handler) } catch {}
        })
        // Also sync from sub-pane to main
        const reverseHandler = (range: any) => {
          if (range) try { mainChartRef.current?.timeScale().setVisibleLogicalRange(range) } catch {}
        }
        chart.timeScale().subscribeVisibleLogicalRangeChange(reverseHandler)
      }

      // ── RSI ─────────────────────────────────────────────────────
      if (config.rsi.enabled && rsiRef.current) {
        const chart = lc.createChart(rsiRef.current, { ...baseOpts, height: PANE_H })
        rsiChart.current = chart
        const rsiVals = rsi(candles, config.rsi.period)
        const series  = chart.addLineSeries({ color: '#a78bfa', lineWidth: 1, priceScaleId: 'right' })
        series.setData(toLineSeries(candles, rsiVals))
        // Overbought/Oversold lines
        const ob = chart.addLineSeries({ color: 'rgba(239,68,68,0.4)', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false })
        const os = chart.addLineSeries({ color: 'rgba(34,197,94,0.4)',  lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false })
        const times = candles.map(c => ({ time: c.time as any, value: 70 }))
        ob.setData(times)
        os.setData(times.map(t => ({ ...t, value: 30 })))
        syncToMain(chart)
      }

      // ── MACD ─────────────────────────────────────────────────────
      if (config.macd.enabled && macdRef.current) {
        const chart = lc.createChart(macdRef.current, { ...baseOpts, height: PANE_H })
        macdChart.current = chart
        const m = macd(candles, config.macd.fast, config.macd.slow, config.macd.signal)
        const macdSeries   = chart.addLineSeries({ color: '#3b82f6', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
        const signalSeries = chart.addLineSeries({ color: '#f59e0b', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
        const histSeries   = chart.addHistogramSeries({
          color: '#22c55e',
          priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
          priceScaleId: 'right',
          lastValueVisible: false,
        })
        macdSeries.setData(candles.map((c, i) => ({ time: c.time as any, value: m[i].macd ?? 0 })).filter((_, i) => m[i].macd !== null))
        signalSeries.setData(candles.map((c, i) => ({ time: c.time as any, value: m[i].signal ?? 0 })).filter((_, i) => m[i].signal !== null))
        histSeries.setData(candles.map((c, i) => ({
          time: c.time as any,
          value: m[i].hist ?? 0,
          color: (m[i].hist ?? 0) >= 0 ? '#22c55e' : '#ef4444',
        })).filter((_, i) => m[i].hist !== null))
        syncToMain(chart)
      }

      // ── Volume ───────────────────────────────────────────────────
      if (config.volume.enabled && volRef.current) {
        const chart = lc.createChart(volRef.current, {
          ...baseOpts,
          height: PANE_H,
          timeScale: { ...baseOpts.timeScale, visible: true }, // show time axis on last pane
        })
        volChart.current = chart
        const vols = volume(candles)
        const volSeries = chart.addHistogramSeries({
          priceFormat: { type: 'volume' },
          priceScaleId: 'right',
          lastValueVisible: false,
        })
        volSeries.setData(candles.map((c, i) => ({
          time: c.time as any,
          value: vols[i],
          color: c.close >= c.open ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)',
        })))
        syncToMain(chart)
      }

      // Sync initial range
      setTimeout(() => {
        const range = mainChartRef.current?.timeScale().getVisibleLogicalRange()
        if (range) {
          rsiChart.current?.timeScale().setVisibleLogicalRange(range)
          macdChart.current?.timeScale().setVisibleLogicalRange(range)
          volChart.current?.timeScale().setVisibleLogicalRange(range)
        }
      }, 100)
    })

    return () => destroyAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, config, theme])

  const show = config.rsi.enabled || config.macd.enabled || config.volume.enabled
  if (!show) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      {config.rsi.enabled    && <PaneWrapper label={`RSI (${config.rsi.period})`}    ref={rsiRef}  />}
      {config.macd.enabled   && <PaneWrapper label={`MACD (${config.macd.fast},${config.macd.slow},${config.macd.signal})`} ref={macdRef} />}
      {config.volume.enabled && <PaneWrapper label="Volume" ref={volRef} />}
    </div>
  )
}

import { forwardRef } from 'react'

const PaneWrapper = forwardRef<HTMLDivElement, { label: string }>(({ label }, ref) => (
  <div style={{ position: 'relative', height: PANE_H, borderTop: '1px solid var(--border-subtle)' }}>
    <span style={{
      position: 'absolute', top: 4, left: 8, zIndex: 2,
      fontSize: 10, color: 'var(--text-muted)', pointerEvents: 'none',
    }}>{label}</span>
    <div ref={ref} style={{ width: '100%', height: '100%' }} />
  </div>
))
PaneWrapper.displayName = 'PaneWrapper'
