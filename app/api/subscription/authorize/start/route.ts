import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { startAuthorization, type PaymentMethod } from '@/lib/payments/uzum'

export async function POST(req: NextRequest) {
  try {
    const db = createClient()
    const { data: auth } = await db.auth.getUser()
    const user = auth.user

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const paymentMethod = body.paymentMethod as PaymentMethod

    if (!['humo', 'uzcard', 'visa'].includes(paymentMethod)) {
      return NextResponse.json({ error: 'Unsupported payment method' }, { status: 400 })
    }

    const authorization = await startAuthorization(paymentMethod, user.id)
    const { error: txError } = await db.from('subscription_transactions').insert({
      user_id: user.id,
      amount: authorization.verificationAmount,
      currency: authorization.verificationCurrency,
      payment_method: paymentMethod,
      card_last4: 'pending',
      card_holder_name: null,
      card_exp_month: null,
      card_exp_year: null,
      provider_card_id: null,
      status: 'pending',
      reference: authorization.reference,
    })

    if (txError) {
      return NextResponse.json({ error: txError.message }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      reference: authorization.reference,
      redirectUrl: authorization.redirectUrl,
      verificationAmount: authorization.verificationAmount,
      verificationCurrency: authorization.verificationCurrency,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start authorization'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
