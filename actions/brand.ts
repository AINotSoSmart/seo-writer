"use server"

import { createClient } from "@/utils/supabase/server"
import { getUserBrandLimit, getBrandCount } from "@/lib/brands"
import { BrandDetails } from "@/lib/schemas/brand"

export async function saveBrandAction(url: string, brandData: BrandDetails) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { success: false, error: "Not authenticated" }
  }

  // 1. Check Limits
  const limit = await getUserBrandLimit(user.id)
  const currentCount = await getBrandCount(user.id)

  if (currentCount >= limit) {
    return { 
      success: false, 
      error: `Plan limit reached. You have ${currentCount} brands, but your plan allows ${limit}. Please upgrade.` 
    }
  }

  // 2. Insert
  const { data, error } = await supabase
    .from("brand_details")
    .insert({
      user_id: user.id,
      website_url: url,
      brand_data: brandData,
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, brandId: data.id }
}

export async function getUserBrands() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return []

  const { data } = await supabase
    .from("brand_details")
    .select("id, website_url, brand_data, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  return data || []
}

export async function getUserBrandStatus() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { brands: [], limit: 0, count: 0 }

  const [limit, brands] = await Promise.all([
    getUserBrandLimit(user.id),
    getUserBrands()
  ])

  return {
    brands,
    limit,
    count: brands.length
  }
}

export async function deleteBrandAction(brandId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { success: false, error: "Not authenticated" }
  }

  const { error } = await supabase
    .from("brand_details")
    .delete()
    .eq("id", brandId)
    .eq("user_id", user.id) // Security: Ensure user owns the brand

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
