import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

// GET: Fetch user's settings (brand ID for article generation)
export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { data: brand } = await supabase
            .from("brand_details")
            .select("id")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single()

        return NextResponse.json({
            brandId: brand?.id || null,
        })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
