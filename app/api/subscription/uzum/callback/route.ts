import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthorizationStatus } from '@/lib/payments/uzum'
import { activateSubscriptionForTransaction } from '@/lib/payments/subscription'

interface UzumCallbackPayload {
  orderId?: string
}

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.UZUM_CHECKOUT_CALLBACK_SECRET?.trim()
    if (secret) {
      const header = req.headers.get('x-api-key')?.trim()
      if (header !== secret) {
        return NextResponse.json({ error: 'Unauthorized callback' }, { status: 401 })
      }
    }

    const payload = (await req.json()) as UzumCallbackPayload
    const reference = String(payload.orderId ?? '').trim()

    if (!reference) {
      return NextResponse.json({ error: 'Missing order id' }, { status: 400 })
    }

    const db = createAdminClient()
    const { data: transaction, error: txError } = await db
      .from('subscription_transactions')
      .select('id, user_id, payment_method, card_last4, card_holder_name, card_exp_month, card_exp_year, reference')
      .eq('reference', reference)
      .maybeSingle()

    if (txError) {
      return NextResponse.json({ error: txError.message }, { status: 400 })
    }
    if (!transaction) {
      return NextResponse.json({ error: 'Authorization not found' }, { status: 404 })
    }

    const providerStatus = await getAuthorizationStatus(reference)

    if (providerStatus.isAuthorized) {
      await activateSubscriptionForTransaction(db, {
        ...transaction,
        card_last4: providerStatus.last4 || transaction.card_last4,
      }, providerStatus.bindingId)
    } else if (providerStatus.isFailed) {
      await db
        .from('subscription_transactions')
        .update({
          status: 'failed',
          card_last4: providerStatus.last4 || transaction.card_last4,
          provider_card_id: providerStatus.bindingId || null,
        })
        .eq('id', transaction.id)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process callback'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
