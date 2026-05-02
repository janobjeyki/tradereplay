import { NextRequest, NextResponse } from 'next/server'
import { DUKASCOPY_MULTIPLIER } from '@/lib/marketData'
import { symbolExistsInStorage } from '@/lib/marketStorage'

export async function POST(req: NextRequest) {
  const symbol = ((await req.json())?.symbol ?? '').toUpperCase()

  if (!(symbol in DUKASCOPY_MULTIPLIER)) {
    return NextResponse.json({ error: 'Unsupported symbol' }, { status: 400 })
  }

  const exists = await symbolExistsInStorage(symbol)
  if (exists) {
    return NextResponse.json({ ok: true, downloaded: true })
  }

  return NextResponse.json(
    { ok: false, downloaded: false, error: 'Data not synced yet. Ask admin to run Sync All Market Data.' },
    { status: 409 },
  )
}
