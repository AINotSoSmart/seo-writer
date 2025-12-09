import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { refreshGSCToken } from "@/actions/gsc"

// GET: Fetch list of sites from GSC account
export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Get GSC connection
        const { data: connection } = await supabase
            .from("gsc_connections")
            .select("*")
            .eq("user_id", user.id)
            .single()

        if (!connection) {
            return NextResponse.json({ error: "GSC not connected" }, { status: 400 })
        }

        // Check if token is expired and refresh if needed
        let accessToken = connection.access_token
        const expiresAt = new Date(connection.expires_at)

        if (expiresAt < new Date()) {
            const refreshResult = await refreshGSCToken(connection.id)
            if (!refreshResult.success) {
                return NextResponse.json({ error: "Failed to refresh token" }, { status: 401 })
            }
            accessToken = refreshResult.accessToken
        }

        // Fetch list of sites from GSC
        const sitesResponse = await fetch(
            "https://www.googleapis.com/webmasters/v3/sites",
            {
                headers: { Authorization: `Bearer ${accessToken}` },
            }
        )

        if (!sitesResponse.ok) {
            console.error("GSC sites fetch failed:", await sitesResponse.text())
            return NextResponse.json({ error: "Failed to fetch GSC sites" }, { status: 500 })
        }

        const sitesData = await sitesResponse.json()

        // Return list of sites
        const sites = (sitesData.siteEntry || []).map((site: any) => ({
            siteUrl: site.siteUrl,
            permissionLevel: site.permissionLevel,
        }))

        return NextResponse.json({ sites })
    } catch (error: any) {
        console.error("GSC sites error:", error)
        return NextResponse.json(
            { error: error.message || "Failed to fetch GSC sites" },
            { status: 500 }
        )
    }
}

// POST: Update selected site URL
export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { siteUrl } = await req.json()

        if (!siteUrl) {
            return NextResponse.json({ error: "Site URL required" }, { status: 400 })
        }

        // Update the selected site URL
        const { error } = await supabase
            .from("gsc_connections")
            .update({
                site_url: siteUrl,
                updated_at: new Date().toISOString()
            })
            .eq("user_id", user.id)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
