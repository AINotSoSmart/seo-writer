import { create } from 'zustand'
import { createClient } from '@/utils/supabase/client'

const supabase = createClient()

interface UserProfile {
  id: string
  user_id: string
  has_completed_onboarding: boolean
  created_at: string
  updated_at: string
}

interface UserStore {
  profile: UserProfile | null
  loading: boolean
  error: string | null
  fetchProfile: () => Promise<void>
  completeOnboarding: () => Promise<void>
  clearError: () => void
}

export const useUserStore = create<UserStore>((set, get) => ({
  profile: null,
  loading: false,
  error: null,

  fetchProfile: async () => {
    set({ loading: true, error: null })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()


      if (error) {
        // If profile doesn't exist, try to create it
        if (error.code === 'PGRST116') { // No rows found
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({ id: user.id, user_id: user.id })
            .select()
            .single()
          
          if (createError) throw createError
          set({ profile: newProfile, loading: false })
          return
        }
        throw error
      }
      set({ profile: data, loading: false })
    } catch (error) {
      console.error('Store: Error fetching profile:', error)
      set({ error: 'Failed to fetch profile', loading: false })
    }
  },

  completeOnboarding: async () => {
    set({ loading: true, error: null })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      const { data, error } = await supabase
        .from('profiles')
        .update({ has_completed_onboarding: true })
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error
      set({ profile: data, loading: false })
    } catch (error) {
      set({ error: 'Failed to complete onboarding', loading: false })
    }
  },

  clearError: () => set({ error: null })
}))