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
            .select("id, outline, final_html, meta_description, slug, featured_image_url, user_id")
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

        // 3. Get the featured image URL (use proxy if needed)
        let featuredImageUrl = article.featured_image_url
        if (featuredImageUrl) {
            let fetchUrl = featuredImageUrl

            // Construct fetchable URL
            if (featuredImageUrl.includes('.r2.cloudflarestorage.com/')) {
                const key = featuredImageUrl.split('.r2.cloudflarestorage.com/')[1]
                const appUrl = process.env.NEXT_PUBLIC_APP_URL
                    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
                fetchUrl = `${appUrl}/api/images/${key}`
            } else if (featuredImageUrl.startsWith('/api/images/')) {
                const appUrl = process.env.NEXT_PUBLIC_APP_URL
                    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
                fetchUrl = `${appUrl}${featuredImageUrl}`
            }

            // Detect if we are on localhost
            const isLocalhost = fetchUrl.includes('localhost') || fetchUrl.includes('127.0.0.1')

            // If on localhost, we MUST upload the asset to Webflow first because they can't reach us.
            // Even in prod, uploading as an asset is safer/cleaner than hotlinking to our R2 proxy.
            try {
                console.log(`[Webflow Publish] Fetching image for asset upload: ${fetchUrl}`)
                const imageRes = await fetch(fetchUrl)
                if (imageRes.ok) {
                    const arrayBuffer = await imageRes.arrayBuffer()
                    const buffer = Buffer.from(arrayBuffer)

                    // Upload to Webflow Assets
                    const { uploadAssetToWebflow } = await import("@/lib/integrations/webflow-client")
                    const assetResult = await uploadAssetToWebflow(
                        connection.api_token,
                        connection.site_id,
                        buffer,
                        `image-${Date.now()}.jpg` // Simple unique name
                    )

                    if (assetResult.url) {
                        featuredImageUrl = assetResult.url
                        console.log(`[Webflow Publish] Asset uploaded successfully: ${featuredImageUrl}`)
                    } else {
                        console.warn(`[Webflow Publish] Asset upload failed: ${assetResult.error}`)
                        // Fallback to original URL if not localhost (might work if public)
                        if (isLocalhost) featuredImageUrl = null
                    }
                }
            } catch (err) {
                console.error(`[Webflow Publish] Error processing image:`, err)
                if (isLocalhost) featuredImageUrl = null
            }
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
                featuredImageUrl,
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
