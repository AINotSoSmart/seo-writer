import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  // Product surfaces archived by the closed-pool pivot. Keep their code and
  // tables reversible, but do not expose the old GSC product by direct URL.
  if (['/action-board', '/seo-health'].includes(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL('/content-plan', request.url))
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Public API routes that don't require authentication
  // - csrf-token: needed for login form before user is authenticated
  // - auth: OAuth callbacks during authentication flow
  // - dodopayments/webhook: external webhook with its own signature verification
  // - images: public image proxy for blog featured images
  const publicApiRoutes = [
    '/api/csrf-token',
    '/api/auth',
    '/api/dodopayments/webhook',
    '/api/images',
  ]
  // Dev-only harvest test harnesses. Exact matches, never prefixes, so that
  // e.g. /api/harvest/verify-anything stays behind auth. Both routes also
  // return 404 when NODE_ENV === 'production', so this is defence in depth.
  const devOnlyApiRoutes = ['/api/harvest/verify', '/api/harvest/calibrate']
  const isDevHarvestRoute =
    process.env.NODE_ENV !== 'production' &&
    devOnlyApiRoutes.includes(request.nextUrl.pathname)
  const isPublicApiRoute = isDevHarvestRoute || publicApiRoutes.some(route =>
    request.nextUrl.pathname.startsWith(route)
  )

  // Protected routes - ONLY these require authentication
  const protectedRoutes = ['/content-plan', '/seo-health', '/reports', '/settings', '/articles', '/integrations', '/subscribe', '/onboarding', '/account', '/api']
  const isProtectedRoute = protectedRoutes.some(route =>
    request.nextUrl.pathname.startsWith(route)
  ) && !isPublicApiRoute // Exclude public API routes from protection

  // Only run auth check for protected routes or login page
  const needsAuthCheck = isProtectedRoute || request.nextUrl.pathname === '/login'

  if (!needsAuthCheck) {
    // All other routes skip auth entirely - no getUser() call
    return response
  }

  // Check if the user is authenticated (only for routes that need it)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If accessing protected routes and not authenticated, redirect to login
  if (isProtectedRoute && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // If authenticated and trying to access login, redirect to dashboard
  if (request.nextUrl.pathname === '/login' && user) {
    return NextResponse.redirect(new URL('/content-plan', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
