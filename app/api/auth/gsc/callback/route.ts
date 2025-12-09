import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

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
            new URL(`/onboarding?step=gsc&error=${encodeURIComponent(error)}`, req.url)
        )
    }

    if (!code || !state) {
        return NextResponse.redirect(
            new URL("/onboarding?step=gsc&error=invalid_response", req.url)
        )
    }

    // Verify state (CSRF protection)
    const storedState = req.cookies.get("gsc_oauth_state")?.value
    if (!storedState || storedState !== state) {
        return NextResponse.redirect(
            new URL("/onboarding?step=gsc&error=invalid_state", req.url)
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
                new URL("/onboarding?step=gsc&error=token_exchange_failed", req.url)
            )
        }

        const tokens = await tokenResponse.json()

        // Get the list of sites from GSC to find the user's site
        const sitesResponse = await fetch(
            "https://www.googleapis.com/webmasters/v3/sites",
            {
                headers: { Authorization: `Bearer ${tokens.access_token}` },
            }
        )

        let siteUrl = ""
        if (sitesResponse.ok) {
            const sitesData = await sitesResponse.json()
            // Use the first verified site, or empty string if none
            siteUrl = sitesData.siteEntry?.[0]?.siteUrl || ""
        }

        // Calculate expiry time
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

        // Store connection in database
        const { error: dbError } = await supabase
            .from("gsc_connections")
            .upsert({
                user_id: user.id,
                site_url: siteUrl,
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expires_at: expiresAt.toISOString(),
                updated_at: new Date().toISOString(),
            }, {
                onConflict: "user_id"
            })

        if (dbError) {
            console.error("Failed to save GSC connection:", dbError)
            return NextResponse.redirect(
                new URL("/onboarding?step=gsc&error=save_failed", req.url)
            )
        }

        // Clear state cookie and redirect to success
        const response = NextResponse.redirect(
            new URL("/onboarding?step=gsc-success", req.url)
        )
        response.cookies.delete("gsc_oauth_state")

        return response
    } catch (error) {
        console.error("GSC callback error:", error)
        return NextResponse.redirect(
            new URL("/onboarding?step=gsc&error=unknown", req.url)
        )
    }
}
