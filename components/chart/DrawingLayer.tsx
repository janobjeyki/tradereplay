'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { DrawingTool, Drawing, DrawPoint } from '@/lib/drawing-types'
import { FIB_LEVELS, FIB_COLORS, uid } from '@/lib/drawing-types'

interface Coords {
  priceToY: (p: number) => number | null
  timeToX:  (t: number) => number | null
  yToPrice: (y: number) => number | null
  xToTime:  (x: number) => number | null
}

interface Props {
  width:       number
  height:      number
  activeTool:  DrawingTool
  drawings:    Drawing[]
  coords:      Coords
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

export function DrawingLayer({ width, height, activeTool, drawings, coords, onAdd, onDelete }: Props) {
  const [pendingPts, setPendingPts] = useState<DrawPoint[]>([])
  const [mousePos,   setMousePos]   = useState<{ x: number; y: number } | null>(null)
  const brushPts = useRef<DrawPoint[]>([])
  const isBrushingRef = useRef(false)
  const svgRef = useRef<SVGSVGElement>(null)

  // Reset pending when tool changes
  useEffect(() => {
    setPendingPts([])
    brushPts.current = []
    isBrushingRef.current = false
  }, [activeTool])

  const getPoint = useCallback((e: React.MouseEvent<SVGSVGElement>): DrawPoint | null => {
    const rect = svgRef.current!.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const price = coords.yToPrice(y)
    const time  = coords.xToTime(x)
    if (price === null || time === null) return null
    return { price, time: Math.floor(time as any) }
  }, [coords])

  const onClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!activeTool) return
    const pt = getPoint(e)
    if (!pt) return

    // Single-click tools
    if (activeTool === 'hline') {
      onAdd({ id: uid(), type: 'hline', price: pt.price, color: TOOL_COLOR.hline! })
      return
    }
    if (activeTool === 'vline') {
      onAdd({ id: uid(), type: 'vline', time: pt.time, color: TOOL_COLOR.vline! })
      return
    }

    // Two-click tools
    if (['trendline','rectangle','fibonacci','longpos','shortpos'].includes(activeTool)) {
      if (pendingPts.length === 0) {
        setPendingPts([pt])
      } else {
        const p1 = pendingPts[0]
        const type = activeTool as 'trendline'|'rectangle'|'fibonacci'|'longpos'|'shortpos'
        onAdd({ id: uid(), type, p1, p2: pt, color: TOOL_COLOR[activeTool]! })
        setPendingPts([])
      }
    }
  }, [activeTool, pendingPts, getPoint, onAdd])

  const onMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (activeTool !== 'brush' && activeTool !== 'path') return
    isBrushingRef.current = true
    brushPts.current = []
    const pt = getPoint(e)
    if (pt) brushPts.current.push(pt)
  }, [activeTool, getPoint])

  const onMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect()
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    if (isBrushingRef.current && (activeTool === 'brush' || activeTool === 'path')) {
      const pt = getPoint(e)
      if (pt) brushPts.current.push(pt)
    }
  }, [activeTool, getPoint])

  const onMouseUp = useCallback(() => {
    if (!isBrushingRef.current) return
    isBrushingRef.current = false
    if (brushPts.current.length > 1) {
      onAdd({ id: uid(), type: 'brush', points: [...brushPts.current], color: TOOL_COLOR.brush! })
    }
    brushPts.current = []
  }, [onAdd])

  const onMouseLeave = useCallback(() => {
    setMousePos(null)
    if (isBrushingRef.current) onMouseUp()
  }, [onMouseUp])

  if (!activeTool && drawings.length === 0) return null

  // ── Convert stored drawings to pixel shapes ────────────────────
  const renderDrawing = (d: Drawing) => {
    const key = d.id
    switch (d.type) {
      case 'hline': {
        const y = coords.priceToY(d.price)
        if (y === null) return null
        return (
          <g key={key}>
            <line x1={0} y1={y} x2={width} y2={y} stroke={d.color} strokeWidth={1.5} strokeDasharray="5,3" />
            <text x={6} y={y - 3} fill={d.color} fontSize={10}>{d.price.toFixed(2)}</text>
            <rect x={width - 16} y={y - 8} width={14} height={14} fill="transparent" style={{cursor:'pointer'}}
              onClick={() => onDelete(d.id)} />
            <text x={width - 14} y={y + 4} fill={d.color} fontSize={12} style={{cursor:'pointer'}}
              onClick={() => onDelete(d.id)}>×</text>
          </g>
        )
      }
      case 'vline': {
        const x = coords.timeToX(d.time)
        if (x === null) return null
        return (
          <g key={key}>
            <line x1={x} y1={0} x2={x} y2={height} stroke={d.color} strokeWidth={1.5} strokeDasharray="5,3" />
            <text x={x + 4} y={14} fill={d.color} fontSize={10} style={{cursor:'pointer'}}
              onClick={() => onDelete(d.id)}>×</text>
          </g>
        )
      }
      case 'trendline': {
        const x1 = coords.timeToX(d.p1.time), y1 = coords.priceToY(d.p1.price)
        const x2 = coords.timeToX(d.p2.time), y2 = coords.priceToY(d.p2.price)
        if (x1 === null || y1 === null || x2 === null || y2 === null) return null
        return (
          <g key={key}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={d.color} strokeWidth={1.5} />
            <circle cx={x1} cy={y1} r={4} fill={d.color} />
            <circle cx={x2} cy={y2} r={4} fill={d.color} style={{cursor:'pointer'}} onClick={() => onDelete(d.id)} />
          </g>
        )
      }
      case 'rectangle': {
        const x1 = coords.timeToX(d.p1.time), y1 = coords.priceToY(d.p1.price)
        const x2 = coords.timeToX(d.p2.time), y2 = coords.priceToY(d.p2.price)
        if (x1 === null || y1 === null || x2 === null || y2 === null) return null
        const rx = Math.min(x1, x2), ry = Math.min(y1, y2)
        const rw = Math.abs(x2 - x1), rh = Math.abs(y2 - y1)
        return (
          <g key={key}>
            <rect x={rx} y={ry} width={rw} height={rh} stroke={d.color} strokeWidth={1.5}
              fill={d.color} fillOpacity={0.08} />
            <text x={rx + rw - 14} y={ry + 14} fill={d.color} fontSize={12} style={{cursor:'pointer'}}
              onClick={() => onDelete(d.id)}>×</text>
          </g>
        )
      }
      case 'fibonacci': {
        const x1 = coords.timeToX(d.p1.time), y1 = coords.priceToY(d.p1.price)
        const x2 = coords.timeToX(d.p2.time), y2 = coords.priceToY(d.p2.price)
        if (x1 === null || y1 === null || x2 === null || y2 === null) return null
        const high = Math.min(y1, y2), low = Math.max(y1, y2)
        const highP = coords.yToPrice(high)!, lowP = coords.yToPrice(low)!
        const xStart = Math.min(x1, x2), xEnd = Math.max(x1, x2)
        return (
          <g key={key}>
            {FIB_LEVELS.map((lvl, i) => {
              const p = highP - (highP - lowP) * lvl
              const y = coords.priceToY(p)
              if (y === null) return null
              return (
                <g key={lvl}>
                  <line x1={xStart} y1={y} x2={xEnd} y2={y} stroke={FIB_COLORS[i]} strokeWidth={1} strokeDasharray="4,2" />
                  <text x={xEnd + 4} y={y + 4} fill={FIB_COLORS[i]} fontSize={9}>{(lvl * 100).toFixed(1)}%</text>
                </g>
              )
            })}
            <text x={xEnd - 10} y={high - 6} fill={d.color} fontSize={12} style={{cursor:'pointer'}}
              onClick={() => onDelete(d.id)}>×</text>
          </g>
        )
      }
      case 'longpos':
      case 'shortpos': {
        const isLong = d.type === 'longpos'
        const xE = coords.timeToX(d.p1.time), yE = coords.priceToY(d.p1.price)
        const xT = coords.timeToX(d.p2.time), yT = coords.priceToY(d.p2.price)
        if (xE === null || yE === null || xT === null || yT === null) return null
        const xRight = Math.max(xE, xT, 200)
        // SL is mirror of TP around entry
        const slPrice = d.p1.price - (d.p2.price - d.p1.price)
        const yS = coords.priceToY(slPrice)
        const profitColor = isLong ? '#22c55e' : '#ef4444'
        const lossColor   = isLong ? '#ef4444' : '#22c55e'
        return (
          <g key={key}>
            {/* TP zone */}
            {yT !== null && (
              <rect x={xE} y={Math.min(yE, yT)} width={xRight - xE}
                height={Math.abs(yE - yT)} fill={profitColor} fillOpacity={0.12} />
            )}
            {/* SL zone */}
            {yS !== null && (
              <rect x={xE} y={Math.min(yE, yS)} width={xRight - xE}
                height={Math.abs(yE - yS)} fill={lossColor} fillOpacity={0.12} />
            )}
            {/* Entry line */}
            <line x1={xE} y1={yE} x2={xRight} y2={yE} stroke="#3b82f6" strokeWidth={1.5} />
            <text x={xE + 4} y={yE - 4} fill="#3b82f6" fontSize={10}>Entry {d.p1.price.toFixed(2)}</text>
            {/* TP line */}
            {yT !== null && (
              <>
                <line x1={xE} y1={yT} x2={xRight} y2={yT} stroke={profitColor} strokeWidth={1.5} strokeDasharray="5,3" />
                <text x={xE + 4} y={yT - 4} fill={profitColor} fontSize={10}>TP {d.p2.price.toFixed(2)}</text>
              </>
            )}
            {/* SL line */}
            {yS !== null && (
              <>
                <line x1={xE} y1={yS} x2={xRight} y2={yS} stroke={lossColor} strokeWidth={1.5} strokeDasharray="5,3" />
                <text x={xE + 4} y={yS + 12} fill={lossColor} fontSize={10}>SL {slPrice.toFixed(2)}</text>
              </>
            )}
            <text x={xRight - 14} y={yE - 4} fill="#3b82f6" fontSize={12} style={{cursor:'pointer'}}
              onClick={() => onDelete(d.id)}>×</text>
          </g>
        )
      }
      case 'brush': {
        if (d.points.length < 2) return null
        const pts = d.points.map(p => {
          const x = coords.timeToX(p.time), y = coords.priceToY(p.price)
          if (x === null || y === null) return null
          return `${x},${y}`
        }).filter(Boolean)
        if (pts.length < 2) return null
        return (
          <g key={key}>
            <polyline points={pts.join(' ')} stroke={d.color} strokeWidth={2} fill="none"
              strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )
      }
    }
  }

  // ── Preview while placing ──────────────────────────────────────
  const renderPreview = () => {
    if (!mousePos || !activeTool) return null
    const { x: mx, y: my } = mousePos

    if (activeTool === 'hline') {
      return <line x1={0} y1={my} x2={width} y2={my} stroke={TOOL_COLOR.hline!} strokeWidth={1} strokeDasharray="4,2" opacity={0.6} />
    }
    if (activeTool === 'vline') {
      return <line x1={mx} y1={0} x2={mx} y2={height} stroke={TOOL_COLOR.vline!} strokeWidth={1} strokeDasharray="4,2" opacity={0.6} />
    }
    if (pendingPts.length === 1 && ['trendline','rectangle','fibonacci','longpos','shortpos'].includes(activeTool)) {
      const p1 = pendingPts[0]
      const x1 = coords.timeToX(p1.time), y1 = coords.priceToY(p1.price)
      if (x1 === null || y1 === null) return null
      if (activeTool === 'trendline') {
        return <line x1={x1} y1={y1} x2={mx} y2={my} stroke={TOOL_COLOR.trendline!} strokeWidth={1.5} opacity={0.7} />
      }
      if (activeTool === 'rectangle') {
        return <rect x={Math.min(x1,mx)} y={Math.min(y1,my)} width={Math.abs(mx-x1)} height={Math.abs(my-y1)}
          stroke={TOOL_COLOR.rectangle!} strokeWidth={1.5} fill={TOOL_COLOR.rectangle!} fillOpacity={0.06} opacity={0.7} />
      }
      if (activeTool === 'fibonacci') {
        return <line x1={x1} y1={y1} x2={mx} y2={my} stroke={TOOL_COLOR.fibonacci!} strokeWidth={1} strokeDasharray="3,2" opacity={0.6} />
      }
      if (activeTool === 'longpos' || activeTool === 'shortpos') {
        const isLong = activeTool === 'longpos'
        return (
          <>
            <line x1={x1} y1={y1} x2={mx} y2={y1} stroke="#3b82f6" strokeWidth={1.5} opacity={0.8} />
            <line x1={x1} y1={my} x2={mx} y2={my} stroke={isLong ? '#22c55e' : '#ef4444'} strokeWidth={1} strokeDasharray="4,2" opacity={0.7} />
            <rect x={x1} y={Math.min(y1,my)} width={mx-x1} height={Math.abs(my-y1)}
              fill={isLong ? '#22c55e' : '#ef4444'} fillOpacity={0.08} />
          </>
        )
      }
    }
    if ((activeTool === 'brush' || activeTool === 'path') && isBrushingRef.current && brushPts.current.length > 1) {
      const pts = brushPts.current.map(p => {
        const x = coords.timeToX(p.time), y = coords.priceToY(p.price)
        if (x === null || y === null) return null
        return `${x},${y}`
      }).filter(Boolean)
      if (pts.length > 1) {
        return <polyline points={pts.join(' ')} stroke={TOOL_COLOR.brush!} strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.7} />
      }
    }
    return null
  }

  return (
    <svg
      ref={svgRef}
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        cursor: activeTool ? 'crosshair' : 'default',
        pointerEvents: activeTool ? 'all' : 'none',
        zIndex: 5,
        overflow: 'visible',
      }}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      {drawings.map(d => renderDrawing(d))}
      {renderPreview()}
    </svg>
  )
}
