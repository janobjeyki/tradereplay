import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const adminAuth = await requireAdminUser()
  if (adminAuth.error) {
    return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status })
  }

  const query = req.nextUrl.searchParams.get('query')?.trim().toLowerCase() || ''
  const db = createAdminClient()
  const { data: userPage, error: usersError } = await db.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 })
  }

  const users = (userPage.users || [])
    .filter(user => {
      if (!query) return true
      const email = user.email?.toLowerCase() || ''
      return email.includes(query) || user.id.toLowerCase().includes(query)
    })
    .slice(0, 50)

  const ids = users.map(user => user.id)
  if (ids.length === 0) {
    return NextResponse.json({ users: [] })
  }

  const [{ data: profiles }, { data: sessions }, { data: transactions }] = await Promise.all([
    db.from('profiles').select('*').in('id', ids),
    db.from('sessions').select('user_id').in('user_id', ids),
    db.from('subscription_transactions').select('*').in('user_id', ids).order('created_at', { ascending: false }),
  ])

  const profilesById = new Map((profiles || []).map(profile => [profile.id, profile]))
  const sessionCounts = new Map<string, number>()
  for (const session of sessions || []) {
    sessionCounts.set(session.user_id, (sessionCounts.get(session.user_id) || 0) + 1)
  }
  const transactionsByUser = new Map<string, any[]>()
  for (const transaction of transactions || []) {
    const existing = transactionsByUser.get(transaction.user_id) || []
    existing.push(transaction)
    transactionsByUser.set(transaction.user_id, existing)
  }

  return NextResponse.json({
    users: users.map(user => ({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      profile: profilesById.get(user.id) || null,
      sessions_count: sessionCounts.get(user.id) || 0,
      transactions: transactionsByUser.get(user.id) || [],
    })),
  })
}
