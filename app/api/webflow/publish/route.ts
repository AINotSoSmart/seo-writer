import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { publishToWebflow } from "@/lib/integrations/webflow-client"

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await req.json()
        const { articleId, connectionId } = body

        if (!articleId || !connectionId) {
            return NextResponse.json({ error: "Missing articleId or connectionId" }, { status: 400 })
        }

        // 1. Fetch the article
        const { data: article, error: articleError } = await supabase
            .from("articles")
            .select("id, outline, final_html, meta_description, slug, user_id")
            .eq("id", articleId)
            .eq("user_id", user.id)
            .single()

        if (articleError || !article) {
            return NextResponse.json({ error: "Article not found" }, { status: 404 })
        }

        if (!article.final_html) {
            return NextResponse.json({ error: "Article has no content to publish" }, { status: 400 })
        }

        // 2. Fetch the Webflow connection
        const { data: connection, error: connectionError } = await supabase
            .from("webflow_connections")
            .select("id, site_id, collection_id, api_token, field_mapping")
            .eq("id", connectionId)
            .eq("user_id", user.id)
            .single()

        if (connectionError || !connection) {
            return NextResponse.json({ error: "Webflow connection not found" }, { status: 404 })
        }

        // 3. Publish to Webflow
        const result = await publishToWebflow(
            {
                apiToken: connection.api_token,
                siteId: connection.site_id,
                collectionId: connection.collection_id,
            },
            {
                title: article.outline?.title || 'Untitled',
                content: article.final_html,
                slug: article.slug || undefined,
                excerpt: article.meta_description || undefined,
            },
            connection.field_mapping || {}
        )

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 })
        }

        // 4. Update article with Webflow item info
        await supabase
            .from("articles")
            .update({
                webflow_item_id: result.itemId,
                webflow_site_id: connectionId,
            })
            .eq("id", articleId)

        return NextResponse.json({
            success: true,
            itemId: result.itemId,
        })

    } catch (error: any) {
        console.error("Webflow publish error:", error)
        return NextResponse.json(
            { error: error.message || "Failed to publish" },
            { status: 500 }
        )
    }
}
