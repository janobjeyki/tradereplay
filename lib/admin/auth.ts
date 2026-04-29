import { createClient } from '@/lib/supabase/server'

const DEFAULT_ADMIN_EMAILS = ['bekhruzjke@gmail.com']

export function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || DEFAULT_ADMIN_EMAILS.join(','))
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminEmail(email?: string | null) {
  if (!email) return false
  return getAdminEmails().includes(email.toLowerCase())
}

export async function requireAdminUser() {
  const db = await createClient()
  const { data: auth } = await db.auth.getUser()
  const user = auth.user

  if (!user) {
    return { user: null, error: 'Unauthorized', status: 401 }
  }

  if (!isAdminEmail(user.email)) {
    return { user: null, error: 'Forbidden', status: 403 }
  }

  return { user, error: null, status: 200 }
}
