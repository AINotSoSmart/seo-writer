"use server"

import { createClient } from "@/utils/supabase/server"

/**
 * A completed current audit is already the customer's plan. Customers without
 * one may resume onboarding; everyone else uses the normalized program view.
 */
export async function canAccessOnboarding(
    _currentStep?: string,
): Promise<{ allowed: boolean; redirectTo?: string }> {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) return { allowed: false, redirectTo: "/login" }

    const { data: brand } = await supabase
        .from("brand_details")
        .select("id, current_audit_id")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle()

    return brand?.current_audit_id
        ? { allowed: false, redirectTo: "/content-plan" }
        : { allowed: true }
}
