"use server"

import { createClient } from "@/utils/supabase/server"
import { getUserBrandLimit, getBrandCount } from "@/lib/brands"
import { BrandDetails } from "@/lib/schemas/brand"
import { HARVEST_POLICY } from "@/lib/harvest/policy"
import {
  SCOPE_CONTRACT_VERSION,
  scopeHash,
  validateConfirmedScope,
} from "@/lib/brand-scope"

async function persistConfirmedScope(
  supabase: Awaited<ReturnType<typeof createClient>>,
  brandId: string,
  brandData: BrandDetails,
) {
  const scope = validateConfirmedScope(brandData)
  if (scope.errors.length > 0) {
    return { success: false as const, error: scope.errors.join(" ") }
  }

  const { error } = await (supabase as any).rpc("confirm_brand_scope", {
    p_brand_id: brandId,
    p_families: scope.families,
    p_contract_version: SCOPE_CONTRACT_VERSION,
    p_scope_hash: scopeHash(scope.families),
    p_brand_data: {
      ...brandData,
      scope_families: scope.families,
    },
  })
  if (error) {
    return {
      success: false as const,
      error: `Could not confirm the business scope: ${error.message}`,
    }
  }

  return { success: true as const, families: scope.families }
}

function normalizedCompetitors(competitors: string[] | undefined) {
  const byHost = new Map<string, { name: string; url: string }>()
  for (const raw of competitors || []) {
    const value = raw.trim()
    if (!value) continue
    const parsed = new URL(
      /^(https?:)?\/\//i.test(value) ? value : `https://${value}`,
    )
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) {
      throw new Error(`Invalid competitor URL: ${value}`)
    }
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "")
    byHost.set(host, { name: host, url: `https://${host}` })
  }
  return Array.from(byHost.values())
}

async function saveOnboardingBrandWithScope(
  supabase: Awaited<ReturnType<typeof createClient>>,
  brandId: string | null,
  websiteUrl: string,
  brandData: BrandDetails,
  competitors: Array<{ name: string; url: string }>,
) {
  const scope = validateConfirmedScope(brandData)
  if (scope.errors.length > 0) {
    return { success: false as const, error: scope.errors.join(" ") }
  }
  const confirmedBrandData: BrandDetails = {
    ...brandData,
    scope_families: scope.families,
  }
  const { data, error } = await (supabase as any).rpc(
    "save_onboarding_brand_with_scope",
    {
      p_brand_id: brandId,
      p_website_url: websiteUrl,
      p_discovered_competitors: competitors,
      p_families: scope.families,
      p_contract_version: SCOPE_CONTRACT_VERSION,
      p_scope_hash: scopeHash(scope.families),
      p_brand_data: confirmedBrandData,
    },
  )
  if (error || !data) {
    return {
      success: false as const,
      error: `Could not save the brand and confirmed business scope: ${error?.message || "unknown error"}`,
    }
  }
  return { success: true as const, brandId: String(data) }
}

export async function saveBrandAction(
  url: string,
  brandData: BrandDetails,
  competitors?: string[] // Optional competitor domains from onboarding
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false as const, error: "Not authenticated" }
  }
  let websiteUrl: string
  let websiteHost: string
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "https:") {
      throw new Error("Website URL must use HTTPS.")
    }
    parsed.hash = ""
    parsed.search = ""
    parsed.hostname = parsed.hostname.toLowerCase()
    parsed.pathname =
      parsed.pathname === "/" ? "/" : parsed.pathname.replace(/\/+$/, "")
    websiteUrl = parsed.toString()
    websiteHost = parsed.hostname.replace(/^www\./, "")
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Website URL is invalid.",
    }
  }
  let competitorRecords: Array<{ name: string; url: string }>
  try {
    competitorRecords = normalizedCompetitors(competitors)
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "A competitor URL is invalid.",
    }
  }
  if (competitorRecords.length > HARVEST_POLICY.maxCompetitors) {
    return {
      success: false as const,
      error: `Add no more than ${HARVEST_POLICY.maxCompetitors} direct competitors. None were silently removed.`,
    }
  }
  if (
    competitorRecords.some(
      (competitor) => new URL(competitor.url).hostname === websiteHost,
    )
  ) {
    return {
      success: false as const,
      error: "Your own website cannot also be saved as a competitor.",
    }
  }

  // Get user's brand limit
  let limit = await getUserBrandLimit(user.id)
  // Fail-safe: If limit is 0 (unknown active plan or glitch), allow 1 slot
  if (limit === 0) limit = 1

  // For users with single-brand limit (most common case), always update existing brand
  if (limit === 1) {
    const { data: existingBrand } = await supabase
      .from("brand_details")
      .select("id")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle()

    if (existingBrand) {
      return saveOnboardingBrandWithScope(
        supabase,
        existingBrand.id,
        websiteUrl,
        brandData,
        competitorRecords,
      )
    }
    // No existing brand, will insert below
  } else {
    // Multi-brand users: check for existing brand with same URL
    const { data: existingBrand } = await supabase
      .from("brand_details")
      .select("id")
      .eq("user_id", user.id)
      .eq("website_url", websiteUrl)
      .is("deleted_at", null)
      .maybeSingle()

    if (existingBrand) {
      return saveOnboardingBrandWithScope(
        supabase,
        existingBrand.id,
        websiteUrl,
        brandData,
        competitorRecords,
      )
    }

    // Check limit for multi-brand users
    const currentCount = await getBrandCount(user.id)
    if (currentCount >= limit) {
      return {
        success: false as const,
        error: `Plan limit reached. You have ${currentCount} brands, but your plan allows ${limit}. Please upgrade.`
      }
    }
  }

  return saveOnboardingBrandWithScope(
    supabase,
    null,
    websiteUrl,
    brandData,
    competitorRecords,
  )
}

export async function updateBrandAction(brandId: string, brandData: BrandDetails) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Not authenticated" }
  }

  const confirmedScope = validateConfirmedScope(brandData)
  if (confirmedScope.errors.length > 0) {
    return { success: false, error: confirmedScope.errors.join(" ") }
  }
  const confirmedBrandData: BrandDetails = {
    ...brandData,
    scope_families: confirmedScope.families,
  }

  const scopeResult = await persistConfirmedScope(
    supabase,
    brandId,
    confirmedBrandData,
  )
  if (!scopeResult.success) return scopeResult

  return { success: true, brandId }
}

export async function getUserBrands() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  const { data } = await supabase
    .from("brand_details")
    .select("id, website_url, brand_data, created_at")
    .eq("user_id", user.id)
    .is("deleted_at", null) // Exclude soft-deleted brands
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

  // Soft delete: set deleted_at instead of actually deleting
  // This prevents the delete-recreate abuse loop
  const { error } = await supabase
    .from("brand_details")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", brandId)
    .eq("user_id", user.id) // Security: Ensure user owns the brand

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
