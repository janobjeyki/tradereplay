import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { chargeSubscription, verifyAuthorization } from '@/lib/payments/click'
import { activateSubscriptionForTransaction } from '@/lib/payments/subscription'

export async function POST(req: NextRequest) {
  try {
    const sessionDb = await createClient()
    const { data: auth } = await sessionDb.auth.getUser()
    const user = auth.user

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const reference = String(body.reference ?? '').trim()
    const code = String(body.code ?? '').trim()

    if (!reference) {
      return NextResponse.json({ error: 'Reference is required' }, { status: 400 })
    }
    if (!code) {
      return NextResponse.json({ error: 'Verification code is required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: transaction, error } = await admin
      .from('subscription_transactions')
      .select('id, user_id, amount, status, reference, payment_method, card_last4, card_holder_name, card_exp_month, card_exp_year, provider_card_token')
      .eq('user_id', user.id)
      .eq('reference', reference)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (!transaction) {
      return NextResponse.json({ error: 'Authorization not found' }, { status: 404 })
    }

    const providerStatus = await verifyAuthorization(reference, code)
    const payment = await chargeSubscription(reference, transaction.id, Number(transaction.amount || 0))
    await activateSubscriptionForTransaction(admin, {
      id: transaction.id,
      user_id: transaction.user_id,
      amount: Number(transaction.amount || 0),
      payment_method: transaction.payment_method,
      card_last4: providerStatus.last4 || transaction.card_last4,
      card_holder_name: transaction.card_holder_name,
      card_exp_month: transaction.card_exp_month,
      card_exp_year: transaction.card_exp_year,
      reference: transaction.reference,
      provider_card_token: providerStatus.token || transaction.provider_card_token,
    }, payment.paymentId || providerStatus.bindingId, providerStatus.token)

    const { data: refreshed, error: refreshedError } = await admin
      .from('subscription_transactions')
      .select('status, reference, payment_method, created_at')
      .eq('user_id', user.id)
      .eq('reference', reference)
      .maybeSingle()

    if (refreshedError) {
      return NextResponse.json({ error: refreshedError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, transaction: refreshed })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to verify card'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
