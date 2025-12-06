"use server"

import { createClient } from "@/utils/supabase/server"
import { testConnection, listBlogs } from "@/lib/integrations/shopify-client"

interface ShopifyConnection {
    id: string
    store_name: string
    store_domain: string
    blog_id: string
    blog_title: string | null
    is_default: boolean
    created_at: string
}

export async function getShopifyConnections(): Promise<{
    connections: ShopifyConnection[]
    error?: string
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { connections: [], error: "Not authenticated" }
    }

    const { data, error } = await supabase
        .from("shopify_connections")
        .select("id, store_name, store_domain, blog_id, blog_title, is_default, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

    if (error) {
        return { connections: [], error: error.message }
    }

    return { connections: data || [] }
}

export async function testShopifyConnection(params: {
    storeDomain: string
    accessToken: string
}): Promise<{
    success: boolean
    shopName?: string
    blogs?: { id: number; title: string }[]
    error?: string
}> {
    // Test the connection
    const testResult = await testConnection({
        storeDomain: params.storeDomain,
        accessToken: params.accessToken,
    })

    if (!testResult.success) {
        return { success: false, error: testResult.error }
    }

    // Fetch available blogs
    const blogsResult = await listBlogs({
        storeDomain: params.storeDomain,
        accessToken: params.accessToken,
    })

    if (blogsResult.error) {
        return { success: false, error: blogsResult.error }
    }

    return {
        success: true,
        shopName: testResult.shopName,
        blogs: blogsResult.blogs.map(b => ({ id: b.id, title: b.title })),
    }
}

export async function addShopifyConnection(params: {
    storeDomain: string
    accessToken: string
    storeName: string
    blogId: string
    blogTitle: string
}): Promise<{ success: boolean; connectionId?: string; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    // Check if this store is already connected
    const { data: existing } = await supabase
        .from("shopify_connections")
        .select("id")
        .eq("user_id", user.id)
        .eq("store_domain", params.storeDomain)
        .single()

    if (existing) {
        return { success: false, error: "This store is already connected" }
    }

    // Check how many connections exist to set default
    const { count } = await supabase
        .from("shopify_connections")
        .select("id", { count: 'exact', head: true })
        .eq("user_id", user.id)

    const isFirst = (count || 0) === 0

    // Save the connection
    const { data, error } = await supabase
        .from("shopify_connections")
        .insert({
            user_id: user.id,
            store_name: params.storeName,
            store_domain: params.storeDomain,
            access_token: params.accessToken,
            blog_id: params.blogId,
            blog_title: params.blogTitle,
            is_default: isFirst,
        })
        .select()
        .single()

    if (error) {
        return { success: false, error: error.message }
    }

    return { success: true, connectionId: data.id }
}

export async function deleteShopifyConnection(connectionId: string): Promise<{
    success: boolean
    error?: string
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    const { error } = await supabase
        .from("shopify_connections")
        .delete()
        .eq("id", connectionId)
        .eq("user_id", user.id)

    if (error) {
        return { success: false, error: error.message }
    }

    return { success: true }
}

export async function setDefaultShopifyConnection(connectionId: string): Promise<{
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
        .from("shopify_connections")
        .update({ is_default: false })
        .eq("user_id", user.id)

    // Then set the new default
    const { error } = await supabase
        .from("shopify_connections")
        .update({ is_default: true })
        .eq("id", connectionId)
        .eq("user_id", user.id)

    if (error) {
        return { success: false, error: error.message }
    }

    return { success: true }
}
