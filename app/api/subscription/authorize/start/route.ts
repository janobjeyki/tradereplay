import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { startAuthorization, type CardNetwork } from '@/lib/payments/click'
import { lookupPromoCode } from '@/lib/payments/promo'
import { START_PLAN_KEY } from '@/lib/payments/plans'

export async function POST(req: NextRequest) {
  try {
    const db = await createClient()
    const { data: auth } = await db.auth.getUser()
    const user = auth.user

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const paymentMethod = body.paymentMethod as CardNetwork
    const cardNumber = String(body.cardNumber ?? '')
    const cardExpire = String(body.cardExpire ?? '')
    const promoCodeRaw = String(body.promoCode ?? '').trim()
    const product = String(body.product ?? START_PLAN_KEY).trim()

    if (!['humo', 'uzcard'].includes(paymentMethod)) {
      return NextResponse.json({ error: 'Unsupported payment method' }, { status: 400 })
    }

    const authorization = await startAuthorization(paymentMethod, cardNumber, cardExpire)

    let amount = authorization.verificationAmount
    let promoCodeId: string | null = null
    let discountPercent = 0

    if (promoCodeRaw) {
      const admin = createAdminClient()
      const { promoCode, discountedAmount } = await lookupPromoCode(
        admin,
        promoCodeRaw,
        product,
        authorization.verificationAmount,
        { id: user.id, email: user.email ?? null },
      )
      amount = discountedAmount
      promoCodeId = promoCode.id
      discountPercent = promoCode.discount_percent
    }

    const { error: txError } = await db.from('subscription_transactions').insert({
      user_id: user.id,
      amount,
      currency: authorization.verificationCurrency,
      payment_method: paymentMethod,
      card_last4: authorization.last4,
      card_holder_name: null,
      card_exp_month: authorization.cardExpMonth,
      card_exp_year: authorization.cardExpYear,
      provider_card_id: null,
      provider_card_token: authorization.reference,
      status: 'pending',
      reference: authorization.reference,
      promo_code_id: promoCodeId,
    })

    if (txError) {
      return NextResponse.json({ error: txError.message }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      reference: authorization.reference,
      verificationAmount: amount,
      verificationCurrency: authorization.verificationCurrency,
      verificationPhone: authorization.verificationPhone,
      verificationWaitMs: authorization.verificationWaitMs,
      discountPercent,
      promoApplied: Boolean(promoCodeId),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start authorization'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
