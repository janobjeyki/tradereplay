import type { CardNetwork } from '@/lib/payments/click'

const SUBSCRIPTION_INTERVAL_MONTHS = 1

export interface PendingAuthorizationRecord {
  id: string
  user_id: string
  amount: number
  payment_method: CardNetwork
  card_last4: string
  card_holder_name: string | null
  card_exp_month: number | null
  card_exp_year: number | null
  reference: string
  provider_card_token?: string | null
}

export function nextSubscriptionExpiry(from = new Date()) {
  const next = new Date(from)
  next.setMonth(next.getMonth() + SUBSCRIPTION_INTERVAL_MONTHS)
  return next.toISOString()
}

export async function activateSubscriptionForTransaction(
  db: any,
  transaction: PendingAuthorizationRecord,
  bindingId?: string,
  bindingToken?: string
) {
  const now = new Date().toISOString()
  const expiresAt = nextSubscriptionExpiry()

  const { error: txError } = await db
    .from('subscription_transactions')
    .update({
      status: 'authorized',
      provider_card_id: bindingId ?? transaction.reference,
      provider_card_token: bindingToken ?? bindingId ?? transaction.provider_card_token ?? transaction.reference,
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
      subscription_price: transaction.amount,
      payment_method: transaction.payment_method,
      card_holder_name: transaction.card_holder_name,
      card_last4: transaction.card_last4,
      card_exp_month: transaction.card_exp_month,
      card_exp_year: transaction.card_exp_year,
      payment_authorized_at: now,
      subscription_started_at: now,
      subscription_expires_at: expiresAt,
    })
    .eq('id', transaction.user_id)

  if (profileError) {
    throw new Error(profileError.message)
  }
}
