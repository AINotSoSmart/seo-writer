import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { encryptToken } from "@/lib/encryption"

export async function GET(req: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.redirect(new URL("/login", req.url))
    }

    const searchParams = req.nextUrl.searchParams
    const code = searchParams.get("code")
    const state = searchParams.get("state")
    const error = searchParams.get("error")

    // Handle OAuth errors
    if (error) {
        console.error("GSC OAuth error:", error)
        return NextResponse.redirect(
            new URL(`/settings?gsc_error=${encodeURIComponent(error)}`, req.url)
        )
    }

    if (!code || !state) {
        return NextResponse.redirect(
            new URL("/settings?gsc_error=invalid_response", req.url)
        )
    }

    // Verify state (CSRF protection)
    const storedState = req.cookies.get("gsc_oauth_state")?.value
    if (!storedState || storedState !== state) {
        return NextResponse.redirect(
            new URL("/settings?gsc_error=invalid_state", req.url)
        )
    }

    try {
        // Exchange code for tokens
        const callbackUrl = new URL("/api/auth/gsc/callback", req.url).toString()

        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                code,
                grant_type: "authorization_code",
                redirect_uri: callbackUrl,
            }),
        })

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json()
            console.error("Token exchange failed:", errorData)
            return NextResponse.redirect(
                new URL("/settings?gsc_error=token_exchange_failed", req.url)
            )
        }

        const tokens = await tokenResponse.json()

        // Decode state to find nextUrl
        let nextUrl = "/settings?gsc=connected"
        try {
            const decodedState = JSON.parse(Buffer.from(state, "base64").toString("utf-8"))
            if (decodedState.next) {
                nextUrl = decodedState.next
            }
        } catch (e) {
            console.error("Failed to decode state for nextUrl")
        }

        // Calculate expiry time
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

        // Store connection in database (tokens encrypted at rest)
        const { error: dbError } = await supabase
            .from("gsc_connections")
            .upsert({
                user_id: user.id,
                site_url: "", // Leave blank to force explicit selection later
                access_token: encryptToken(tokens.access_token),
                refresh_token: encryptToken(tokens.refresh_token),
                expires_at: expiresAt.toISOString(),
                updated_at: new Date().toISOString(),
            }, {
                onConflict: "user_id"
            })

        if (dbError) {
            console.error("Failed to save GSC connection:", dbError)
            return NextResponse.redirect(
                new URL("/settings?gsc_error=save_failed", req.url)
            )
        }

        // Clear state cookie and redirect directly to next URL
        const response = NextResponse.redirect(
            new URL(nextUrl, req.url)
        )
        response.cookies.delete("gsc_oauth_state")

        return response
    } catch (error) {
        console.error("GSC callback error:", error)
        return NextResponse.redirect(
            new URL("/settings?gsc_error=unknown", req.url)
        )
    }
}
