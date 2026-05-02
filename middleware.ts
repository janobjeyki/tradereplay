import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Build a response we can attach cookie mutations to
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  // Refresh session (keeps token alive) and get user
  const { data: { user } } = await supabase.auth.getUser()

  const isProtected = pathname.startsWith('/dashboard') || pathname.startsWith('/workspace')
  const isAuthPage  = pathname.startsWith('/auth')

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Redirect logged-in users away from auth pages to the app
  if (isAuthPage && user && pathname !== '/auth/verify') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard/sessions'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/workspace/:path*', '/auth/:path*'],
}
