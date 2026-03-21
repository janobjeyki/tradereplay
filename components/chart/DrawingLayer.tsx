'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { DrawingTool, Drawing, DrawPoint } from '@/lib/drawing-types'
import { FIB_LEVELS, FIB_COLORS, uid } from '@/lib/drawing-types'

interface Props {
  // These come directly from the lightweight-charts series/chart objects
  seriesRef:   React.MutableRefObject<any>
  chartRef:    React.MutableRefObject<any>
  containerRef: React.MutableRefObject<HTMLDivElement | null>
  activeTool:  DrawingTool
  drawings:    Drawing[]
  onAdd:       (d: Drawing) => void
  onDelete:    (id: string) => void
}

const TOOL_COLOR: Partial<Record<NonNullable<DrawingTool>, string>> = {
  hline:     '#3b82f6',
  vline:     '#3b82f6',
  trendline: '#f59e0b',
  rectangle: '#a78bfa',
  fibonacci: '#60a5fa',
  longpos:   '#22c55e',
  shortpos:  '#ef4444',
  brush:     '#f59e0b',
  path:      '#f59e0b',
}

// Convert a stored DrawPoint to pixel coords using the chart APIs
function toPixel(
  pt: DrawPoint,
  series: any,
  chart: any,
): { x: number; y: number } | null {
  const y = series?.priceToCoordinate(pt.price)
  const x = chart?.timeScale().timeToCoordinate(pt.time as any)
  if (y == null || x == null) return null
  return { x, y }
}

export function DrawingLayer({ seriesRef, chartRef, containerRef, activeTool, drawings, onAdd, onDelete }: Props) {
  const [pendingPts, setPendingPts] = useState<DrawPoint[]>([])
  const [cursorPt,   setCursorPt]   = useState<DrawPoint | null>(null)
  const [, forceRedraw] = useState(0)
  const brushPts    = useRef<DrawPoint[]>([])
  const isBrushingRef = useRef(false)
  const svgRef      = useRef<SVGSVGElement>(null)

  // Reset pending when tool changes
  useEffect(() => {
    setPendingPts([])
    setCursorPt(null)
    brushPts.current = []
    isBrushingRef.current = false
  }, [activeTool])

  // Subscribe to crosshair to get accurate price+time at cursor
  // This is the RELIABLE way to get chart coordinates from mouse position
  useEffect(() => {
    if (!chartRef.current || !activeTool) return
    const handler = (param: any) => {
      if (!param.time || !param.seriesData) return
      // Get price from series data or from coordinate
      const point = param.point
      const time  = param.time
      const price = seriesRef.current?.coordinateToPrice(point?.y)
      if (price == null || time == null) return
      // time is unix timestamp (number) for our data
      const t = typeof time === 'number' ? time : 0
      setCursorPt({ price, time: t })
    }
    chartRef.current.subscribeCrosshairMove(handler)
    return () => { try { chartRef.current?.unsubscribeCrosshairMove(handler) } catch {} }
  }, [activeTool, chartRef, seriesRef])

  // Redraw whenever chart scrolls/zooms so drawings stay pinned
  useEffect(() => {
    if (!chartRef.current) return
    const handler = () => forceRedraw(n => n + 1)
    chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(handler)
    chartRef.current.subscribeCrosshairMove(handler)
    return () => {
      try { chartRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange(handler) } catch {}
      try { chartRef.current?.unsubscribeCrosshairMove(handler) } catch {}
    }
  }, [chartRef])

  // Get a DrawPoint from a native mouse event using chart internals
  const getPointFromEvent = useCallback((e: MouseEvent): DrawPoint | null => {
    if (!containerRef.current || !seriesRef.current || !chartRef.current) return null
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const price = seriesRef.current.coordinateToPrice(y)
    // Get time: use coordinateToTime if available, else get logical index + time
    let time: number | null = null
    try {
      const t = chartRef.current.timeScale().coordinateToTime(x)
      if (t != null) time = typeof t === 'number' ? t : null
    } catch {}
    if (time == null) {
      // fallback: use logical coordinate
      try {
        const logical = chartRef.current.timeScale().coordinateToLogical(x)
        if (logical != null) {
          const visRange = chartRef.current.timeScale().getVisibleRange()
          if (visRange) time = Math.round(visRange.from + logical)
        }
      } catch {}
    }
    if (price == null || time == null) return null
    return { price, time }
  }, [containerRef, seriesRef, chartRef])

  // Attach click/mousedown/mousemove/mouseup to containerRef (chart canvas)
  useEffect(() => {
    if (!containerRef.current || !activeTool) return
    const el = containerRef.current

    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return
      const pt = getPointFromEvent(e)
      if (!pt) return

      if (activeTool === 'hline') {
        onAdd({ id: uid(), type: 'hline', price: pt.price, color: TOOL_COLOR.hline! }); return
      }
      if (activeTool === 'vline') {
        onAdd({ id: uid(), type: 'vline', time: pt.time, color: TOOL_COLOR.vline! }); return
      }
      if (['trendline','rectangle','fibonacci','longpos','shortpos'].includes(activeTool)) {
        setPendingPts(prev => {
          if (prev.length === 0) return [pt]
          const type = activeTool as 'trendline'|'rectangle'|'fibonacci'|'longpos'|'shortpos'
          onAdd({ id: uid(), type, p1: prev[0], p2: pt, color: TOOL_COLOR[activeTool]! })
          return []
        })
      }
    }

    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return
      if (activeTool !== 'brush' && activeTool !== 'path') return
      isBrushingRef.current = true
      brushPts.current = []
      const pt = getPointFromEvent(e)
      if (pt) brushPts.current.push(pt)
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isBrushingRef.current) return
      const pt = getPointFromEvent(e)
      if (pt) { brushPts.current.push(pt); forceRedraw(n => n + 1) }
    }

    const onMouseUp = (e: MouseEvent) => {
      if (!isBrushingRef.current) return
      isBrushingRef.current = false
      if (brushPts.current.length > 1) {
        onAdd({ id: uid(), type: 'brush', points: [...brushPts.current], color: TOOL_COLOR.brush! })
      }
      brushPts.current = []
    }

    el.addEventListener('click',     onClick,     { capture: false })
    el.addEventListener('mousedown', onMouseDown, { capture: false })
    el.addEventListener('mousemove', onMouseMove, { capture: false })
    el.addEventListener('mouseup',   onMouseUp,   { capture: false })
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      el.removeEventListener('click',     onClick)
      el.removeEventListener('mousedown', onMouseDown)
      el.removeEventListener('mousemove', onMouseMove)
      el.removeEventListener('mouseup',   onMouseUp)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [activeTool, containerRef, getPointFromEvent, onAdd])

  if (!chartRef.current || !seriesRef.current) return null

  const W = containerRef.current?.clientWidth  ?? 800
  const H = containerRef.current?.clientHeight ?? 500

  // ── Render a stored drawing ──────────────────────────────────────
  const renderDrawing = (d: Drawing) => {
    const s = seriesRef.current, ch = chartRef.current
    switch (d.type) {

      case 'hline': {
        const y = s.priceToCoordinate(d.price)
        if (y == null) return null
        return (
          <g key={d.id}>
            <line x1={0} y1={y} x2={W} y2={y} stroke={d.color} strokeWidth={1.5} strokeDasharray="6,3" />
            <rect x={4} y={y - 8} width={50} height={14} rx={2} fill={d.color} fillOpacity={0.15} />
            <text x={6} y={y + 4} fill={d.color} fontSize={9} fontWeight={600}>{d.price.toFixed(2)}</text>
            <text x={W - 18} y={y + 5} fill={d.color} fontSize={14} style={{cursor:'pointer'}} onClick={() => onDelete(d.id)}>×</text>
          </g>
        )
      }

      case 'vline': {
        const x = ch.timeScale().timeToCoordinate(d.time as any)
        if (x == null) return null
        return (
          <g key={d.id}>
            <line x1={x} y1={0} x2={x} y2={H} stroke={d.color} strokeWidth={1.5} strokeDasharray="6,3" />
            <text x={x + 4} y={16} fill={d.color} fontSize={13} style={{cursor:'pointer'}} onClick={() => onDelete(d.id)}>×</text>
          </g>
        )
      }

      case 'trendline': {
        const a = toPixel(d.p1, s, ch), b = toPixel(d.p2, s, ch)
        if (!a || !b) return null
        return (
          <g key={d.id}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={d.color} strokeWidth={2} />
            <circle cx={a.x} cy={a.y} r={4} fill={d.color} />
            <circle cx={b.x} cy={b.y} r={4} fill={d.color} />
            <text x={(a.x+b.x)/2} y={(a.y+b.y)/2 - 6} fill={d.color} fontSize={13} style={{cursor:'pointer'}} onClick={() => onDelete(d.id)}>×</text>
          </g>
        )
      }

      case 'rectangle': {
        const a = toPixel(d.p1, s, ch), b = toPixel(d.p2, s, ch)
        if (!a || !b) return null
        const rx = Math.min(a.x,b.x), ry = Math.min(a.y,b.y)
        const rw = Math.abs(b.x-a.x), rh = Math.abs(b.y-a.y)
        return (
          <g key={d.id}>
            <rect x={rx} y={ry} width={rw} height={rh} stroke={d.color} strokeWidth={1.5}
              fill={d.color} fillOpacity={0.07} />
            <text x={rx+rw-16} y={ry+14} fill={d.color} fontSize={14} style={{cursor:'pointer'}} onClick={() => onDelete(d.id)}>×</text>
          </g>
        )
      }

      case 'fibonacci': {
        const a = toPixel(d.p1, s, ch), b = toPixel(d.p2, s, ch)
        if (!a || !b) return null
        const highY = Math.min(a.y,b.y), lowY = Math.max(a.y,b.y)
        const highP = s.coordinateToPrice(highY) ?? 0
        const lowP  = s.coordinateToPrice(lowY)  ?? 0
        const xL    = Math.min(a.x,b.x), xR = Math.max(a.x,b.x)
        return (
          <g key={d.id}>
            {FIB_LEVELS.map((lvl, i) => {
              const p = highP - (highP - lowP) * lvl
              const y = s.priceToCoordinate(p)
              if (y == null) return null
              return (
                <g key={lvl}>
                  <line x1={xL} y1={y} x2={xR} y2={y} stroke={FIB_COLORS[i]} strokeWidth={1} strokeDasharray="5,3" />
                  <text x={xR+3} y={y+4} fill={FIB_COLORS[i]} fontSize={9}>{(lvl*100).toFixed(1)}%  {p.toFixed(2)}</text>
                </g>
              )
            })}
            <text x={xL} y={highY-6} fill={d.color} fontSize={13} style={{cursor:'pointer'}} onClick={() => onDelete(d.id)}>×</text>
          </g>
        )
      }

      case 'longpos':
      case 'shortpos': {
        const isLong    = d.type === 'longpos'
        const entry     = toPixel(d.p1, s, ch)
        const tpPx      = toPixel(d.p2, s, ch)
        if (!entry || !tpPx) return null
        const slPrice   = d.p1.price - (d.p2.price - d.p1.price)
        const slY       = s.priceToCoordinate(slPrice)
        const xR        = Math.min(W - 60, Math.max(entry.x, tpPx.x) + 120)
        const pColor    = isLong ? '#22c55e' : '#ef4444'
        const lColor    = isLong ? '#ef4444' : '#22c55e'
        return (
          <g key={d.id}>
            {slY != null && (
              <rect x={entry.x} y={Math.min(entry.y,slY)} width={xR-entry.x}
                height={Math.abs(entry.y-slY)} fill={lColor} fillOpacity={0.10} />
            )}
            <rect x={entry.x} y={Math.min(entry.y,tpPx.y)} width={xR-entry.x}
              height={Math.abs(entry.y-tpPx.y)} fill={pColor} fillOpacity={0.10} />
            <line x1={entry.x} y1={entry.y} x2={xR} y2={entry.y} stroke="#3b82f6" strokeWidth={2} />
            <line x1={entry.x} y1={tpPx.y} x2={xR} y2={tpPx.y} stroke={pColor} strokeWidth={1.5} strokeDasharray="5,3" />
            {slY != null && <line x1={entry.x} y1={slY} x2={xR} y2={slY} stroke={lColor} strokeWidth={1.5} strokeDasharray="5,3" />}
            <text x={entry.x+4} y={entry.y-4} fill="#3b82f6" fontSize={10}>Entry {d.p1.price.toFixed(2)}</text>
            <text x={entry.x+4} y={tpPx.y-4} fill={pColor} fontSize={10}>TP {d.p2.price.toFixed(2)}</text>
            {slY != null && <text x={entry.x+4} y={slY+12} fill={lColor} fontSize={10}>SL {slPrice.toFixed(2)}</text>}
            <text x={xR-4} y={entry.y-4} fill="#3b82f6" fontSize={13} style={{cursor:'pointer'}} onClick={() => onDelete(d.id)}>×</text>
          </g>
        )
      }

      case 'brush': {
        if (d.points.length < 2) return null
        const pts = d.points.map(p => {
          const px = toPixel(p, s, ch)
          return px ? `${px.x},${px.y}` : null
        }).filter(Boolean).join(' ')
        return (
          <g key={d.id}>
            <polyline points={pts} stroke={d.color} strokeWidth={2} fill="none"
              strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )
      }
    }
    return null
  }

  // ── Preview ──────────────────────────────────────────────────────
  const renderPreview = () => {
    if (!cursorPt && !isBrushingRef.current) return null
    const s = seriesRef.current, ch = chartRef.current

    if (activeTool === 'hline' && cursorPt) {
      const y = s.priceToCoordinate(cursorPt.price)
      if (y == null) return null
      return <line x1={0} y1={y} x2={W} y2={y} stroke={TOOL_COLOR.hline!} strokeWidth={1} strokeDasharray="5,3" opacity={0.5} />
    }
    if (activeTool === 'vline' && cursorPt) {
      const x = ch.timeScale().timeToCoordinate(cursorPt.time as any)
      if (x == null) return null
      return <line x1={x} y1={0} x2={x} y2={H} stroke={TOOL_COLOR.vline!} strokeWidth={1} strokeDasharray="5,3" opacity={0.5} />
    }
    if (pendingPts.length === 1 && cursorPt) {
      const a = toPixel(pendingPts[0], s, ch)
      const b = { x: ch.timeScale().timeToCoordinate(cursorPt.time as any) ?? 0, y: s.priceToCoordinate(cursorPt.price) ?? 0 }
      if (!a) return null
      if (activeTool === 'trendline') {
        return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={TOOL_COLOR.trendline!} strokeWidth={1.5} opacity={0.6} />
      }
      if (activeTool === 'rectangle') {
        return <rect x={Math.min(a.x,b.x)} y={Math.min(a.y,b.y)} width={Math.abs(b.x-a.x)} height={Math.abs(b.y-a.y)}
          stroke={TOOL_COLOR.rectangle!} strokeWidth={1.5} fill={TOOL_COLOR.rectangle!} fillOpacity={0.05} opacity={0.7} />
      }
      if (activeTool === 'fibonacci') {
        return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={TOOL_COLOR.fibonacci!} strokeWidth={1} strokeDasharray="4,2" opacity={0.6} />
      }
      if (activeTool === 'longpos' || activeTool === 'shortpos') {
        const isLong = activeTool === 'longpos'
        return (
          <>
            <line x1={a.x} y1={a.y} x2={b.x} y2={a.y} stroke="#3b82f6" strokeWidth={1.5} opacity={0.8} />
            <line x1={a.x} y1={b.y} x2={b.x} y2={b.y} stroke={isLong?'#22c55e':'#ef4444'} strokeWidth={1} strokeDasharray="4,2" opacity={0.7} />
            <rect x={Math.min(a.x,b.x)} y={Math.min(a.y,b.y)} width={Math.abs(b.x-a.x)} height={Math.abs(b.y-a.y)}
              fill={isLong?'#22c55e':'#ef4444'} fillOpacity={0.07} />
          </>
        )
      }
    }
    if ((activeTool === 'brush' || activeTool === 'path') && isBrushingRef.current && brushPts.current.length > 1) {
      const pts = brushPts.current.map(p => {
        const px = toPixel(p, s, ch)
        return px ? `${px.x},${px.y}` : null
      }).filter(Boolean).join(' ')
      return <polyline points={pts} stroke={TOOL_COLOR.brush!} strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.7} />
    }
    return null
  }

  return (
    <svg
      ref={svgRef}
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',  // chart canvas handles events, we just render
        zIndex: 5,
        overflow: 'visible',
      }}
    >
      {drawings.map(d => renderDrawing(d))}
      {renderPreview()}
    </svg>
  )
}
