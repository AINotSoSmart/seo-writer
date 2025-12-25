"use server"

import { createClient } from "@/utils/supabase/server"

/**
 * Checks if the current user is allowed to access the onboarding page.
 * Users with BOTH a brand AND a content plan should be redirected to /content-plan.
 * Users with only a brand (no plan) should be allowed to continue onboarding.
 */
export async function canAccessOnboarding(): Promise<{ allowed: boolean; redirectTo?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { allowed: false, redirectTo: "/login" }
    }

    // Check for active (non-deleted) brands
    const { data: brands } = await supabase
        .from("brand_details")
        .select("id")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .limit(1)

    const hasBrand = brands && brands.length > 0

    if (!hasBrand) {
        // No brand → allow onboarding
        return { allowed: true }
    }

    // User has a brand, now check for content plan
    const { count: planCount } = await supabase
        .from("content_plans")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)

    const hasPlan = planCount && planCount > 0

    if (hasBrand && hasPlan) {
        // User has BOTH brand AND plan → redirect to content plan
        return { allowed: false, redirectTo: "/content-plan" }
    }

    // User has brand but NO plan → allow onboarding to continue from where they left off
    return { allowed: true }
}

/**
 * Gets existing brand data for onboarding resume.
 * If user has a brand but no content plan, return the brand data so onboarding can resume from competitors step.
 */
export async function getExistingBrandForResume(): Promise<{
    hasBrand: boolean;
    brandId?: string;
    brandUrl?: string;
    brandData?: any;
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { hasBrand: false }
    }

    // Get the user's brand (if any)
    const { data: brand } = await supabase
        .from("brand_details")
        .select("id, website_url, brand_data")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .limit(1)
        .single()

    if (!brand) {
        return { hasBrand: false }
    }

    return {
        hasBrand: true,
        brandId: brand.id,
        brandUrl: brand.website_url,
        brandData: brand.brand_data
    }
}

