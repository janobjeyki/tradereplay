import { NextResponse } from 'next/server'
import { chargeSubscription, getSubscriptionAmount } from '@/lib/payments/click'
import { createAdminClient } from '@/lib/supabase/admin'
import { nextSubscriptionExpiry } from '@/lib/payments/subscription'

interface RenewalProfile {
  id: string
  subscription_price: number | null
  subscription_expires_at: string | null
  payment_method: 'humo' | 'uzcard' | null
  card_last4: string | null
  card_holder_name: string | null
  card_exp_month: number | null
  card_exp_year: number | null
}

function isAuthorizedCron(request: Request) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`)
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { data: dueProfiles, error: profileError } = await admin
    .from('profiles')
    .select('id, subscription_price, subscription_expires_at, payment_method, card_last4, card_holder_name, card_exp_month, card_exp_year')
    .eq('subscription_status', 'active')
    .not('subscription_expires_at', 'is', null)
    .lte('subscription_expires_at', now)
    .limit(100)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  const results = []
  for (const profile of (dueProfiles ?? []) as RenewalProfile[]) {
    const { data: latestAuthorized, error: txLookupError } = await admin
      .from('subscription_transactions')
      .select('provider_card_token, provider_card_id, payment_method, card_last4, card_holder_name, card_exp_month, card_exp_year')
      .eq('user_id', profile.id)
      .eq('status', 'authorized')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (txLookupError || !latestAuthorized?.provider_card_token) {
      await admin
        .from('profiles')
        .update({ subscription_status: 'inactive' })
        .eq('id', profile.id)
      results.push({ userId: profile.id, status: 'failed', reason: txLookupError?.message || 'No saved Click card token' })
      continue
    }

    const amount = Number(profile.subscription_price || getSubscriptionAmount())
    const token = latestAuthorized.provider_card_token
    const paymentMethod = latestAuthorized.payment_method || profile.payment_method
    const cardLast4 = latestAuthorized.card_last4 || profile.card_last4 || 'card'

    if (paymentMethod !== 'humo' && paymentMethod !== 'uzcard') {
      await admin
        .from('profiles')
        .update({ subscription_status: 'inactive' })
        .eq('id', profile.id)
      results.push({ userId: profile.id, status: 'failed', reason: 'No saved payment method' })
      continue
    }

    const { data: renewalTx, error: insertError } = await admin
      .from('subscription_transactions')
      .insert({
        user_id: profile.id,
        amount,
        currency: 'UZS',
        payment_method: paymentMethod,
        card_last4: cardLast4,
        card_holder_name: latestAuthorized.card_holder_name || profile.card_holder_name,
        card_exp_month: latestAuthorized.card_exp_month ?? profile.card_exp_month,
        card_exp_year: latestAuthorized.card_exp_year ?? profile.card_exp_year,
        provider_card_token: token,
        status: 'pending',
        reference: `renewal:${profile.id}:${Date.now()}`,
      })
      .select('id')
      .single()

    if (insertError || !renewalTx) {
      results.push({ userId: profile.id, status: 'failed', reason: insertError?.message || 'Could not create renewal transaction' })
      continue
    }

    try {
      const payment = await chargeSubscription(token, renewalTx.id, amount)
      const renewedAt = new Date()
      const { error: updateTxError } = await admin
        .from('subscription_transactions')
        .update({
          status: 'authorized',
          provider_card_id: payment.paymentId || latestAuthorized.provider_card_id,
          provider_card_token: token,
        })
        .eq('id', renewalTx.id)

      if (updateTxError) throw new Error(updateTxError.message)

      const { error: updateProfileError } = await admin
        .from('profiles')
        .update({
          subscription_status: 'active',
          subscription_price: amount,
          payment_method: paymentMethod,
          card_last4: cardLast4,
          payment_authorized_at: renewedAt.toISOString(),
          subscription_expires_at: nextSubscriptionExpiry(renewedAt),
        })
        .eq('id', profile.id)

      if (updateProfileError) throw new Error(updateProfileError.message)
      results.push({ userId: profile.id, status: 'renewed' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Renewal payment failed'
      await admin
        .from('subscription_transactions')
        .update({ status: 'failed' })
        .eq('id', renewalTx.id)
      await admin
        .from('profiles')
        .update({ subscription_status: 'inactive' })
        .eq('id', profile.id)
      results.push({ userId: profile.id, status: 'failed', reason: message })
    }
  }

  return NextResponse.json({
    ok: true,
    checked: dueProfiles?.length ?? 0,
    results,
  })
}
