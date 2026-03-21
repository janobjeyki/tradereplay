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
  hline:'#3b82f6', vline:'#94a3b8', trendline:'#f59e0b',
  rectangle:'#a78bfa', fibonacci:'#60a5fa',
  longpos:'#22c55e', shortpos:'#ef4444',
  brush:'#e879f9', path:'#e879f9',
}
const HIT = 8

// ── Coordinate helpers ────────────────────────────────────────────
function pToY(price: number, s: any) { return s?.priceToCoordinate(price) ?? null }
function yToP(y: number, s: any)     { return s?.coordinateToPrice(y) ?? null }
function tToX(time: number, ch: any, candles: Candle[]) {
  const idx = candles.findIndex(c => c.time === time)
  if (idx < 0) return null
  return ch?.timeScale().logicalToCoordinate(idx) ?? null
}
function xyToPoint(x: number, y: number, s: any, ch: any, candles: Candle[]): DrawPoint | null {
  const price = yToP(y, s)
  if (price == null) return null
  const logical = ch?.timeScale().coordinateToLogical(x)
  if (logical == null) return null
  const idx = Math.max(0, Math.min(Math.round(logical), candles.length - 1))
  const time = candles[idx]?.time
  if (!time) return null
  return { price, time }
}
function ptToPx(pt: DrawPoint, s: any, ch: any, candles: Candle[]) {
  const y = pToY(pt.price, s), x = tToX(pt.time, ch, candles)
  return (y == null || x == null) ? null : { x, y }
}

function hitDrawing(d: Drawing, mx: number, my: number, s: any, ch: any, candles: Candle[]): boolean {
  switch (d.type) {
    case 'hline': { const y = pToY(d.price, s); return y != null && Math.abs(y - my) < HIT }
    case 'vline': { const x = tToX(d.time, ch, candles); return x != null && Math.abs(x - mx) < HIT }
    case 'trendline': {
      const a = ptToPx(d.p1, s, ch, candles), b = ptToPx(d.p2, s, ch, candles)
      if (!a || !b) return false
      const dx = b.x-a.x, dy = b.y-a.y, len2 = dx*dx+dy*dy
      if (!len2) return false
      const t = Math.max(0, Math.min(1, ((mx-a.x)*dx+(my-a.y)*dy)/len2))
      return Math.hypot(mx-a.x-t*dx, my-a.y-t*dy) < HIT
    }
    case 'rectangle': {
      const a = ptToPx(d.p1, s, ch, candles), b = ptToPx(d.p2, s, ch, candles)
      if (!a || !b) return false
      const rx=Math.min(a.x,b.x), ry=Math.min(a.y,b.y), rw=Math.abs(b.x-a.x), rh=Math.abs(b.y-a.y)
      return mx>=rx-HIT&&mx<=rx+rw+HIT&&my>=ry-HIT&&my<=ry+rh+HIT&&
        (Math.abs(mx-rx)<HIT||Math.abs(mx-rx-rw)<HIT||Math.abs(my-ry)<HIT||Math.abs(my-ry-rh)<HIT)
    }
    case 'longpos': case 'shortpos': { const y = pToY(d.p1.price, s); return y != null && Math.abs(y-my) < HIT }
    case 'fibonacci': { const a = ptToPx(d.p1, s, ch, candles); if (!a) return false; const y = pToY(d.p1.price, s); return y != null && Math.abs(y-my) < HIT }
    case 'brush': return d.points.some(p => { const px = ptToPx(p, s, ch, candles); return px != null && Math.hypot(px.x-mx, px.y-my) < HIT+4 })
    default: return false
  }
}

// ── Canvas drawing functions ──────────────────────────────────────
function drawOnCanvas(
  ctx: CanvasRenderingContext2D,
  drawings: Drawing[],
  selectedId: string | null,
  preview: { tool: DrawingTool; pending: DrawPoint[]; cursor: { x: number; y: number } | null; brushPts: DrawPoint[] } | null,
  s: any, ch: any, candles: Candle[],
  W: number, H: number,
) {
  ctx.clearRect(0, 0, W, H)

  const drawLine = (x1: number, y1: number, x2: number, y2: number, color: string, width: number, dashed = false) => {
    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.lineWidth   = width
    ctx.setLineDash(dashed ? [5, 3] : [])
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
    ctx.setLineDash([])
  }

  const drawCircle = (x: number, y: number, r: number, color: string) => {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = color; ctx.fill()
  }

  const drawText = (text: string, x: number, y: number, color: string, size = 10) => {
    ctx.font = `${size}px -apple-system, sans-serif`
    ctx.fillStyle = color; ctx.fillText(text, x, y)
  }

  const drawDeleteBtn = (x: number, y: number) => {
    ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2)
    ctx.fillStyle = '#ef4444'; ctx.fill()
    ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.setLineDash([])
    ctx.beginPath(); ctx.moveTo(x-4, y-4); ctx.lineTo(x+4, y+4); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x+4, y-4); ctx.lineTo(x-4, y+4); ctx.stroke()
  }

  // Draw each stored drawing
  for (const d of drawings) {
    const sel = d.id === selectedId
    const w   = sel ? 2.5 : 1.5

    switch (d.type) {
      case 'hline': {
        const y = pToY(d.price, s); if (y == null) break
        drawLine(0, y, W - 60, y, d.color, w)
        ctx.fillStyle = d.color + '30'
        ctx.fillRect(2, y - 9, 56, 16)
        drawText(d.price.toFixed(2), 5, y + 4, d.color, 9)
        if (sel) drawDeleteBtn(W - 72, y)
        break
      }
      case 'vline': {
        const x = tToX(d.time, ch, candles); if (x == null) break
        drawLine(x, 0, x, H, d.color, w)
        if (sel) drawDeleteBtn(x, 20)
        break
      }
      case 'trendline': {
        const a = ptToPx(d.p1, s, ch, candles), b = ptToPx(d.p2, s, ch, candles)
        if (!a || !b) break
        drawLine(a.x, a.y, b.x, b.y, d.color, w)
        drawCircle(a.x, a.y, sel ? 5 : 3, d.color)
        drawCircle(b.x, b.y, sel ? 5 : 3, d.color)
        if (sel) drawDeleteBtn((a.x+b.x)/2, (a.y+b.y)/2 - 14)
        break
      }
      case 'rectangle': {
        const a = ptToPx(d.p1, s, ch, candles), b = ptToPx(d.p2, s, ch, candles)
        if (!a || !b) break
        const rx=Math.min(a.x,b.x), ry=Math.min(a.y,b.y), rw=Math.abs(b.x-a.x), rh=Math.abs(b.y-a.y)
        ctx.fillStyle = d.color + '12'; ctx.fillRect(rx, ry, rw, rh)
        ctx.strokeStyle = d.color; ctx.lineWidth = w; ctx.setLineDash([])
        ctx.strokeRect(rx, ry, rw, rh)
        if (sel) drawDeleteBtn(rx + rw - 10, ry + 10)
        break
      }
      case 'fibonacci': {
        const a = ptToPx(d.p1, s, ch, candles), b = ptToPx(d.p2, s, ch, candles)
        if (!a || !b) break
        const topY=Math.min(a.y,b.y), botY=Math.max(a.y,b.y)
        const topP=yToP(topY,s)??0, botP=yToP(botY,s)??0
        const xL=Math.min(a.x,b.x), xR=Math.max(a.x,b.x)
        for (let i = 0; i < FIB_LEVELS.length; i++) {
          const p = topP - (topP - botP) * FIB_LEVELS[i]
          const y = pToY(p, s); if (y == null) continue
          drawLine(xL, y, xR, y, FIB_COLORS[i], 1)
          drawText(`${(FIB_LEVELS[i]*100).toFixed(1)}%  ${p.toFixed(2)}`, xR+4, y+4, FIB_COLORS[i], 9)
        }
        if (sel) drawDeleteBtn(xL, topY - 8)
        break
      }
      case 'longpos': case 'shortpos': {
        const isLong = d.type === 'longpos'
        const eP = ptToPx(d.p1, s, ch, candles), tpP = ptToPx(d.p2, s, ch, candles)
        if (!eP || !tpP) break
        const slPrice = d.p1.price - (d.p2.price - d.p1.price)
        const slY = pToY(slPrice, s)
        const xR  = Math.min(W - 80, eP.x + 200)
        const pClr = isLong ? '#22c55e' : '#ef4444'
        const lClr = isLong ? '#ef4444' : '#22c55e'
        if (slY != null) { ctx.fillStyle = lClr + '16'; ctx.fillRect(eP.x, Math.min(eP.y,slY), xR-eP.x, Math.abs(eP.y-slY)) }
        ctx.fillStyle = pClr + '16'; ctx.fillRect(eP.x, Math.min(eP.y,tpP.y), xR-eP.x, Math.abs(eP.y-tpP.y))
        drawLine(eP.x, eP.y, xR, eP.y, '#3b82f6', w)
        drawLine(eP.x, tpP.y, xR, tpP.y, pClr, 1.5)
        if (slY != null) drawLine(eP.x, slY, xR, slY, lClr, 1.5)
        drawText(`Entry ${d.p1.price.toFixed(2)}`, eP.x+4, eP.y-4, '#3b82f6')
        drawText(`TP ${d.p2.price.toFixed(2)}`, eP.x+4, tpP.y-4, pClr)
        if (slY != null) drawText(`SL ${slPrice.toFixed(2)}`, eP.x+4, slY+12, lClr)
        if (sel) drawDeleteBtn(xR-10, eP.y-12)
        break
      }
      case 'brush': {
        if (d.points.length < 2) break
        const step = Math.max(1, Math.floor(d.points.length / 300))
        ctx.beginPath(); ctx.strokeStyle = d.color; ctx.lineWidth = sel ? 3 : 2
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([])
        let started = false
        for (let i = 0; i < d.points.length; i += step) {
          const px = ptToPx(d.points[i], s, ch, candles)
          if (!px) continue
          if (!started) { ctx.moveTo(px.x, px.y); started = true } else ctx.lineTo(px.x, px.y)
        }
        ctx.stroke()
        if (sel) {
          const mid = d.points[Math.floor(d.points.length/2)]
          const mpx = ptToPx(mid, s, ch, candles)
          if (mpx) drawDeleteBtn(mpx.x, mpx.y - 14)
        }
        break
      }
    }
  }

  // Draw preview
  if (preview?.tool && preview.cursor) {
    const { x: mx, y: my } = preview.cursor
    const tool = preview.tool

    ctx.globalAlpha = 0.6
    if (tool === 'hline') drawLine(0, my, W, my, TOOL_COLOR.hline, 1.5)
    else if (tool === 'vline') drawLine(mx, 0, mx, H, TOOL_COLOR.vline, 1.5)
    else if (preview.pending.length === 1) {
      const a = ptToPx(preview.pending[0], s, ch, candles)
      if (a) {
        if (tool === 'trendline') drawLine(a.x, a.y, mx, my, TOOL_COLOR.trendline, 1.5)
        else if (tool === 'rectangle') {
          ctx.strokeStyle = TOOL_COLOR.rectangle; ctx.lineWidth = 1.5; ctx.setLineDash([])
          ctx.fillStyle = TOOL_COLOR.rectangle + '10'
          ctx.fillRect(Math.min(a.x,mx), Math.min(a.y,my), Math.abs(mx-a.x), Math.abs(my-a.y))
          ctx.strokeRect(Math.min(a.x,mx), Math.min(a.y,my), Math.abs(mx-a.x), Math.abs(my-a.y))
        } else if (tool === 'fibonacci') drawLine(a.x, a.y, mx, my, TOOL_COLOR.fibonacci, 1)
        else if (tool === 'longpos' || tool === 'shortpos') {
          const pClr = tool === 'longpos' ? '#22c55e' : '#ef4444'
          ctx.fillStyle = pClr + '12'
          ctx.fillRect(Math.min(a.x,mx), Math.min(a.y,my), Math.abs(mx-a.x), Math.abs(my-a.y))
          drawLine(a.x, a.y, mx, a.y, '#3b82f6', 1.5)
          drawLine(a.x, my, mx, my, pClr, 1)
        }
      }
    } else if ((tool === 'brush' || tool === 'path') && preview.brushPts.length > 1) {
      ctx.beginPath(); ctx.strokeStyle = TOOL_COLOR.brush; ctx.lineWidth = 2
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([])
      let started = false
      for (const p of preview.brushPts) {
        const px = ptToPx(p, s, ch, candles)
        if (!px) continue
        if (!started) { ctx.moveTo(px.x, px.y); started = true } else ctx.lineTo(px.x, px.y)
      }
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }
}

// ── Component ─────────────────────────────────────────────────────
export function DrawingLayer({ seriesRef, chartRef, containerRef, candles, activeTool, drawings, onAdd, onDelete, onUpdate }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const [pendingPts, setPendingPts]  = useState<DrawPoint[]>([])
  const cursorPxRef  = useRef<{ x: number; y: number } | null>(null)
  const [selectedId, setSelectedId]  = useState<string | null>(null)
  const selectedIdRef = useRef<string | null>(null)
  const brushPts     = useRef<DrawPoint[]>([])
  const isBrushing   = useRef(false)
  const lastBrushMs  = useRef(0)
  const dragging     = useRef<{ id: string; sx: number; sy: number; orig: Drawing } | null>(null)
  const pendingRef   = useRef<DrawPoint[]>([])
  const drawingsRef  = useRef<Drawing[]>(drawings)
  const rafRef       = useRef<number>(0)

  // Keep refs in sync
  useEffect(() => { drawingsRef.current = drawings }, [drawings])
  useEffect(() => { pendingRef.current  = pendingPts }, [pendingPts])
  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])
  useEffect(() => { if (activeTool) { setSelectedId(null); setPendingPts([]) } }, [activeTool])

  // ── RAF render loop ───────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    const el     = containerRef.current
    if (!canvas || !el) return

    const render = () => {
      const s  = seriesRef.current
      const ch = chartRef.current
      if (!s || !ch) { rafRef.current = requestAnimationFrame(render); return }

      const W = el.clientWidth, H = el.clientHeight
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H }
      const ctx = canvas.getContext('2d')
      if (!ctx) { rafRef.current = requestAnimationFrame(render); return }

      drawOnCanvas(
        ctx,
        drawingsRef.current,
        selectedIdRef.current,
        {
          tool:      activeTool,
          pending:   pendingRef.current,
          cursor:    cursorPxRef.current,
          brushPts:  isBrushing.current ? brushPts.current : [],
        },
        s, ch, candles, W, H,
      )
      rafRef.current = requestAnimationFrame(render)
    }
    rafRef.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(rafRef.current)
  // activeTool + candles are needed so preview / fib labels update
  }, [activeTool, candles, containerRef, seriesRef, chartRef])

  // ── Hit test for delete button ────────────────────────────────────
  const hitDeleteBtn = useCallback((mx: number, my: number, d: Drawing, W: number) => {
    const s = seriesRef.current, ch = chartRef.current
    switch (d.type) {
      case 'hline':    { const y=pToY(d.price,s); return y!=null && Math.hypot(mx-(W-72),my-y)<12 }
      case 'vline':    { const x=tToX(d.time,ch,candles); return x!=null && Math.hypot(mx-x,my-20)<12 }
      case 'trendline':{ const a=ptToPx(d.p1,s,ch,candles),b=ptToPx(d.p2,s,ch,candles); return (a&&b)&&Math.hypot(mx-(a.x+b.x)/2,my-(a.y+b.y)/2+14)<12 || false }
      case 'rectangle':{ const a=ptToPx(d.p1,s,ch,candles),b=ptToPx(d.p2,s,ch,candles); return (a&&b)&&Math.hypot(mx-(Math.min(a.x,b.x)+Math.abs(b.x-a.x)-10),my-(Math.min(a.y,b.y)+10))<12 || false }
      default:         return false
    }
  }, [candles, seriesRef, chartRef])

  // ── Pointer events ────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const getPoint = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      return xyToPoint(e.clientX-rect.left, e.clientY-rect.top, seriesRef.current, chartRef.current, candles)
    }
    const getPx = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      return { x: e.clientX-rect.left, y: e.clientY-rect.top }
    }

    const onMove = (e: MouseEvent) => {
      const px = getPx(e)
      cursorPxRef.current = px

      if (dragging.current) {
        const { sx, sy, orig } = dragging.current
        const s = seriesRef.current, ch = chartRef.current
        // compute delta in price and candle-index
        const origPy = orig.type === 'hline' ? pToY(orig.price, s) :
                       orig.type === 'trendline' || orig.type === 'rectangle' || orig.type === 'fibonacci' ||
                       orig.type === 'longpos' || orig.type === 'shortpos' ? pToY(orig.p1.price, s) : null
        if (origPy == null) return

        const dyPx  = px.y - sy
        const dxPx  = px.x - sx
        const newPy = origPy + dyPx
        const dPrice = (yToP(newPy, s) ?? 0) - (yToP(origPy, s) ?? 0)

        const origLogical = ch?.timeScale().coordinateToLogical(sx) ?? 0
        const newLogical  = ch?.timeScale().coordinateToLogical(sx + dxPx) ?? 0
        const dLogical    = Math.round(newLogical - origLogical)

        const shiftTime = (t: number) => {
          const idx = candles.findIndex(c => c.time === t)
          return candles[Math.max(0, Math.min(idx + dLogical, candles.length-1))]?.time ?? t
        }
        const shiftPt = (p: DrawPoint): DrawPoint => ({ price: p.price + dPrice, time: shiftTime(p.time) })

        let moved: Drawing | null = null
        switch (orig.type) {
          case 'hline':    moved = { ...orig, price: orig.price + dPrice }; break
          case 'vline':    moved = { ...orig, time: shiftTime(orig.time) }; break
          case 'trendline': case 'rectangle': case 'fibonacci':
          case 'longpos':  case 'shortpos':
            moved = { ...orig, p1: shiftPt(orig.p1), p2: shiftPt(orig.p2) }; break
          case 'brush':    moved = { ...orig, points: orig.points.map(shiftPt) }; break
        }
        if (moved) onUpdate(moved)
        return
      }

      if (isBrushing.current) {
        const now = Date.now()
        if (now - lastBrushMs.current < 16) return
        lastBrushMs.current = now
        const pt = getPoint(e)
        if (pt) brushPts.current.push(pt)
      }
    }

    const onDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return
      const px = getPx(e)
      const W  = el.clientWidth

      if (!activeTool) {
        // Check delete button first
        const sel = selectedIdRef.current
        if (sel) {
          const d = drawingsRef.current.find(x => x.id === sel)
          if (d && hitDeleteBtn(px.x, px.y, d, W)) { onDelete(sel); setSelectedId(null); return }
        }
        // Hit test drawings
        let hit: Drawing | null = null
        for (const d of [...drawingsRef.current].reverse()) {
          if (hitDrawing(d, px.x, px.y, seriesRef.current, chartRef.current, candles)) { hit = d; break }
        }
        if (hit) {
          setSelectedId(hit.id)
          dragging.current = { id: hit.id, sx: px.x, sy: px.y, orig: hit }
          e.stopPropagation()
        } else {
          setSelectedId(null)
        }
        return
      }

      if (activeTool === 'brush' || activeTool === 'path') {
        isBrushing.current = true; brushPts.current = []
        const pt = getPoint(e); if (pt) brushPts.current.push(pt)
      }
    }

    const onUp = () => {
      dragging.current = null
      if (!isBrushing.current) return
      isBrushing.current = false
      if (brushPts.current.length > 1) onAdd({ id: uid(), type: 'brush', points: [...brushPts.current], color: TOOL_COLOR.brush })
      brushPts.current = []
    }

    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return
      if (!activeTool || activeTool === 'brush' || activeTool === 'path') return
      const pt = getPoint(e); if (!pt) return

      if (activeTool === 'hline') { onAdd({ id: uid(), type: 'hline', price: pt.price, color: TOOL_COLOR.hline }); return }
      if (activeTool === 'vline') { onAdd({ id: uid(), type: 'vline', time: pt.time,   color: TOOL_COLOR.vline }); return }

      const twoClick = ['trendline','rectangle','fibonacci','longpos','shortpos'] as const
      if ((twoClick as readonly string[]).includes(activeTool)) {
        setPendingPts(prev => {
          if (prev.length === 0) return [pt]
          onAdd({ id: uid(), type: activeTool as typeof twoClick[number], p1: prev[0], p2: pt, color: TOOL_COLOR[activeTool] })
          return []
        })
      }
    }

    const onLeave = () => { cursorPxRef.current = null; if (isBrushing.current) onUp() }

    el.addEventListener('mousemove',  onMove)
    el.addEventListener('mousedown',  onDown,  { capture: false })
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
  }, [activeTool, candles, drawings, containerRef, seriesRef, chartRef, onAdd, onDelete, onUpdate, hitDeleteBtn])

  return (
    <canvas
      ref={canvasRef}
      style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:5 }}
    />
  )
}
