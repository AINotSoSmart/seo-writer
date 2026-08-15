"use server"

import { createClient } from "@/utils/supabase/server"

/**
 * Get user's default preferences (currently just the default brand).
 * This is used by blog-writer and content-plan to know which brand to use.
 */
export async function getUserDefaults() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { default_brand_id: null }

  const { data } = await supabase
    .from("profiles")
    .select("default_brand_id")
    .eq("user_id", user.id)
    .single()

  return data || { default_brand_id: null }
}

/**
 * Set the user's default brand for article generation.
 * This brand's style_dna will be used for writing voice.
 */
export async function setDefaultBrand(brandId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Not authenticated" }

  const { error } = await supabase
    .from("profiles")
    .update({ default_brand_id: brandId })
    .eq("user_id", user.id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}
