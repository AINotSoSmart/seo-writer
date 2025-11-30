"use server"

import { createClient } from "@/utils/supabase/server"

export async function getUserDefaults() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { default_brand_id: null, default_voice_id: null }

  const { data } = await supabase
    .from("profiles")
    .select("default_brand_id, default_voice_id")
    .eq("user_id", user.id)
    .single()

  return data || { default_brand_id: null, default_voice_id: null }
}

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

export async function setDefaultVoice(voiceId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Not authenticated" }

  const { error } = await supabase
    .from("profiles")
    .update({ default_voice_id: voiceId })
    .eq("user_id", user.id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

