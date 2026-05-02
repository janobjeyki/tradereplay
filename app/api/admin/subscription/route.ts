import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/admin/requireAdmin'
import { createAdminClient } from '@/lib/supabase/admin'

type AdminAction = 'gift' | 'extend' | 'cancel'

function addMonths(date: Date, months: number) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

export async function POST(req: NextRequest) {
  const adminAuth = await requireAdminUser()
  if (adminAuth.error) {
    return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status })
  }

  const body = await req.json()
  const userId = String(body.userId || '').trim()
  const action = String(body.action || '').trim() as AdminAction
  const months = Number(body.months || 1)
  const lifetime = Boolean(body.lifetime)

  if (!userId) {
    return NextResponse.json({ error: 'User id is required' }, { status: 400 })
  }
  if (!['gift', 'extend', 'cancel'].includes(action)) {
    return NextResponse.json({ error: 'Unsupported admin action' }, { status: 400 })
  }
  if ((action === 'gift' || action === 'extend') && !lifetime && (!Number.isFinite(months) || months < 1 || months > 120)) {
    return NextResponse.json({ error: 'Months must be between 1 and 120' }, { status: 400 })
  }

  const db = createAdminClient()
  const now = new Date()
  let update: Record<string, unknown>

  if (action === 'cancel') {
    update = {
      subscription_status: 'canceled',
      subscription_expires_at: now.toISOString(),
    }
  } else if (action === 'gift') {
    update = {
      subscription_status: 'active',
      subscription_plan: 'starter',
      subscription_price: 0,
      subscription_started_at: now.toISOString(),
      subscription_expires_at: lifetime ? null : addMonths(now, months).toISOString(),
    }
  } else {
    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('subscription_expires_at')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    const currentExpiry = profile?.subscription_expires_at ? new Date(profile.subscription_expires_at) : now
    const base = currentExpiry > now ? currentExpiry : now
    update = {
      subscription_status: 'active',
      subscription_plan: 'starter',
      subscription_expires_at: addMonths(base, months).toISOString(),
    }
  }

  const { data: updatedProfile, error: updateError } = await db
    .from('profiles')
    .update(update)
    .eq('id', userId)
    .select('*')
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    profile: updatedProfile,
    action,
    admin: adminAuth.user?.email,
  })
}
