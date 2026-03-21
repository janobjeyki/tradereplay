'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { DrawingTool, Drawing, DrawPoint } from '@/lib/drawing-types'
import { FIB_LEVELS, FIB_COLORS, uid } from '@/lib/drawing-types'
import type { Candle } from '@/types'

interface Props {
  seriesRef:    React.MutableRefObject<any>
  chartRef:     React.MutableRefObject<any>
  containerRef: React.MutableRefObject<HTMLDivElement | null>
  candles:      Candle[]   // needed to map logical index → real timestamp
  activeTool:   DrawingTool
  drawings:     Drawing[]
  onAdd:        (d: Drawing) => void
  onDelete:     (id: string) => void
}

const TOOL_COLOR: Record<NonNullable<DrawingTool>, string> = {
  hline:     '#3b82f6',
  vline:     '#94a3b8',
  trendline: '#f59e0b',
  rectangle: '#a78bfa',
  fibonacci: '#60a5fa',
  longpos:   '#22c55e',
  shortpos:  '#ef4444',
  brush:     '#e879f9',
  path:      '#e879f9',
}

// ── Coordinate helpers ────────────────────────────────────────────

/** price → SVG y */
function pToY(price: number, series: any): number | null {
  const y = series?.priceToCoordinate(price)
  return y == null ? null : y
}

/** unix timestamp → SVG x  (uses our candles array as lookup) */
function tToX(time: number, chart: any, candles: Candle[]): number | null {
  if (!chart || !candles.length) return null
  // Find the index of the candle with this timestamp
  const idx = candles.findIndex(c => c.time === time)
  if (idx < 0) return null
  try {
    return chart.timeScale().logicalToCoordinate(idx) ?? null
  } catch { return null }
}

/** SVG y → price */
function yToP(y: number, series: any): number | null {
  return series?.coordinateToPrice(y) ?? null
}

/** SVG x → DrawPoint (price+time) — the KEY fix */
function xYToPoint(
  x: number, y: number,
  series: any, chart: any, candles: Candle[],
): DrawPoint | null {
  const price = yToP(y, series)
  if (price == null) return null
  try {
    // coordinateToLogical gives fractional index into the candle array
    const logical = chart?.timeScale().coordinateToLogical(x)
    if (logical == null) return null
    const idx   = Math.max(0, Math.min(Math.round(logical), candles.length - 1))
    const time  = candles[idx]?.time
    if (!time) return null
    return { price, time }
  } catch { return null }
}

/** stored DrawPoint → SVG pixel */
function ptToPx(pt: DrawPoint, series: any, chart: any, candles: Candle[]): { x: number; y: number } | null {
  const y = pToY(pt.price, series)
  const x = tToX(pt.time, chart, candles)
  if (y == null || x == null) return null
  return { x, y }
}

// ── Component ─────────────────────────────────────────────────────

export function DrawingLayer({
  seriesRef, chartRef, containerRef, candles,
  activeTool, drawings, onAdd, onDelete,
}: Props) {
  const [pendingPts, setPendingPts] = useState<DrawPoint[]>([])
  const [cursorPx,   setCursorPx]   = useState<{ x: number; y: number } | null>(null)
  const [tick,       setTick]        = useState(0)
  const redraw = useCallback(() => setTick(n => n + 1), [])

  const brushPts      = useRef<DrawPoint[]>([])
  const isBrushing    = useRef(false)
  const lastBrushTime = useRef(0)

  // Reset on tool change
  useEffect(() => {
    setPendingPts([])
    setCursorPx(null)
    brushPts.current = []
    isBrushing.current = false
  }, [activeTool])

  // Redraw on chart scroll/zoom
  useEffect(() => {
    const ch = chartRef.current
    if (!ch) return
    ch.timeScale().subscribeVisibleLogicalRangeChange(redraw)
    ch.subscribeCrosshairMove(redraw)
    return () => {
      try { ch.timeScale().unsubscribeVisibleLogicalRangeChange(redraw) } catch {}
      try { ch.unsubscribeCrosshairMove(redraw) } catch {}
    }
  }, [chartRef, redraw])

  // Mouse event handlers on chart canvas
  useEffect(() => {
    const el = containerRef.current
    if (!el || !activeTool) return

    const getPoint = (e: MouseEvent): DrawPoint | null => {
      const rect = el.getBoundingClientRect()
      return xYToPoint(e.clientX - rect.left, e.clientY - rect.top, seriesRef.current, chartRef.current, candles)
    }

    const getPx = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    const onMove = (e: MouseEvent) => {
      setCursorPx(getPx(e))
      if (!isBrushing.current) return
      // Throttle brush points to max 1 per 16ms (~60fps)
      const now = Date.now()
      if (now - lastBrushTime.current < 16) return
      lastBrushTime.current = now
      const pt = getPoint(e)
      if (pt) { brushPts.current.push(pt); redraw() }
    }

    const onDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return
      if (activeTool !== 'brush' && activeTool !== 'path') return
      isBrushing.current = true
      brushPts.current = []
      const pt = getPoint(e)
      if (pt) brushPts.current.push(pt)
    }

    const onUp = () => {
      if (!isBrushing.current) return
      isBrushing.current = false
      if (brushPts.current.length > 1) {
        onAdd({ id: uid(), type: 'brush', points: [...brushPts.current], color: TOOL_COLOR.brush })
      }
      brushPts.current = []
    }

    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return
      if (activeTool === 'brush' || activeTool === 'path') return
      const pt = getPoint(e)
      if (!pt) return

      if (activeTool === 'hline') {
        onAdd({ id: uid(), type: 'hline', price: pt.price, color: TOOL_COLOR.hline }); return
      }
      if (activeTool === 'vline') {
        onAdd({ id: uid(), type: 'vline', time: pt.time, color: TOOL_COLOR.vline }); return
      }
      // Two-click tools
      const twoClick = ['trendline','rectangle','fibonacci','longpos','shortpos'] as const
      if ((twoClick as readonly string[]).includes(activeTool)) {
        setPendingPts(prev => {
          if (prev.length === 0) return [pt]
          const type = activeTool as typeof twoClick[number]
          onAdd({ id: uid(), type, p1: prev[0], p2: pt, color: TOOL_COLOR[activeTool] })
          return []
        })
      }
    }

    const onLeave = () => {
      setCursorPx(null)
      if (isBrushing.current) onUp()
    }

    el.addEventListener('mousemove',  onMove)
    el.addEventListener('mousedown',  onDown, { capture: false })
    el.addEventListener('click',      onClick, { capture: false })
    el.addEventListener('mouseleave', onLeave)
    document.addEventListener('mouseup', onUp)
    return () => {
      el.removeEventListener('mousemove',  onMove)
      el.removeEventListener('mousedown',  onDown)
      el.removeEventListener('click',      onClick)
      el.removeEventListener('mouseleave', onLeave)
      document.removeEventListener('mouseup', onUp)
    }
  }, [activeTool, candles, containerRef, seriesRef, chartRef, onAdd, redraw])

  const s  = seriesRef.current
  const ch = chartRef.current
  if (!s || !ch) return null

  const W = containerRef.current?.clientWidth  ?? 900
  const H = containerRef.current?.clientHeight ?? 500

  // ── Render stored drawings ────────────────────────────────────────
  const renderDrawing = (d: Drawing) => {
    switch (d.type) {

      case 'hline': {
        const y = pToY(d.price, s)
        if (y == null || y < 0 || y > H) return null
        return (
          <g key={d.id}>
            <line x1={0} y1={y} x2={W - 60} y2={y} stroke={d.color} strokeWidth={1.5} strokeDasharray="6,3" />
            <rect x={2} y={y - 9} width={58} height={16} rx={3} fill={d.color} fillOpacity={0.18} />
            <text x={5} y={y + 4} fill={d.color} fontSize={9} fontWeight={700}>{d.price.toFixed(2)}</text>
            <DeleteBtn x={W - 58} y={y} onClick={() => onDelete(d.id)} />
          </g>
        )
      }

      case 'vline': {
        const x = tToX(d.time, ch, candles)
        if (x == null || x < 0 || x > W) return null
        return (
          <g key={d.id}>
            <line x1={x} y1={0} x2={x} y2={H} stroke={d.color} strokeWidth={1.5} strokeDasharray="6,3" />
            <DeleteBtn x={x + 4} y={20} onClick={() => onDelete(d.id)} />
          </g>
        )
      }

      case 'trendline': {
        const a = ptToPx(d.p1, s, ch, candles)
        const b = ptToPx(d.p2, s, ch, candles)
        if (!a || !b) return null
        return (
          <g key={d.id}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={d.color} strokeWidth={2} />
            <circle cx={a.x} cy={a.y} r={3} fill={d.color} />
            <circle cx={b.x} cy={b.y} r={3} fill={d.color} />
            <DeleteBtn x={(a.x+b.x)/2} y={(a.y+b.y)/2 - 10} onClick={() => onDelete(d.id)} />
          </g>
        )
      }

      case 'rectangle': {
        const a = ptToPx(d.p1, s, ch, candles)
        const b = ptToPx(d.p2, s, ch, candles)
        if (!a || !b) return null
        const rx = Math.min(a.x,b.x), ry = Math.min(a.y,b.y)
        const rw = Math.abs(b.x-a.x),  rh = Math.abs(b.y-a.y)
        return (
          <g key={d.id}>
            <rect x={rx} y={ry} width={rw} height={rh}
              stroke={d.color} strokeWidth={1.5} fill={d.color} fillOpacity={0.07} />
            <DeleteBtn x={rx + rw - 10} y={ry + 10} onClick={() => onDelete(d.id)} />
          </g>
        )
      }

      case 'fibonacci': {
        const a = ptToPx(d.p1, s, ch, candles)
        const b = ptToPx(d.p2, s, ch, candles)
        if (!a || !b) return null
        const topY    = Math.min(a.y, b.y)
        const botY    = Math.max(a.y, b.y)
        const topP    = yToP(topY, s) ?? 0
        const botP    = yToP(botY, s) ?? 0
        const xL      = Math.min(a.x, b.x)
        const xR      = Math.max(a.x, b.x)
        return (
          <g key={d.id}>
            {FIB_LEVELS.map((lvl, i) => {
              const p = topP - (topP - botP) * lvl
              const y = pToY(p, s)
              if (y == null) return null
              return (
                <g key={lvl}>
                  <line x1={xL} y1={y} x2={xR} y2={y}
                    stroke={FIB_COLORS[i]} strokeWidth={1} strokeDasharray="5,3" />
                  <text x={xR + 4} y={y + 4} fill={FIB_COLORS[i]} fontSize={9}>
                    {(lvl * 100).toFixed(1)}%  {p.toFixed(2)}
                  </text>
                </g>
              )
            })}
            <DeleteBtn x={xL} y={topY - 8} onClick={() => onDelete(d.id)} />
          </g>
        )
      }

      case 'longpos':
      case 'shortpos': {
        const isLong  = d.type === 'longpos'
        const eP      = ptToPx(d.p1, s, ch, candles)
        const tpP     = ptToPx(d.p2, s, ch, candles)
        if (!eP || !tpP) return null
        const slPrice = d.p1.price - (d.p2.price - d.p1.price)
        const slY     = pToY(slPrice, s)
        const xR      = Math.min(W - 80, eP.x + 200)
        const pClr    = isLong ? '#22c55e' : '#ef4444'
        const lClr    = isLong ? '#ef4444' : '#22c55e'
        return (
          <g key={d.id}>
            {slY != null && (
              <rect x={eP.x} y={Math.min(eP.y, slY)} width={xR - eP.x}
                height={Math.abs(eP.y - slY)} fill={lClr} fillOpacity={0.09} />
            )}
            <rect x={eP.x} y={Math.min(eP.y, tpP.y)} width={xR - eP.x}
              height={Math.abs(eP.y - tpP.y)} fill={pClr} fillOpacity={0.09} />
            <line x1={eP.x} y1={eP.y}   x2={xR} y2={eP.y}   stroke="#3b82f6" strokeWidth={2} />
            <line x1={eP.x} y1={tpP.y}  x2={xR} y2={tpP.y}  stroke={pClr} strokeWidth={1.5} strokeDasharray="5,3" />
            {slY != null && <line x1={eP.x} y1={slY} x2={xR} y2={slY} stroke={lClr} strokeWidth={1.5} strokeDasharray="5,3" />}
            <text x={eP.x + 4} y={eP.y - 4}   fill="#3b82f6" fontSize={10}>Entry {d.p1.price.toFixed(2)}</text>
            <text x={eP.x + 4} y={tpP.y - 4}  fill={pClr}    fontSize={10}>TP {d.p2.price.toFixed(2)}</text>
            {slY != null && <text x={eP.x + 4} y={slY + 12} fill={lClr} fontSize={10}>SL {slPrice.toFixed(2)}</text>}
            <DeleteBtn x={xR - 10} y={eP.y - 10} onClick={() => onDelete(d.id)} />
          </g>
        )
      }

      case 'brush': {
        if (d.points.length < 2) return null
        // Simplify: only render every Nth point for performance
        const step = Math.max(1, Math.floor(d.points.length / 200))
        const pts  = d.points
          .filter((_, i) => i % step === 0 || i === d.points.length - 1)
          .map(p => {
            const px = ptToPx(p, s, ch, candles)
            return px ? `${px.x.toFixed(1)},${px.y.toFixed(1)}` : null
          }).filter(Boolean).join(' ')
        if (!pts) return null
        return (
          <polyline key={d.id} points={pts} stroke={d.color} strokeWidth={2}
            fill="none" strokeLinecap="round" strokeLinejoin="round" />
        )
      }
    }
    return null
  }

  // ── Preview while placing ─────────────────────────────────────────
  const renderPreview = () => {
    if (!cursorPx || !activeTool) return null
    const { x: mx, y: my } = cursorPx

    if (activeTool === 'hline') {
      return <line x1={0} y1={my} x2={W} y2={my} stroke={TOOL_COLOR.hline} strokeWidth={1} strokeDasharray="5,3" opacity={0.55} />
    }
    if (activeTool === 'vline') {
      return <line x1={mx} y1={0} x2={mx} y2={H} stroke={TOOL_COLOR.vline} strokeWidth={1} strokeDasharray="5,3" opacity={0.55} />
    }

    if (pendingPts.length === 1) {
      const a = ptToPx(pendingPts[0], s, ch, candles)
      if (!a) return null
      if (activeTool === 'trendline') {
        return <line x1={a.x} y1={a.y} x2={mx} y2={my} stroke={TOOL_COLOR.trendline} strokeWidth={1.5} opacity={0.65} />
      }
      if (activeTool === 'rectangle') {
        const rx = Math.min(a.x,mx), ry = Math.min(a.y,my)
        return <rect x={rx} y={ry} width={Math.abs(mx-a.x)} height={Math.abs(my-a.y)}
          stroke={TOOL_COLOR.rectangle} strokeWidth={1.5} fill={TOOL_COLOR.rectangle} fillOpacity={0.05} opacity={0.7} />
      }
      if (activeTool === 'fibonacci') {
        return <line x1={a.x} y1={a.y} x2={mx} y2={my} stroke={TOOL_COLOR.fibonacci} strokeWidth={1} strokeDasharray="4,2" opacity={0.65} />
      }
      if (activeTool === 'longpos' || activeTool === 'shortpos') {
        const isLong = activeTool === 'longpos'
        const pClr   = isLong ? '#22c55e' : '#ef4444'
        return (
          <>
            <line x1={a.x} y1={a.y} x2={mx} y2={a.y} stroke="#3b82f6" strokeWidth={1.5} opacity={0.8} />
            <line x1={a.x} y1={my}  x2={mx} y2={my}  stroke={pClr} strokeWidth={1} strokeDasharray="4,2" opacity={0.7} />
            <rect x={Math.min(a.x,mx)} y={Math.min(a.y,my)} width={Math.abs(mx-a.x)} height={Math.abs(my-a.y)}
              fill={pClr} fillOpacity={0.07} />
          </>
        )
      }
    }

    // Live brush stroke preview
    if ((activeTool === 'brush' || activeTool === 'path') && isBrushing.current && brushPts.current.length > 1) {
      const pts = brushPts.current.map(p => {
        const px = ptToPx(p, s, ch, candles)
        return px ? `${px.x.toFixed(1)},${px.y.toFixed(1)}` : null
      }).filter(Boolean).join(' ')
      if (pts) return (
        <polyline points={pts} stroke={TOOL_COLOR.brush} strokeWidth={2}
          fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.75} />
      )
    }

    return null
  }

  return (
    <svg
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
        zIndex: 5,
        overflow: 'visible',
      }}
    >
      {drawings.map(d => renderDrawing(d))}
      {renderPreview()}
    </svg>
  )
}

// ── Delete button ─────────────────────────────────────────────────
function DeleteBtn({ x, y, onClick }: { x: number; y: number; onClick: () => void }) {
  return (
    <g style={{ cursor: 'pointer', pointerEvents: 'all' }} onClick={onClick}>
      <circle cx={x} cy={y} r={8} fill="#ef4444" />
      <line x1={x - 4} y1={y - 4} x2={x + 4} y2={y + 4} stroke="white" strokeWidth={1.8} strokeLinecap="round" />
      <line x1={x + 4} y1={y - 4} x2={x - 4} y2={y + 4} stroke="white" strokeWidth={1.8} strokeLinecap="round" />
    </g>
  )
}
