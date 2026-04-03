import { NextRequest, NextResponse } from "next/server"
import { syncGscDataTask } from "@/trigger/gsc-sync"
import { createClient } from "@/utils/supabase/server"

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await req.json()
        const { connectionId, siteUrl } = body

        if (!connectionId || !siteUrl) {
            return NextResponse.json({ error: "Missing connectionId or siteUrl" }, { status: 400 })
        }

        // Verify the connection belongs to the user
        const { data: connection, error } = await supabase
            .from("gsc_connections")
            .select("id")
            .eq("id", connectionId)
            .eq("user_id", user.id)
            .single()

        if (error || !connection) {
            return NextResponse.json({ error: "Connection not found or unauthorized" }, { status: 404 })
        }

        // Trigger the background task for the initial 60-day sync
        const handle = await syncGscDataTask.trigger({
            userId: user.id,
            connectionId: connection.id,
            siteUrl: siteUrl,
            isInitialSync: true
        })

        return NextResponse.json({ 
            success: true, 
            message: "GSC synchronization triggered successfully",
            jobId: handle.id 
        })

    } catch (e: any) {
        console.error("Failed to trigger GSC sync:", e)
        return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 })
    }
}
