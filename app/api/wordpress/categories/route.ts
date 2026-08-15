import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { listCategories } from "@/lib/integrations/wordpress-client"

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await req.json()
        const { connectionId } = body

        if (!connectionId) {
            return NextResponse.json({ error: "Missing connectionId" }, { status: 400 })
        }

        // Fetch the WordPress connection
        const { data: connection, error: connectionError } = await supabase
            .from("wordpress_connections")
            .select("id, site_url, username, app_password")
            .eq("id", connectionId)
            .eq("user_id", user.id)
            .single()

        if (connectionError || !connection) {
            return NextResponse.json({ error: "WordPress connection not found" }, { status: 404 })
        }

        // Fetch categories from WordPress
        const result = await listCategories({
            siteUrl: connection.site_url,
            username: connection.username,
            appPassword: connection.app_password,
        })

        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            categories: result.categories,
        })

    } catch (error: any) {
        console.error("WordPress categories error:", error)
        return NextResponse.json(
            { error: error.message || "Failed to fetch categories" },
            { status: 500 }
        )
    }
}
