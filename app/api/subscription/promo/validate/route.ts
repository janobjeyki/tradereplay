import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { lookupPromoCode } from '@/lib/payments/promo'
import { getSubscriptionAmount } from '@/lib/payments/click'
import { START_PLAN_KEY, START_PLAN_PRICE_UZS } from '@/lib/payments/plans'

export async function POST(req: NextRequest) {
  try {
    const db = await createClient()
    const { data: auth } = await db.auth.getUser()
    const user = auth.user
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const code = String(body.code ?? '').trim()
    const product = String(body.product ?? START_PLAN_KEY).trim()
    if (!code) {
      return NextResponse.json({ error: 'Promo code is required.' }, { status: 400 })
    }

    const baseAmount = getSubscriptionAmount() || START_PLAN_PRICE_UZS
    const admin = createAdminClient()
    const { promoCode, discountedAmount } = await lookupPromoCode(
      admin,
      code,
      product,
      baseAmount,
      { id: user.id, email: user.email ?? null },
    )

    return NextResponse.json({
      ok: true,
      code: promoCode.code,
      product: promoCode.product,
      discountPercent: promoCode.discount_percent,
      baseAmount,
      discountedAmount,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to validate promo code'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
