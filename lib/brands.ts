import { createClient } from "@/utils/supabase/server"

/**
 * Returns the brand limit for a user.
 * Simple model: 1 user = 1 brand. No plan-based logic.
 */
export async function getUserBrandLimit(userId: string): Promise<number> {
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
