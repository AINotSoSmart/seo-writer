"use server"

import { createClient } from "@/utils/supabase/server"

/**
 * A completed current audit is already the customer's plan. Customers without
 * one may resume onboarding; everyone else uses the normalized program view.
 */
export async function canAccessOnboarding(
    currentStep?: string,
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

    if (!brand?.current_audit_id) return { allowed: true }

    // Do not eject the customer at the exact moment finalization sets the
    // brand's current audit. The audit and audit-results steps are the focused
    // completion experience; all other attempts to reopen onboarding land on
    // the permanent evidence view.
    if (currentStep === "audit" || currentStep === "audit-results") {
        return { allowed: true }
    }

    return { allowed: false, redirectTo: "/audit" }
}
