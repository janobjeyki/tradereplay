import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthorizationStatus } from '@/lib/payments/uzum'
import { activateSubscriptionForTransaction } from '@/lib/payments/subscription'

export async function GET(req: NextRequest) {
  try {
    const db = createClient()
    const { data: auth } = await db.auth.getUser()
    const user = auth.user

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const reference = req.nextUrl.searchParams.get('reference')?.trim()
    if (!reference) {
      return NextResponse.json({ error: 'Reference is required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: transaction, error } = await admin
      .from('subscription_transactions')
      .select('id, user_id, status, reference, payment_method, created_at, card_last4, card_holder_name, card_exp_month, card_exp_year, provider_card_id')
      .eq('user_id', user.id)
      .eq('reference', reference)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (!transaction) {
      return NextResponse.json({ error: 'Authorization not found' }, { status: 404 })
    }

    if (transaction.status === 'pending') {
      const providerStatus = await getAuthorizationStatus(reference)

      if (providerStatus.isAuthorized) {
        await activateSubscriptionForTransaction(admin, {
          id: transaction.id,
          user_id: transaction.user_id,
          payment_method: transaction.payment_method,
          card_last4: providerStatus.last4 || transaction.card_last4,
          card_holder_name: transaction.card_holder_name,
          card_exp_month: transaction.card_exp_month,
          card_exp_year: transaction.card_exp_year,
          reference: transaction.reference,
        }, providerStatus.bindingId)
      } else if (providerStatus.isFailed) {
        await admin
          .from('subscription_transactions')
          .update({
            status: 'failed',
            card_last4: providerStatus.last4 || transaction.card_last4,
            provider_card_id: providerStatus.bindingId || transaction.provider_card_id,
          })
          .eq('id', transaction.id)
      }
    }

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
    const message = error instanceof Error ? error.message : 'Failed to fetch authorization status'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
