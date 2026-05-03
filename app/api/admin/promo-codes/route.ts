import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { requireAdminUser } from '@/lib/admin/requireAdmin'
import { createAdminClient } from '@/lib/supabase/admin'
import { PLANS, START_PLAN_KEY } from '@/lib/payments/plans'

const VALID_PRODUCTS = new Set(PLANS.map(p => p.key))

function generateCode() {
  return randomBytes(5).toString('hex').toUpperCase()
}

export async function GET() {
  const adminAuth = await requireAdminUser()
  if (adminAuth.error) {
    return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status })
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('promo_codes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ promoCodes: data || [] })
}

export async function POST(req: NextRequest) {
  const adminAuth = await requireAdminUser()
  if (adminAuth.error) {
    return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status })
  }

  const body = await req.json().catch(() => ({}))
  const product = String(body.product || START_PLAN_KEY).trim()
  const discountPercent = Number(body.discountPercent)
  const rawEmail = typeof body.assignedEmail === 'string' ? body.assignedEmail.trim() : ''
  const assignedEmail = rawEmail.length > 0 ? rawEmail.toLowerCase() : null

  if (!VALID_PRODUCTS.has(product as typeof START_PLAN_KEY)) {
    return NextResponse.json({ error: 'Unsupported product' }, { status: 400 })
  }
  if (!Number.isFinite(discountPercent) || discountPercent < 1 || discountPercent > 100) {
    return NextResponse.json({ error: 'Discount percent must be between 1 and 100' }, { status: 400 })
  }
  if (assignedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(assignedEmail)) {
    return NextResponse.json({ error: 'Assigned email is not a valid address' }, { status: 400 })
  }

  const db = createAdminClient()

  let lastError: string | null = null
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateCode()
    const { data, error } = await db
      .from('promo_codes')
      .insert({
        code,
        product,
        discount_percent: Math.round(discountPercent),
        assigned_email: assignedEmail,
        created_by: adminAuth.user?.id ?? null,
      })
      .select('*')
      .single()

    if (!error) {
      return NextResponse.json({ promoCode: data })
    }

    if (!/duplicate key|unique/i.test(error.message)) {
      lastError = error.message
      break
    }
    lastError = error.message
  }

  return NextResponse.json({ error: lastError || 'Failed to create promo code' }, { status: 500 })
}

export async function DELETE(req: NextRequest) {
  const adminAuth = await requireAdminUser()
  if (adminAuth.error) {
    return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status })
  }

  const id = req.nextUrl.searchParams.get('id')?.trim()
  if (!id) {
    return NextResponse.json({ error: 'Promo code id is required' }, { status: 400 })
  }

  const db = createAdminClient()
  const { error } = await db.from('promo_codes').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
