import { createClient } from "@/utils/supabase/server"

import { internalMode } from "@/lib/engine/mode"

/** Tools one owner can track in internal mode. */
const INTERNAL_BRAND_LIMIT = 20

/**
 * Returns the brand limit for a user.
 * Paid product: 1 user = 1 brand. Internal mode: one brand per SaaS tool.
 */
export async function getUserBrandLimit(userId: string): Promise<number> {
  void userId
  return internalMode() ? INTERNAL_BRAND_LIMIT : 1
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
