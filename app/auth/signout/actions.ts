'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { safeError } from '@/lib/safe-log'

export async function signOut() {
  const supabase = await createClient()
  
  try {
    // Sign out from Supabase Auth
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      console.error('Sign out error:', error.message)
      return { error: 'Failed to sign out. Please try again.' }
    }
    
    // Clear any cached data
    revalidatePath('/', 'layout')
    
  } catch (error) {
    // Redacted: a thrown Supabase auth error can carry session material
    console.error('Unexpected sign out error:', safeError(error))
    return { error: 'An unexpected error occurred. Please try again.' }
  }
  
  // Redirect to home page after successful sign out
  redirect('/')
}

// Alternative sign out with scope options
export async function signOutWithScope(scope: 'global' | 'local' | 'others' = 'global') {
  const supabase = await createClient()
  
  try {
    // Sign out with specified scope
    const { error } = await supabase.auth.signOut({ scope })
    
    if (error) {
      console.error('Sign out error:', error.message)
      return { error: 'Failed to sign out. Please try again.' }
    }
    
    // Clear any cached data
    revalidatePath('/', 'layout')
    
  } catch (error) {
    // Redacted: a thrown Supabase auth error can carry session material
    console.error('Unexpected sign out error:', safeError(error))
    return { error: 'An unexpected error occurred. Please try again.' }
  }
  
  // Redirect to home page after successful sign out
  redirect('/')
}