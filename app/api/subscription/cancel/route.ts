import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { unbindCard } from '@/lib/payments/uzum'

export async function POST() {
  try {
    const sessionDb = createClient()
    const { data: auth } = await sessionDb.auth.getUser()
    const user = auth.user

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = createAdminClient()
    const { data: latestAuthorized, error: txError } = await db
      .from('subscription_transactions')
      .select('id, provider_card_id')
      .eq('user_id', user.id)
      .eq('status', 'authorized')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (txError) {
      return NextResponse.json({ error: txError.message }, { status: 400 })
    }

    if (latestAuthorized?.provider_card_id) {
      await unbindCard(latestAuthorized.provider_card_id)
      await db
        .from('subscription_transactions')
        .update({ status: 'canceled' })
        .eq('id', latestAuthorized.id)
    }

    const { error: profileError } = await db
      .from('profiles')
      .update({ subscription_status: 'canceled' })
      .eq('id', user.id)

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to cancel subscription'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
