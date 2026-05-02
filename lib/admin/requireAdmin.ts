// Server-only — only import this from API routes and Server Components,
// never from proxy.ts or any Edge runtime file.
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from './auth'

export async function requireAdminUser() {
  const db = await createClient()
  const { data: auth } = await db.auth.getUser()
  const user = auth.user

  if (!user) return { user: null, error: 'Unauthorized', status: 401 }
  if (!isAdminEmail(user.email)) return { user: null, error: 'Forbidden', status: 403 }
  return { user, error: null, status: 200 }
}
