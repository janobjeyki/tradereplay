import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  try {
    const db = await createClient()
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
      .select('status, reference, payment_method, created_at')
      .eq('user_id', user.id)
      .eq('reference', reference)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (!transaction) {
      return NextResponse.json({ error: 'Authorization not found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, transaction })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch authorization status'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
