'use client'
import { useEffect, useRef } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import type { DayStats } from '@/types'
import { WEEKDAYS } from '@/lib/utils'

export function DayPerformanceChart({ byDay }: { byDay: Record<string, DayStats> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { theme } = useTheme()

  useEffect(() => {
    const canvasEl = canvasRef.current
    if (!canvasEl) return
    let disposed = false

    const draw = () => {
      const canvas = canvasRef.current
      if (!canvas || disposed) return
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      canvas.width = rect.width*dpr; canvas.height = rect.height*dpr
      const ctx = canvas.getContext('2d')!
      ctx.scale(dpr, dpr)
      const W = rect.width, H = rect.height
      const pad = { t:24, r:20, b:32, l:68 }
      const cW = W-pad.l-pad.r, cH = H-pad.t-pad.b
      const vals = WEEKDAYS.map(d => byDay[d]?.pnl ?? 0)
      const maxAbs = Math.max(...vals.map(Math.abs), 1)
      const slotW = cW / WEEKDAYS.length, barW = slotW * 0.55, midY = pad.t + cH/2
      const isDark = theme === 'dark'
      const bgC   = isDark ? '#0b1120' : '#ffffff'
      const gridC = isDark ? '#1e2d45' : '#e2eaf6'
      const textC = isDark ? '#4a6280' : '#7090b0'

      ctx.fillStyle = bgC; ctx.fillRect(0, 0, W, H)
      ctx.strokeStyle = gridC; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(pad.l, midY); ctx.lineTo(W-pad.r, midY); ctx.stroke()

      WEEKDAYS.forEach((d, i) => {
        const x = pad.l + i*slotW + slotW/2, v = vals[i]
        const barH = (Math.abs(v)/maxAbs) * (cH/2) * 0.88
        ctx.fillStyle = v >= 0 ? '#22c55e' : '#ef4444'; ctx.globalAlpha = 0.82
        if (v >= 0) ctx.fillRect(x-barW/2, midY-barH, barW, barH)
        else        ctx.fillRect(x-barW/2, midY,       barW, barH)
        ctx.globalAlpha = 1
        ctx.fillStyle = textC; ctx.font = '11px sans-serif'; ctx.textAlign = 'center'
        ctx.fillText(d, x, H-pad.b+14)
        if (v !== 0) {
          ctx.fillStyle = v>=0 ? '#22c55e' : '#ef4444'; ctx.font = 'bold 10px monospace'
          ctx.fillText((v>=0?'+':'')+v.toFixed(0), x, v>=0 ? midY-barH-5 : midY+barH+13)
        }
      })
    }
    draw()
    const ro = new ResizeObserver(() => draw())
    ro.observe(canvasEl)
    return () => {
      disposed = true
      ro.disconnect()
    }
  }, [byDay, theme])

  return <canvas ref={canvasRef} style={{width:'100%', height:'150px', display:'block'}}/>
}
