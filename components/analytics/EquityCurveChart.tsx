'use client'
import { useEffect, useRef } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import type { EquityPoint } from '@/types'

export function EquityCurveChart({ equity, startCapital }: { equity: EquityPoint[]; startCapital: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { theme } = useTheme()

  useEffect(() => {
    const canvasEl = canvasRef.current
    if (!canvasEl || equity.length < 2) return
    let disposed = false

    const draw = () => {
      const canvas = canvasRef.current
      if (!canvas || disposed) return
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      canvas.width = rect.width * dpr; canvas.height = rect.height * dpr
      const ctx = canvas.getContext('2d')!
      ctx.scale(dpr, dpr)
      const W = rect.width, H = rect.height
      const pad = { t:10, r:15, b:26, l:72 }
      const cW = W-pad.l-pad.r, cH = H-pad.t-pad.b
      const vals = equity.map(e => e.value)
      const minV = Math.min(...vals), maxV = Math.max(...vals)
      const range = (maxV-minV) || 1
      const px = (i:number) => pad.l + (i/(equity.length-1))*cW
      const py = (v:number) => pad.t + cH - ((v-minV)/range)*cH
      const isProfit = equity[equity.length-1].value >= startCapital
      const lc = isProfit ? '#22c55e' : '#ef4444'
      const isDark = theme === 'dark'
      const bgC    = isDark ? '#0b1120' : '#ffffff'
      const gridC  = isDark ? '#1e2d45' : '#e2eaf6'
      const textC  = isDark ? '#4a6280' : '#7090b0'

      ctx.fillStyle = bgC; ctx.fillRect(0, 0, W, H)
      for (let i = 0; i <= 4; i++) {
        const v = minV + range*(i/4), y = py(v)
        ctx.strokeStyle = gridC; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W-pad.r, y); ctx.stroke()
        ctx.fillStyle = textC; ctx.font = '10px monospace'; ctx.textAlign = 'right'
        ctx.fillText('$'+v.toFixed(0), pad.l-5, y+4)
      }
      ctx.beginPath()
      equity.forEach((e,i) => i===0 ? ctx.moveTo(px(i),py(e.value)) : ctx.lineTo(px(i),py(e.value)))
      ctx.lineTo(px(equity.length-1), pad.t+cH)
      ctx.lineTo(pad.l, pad.t+cH); ctx.closePath()
      ctx.globalAlpha = 0.15; ctx.fillStyle = lc; ctx.fill(); ctx.globalAlpha = 1
      ctx.strokeStyle = lc; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'
      ctx.beginPath()
      equity.forEach((e,i) => i===0 ? ctx.moveTo(px(i),py(e.value)) : ctx.lineTo(px(i),py(e.value)))
      ctx.stroke()
    }
    draw()
    const ro = new ResizeObserver(() => draw())
    ro.observe(canvasEl)
    return () => {
      disposed = true
      ro.disconnect()
    }
  }, [equity, startCapital, theme])

  return <canvas ref={canvasRef} style={{width:'100%', height:'180px', display:'block'}}/>
}
