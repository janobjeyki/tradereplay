import { NextRequest, NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'
import { DUKASCOPY_MULTIPLIER, m1Filename } from '@/lib/marketData'

export async function POST(req: NextRequest) {
  const symbol = ((await req.json())?.symbol ?? '').toUpperCase()
  if (!(symbol in DUKASCOPY_MULTIPLIER)) {
    return NextResponse.json({ error: 'Unsupported symbol' }, { status: 400 })
  }

  const filePath = path.join(process.cwd(), 'public', 'data', m1Filename(symbol))
  try {
    await fs.access(filePath)
    return NextResponse.json({ ok: true, downloaded: true, cached: true })
  } catch {
    return NextResponse.json(
      {
        ok: false,
        downloaded: false,
        cached: false,
        error: 'Data not synced yet. Ask admin to run Sync All Market Data.',
      },
      { status: 409 },
    )
  }
}
