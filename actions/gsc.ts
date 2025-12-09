"use server"

import { createClient } from "@/utils/supabase/server"
import { GSCConnection } from "@/lib/schemas/content-plan"

export async function saveGSCConnection(
    siteUrl: string,
    accessToken: string,
    refreshToken: string,
    expiresAt: Date
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    // Upsert - update if exists, insert if not
    const { data, error } = await supabase
        .from("gsc_connections")
        .upsert({
            user_id: user.id,
            site_url: siteUrl,
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: expiresAt.toISOString(),
            updated_at: new Date().toISOString(),
        }, {
            onConflict: 'user_id'
        })
        .select()
        .single()

    if (error) {
        return { success: false, error: error.message }
    }

    return { success: true, connectionId: data.id }
}

export async function getGSCConnection(): Promise<GSCConnection | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const { data } = await supabase
        .from("gsc_connections")
        .select("*")
        .eq("user_id", user.id)
        .single()

    return data as GSCConnection | null
}

export async function hasGSCConnection(): Promise<boolean> {
    const connection = await getGSCConnection()
    return connection !== null
}

export async function deleteGSCConnection() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    const { error } = await supabase
        .from("gsc_connections")
        .delete()
        .eq("user_id", user.id)

    if (error) {
        return { success: false, error: error.message }
    }

    return { success: true }
}

export async function refreshGSCToken(connectionId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    // Get current connection
    const { data: connection, error: fetchError } = await supabase
        .from("gsc_connections")
        .select("*")
        .eq("id", connectionId)
        .eq("user_id", user.id)
        .single()

    if (fetchError || !connection) {
        return { success: false, error: "Connection not found" }
    }

    // Refresh the token using Google's token endpoint
    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            refresh_token: connection.refresh_token,
            grant_type: "refresh_token",
        }),
    })

    if (!response.ok) {
        return { success: false, error: "Failed to refresh token" }
    }

    const tokens = await response.json()
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    // Update stored tokens
    const { error: updateError } = await supabase
        .from("gsc_connections")
        .update({
            access_token: tokens.access_token,
            expires_at: expiresAt.toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq("id", connectionId)

    if (updateError) {
        return { success: false, error: updateError.message }
    }

    return {
        success: true,
        accessToken: tokens.access_token,
        expiresAt: expiresAt.toISOString()
    }
}
