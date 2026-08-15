"use server"

import { createClient } from "@/utils/supabase/server"

export async function getBrandLinkCountAction(brandId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, count: 0 }
    }

    const { count, error } = await supabase
        .from("internal_links")
        .select("*", { count: 'exact', head: true })
        .eq("user_id", user.id)
        .eq("brand_id", brandId)

    if (error) {
        console.error("❌ Error fetching link count:", error)
        return { success: false, count: 0 }
    }

    return { success: true, count: count || 0 }
}
