import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { authRateLimit, getClientIP, checkRateLimit } from '@/utils/rate-limit'
import { isRateLimitingEnabled } from '@/config/security'

export async function GET(request: NextRequest) {
  // Apply rate limiting only if enabled
  if (isRateLimitingEnabled()) {
    const clientIP = getClientIP(request)
    const rateLimitResult = await checkRateLimit(clientIP, authRateLimit)
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many authentication attempts. Please try again later.' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit?.toString() || '5',
            'X-RateLimit-Remaining': rateLimitResult.remaining?.toString() || '0',
            'X-RateLimit-Reset': rateLimitResult.reset?.toString() || '0',
          }
        }
      )
    }
  }
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = (searchParams.get('type') || 'email').toLowerCase()
  const next = searchParams.get('next') ?? '/blog-writer'

  if (code) {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        // Log error for debugging without exposing details
        console.error('Auth exchange failed:', error.code || 'UNKNOWN_ERROR')
        return NextResponse.redirect(`${origin}/login?error=Authentication failed`)
      }
      
      if (data?.user) {
        // Log successful auth without user details
        return NextResponse.redirect(`${origin}${next}`)
      } else {
        console.error('No user data returned after exchange')
        return NextResponse.redirect(`${origin}/login?error=Authentication failed`)
      }
    } catch (err) {
      console.error('Auth exchange error:', err instanceof Error ? err.message : 'Unknown error')
      return NextResponse.redirect(`${origin}/login?error=Authentication failed`)
    }
  }

  if (tokenHash) {
    try {
      const supabase = await createClient()
      const { data, error } = await (supabase.auth as any).verifyOtp({
        type,
        token_hash: tokenHash,
      })

      if (error) {
        console.error('Auth verifyOtp failed:', error.code || 'UNKNOWN_ERROR')
        return NextResponse.redirect(`${origin}/login?error=Authentication failed or link expired`)
      }

      if (data?.user) {
        return NextResponse.redirect(`${origin}${next}`)
      } else {
        console.error('No user data returned after verifyOtp')
        return NextResponse.redirect(`${origin}/login?error=Authentication failed`)
      }
    } catch (err) {
      console.error('Auth verifyOtp error:', err instanceof Error ? err.message : 'Unknown error')
      return NextResponse.redirect(`${origin}/login?error=Authentication failed`)
    }
  }

  // Return generic error for missing parameters
  return NextResponse.redirect(`${origin}/login?error=Authentication failed`)
}