import { NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/admin/requireAdmin'
import { dukascopyDayUrl, decodeLZ4Frame, parseM1Records, DUKASCOPY_MULTIPLIER } from '@/lib/marketData'

export const maxDuration = 30

export async function GET() {
  const adminAuth = await requireAdminUser()
  if (adminAuth.error) return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status })

  // Test: fetch one known trading day EURUSD 2024-01-02
  const symbol = 'EURUSD'
  const day    = new Date('2024-01-02T00:00:00Z')
  const mult   = DUKASCOPY_MULTIPLIER[symbol]
  const url    = dukascopyDayUrl(symbol, day)

  const result: Record<string, unknown> = { url }

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
    result.httpStatus = res.status
    result.ok         = res.ok

    if (!res.ok) {
      result.error = `HTTP ${res.status}`
      return NextResponse.json(result)
    }

    const ab = await res.arrayBuffer()
    result.byteLength = ab.byteLength

    if (!ab.byteLength) {
      result.error = 'Empty response — Dukascopy returned no data for this day'
      return NextResponse.json(result)
    }

    const decoded = decodeLZ4Frame(Buffer.from(ab))
    result.decodedBytes = decoded.length

    const candles = parseM1Records(decoded, mult, day.getTime())
    result.candleCount = candles.length
    result.firstCandle = candles[0]
    result.lastCandle  = candles[candles.length - 1]
    result.success     = true
  } catch (err) {
    result.error = String(err)
  }

  return NextResponse.json(result)
}
