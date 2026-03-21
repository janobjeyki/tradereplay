'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { DrawingTool, Drawing, DrawPoint } from '@/lib/drawing-types'
import { FIB_LEVELS, FIB_COLORS, uid } from '@/lib/drawing-types'
import type { Candle } from '@/types'

interface Props {
  seriesRef:    React.MutableRefObject<any>
  chartRef:     React.MutableRefObject<any>
  containerRef: React.MutableRefObject<HTMLDivElement | null>
  candles:      Candle[]
  activeTool:   DrawingTool
  drawings:     Drawing[]
  onAdd:        (d: Drawing) => void
  onDelete:     (id: string) => void
  onUpdate:     (d: Drawing) => void
}

const TOOL_COLOR: Record<NonNullable<DrawingTool>, string> = {
  hline: '#3b82f6', vline: '#94a3b8', trendline: '#f59e0b',
  rectangle: '#a78bfa', fibonacci: '#60a5fa',
  longpos: '#22c55e', shortpos: '#ef4444',
  brush: '#e879f9', path: '#e879f9',
}

// ── Coordinate helpers ────────────────────────────────────────────
function pToY(price: number, s: any)                           { return s?.priceToCoordinate(price) ?? null }
function yToP(y: number, s: any)                               { return s?.coordinateToPrice(y) ?? null }
function tToX(time: number, ch: any, candles: Candle[])        {
  const idx = candles.findIndex(c => c.time === time)
  if (idx < 0) return null
  return ch?.timeScale().logicalToCoordinate(idx) ?? null
}
function xYToPoint(x: number, y: number, s: any, ch: any, candles: Candle[]): DrawPoint | null {
  const price = yToP(y, s)
  if (price == null) return null
  const logical = ch?.timeScale().coordinateToLogical(x)
  if (logical == null) return null
  const idx  = Math.max(0, Math.min(Math.round(logical), candles.length - 1))
  const time = candles[idx]?.time
  if (!time) return null
  return { price, time }
}
function ptToPx(pt: DrawPoint, s: any, ch: any, candles: Candle[]) {
  const y = pToY(pt.price, s)
  const x = tToX(pt.time, ch, candles)
  if (y == null || x == null) return null
  return { x, y }
}

// ── Hit testing ───────────────────────────────────────────────────
const HIT = 8

function hitDrawing(d: Drawing, mx: number, my: number, s: any, ch: any, candles: Candle[]): boolean {
  switch (d.type) {
    case 'hline': {
      const y = pToY(d.price, s)
      return y != null && Math.abs(y - my) < HIT
    }
    case 'vline': {
      const x = tToX(d.time, ch, candles)
      return x != null && Math.abs(x - mx) < HIT
    }
    case 'trendline': {
      const a = ptToPx(d.p1, s, ch, candles), b = ptToPx(d.p2, s, ch, candles)
      if (!a || !b) return false
      const dx = b.x - a.x, dy = b.y - a.y
      const len2 = dx * dx + dy * dy
      if (len2 === 0) return false
      const t = Math.max(0, Math.min(1, ((mx - a.x) * dx + (my - a.y) * dy) / len2))
      const px = a.x + t * dx, py = a.y + t * dy
      return Math.hypot(mx - px, my - py) < HIT
    }
    case 'rectangle': {
      const a = ptToPx(d.p1, s, ch, candles), b = ptToPx(d.p2, s, ch, candles)
      if (!a || !b) return false
      const rx = Math.min(a.x, b.x), ry = Math.min(a.y, b.y)
      const rw = Math.abs(b.x - a.x), rh = Math.abs(b.y - a.y)
      return mx >= rx - HIT && mx <= rx + rw + HIT && my >= ry - HIT && my <= ry + rh + HIT &&
        (Math.abs(mx - rx) < HIT || Math.abs(mx - rx - rw) < HIT ||
         Math.abs(my - ry) < HIT || Math.abs(my - ry - rh) < HIT)
    }
    case 'fibonacci':
    case 'longpos':
    case 'shortpos': {
      const a = ptToPx(d.p1, s, ch, candles)
      if (!a) return false
      const y = pToY(d.p1.price, s)
      return y != null && Math.abs(y - my) < HIT
    }
    case 'brush': {
      return d.points.some(p => {
        const px = ptToPx(p, s, ch, candles)
        return px != null && Math.hypot(px.x - mx, px.y - my) < HIT + 4
      })
    }
    default: return false
  }
}

// ── Component ─────────────────────────────────────────────────────
export function DrawingLayer({ seriesRef, chartRef, containerRef, candles, activeTool, drawings, onAdd, onDelete, onUpdate }: Props) {
  const [pendingPts,  setPendingPts]  = useState<DrawPoint[]>([])
  const [cursorPx,    setCursorPx]    = useState<{ x: number; y: number } | null>(null)
  const [selectedId,  setSelectedId]  = useState<string | null>(null)
  const [tick, setTick]               = useState(0)
  const brushPts       = useRef<DrawPoint[]>([])
  const isBrushing     = useRef(false)
  const lastBrushTime  = useRef(0)
  const dragging       = useRef<{ id: string; startMx: number; startMy: number; orig: Drawing } | null>(null)

  // Deselect when switching to a draw tool
  useEffect(() => {
    setPendingPts([])
    setCursorPx(null)
    brushPts.current = []
    isBrushing.current = false
    if (activeTool) setSelectedId(null)
  }, [activeTool])

  // Continuous RAF loop keeps drawings synced every frame
  useEffect(() => {
    let rafId = 0
    const loop = () => { setTick(n => n + 1); rafId = requestAnimationFrame(loop) }
    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [])

  const getPoint = useCallback((e: MouseEvent): DrawPoint | null => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return null
    return xYToPoint(e.clientX - rect.left, e.clientY - rect.top, seriesRef.current, chartRef.current, candles)
  }, [containerRef, seriesRef, chartRef, candles])

  const getPx = useCallback((e: MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return null
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [containerRef])

  // Move a drawing by delta-price / delta-time index
  const moveDrawing = useCallback((orig: Drawing, dx: number, dy: number, s: any, ch: any): Drawing | null => {
    const dPrice = -(dy * (1 / (s?.priceToCoordinate(1) - s?.priceToCoordinate(0) || 1)))
    const logical0 = ch?.timeScale().coordinateToLogical(0) ?? 0
    const logical1 = ch?.timeScale().coordinateToLogical(dx) ?? 0
    const dLogical = Math.round(logical1 - logical0)
    const shiftTime = (t: number) => {
      const idx    = candles.findIndex(c => c.time === t)
      const newIdx = Math.max(0, Math.min(idx + dLogical, candles.length - 1))
      return candles[newIdx]?.time ?? t
    }
    const shiftPt = (p: DrawPoint): DrawPoint => ({ price: p.price + dPrice, time: shiftTime(p.time) })

    switch (orig.type) {
      case 'hline':     return { ...orig, price: orig.price + dPrice }
      case 'vline':     return { ...orig, time: shiftTime(orig.time) }
      case 'trendline':
      case 'rectangle':
      case 'fibonacci':
      case 'longpos':
      case 'shortpos':  return { ...orig, p1: shiftPt(orig.p1), p2: shiftPt(orig.p2) }
      case 'brush':     return { ...orig, points: orig.points.map(shiftPt) }
      default:          return null
    }
  }, [candles])

  // ── Pointer events ────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const s  = seriesRef.current
    const ch = chartRef.current

    const onMove = (e: MouseEvent) => {
      const px = getPx(e)
      if (px) setCursorPx(px)

      // Drag a selected drawing
      if (dragging.current) {
        const { id, startMx, startMy, orig } = dragging.current
        const dx = e.clientX - (containerRef.current!.getBoundingClientRect().left + startMx)
        const dy = e.clientY - (containerRef.current!.getBoundingClientRect().top  + startMy)
        const moved = moveDrawing(orig, dx, dy, s, ch)
        if (moved) onUpdate(moved)
        return
      }

      // Brush
      if (isBrushing.current) {
        const now = Date.now()
        if (now - lastBrushTime.current < 16) return
        lastBrushTime.current = now
        const pt = getPoint(e)
        if (pt) { brushPts.current.push(pt); setTick(n => n + 1) }
      }
    }

    const onDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return
      const px = getPx(e)
      if (!px) return

      // If no tool active — check if clicking a drawing to select/drag it
      if (!activeTool) {
        let hit: Drawing | null = null
        for (const d of [...drawings].reverse()) {
          if (hitDrawing(d, px.x, px.y, s, ch, candles)) { hit = d; break }
        }
        if (hit) {
          setSelectedId(hit.id)
          dragging.current = { id: hit.id, startMx: px.x, startMy: px.y, orig: hit }
          e.stopPropagation()
        } else {
          setSelectedId(null)
        }
        return
      }

      // Brush start
      if (activeTool === 'brush' || activeTool === 'path') {
        isBrushing.current = true
        brushPts.current = []
        const pt = getPoint(e)
        if (pt) brushPts.current.push(pt)
      }
    }

    const onUp = () => {
      dragging.current = null
      if (!isBrushing.current) return
      isBrushing.current = false
      if (brushPts.current.length > 1) {
        onAdd({ id: uid(), type: 'brush', points: [...brushPts.current], color: TOOL_COLOR.brush })
      }
      brushPts.current = []
    }

    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return
      if (!activeTool || activeTool === 'brush' || activeTool === 'path') return
      const pt = getPoint(e)
      if (!pt) return

      if (activeTool === 'hline') { onAdd({ id: uid(), type: 'hline', price: pt.price, color: TOOL_COLOR.hline }); return }
      if (activeTool === 'vline') { onAdd({ id: uid(), type: 'vline', time: pt.time,  color: TOOL_COLOR.vline }); return }

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

    const onLeave = () => { setCursorPx(null); if (isBrushing.current) onUp() }

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
  }, [activeTool, candles, drawings, containerRef, seriesRef, chartRef, onAdd, onUpdate, getPoint, getPx, moveDrawing])

  const s  = seriesRef.current
  const ch = chartRef.current
  if (!s || !ch) return null

  const W = containerRef.current?.clientWidth  ?? 900
  const H = containerRef.current?.clientHeight ?? 500

  // ── Render ────────────────────────────────────────────────────────
  const renderDrawing = (d: Drawing) => {
    const isSelected = d.id === selectedId

    switch (d.type) {
      case 'hline': {
        const y = pToY(d.price, s)
        if (y == null || y < -10 || y > H + 10) return null
        return (
          <g key={d.id}>
            <line x1={0} y1={y} x2={W - 60} y2={y} stroke={d.color} strokeWidth={isSelected ? 2.5 : 1.5} />
            <rect x={2} y={y - 9} width={56} height={16} rx={3} fill={d.color} fillOpacity={0.18} />
            <text x={5} y={y + 4} fill={d.color} fontSize={9} fontWeight={700}>{d.price.toFixed(2)}</text>
            {isSelected && <DeleteBtn x={W - 72} y={y} onClick={() => { onDelete(d.id); setSelectedId(null) }} />}
          </g>
        )
      }
      case 'vline': {
        const x = tToX(d.time, ch, candles)
        if (x == null || x < -10 || x > W + 10) return null
        return (
          <g key={d.id}>
            <line x1={x} y1={0} x2={x} y2={H} stroke={d.color} strokeWidth={isSelected ? 2.5 : 1.5} />
            {isSelected && <DeleteBtn x={x} y={20} onClick={() => { onDelete(d.id); setSelectedId(null) }} />}
          </g>
        )
      }
      case 'trendline': {
        const a = ptToPx(d.p1, s, ch, candles), b = ptToPx(d.p2, s, ch, candles)
        if (!a || !b) return null
        return (
          <g key={d.id}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={d.color} strokeWidth={isSelected ? 2.5 : 2} />
            <circle cx={a.x} cy={a.y} r={isSelected ? 5 : 3} fill={d.color} />
            <circle cx={b.x} cy={b.y} r={isSelected ? 5 : 3} fill={d.color} />
            {isSelected && <DeleteBtn x={(a.x+b.x)/2} y={(a.y+b.y)/2 - 14} onClick={() => { onDelete(d.id); setSelectedId(null) }} />}
          </g>
        )
      }
      case 'rectangle': {
        const a = ptToPx(d.p1, s, ch, candles), b = ptToPx(d.p2, s, ch, candles)
        if (!a || !b) return null
        const rx = Math.min(a.x,b.x), ry = Math.min(a.y,b.y)
        const rw = Math.abs(b.x-a.x), rh = Math.abs(b.y-a.y)
        return (
          <g key={d.id}>
            <rect x={rx} y={ry} width={rw} height={rh}
              stroke={d.color} strokeWidth={isSelected ? 2.5 : 1.5} fill={d.color} fillOpacity={0.07} />
            {isSelected && <DeleteBtn x={rx + rw - 10} y={ry + 10} onClick={() => { onDelete(d.id); setSelectedId(null) }} />}
          </g>
        )
      }
      case 'fibonacci': {
        const a = ptToPx(d.p1, s, ch, candles), b = ptToPx(d.p2, s, ch, candles)
        if (!a || !b) return null
        const topY = Math.min(a.y, b.y), botY = Math.max(a.y, b.y)
        const topP = yToP(topY, s) ?? 0, botP = yToP(botY, s) ?? 0
        const xL = Math.min(a.x, b.x), xR = Math.max(a.x, b.x)
        return (
          <g key={d.id}>
            {FIB_LEVELS.map((lvl, i) => {
              const p = topP - (topP - botP) * lvl
              const y = pToY(p, s)
              if (y == null) return null
              return (
                <g key={lvl}>
                  <line x1={xL} y1={y} x2={xR} y2={y} stroke={FIB_COLORS[i]} strokeWidth={1} />
                  <text x={xR + 4} y={y + 4} fill={FIB_COLORS[i]} fontSize={9}>
                    {(lvl * 100).toFixed(1)}%  {p.toFixed(2)}
                  </text>
                </g>
              )
            })}
            {isSelected && <DeleteBtn x={xL} y={topY - 8} onClick={() => { onDelete(d.id); setSelectedId(null) }} />}
          </g>
        )
      }
      case 'longpos':
      case 'shortpos': {
        const isLong = d.type === 'longpos'
        const eP = ptToPx(d.p1, s, ch, candles), tpP = ptToPx(d.p2, s, ch, candles)
        if (!eP || !tpP) return null
        const slPrice = d.p1.price - (d.p2.price - d.p1.price)
        const slY     = pToY(slPrice, s)
        const xR      = Math.min(W - 80, eP.x + 200)
        const pClr    = isLong ? '#22c55e' : '#ef4444'
        const lClr    = isLong ? '#ef4444' : '#22c55e'
        return (
          <g key={d.id}>
            {slY != null && <rect x={eP.x} y={Math.min(eP.y, slY)} width={xR - eP.x} height={Math.abs(eP.y - slY)} fill={lClr} fillOpacity={0.09} />}
            <rect x={eP.x} y={Math.min(eP.y, tpP.y)} width={xR - eP.x} height={Math.abs(eP.y - tpP.y)} fill={pClr} fillOpacity={0.09} />
            <line x1={eP.x} y1={eP.y}  x2={xR} y2={eP.y}  stroke="#3b82f6" strokeWidth={isSelected ? 2.5 : 2} />
            <line x1={eP.x} y1={tpP.y} x2={xR} y2={tpP.y} stroke={pClr} strokeWidth={1.5} />
            {slY != null && <line x1={eP.x} y1={slY} x2={xR} y2={slY} stroke={lClr} strokeWidth={1.5} />}
            <text x={eP.x + 4} y={eP.y - 4}  fill="#3b82f6" fontSize={10}>Entry {d.p1.price.toFixed(2)}</text>
            <text x={eP.x + 4} y={tpP.y - 4} fill={pClr}    fontSize={10}>TP {d.p2.price.toFixed(2)}</text>
            {slY != null && <text x={eP.x + 4} y={slY + 12}  fill={lClr} fontSize={10}>SL {slPrice.toFixed(2)}</text>}
            {isSelected && <DeleteBtn x={xR - 10} y={eP.y - 12} onClick={() => { onDelete(d.id); setSelectedId(null) }} />}
          </g>
        )
      }
      case 'brush': {
        if (d.points.length < 2) return null
        const step = Math.max(1, Math.floor(d.points.length / 200))
        const pts  = d.points
          .filter((_, i) => i % step === 0 || i === d.points.length - 1)
          .map(p => { const px = ptToPx(p, s, ch, candles); return px ? `${px.x.toFixed(1)},${px.y.toFixed(1)}` : null })
          .filter(Boolean).join(' ')
        if (!pts) return null
        return (
          <g key={d.id}>
            <polyline points={pts} stroke={d.color} strokeWidth={isSelected ? 3 : 2}
              fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {isSelected && (() => {
              const mid = d.points[Math.floor(d.points.length / 2)]
              const mpx = ptToPx(mid, s, ch, candles)
              return mpx ? <DeleteBtn x={mpx.x} y={mpx.y - 14} onClick={() => { onDelete(d.id); setSelectedId(null) }} /> : null
            })()}
          </g>
        )
      }
    }
    return null
  }

  // ── Preview ───────────────────────────────────────────────────────
  const renderPreview = () => {
    if (!cursorPx || !activeTool) return null
    const { x: mx, y: my } = cursorPx

    if (activeTool === 'hline') return <line x1={0} y1={my} x2={W} y2={my} stroke={TOOL_COLOR.hline} strokeWidth={1} opacity={0.5} />
    if (activeTool === 'vline') return <line x1={mx} y1={0} x2={mx} y2={H} stroke={TOOL_COLOR.vline} strokeWidth={1} opacity={0.5} />

    if (pendingPts.length === 1) {
      const a = ptToPx(pendingPts[0], s, ch, candles)
      if (!a) return null
      if (activeTool === 'trendline') return <line x1={a.x} y1={a.y} x2={mx} y2={my} stroke={TOOL_COLOR.trendline} strokeWidth={1.5} opacity={0.6} />
      if (activeTool === 'rectangle') return <rect x={Math.min(a.x,mx)} y={Math.min(a.y,my)} width={Math.abs(mx-a.x)} height={Math.abs(my-a.y)} stroke={TOOL_COLOR.rectangle} strokeWidth={1.5} fill={TOOL_COLOR.rectangle} fillOpacity={0.05} opacity={0.7} />
      if (activeTool === 'fibonacci') return <line x1={a.x} y1={a.y} x2={mx} y2={my} stroke={TOOL_COLOR.fibonacci} strokeWidth={1} opacity={0.65} />
      if (activeTool === 'longpos' || activeTool === 'shortpos') {
        const pClr = activeTool === 'longpos' ? '#22c55e' : '#ef4444'
        return <>
          <line x1={a.x} y1={a.y} x2={mx} y2={a.y} stroke="#3b82f6" strokeWidth={1.5} opacity={0.8} />
          <line x1={a.x} y1={my} x2={mx} y2={my} stroke={pClr} strokeWidth={1} opacity={0.7} />
          <rect x={Math.min(a.x,mx)} y={Math.min(a.y,my)} width={Math.abs(mx-a.x)} height={Math.abs(my-a.y)} fill={pClr} fillOpacity={0.07} />
        </>
      }
    }
    if ((activeTool === 'brush' || activeTool === 'path') && isBrushing.current && brushPts.current.length > 1) {
      const pts = brushPts.current.map(p => { const px = ptToPx(p, s, ch, candles); return px ? `${px.x.toFixed(1)},${px.y.toFixed(1)}` : null }).filter(Boolean).join(' ')
      if (pts) return <polyline points={pts} stroke={TOOL_COLOR.brush} strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.75} />
    }
    return null
  }

  return (
    <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:5, overflow:'visible' }}>
      {drawings.map(d => renderDrawing(d))}
      {renderPreview()}
    </svg>
  )
}

function DeleteBtn({ x, y, onClick }: { x: number; y: number; onClick: () => void }) {
  return (
    <g style={{ cursor:'pointer', pointerEvents:'all' }} onClick={e => { e.stopPropagation(); onClick() }}>
      <circle cx={x} cy={y} r={8} fill="#ef4444" />
      <line x1={x-4} y1={y-4} x2={x+4} y2={y+4} stroke="white" strokeWidth={1.8} strokeLinecap="round" />
      <line x1={x+4} y1={y-4} x2={x-4} y2={y+4} stroke="white" strokeWidth={1.8} strokeLinecap="round" />
    </g>
  )
}
