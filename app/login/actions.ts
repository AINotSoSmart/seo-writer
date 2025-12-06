'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { authRateLimit, checkRateLimit } from '@/utils/rate-limit'
import { isRateLimitingEnabled } from '@/config/security'
import { requireCSRFToken } from '@/utils/csrf'

type AuthState = {
  error?: string
  success?: string
}

export async function signInWithMagicLink(
  _prevState: AuthState | null,
  formData: FormData
): Promise<AuthState> {
  // Validate CSRF token
  const isValidCSRF = await requireCSRFToken(formData)
  if (!isValidCSRF) {
    return { error: 'Security validation failed. Please refresh the page and try again.' }
  }
  
  // Apply rate limiting based on email only if enabled
  const email = formData.get('email') as string
  if (isRateLimitingEnabled()) {
    const rateLimitResult = await checkRateLimit(`magic-link:${email}`, authRateLimit)
    
    if (!rateLimitResult.success) {
      return { error: 'Too many login attempts. Please try again in 15 minutes.' }
    }
  }
  
  const supabase = await createClient()

  try {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/blog-writer`,
      },
    })

    if (error) {
      console.error('Magic link error:', error.code || 'UNKNOWN_ERROR')
      return { error: 'Failed to send magic link. Please try again.' }
    }
    
    console.log('Magic link sent successfully')
    return { success: 'Check your email for the magic link!' }
  } catch (err) {
    console.error('Magic link error:', err instanceof Error ? err.message : 'Unknown error')
    return { error: 'An unexpected error occurred. Please try again.' }
  }
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  // Validate CSRF token
  const isValidCSRF = await requireCSRFToken(formData)
  if (!isValidCSRF) {
    redirect('/error?message=Security validation failed. Please refresh the page and try again.')
  }
  
  // Apply rate limiting for OAuth attempts only if enabled
  if (isRateLimitingEnabled()) {
    const rateLimitResult = await checkRateLimit('google-oauth', authRateLimit)
    
    if (!rateLimitResult.success) {
      redirect('/error?message=Too many login attempts. Please try again in 15 minutes.')
    }
  }
  
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/blog-writer`,
    },
  })

  if (error) {
    console.error('Google OAuth error:', error.code || 'UNKNOWN_ERROR')
    redirect('/error')
  }

  if (data?.url) {
    redirect(data.url)
  }

  console.error('No OAuth URL generated')
  redirect('/error')
}

// Keep existing functions for backward compatibility
export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    redirect('/error')
  }

  revalidatePath('/', 'layout')
  redirect('/blog-writer')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signUp(data)

  if (error) {
    redirect('/error')
  }

  revalidatePath('/', 'layout')
  redirect('/blog-writer')
}