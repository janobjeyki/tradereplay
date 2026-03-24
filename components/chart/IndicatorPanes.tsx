'use client'

import { useEffect, useRef } from 'react'
import { forwardRef } from 'react'
import type { Candle } from '@/types'
import { useTheme } from '@/contexts/ThemeContext'
import { sma, ema, bollingerBands, rsi, macd, toLineSeries } from '@/lib/indicators'

export interface IndicatorConfig {
  // Overlay (on main chart)
  sma:  { enabled: boolean; period: number; color: string }
  ema:  { enabled: boolean; period: number; color: string }
  bb:   { enabled: boolean; period: number; mult: number }
  // Sub-panes
  rsi:    { enabled: boolean; period: number }
  macd:   { enabled: boolean; fast: number; slow: number; signal: number }
}

export const DEFAULT_INDICATOR_CONFIG: IndicatorConfig = {
  sma:    { enabled: false, period: 20, color: '#f59e0b' },
  ema:    { enabled: false, period: 9,  color: '#a78bfa' },
  bb:     { enabled: false, period: 20, mult: 2 },
  rsi:    { enabled: false, period: 14 },
  macd:   { enabled: false, fast: 12, slow: 26, signal: 9 },
}

const SMA_COLORS  = ['#f59e0b', '#3b82f6', '#ef4444', '#a78bfa']
const EMA_COLORS  = ['#a78bfa', '#60a5fa', '#34d399', '#f97316']
const PANE_H = 110

interface Props {
  candles:      Candle[]
  config:       IndicatorConfig
  mainChartRef: React.MutableRefObject<any>
}

export function IndicatorPanes({ candles, config, mainChartRef }: Props) {
  const { theme }  = useTheme()
  const rsiRef     = useRef<HTMLDivElement>(null)
  const macdRef    = useRef<HTMLDivElement>(null)
  const charts     = useRef<{ rsi: any; macd: any }>({ rsi: null, macd: null })
  const unsubs     = useRef<(() => void)[]>([])

  const getColors = () => {
    const d = theme === 'dark'
    return { bg: d?'#060a14':'#ffffff', text: d?'#4a6280':'#7090b0', border: d?'#1e2d45':'#c8d8ee' }
  }

  const destroy = () => {
    unsubs.current.forEach(fn => fn())
    unsubs.current = []
    ;(['rsi','macd'] as const).forEach(k => {
      try { charts.current[k]?.remove() } catch {}
      charts.current[k] = null
    })
  }

  useEffect(() => {
    if (!candles.length) return
    destroy()
    import('lightweight-charts').then(lc => {
      const c   = getColors()
      const base = {
        layout:    { background: { color: c.bg }, textColor: c.text },
        grid:      { vertLines: { visible: false }, horzLines: { color: c.border } },
        crosshair: { mode: lc.CrosshairMode.Normal },
        rightPriceScale: { borderColor: c.border, scaleMargins: { top: 0.1, bottom: 0.1 } },
        timeScale: { borderColor: c.border, timeVisible: true, secondsVisible: false, visible: false },
        handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: { price: true, time: true } },
      }

      const syncWith = (subChart: any) => {
        const main = mainChartRef.current
        if (!main) return
        // main → sub
        const h1 = (r: any) => { if (r) try { subChart.timeScale().setVisibleLogicalRange(r) } catch {} }
        main.timeScale().subscribeVisibleLogicalRangeChange(h1)
        // sub → main
        const h2 = (r: any) => { if (r) try { main.timeScale().setVisibleLogicalRange(r) } catch {} }
        subChart.timeScale().subscribeVisibleLogicalRangeChange(h2)
        unsubs.current.push(
          () => { try { main.timeScale().unsubscribeVisibleLogicalRangeChange(h1) } catch {} },
          () => { try { subChart.timeScale().unsubscribeVisibleLogicalRangeChange(h2) } catch {} },
        )
        // sync initial range
        setTimeout(() => {
          const r = main.timeScale().getVisibleLogicalRange()
          if (r) try { subChart.timeScale().setVisibleLogicalRange(r) } catch {}
        }, 50)
      }

      if (config.rsi.enabled && rsiRef.current) {
        const ch = lc.createChart(rsiRef.current, { ...base, height: PANE_H })
        charts.current.rsi = ch
        const vals  = rsi(candles, config.rsi.period)
        const line  = ch.addLineSeries({ color: '#a78bfa', lineWidth: 1, priceLineVisible: false, lastValueVisible: true })
        const ob    = ch.addLineSeries({ color: 'rgba(239,68,68,0.35)', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false })
        const os    = ch.addLineSeries({ color: 'rgba(34,197,94,0.35)',  lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false })
        line.setData(toLineSeries(candles, vals) as any)
        ob.setData(candles.map(c => ({ time: c.time as any, value: 70 as number } as any)))
        os.setData(candles.map(c => ({ time: c.time as any, value: 30 as number } as any)))
        syncWith(ch)
      }

      if (config.macd.enabled && macdRef.current) {
        const ch   = lc.createChart(macdRef.current, { ...base, height: PANE_H })
        charts.current.macd = ch
        const m    = macd(candles, config.macd.fast, config.macd.slow, config.macd.signal)
        const ml   = ch.addLineSeries({ color: '#3b82f6', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
        const sl   = ch.addLineSeries({ color: '#f59e0b', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
        const hist = ch.addHistogramSeries({ priceScaleId: 'right', lastValueVisible: false })
        ml.setData(candles.map((c,i) => ({ time: c.time as any, value: m[i].macd ?? 0 })).filter((_,i) => m[i].macd != null))
        sl.setData(candles.map((c,i) => ({ time: c.time as any, value: m[i].signal ?? 0 })).filter((_,i) => m[i].signal != null))
        hist.setData(candles.map((c,i) => ({ time: c.time as any, value: m[i].hist ?? 0, color: (m[i].hist??0)>=0?'#22c55e':'#ef4444' })).filter((_,i) => m[i].hist != null))
        syncWith(ch)
      }
    })
    return destroy
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, config, theme])

  const show = config.rsi.enabled || config.macd.enabled
  if (!show) return null

  return (
    <div style={{ display:'flex', flexDirection:'column', flexShrink:0 }}>
      {config.rsi.enabled    && <Pane label={`RSI (${config.rsi.period})`} ref={rsiRef} />}
      {config.macd.enabled   && <Pane label={`MACD (${config.macd.fast},${config.macd.slow},${config.macd.signal})`} ref={macdRef} />}
    </div>
  )
}

const Pane = forwardRef<HTMLDivElement, { label: string }>(({ label }, ref) => (
  <div style={{ position:'relative', height:PANE_H, borderTop:'1px solid var(--border-subtle)', flexShrink:0 }}>
    <span style={{ position:'absolute', top:4, left:8, zIndex:2, fontSize:10, color:'var(--text-muted)', pointerEvents:'none' }}>{label}</span>
    <div ref={ref} style={{ width:'100%', height:'100%' }} />
  </div>
))
Pane.displayName = 'Pane'
