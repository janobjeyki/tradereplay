import type { PaymentMethod } from '@/lib/payments/uzum'

export interface PendingAuthorizationRecord {
  id: string
  user_id: string
  payment_method: PaymentMethod
  card_last4: string
  card_holder_name: string | null
  card_exp_month: number | null
  card_exp_year: number | null
  reference: string
}

export async function activateSubscriptionForTransaction(
  db: any,
  transaction: PendingAuthorizationRecord,
  bindingId?: string
) {
  const now = new Date().toISOString()

  const { error: txError } = await db
    .from('subscription_transactions')
    .update({
      status: 'authorized',
      provider_card_id: bindingId ?? transaction.reference,
      provider_card_token: null,
    })
    .eq('id', transaction.id)

  if (txError) {
    throw new Error(txError.message)
  }

  const { error: profileError } = await db
    .from('profiles')
    .update({
      subscription_status: 'active',
      subscription_plan: 'starter',
      subscription_price: 0,
      payment_method: transaction.payment_method,
      card_holder_name: transaction.card_holder_name,
      card_last4: transaction.card_last4,
      card_exp_month: transaction.card_exp_month,
      card_exp_year: transaction.card_exp_year,
      payment_authorized_at: now,
      subscription_started_at: now,
      subscription_expires_at: null,
    })
    .eq('id', transaction.user_id)

  if (profileError) {
    throw new Error(profileError.message)
  }
}
