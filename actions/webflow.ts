"use server"

import { createClient } from "@/utils/supabase/server"
import { testConnection, listSites, listCollections } from "@/lib/integrations/webflow-client"

interface WebflowConnection {
    id: string
    site_name: string | null
    site_id: string
    collection_id: string
    field_mapping: Record<string, string>
    is_default: boolean
    created_at: string
}

export async function getWebflowConnections(): Promise<{
    connections: WebflowConnection[]
    error?: string
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { connections: [], error: "Not authenticated" }
    }

    const { data, error } = await supabase
        .from("webflow_connections")
        .select("id, site_name, site_id, collection_id, field_mapping, is_default, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

    if (error) {
        return { connections: [], error: error.message }
    }

    return { connections: data || [] }
}

export async function testWebflowToken(apiToken: string): Promise<{
    success: boolean
    sites?: { id: string; displayName: string }[]
    error?: string
}> {
    // Test the connection
    const testResult = await testConnection(apiToken)
    if (!testResult.success) {
        return { success: false, error: testResult.error }
    }

    // Fetch available sites
    const sitesResult = await listSites(apiToken)
    if (sitesResult.error) {
        return { success: false, error: sitesResult.error }
    }

    return {
        success: true,
        sites: sitesResult.sites.map(s => ({ id: s.id, displayName: s.displayName }))
    }
}

export async function getWebflowCollections(
    apiToken: string,
    siteId: string
): Promise<{
    collections: { id: string; displayName: string; slug: string }[]
    error?: string
}> {
    const result = await listCollections(apiToken, siteId)
    if (result.error) {
        return { collections: [], error: result.error }
    }
    return { collections: result.collections }
}

export async function addWebflowConnection(params: {
    apiToken: string
    siteId: string
    siteName: string
    collectionId: string
    fieldMapping?: Record<string, string>
}): Promise<{ success: boolean; connectionId?: string; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    // Check if this site is already connected
    const { data: existing } = await supabase
        .from("webflow_connections")
        .select("id")
        .eq("user_id", user.id)
        .eq("site_id", params.siteId)
        .single()

    if (existing) {
        return { success: false, error: "This site is already connected" }
    }

    // Check how many connections exist to set default
    const { count } = await supabase
        .from("webflow_connections")
        .select("id", { count: 'exact', head: true })
        .eq("user_id", user.id)

    const isFirst = (count || 0) === 0

    // Save the connection
    const { data, error } = await supabase
        .from("webflow_connections")
        .insert({
            user_id: user.id,
            site_name: params.siteName,
            api_token: params.apiToken,
            site_id: params.siteId,
            collection_id: params.collectionId,
            field_mapping: params.fieldMapping || {
                title: "name",
                content: "post-body",
                slug: "slug",
                excerpt: "post-summary"
            },
            is_default: isFirst,
        })
        .select()
        .single()

    if (error) {
        return { success: false, error: error.message }
    }

    return { success: true, connectionId: data.id }
}

export async function deleteWebflowConnection(connectionId: string): Promise<{
    success: boolean
    error?: string
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    const { error } = await supabase
        .from("webflow_connections")
        .delete()
        .eq("id", connectionId)
        .eq("user_id", user.id)

    if (error) {
        return { success: false, error: error.message }
    }

    return { success: true }
}

export async function setDefaultWebflowConnection(connectionId: string): Promise<{
    success: boolean
    error?: string
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    // First, unset all defaults for this user
    await supabase
        .from("webflow_connections")
        .update({ is_default: false })
        .eq("user_id", user.id)

    // Then set the new default
    const { error } = await supabase
        .from("webflow_connections")
        .update({ is_default: true })
        .eq("id", connectionId)
        .eq("user_id", user.id)

    if (error) {
        return { success: false, error: error.message }
    }

    return { success: true }
}
