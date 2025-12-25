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

  // 0. Check for existing brand with same URL (UPSERT)
  const { data: existingBrand } = await supabase
    .from("brand_details")
    .select("id")
    .eq("user_id", user.id)
    .eq("website_url", url)
    .maybeSingle() // Use maybeSingle to avoid 406 error if multiple (shouldn't happen but safe) or 0

  if (existingBrand) {
    // If exact URL match, just update it
    return updateBrandAction(existingBrand.id, brandData)
  }

  // 1. Check Limits
  let limit = await getUserBrandLimit(user.id)
  const currentCount = await getBrandCount(user.id)

  // Fail-safe: If limit is 0 (unknown active plan or glitch), allow 1 slot
  if (limit === 0) limit = 1

  if (currentCount >= limit) {
    // Smart Swap: If user is at limit 1 (typical starter), allows overwriting the single slot
    // This handles "I want to update the raw" request even if URL is different
    if (currentCount === 1) {
      const { data: singleBrand } = await supabase
        .from("brand_details")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .single()

      if (singleBrand) {
        // Overwrite the existing slot with NEW URL and Data
        const { error } = await supabase
          .from("brand_details")
          .update({
            brand_data: brandData,
            website_url: url
          })
          .eq("id", singleBrand.id)
          .eq("user_id", user.id)

        if (error) return { success: false, error: error.message }
        return { success: true, brandId: singleBrand.id }
      }
    }

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

export async function updateBrandAction(brandId: string, brandData: BrandDetails) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Not authenticated" }
  }

  const { error } = await supabase
    .from("brand_details")
    .update({
      brand_data: brandData,
    })
    .eq("id", brandId)
    .eq("user_id", user.id) // Security check

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
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
