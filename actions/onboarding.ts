"use server"

import { createClient } from "@/utils/supabase/server"

/**
 * Checks if the current user is allowed to access the onboarding page.
 * Users with an existing brand should be redirected to /content-plan.
 */
export async function canAccessOnboarding(): Promise<{ allowed: boolean; redirectTo?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { allowed: false, redirectTo: "/login" }
    }

    // Count active (non-deleted) brands
    const { count } = await supabase
        .from("brand_details")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("deleted_at", null) // Only count non-deleted brands

    if (count && count > 0) {
        // User already has a brand → redirect to content plan
        return { allowed: false, redirectTo: "/content-plan" }
    }

    return { allowed: true }
}
