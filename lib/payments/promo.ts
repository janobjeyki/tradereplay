import type { SupabaseClient } from '@supabase/supabase-js'
import type { PromoCode } from '@/types'

export interface PromoLookupResult {
  promoCode: PromoCode
  discountedAmount: number
}

export async function lookupPromoCode(
  db: SupabaseClient,
  rawCode: string,
  product: string,
  baseAmount: number,
  user: { id: string; email: string | null | undefined },
): Promise<PromoLookupResult> {
  const code = rawCode.trim().toUpperCase()
  if (!code) {
    throw new Error('Promo code is required.')
  }

  const { data, error } = await db
    .from('promo_codes')
    .select('*')
    .eq('code', code)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  if (!data) {
    throw new Error('Promo code not found.')
  }

  const promoCode = data as PromoCode

  if (promoCode.product !== product) {
    throw new Error('This promo code is for a different plan.')
  }
  if (promoCode.used_at) {
    throw new Error('This promo code has already been used.')
  }
  if (promoCode.assigned_email) {
    const userEmail = (user.email || '').trim().toLowerCase()
    if (!userEmail || userEmail !== promoCode.assigned_email.toLowerCase()) {
      throw new Error('This promo code is restricted to a different account.')
    }
  }

  const discountedAmount = Math.max(
    0,
    Math.round(baseAmount * (1 - promoCode.discount_percent / 100)),
  )

  return { promoCode, discountedAmount }
}
