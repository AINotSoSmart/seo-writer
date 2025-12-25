import { createClient } from "@/utils/supabase/server"

export const PLAN_LIMITS = {
  "Starter": 1,
  "Growth": 3,
} as const

export async function getUserBrandLimit(userId: string): Promise<number> {
  const supabase = await createClient()

  // 1. Get active subscription
  const { data: sub } = await supabase
    .from("dodo_subscriptions")
    .select(`
      status,
      dodo_pricing_plans (
        name
      )
    `)
    .eq("user_id", userId)
    .eq("status", "active")
    .single()

  if (!sub || !sub.dodo_pricing_plans) {
    // No active plan: allow 1 brand for smooth onboarding
    return 1
  }

  // @ts-ignore - Join types can be tricky
  const planName = sub.dodo_pricing_plans.name

  // Simple matching, case insensitive
  if (planName.toLowerCase().includes("starter")) return 1
  if (planName.toLowerCase().includes("growth")) return 3

  // Default: allow at least 1 brand (fallback for unknown plan names)
  return 1
}

export async function getBrandCount(userId: string): Promise<number> {
  const supabase = await createClient()
  const { count } = await supabase
    .from("brand_details")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("deleted_at", null) // Exclude soft-deleted brands

  return count || 0
}
