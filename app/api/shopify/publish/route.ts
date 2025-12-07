import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { publishToShopify } from "@/lib/integrations/shopify-client"

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
            .select("id, outline, final_html, meta_description, slug, featured_image_url, keyword, user_id")
            .eq("id", articleId)
            .eq("user_id", user.id)
            .single()

        if (articleError || !article) {
            return NextResponse.json({ error: "Article not found" }, { status: 404 })
        }

        if (!article.final_html) {
            return NextResponse.json({ error: "Article has no content to publish" }, { status: 400 })
        }

        // 2. Fetch the Shopify connection
        const { data: connection, error: connectionError } = await supabase
            .from("shopify_connections")
            .select("id, store_domain, access_token, blog_id, store_name")
            .eq("id", connectionId)
            .eq("user_id", user.id)
            .single()

        if (connectionError || !connection) {
            return NextResponse.json({ error: "Shopify connection not found" }, { status: 404 })
        }

        // 3. Get the featured image URL and fetch content
        let featuredImageAttachment: string | null = null
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

            try {
                console.log(`[Shopify Publish] Fetching image from: ${fetchUrl}`)
                const imageRes = await fetch(fetchUrl)
                if (imageRes.ok) {
                    const arrayBuffer = await imageRes.arrayBuffer()
                    featuredImageAttachment = Buffer.from(arrayBuffer).toString('base64')
                } else {
                    console.warn(`[Shopify Publish] Failed to fetch image: ${imageRes.status}`)
                }
            } catch (err) {
                console.error(`[Shopify Publish] Error fetching image:`, err)
            }
        }

        // 4. Fetch user info for author name
        const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .single()

        const authorName = profile?.full_name || user.email?.split('@')[0] || 'Admin'

        // 5. Publish to Shopify
        const result = await publishToShopify(
            {
                storeDomain: connection.store_domain,
                accessToken: connection.access_token,
            },
            connection.blog_id,
            {
                title: article.outline?.title || 'Untitled',
                content: article.final_html,
                author: authorName,
                tags: article.keyword || undefined,
                featuredImageUrl: null, // We use attachment
                featuredImageAttachment,
            },
            true // publishAsDraft
        )

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 })
        }

        // 6. Update article with Shopify info
        await supabase
            .from("articles")
            .update({
                shopify_article_id: String(result.articleId),
                shopify_article_url: result.articleUrl,
                shopify_connection_id: connectionId,
            })
            .eq("id", articleId)

        return NextResponse.json({
            success: true,
            articleId: result.articleId,
            articleUrl: result.articleUrl,
        })

    } catch (error: any) {
        console.error("Shopify publish error:", error)
        return NextResponse.json(
            { error: error.message || "Failed to publish" },
            { status: 500 }
        )
    }
}
