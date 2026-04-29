import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { startAuthorization, type CardNetwork } from '@/lib/payments/click'

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

    if (!['humo', 'uzcard'].includes(paymentMethod)) {
      return NextResponse.json({ error: 'Unsupported payment method' }, { status: 400 })
    }

    const authorization = await startAuthorization(paymentMethod, cardNumber, cardExpire)
    const { error: txError } = await db.from('subscription_transactions').insert({
      user_id: user.id,
      amount: authorization.verificationAmount,
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
    })

    if (txError) {
      return NextResponse.json({ error: txError.message }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      reference: authorization.reference,
      verificationAmount: authorization.verificationAmount,
      verificationCurrency: authorization.verificationCurrency,
      verificationPhone: authorization.verificationPhone,
      verificationWaitMs: authorization.verificationWaitMs,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start authorization'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
