// Pure helpers — safe to import from both server and client components.
// Does NOT import anything from next/headers or supabase/server.

const DEFAULT_ADMIN_EMAILS = ['bekhruzjke@gmail.com']

export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || DEFAULT_ADMIN_EMAILS.join(','))
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false
  return getAdminEmails().includes(email.toLowerCase())
}
