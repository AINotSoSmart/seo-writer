import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  pathRequiresBrand,
  userHasActiveBrand,
} from '@/lib/onboarding-gate'

export async function proxy(request: NextRequest) {
  const legacyFeatureRedirects: Record<string, string> = {
    '/features/ai-search-visibility': '/features/evidence-backed-topical-audit',
    '/features/topic-cluster-generator': '/features/topic-cluster-delivery',
    '/features/auto-blogging-software': '/features/topic-cluster-delivery',
    '/features/ai-content-calendar': '/features/program-burn-down',
    '/features/ai-seo-writer': '/features/topic-cluster-delivery',
  }
  const redirectTarget = legacyFeatureRedirects[request.nextUrl.pathname]
  if (redirectTarget) {
    return NextResponse.redirect(new URL(redirectTarget, request.url), 308)
  }

  if (
    request.nextUrl.pathname === '/compare' ||
    request.nextUrl.pathname.startsWith('/compare/') ||
    request.nextUrl.pathname === '/solutions' ||
    request.nextUrl.pathname.startsWith('/solutions/') ||
    request.nextUrl.pathname === '/tools' ||
    request.nextUrl.pathname.startsWith('/tools/') ||
    request.nextUrl.pathname === '/case-studies' ||
    request.nextUrl.pathname.startsWith('/case-studies/') ||
    request.nextUrl.pathname === '/blog/boost-ecommerce-ai-search-visibility' ||
    request.nextUrl.pathname.startsWith('/api/shopify/') ||
    request.nextUrl.pathname.startsWith('/api/webflow/') ||
    request.nextUrl.pathname === '/api/generate' ||
    request.nextUrl.pathname.startsWith('/api/credits/') ||
    request.nextUrl.pathname === '/api/deduct-credits' ||
    request.nextUrl.pathname.startsWith('/api/pillar-pages') ||
    request.nextUrl.pathname === '/api/content-plan/sync-links' ||
    request.nextUrl.pathname === '/features/undetectable-ai-content' ||
    request.nextUrl.pathname === '/features/one-click-article-writer'
  ) {
    return new NextResponse('This retired product claim is gone.', {
      status: 410,
      headers: { 'Cache-Control': 'public, max-age=86400' },
    })
  }

  // Product surfaces archived by the closed-pool pivot. Keep their code and
  // tables reversible, but do not expose the old GSC product by direct URL.
  if (['/action-board', '/seo-health'].includes(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL('/content-plan', request.url))
  }

  let requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
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
          requestHeaders = new Headers(request.headers)
          requestHeaders.set('x-pathname', request.nextUrl.pathname)
          response = NextResponse.next({
            request: {
              headers: requestHeaders,
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
          requestHeaders = new Headers(request.headers)
          requestHeaders.set('x-pathname', request.nextUrl.pathname)
          response = NextResponse.next({
            request: {
              headers: requestHeaders,
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
  // Dev-only test harnesses. Exact matches, never prefixes, so that e.g.
  // /api/harvest/verify-anything stays behind auth. Every route here also
  // returns 404 when NODE_ENV === 'production', so this is defence in depth.
  const devOnlyApiRoutes = [
    '/api/harvest/verify',
    '/api/harvest/calibrate',
    // Inspects what the article writer receives for a real planned article.
    // Reads only; calls no paid API and generates nothing.
    '/api/writer/dry-run',
  ]
  const isDevHarvestRoute =
    process.env.NODE_ENV !== 'production' &&
    devOnlyApiRoutes.includes(request.nextUrl.pathname)
  const isPublicApiRoute = isDevHarvestRoute || publicApiRoutes.some(route =>
    request.nextUrl.pathname.startsWith(route)
  )

  // Protected routes - ONLY these require authentication
  // '/founder' pages already call isFounderUser() and notFound(), so nothing
  // leaks without it — verified by fetching one unauthenticated. It is listed
  // here as defence in depth: an anonymous request should be turned away at the
  // edge rather than reaching a server component that queries the database on
  // its way to rejecting the caller.
  //
  // '/visibility' and '/evidence' were the two that were NOT here, and both
  // read through the admin client, which bypasses RLS. Their pages now check
  // ownership themselves; this is the outer of the two gates. Any future
  // customer-data page belongs in this list on the day it is created, not on
  // the day someone notices.
  const protectedRoutes = ['/content-plan', '/seo-health', '/reports', '/settings', '/articles', '/integrations', '/subscribe', '/onboarding', '/account', '/api', '/founder', '/visibility', '/evidence']
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

  // If accessing protected routes and not authenticated, redirect to login.
  // Report pages carry their deep link through the login round-trip, so an
  // evidence URL followed from an email or a bookmark still resolves once the
  // owner signs in. Everything else keeps the plain bounce it already had.
  if (isProtectedRoute && !user) {
    const loginUrl = new URL('/login', request.url)
    if (
      request.nextUrl.pathname.startsWith('/visibility') ||
      request.nextUrl.pathname.startsWith('/evidence')
    ) {
      loginUrl.searchParams.set('next', request.nextUrl.pathname)
    }
    return NextResponse.redirect(loginUrl)
  }

  const pathname = request.nextUrl.pathname

  // Brandless customers must finish /onboarding before any dashboard shell.
  // /onboarding and /founder are exempt; /api stays open so analyze-brand can
  // run before the brand row is saved.
  if (user && pathRequiresBrand(pathname)) {
    const hasBrand = await userHasActiveBrand(supabase, user.id)
    if (!hasBrand) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
  }

  // If authenticated and trying to access login, send them to the right home.
  if (pathname === '/login' && user) {
    const hasBrand = await userHasActiveBrand(supabase, user.id)
    return NextResponse.redirect(
      new URL(hasBrand ? '/content-plan' : '/onboarding', request.url),
    )
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
