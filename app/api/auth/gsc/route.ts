import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

// GSC OAuth initiation - redirects to Google
export async function GET(req: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.redirect(new URL("/login", req.url))
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) {
        return NextResponse.json({ error: "Google OAuth not configured" }, { status: 500 })
    }

    // Get the callback URL
    const callbackUrl = new URL("/api/auth/gsc/callback", req.url).toString()

    // Generate state token for CSRF protection
    const state = Buffer.from(JSON.stringify({
        userId: user.id,
        timestamp: Date.now(),
        nonce: Math.random().toString(36).substring(7)
    })).toString("base64")

    // Store state in cookie for verification
    const response = NextResponse.redirect(
        `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(callbackUrl)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent("https://www.googleapis.com/auth/webmasters.readonly")}&` +
        `access_type=offline&` +
        `prompt=consent&` +
        `state=${encodeURIComponent(state)}`
    )

    // Set state cookie for verification
    response.cookies.set("gsc_oauth_state", state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 600, // 10 minutes
    })

    return response
}
