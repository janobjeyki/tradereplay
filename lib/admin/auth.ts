// Pure helper — safe to import from both server and client components
const DEFAULT_ADMIN_EMAILS = ['bekhruzjke@gmail.com']

export function getAdminEmails(): string[] {
  // On the server, ADMIN_EMAILS env var overrides the default.
  // On the client this env var is undefined, so we fall back to the default.
  return (process.env.ADMIN_EMAILS || DEFAULT_ADMIN_EMAILS.join(','))
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false
  return getAdminEmails().includes(email.toLowerCase())
}

// ── Server-only: requires Supabase session ───────────────────────────────────
// Import this only in API routes and Server Components, not in client components.
export async function requireAdminUser() {
  // Dynamic import keeps the supabase/server import out of client bundles
  const { createClient } = await import('@/lib/supabase/server')
  const db = await createClient()
  const { data: auth } = await db.auth.getUser()
  const user = auth.user

  if (!user) return { user: null, error: 'Unauthorized', status: 401 }
  if (!isAdminEmail(user.email)) return { user: null, error: 'Forbidden', status: 403 }
  return { user, error: null, status: 200 }
}
