"use server"

import { createClient } from "@/utils/supabase/server"
import { testConnection } from "@/lib/integrations/wordpress-client"

interface WordPressConnection {
    id: string
    site_url: string
    site_name: string | null
    username: string
    is_default: boolean
    created_at: string
}

export async function getWordPressConnections(): Promise<{ connections: WordPressConnection[]; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { connections: [], error: "Not authenticated" }
    }

    const { data, error } = await supabase
        .from("wordpress_connections")
        .select("id, site_url, site_name, username, is_default, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

    if (error) {
        return { connections: [], error: error.message }
    }

    return { connections: data || [] }
}

export async function addWordPressConnection(params: {
    siteUrl: string
    username: string
    appPassword: string
}): Promise<{ success: boolean; connectionId?: string; siteName?: string; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    // Test the connection first
    const testResult = await testConnection({
        siteUrl: params.siteUrl,
        username: params.username,
        appPassword: params.appPassword,
    })

    if (!testResult.success) {
        return { success: false, error: testResult.error }
    }

    // Check if this site is already connected
    const { data: existing } = await supabase
        .from("wordpress_connections")
        .select("id")
        .eq("user_id", user.id)
        .eq("site_url", params.siteUrl.replace(/\/+$/, ''))
        .single()

    if (existing) {
        return { success: false, error: "This site is already connected" }
    }

    // Check how many connections exist to set default
    const { count } = await supabase
        .from("wordpress_connections")
        .select("id", { count: 'exact', head: true })
        .eq("user_id", user.id)

    const isFirst = (count || 0) === 0

    // Save the connection
    const { data, error } = await supabase
        .from("wordpress_connections")
        .insert({
            user_id: user.id,
            site_url: params.siteUrl.replace(/\/+$/, ''),
            site_name: testResult.siteName || params.siteUrl,
            username: params.username,
            app_password: params.appPassword, // TODO: Encrypt in production
            is_default: isFirst,
        })
        .select()
        .single()

    if (error) {
        return { success: false, error: error.message }
    }

    return {
        success: true,
        connectionId: data.id,
        siteName: testResult.siteName
    }
}

export async function deleteWordPressConnection(connectionId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    const { error } = await supabase
        .from("wordpress_connections")
        .delete()
        .eq("id", connectionId)
        .eq("user_id", user.id)

    if (error) {
        return { success: false, error: error.message }
    }

    return { success: true }
}

export async function setDefaultConnection(connectionId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    // First, unset all defaults for this user
    await supabase
        .from("wordpress_connections")
        .update({ is_default: false })
        .eq("user_id", user.id)

    // Then set the new default
    const { error } = await supabase
        .from("wordpress_connections")
        .update({ is_default: true })
        .eq("id", connectionId)
        .eq("user_id", user.id)

    if (error) {
        return { success: false, error: error.message }
    }

    return { success: true }
}

/**
 * Get connection with credentials (for server-side publish)
 */
export async function getConnectionWithCredentials(connectionId: string): Promise<{
    connection: {
        id: string
        site_url: string
        username: string
        app_password: string
    } | null
    error?: string
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { connection: null, error: "Not authenticated" }
    }

    const { data, error } = await supabase
        .from("wordpress_connections")
        .select("id, site_url, username, app_password")
        .eq("id", connectionId)
        .eq("user_id", user.id)
        .single()

    if (error || !data) {
        return { connection: null, error: error?.message || "Connection not found" }
    }

    return { connection: data }
}
