import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import {
    prepareContentForWordPress,
    publishToWordPress,
    updatePostStatus,
    uploadContentImagesToWordPress,
} from "@/lib/integrations/wordpress-client"
import { createAdminClient } from "@/utils/supabase/admin"

function canonicalPublicationUrl(value: string): string {
    const url = new URL(value)
    url.hash = ""
    url.search = ""
    url.pathname = url.pathname.replace(/\/+$/, "") || "/"
    return url.toString()
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }
        const admin = createAdminClient() as any

        const body = await req.json()
        const { articleId, connectionId, publishStatus = 'publish' } = body

        if (!articleId || !connectionId) {
            return NextResponse.json({ error: "Missing articleId or connectionId" }, { status: 400 })
        }

        // 1. Fetch the article
        const { data: article, error: articleError } = await (supabase as any)
            .from("articles")
            .select("id, outline, final_html, meta_description, slug, featured_image_url, user_id, planned_article_id")
            .eq("id", articleId)
            .eq("user_id", user.id)
            .single()

        if (articleError || !article) {
            console.error(`[WP Publish API] Article not found: ${articleId}`)
            return NextResponse.json({ error: "Article not found" }, { status: 404 })
        }

        if (!article.final_html) {
            return NextResponse.json({ error: "Article has no content to publish" }, { status: 400 })
        }

        // 2. Fetch the WordPress connection
        const { data: connection, error: connectionError } = await supabase
            .from("wordpress_connections")
            .select("id, site_url, username, app_password, default_category_id")
            .eq("id", connectionId)
            .eq("user_id", user.id)
            .single()

        if (connectionError || !connection) {
            console.error(`[WP Publish API] Connection not found: ${connectionId}`)
            return NextResponse.json({ error: "WordPress connection not found" }, { status: 404 })
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL
            || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

        // 3. Get the featured image URL (use proxy if needed)
        let featuredImageUrl = article.featured_image_url
        if (featuredImageUrl && featuredImageUrl.includes('.r2.cloudflarestorage.com/')) {
            // Convert to proxy URL for fetching
            const key = featuredImageUrl.split('.r2.cloudflarestorage.com/')[1]
            featuredImageUrl = `${appUrl}/api/images/${key}`
        } else if (featuredImageUrl && featuredImageUrl.startsWith('/api/images/')) {
            // Already a relative proxy URL - make it absolute
            featuredImageUrl = `${appUrl}${featuredImageUrl}`
        }


        // 4. Upload section images to WordPress media library and replace R2 URLs
        const credentials = {
            siteUrl: connection.site_url,
            username: connection.username,
            appPassword: connection.app_password,
        }

        let processedContent = article.final_html
        try {
            processedContent = await uploadContentImagesToWordPress(
                credentials,
                article.final_html,
                appUrl
            )
        } catch (imgError) {
            console.error('[WP Publish API] Section images processing failed:', imgError)
            // Continue with original content - non-blocking
        }

        // 4b. Prepare content for WordPress (strip H1, convert to Gutenberg blocks)
        processedContent = prepareContentForWordPress(processedContent)

        // 5. Publish to WordPress
        const { data: plannedArticle } = article.planned_article_id
            ? await (supabase as any)
                  .from("planned_articles")
                  .select("id, slug, target_url")
                  .eq("id", article.planned_article_id)
                  .eq("user_id", user.id)
                  .maybeSingle()
            : { data: null }

        // Program posts are created as drafts first. This lets us verify the
        // actual permalink before any public publication can break the graph.
        const createStatus = plannedArticle ? "draft" : publishStatus
        let result = await publishToWordPress(
            credentials,
            {
                title: article.outline?.title || 'Untitled',
                content: processedContent,
                excerpt: article.meta_description || undefined,
                slug: plannedArticle?.slug || article.slug || undefined,
                featuredImageUrl,
                categoryId: connection.default_category_id || null,
            },
            createStatus,
        )

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 })
        }

        const returnedUrl = result.post?.link
        if (
            plannedArticle?.target_url &&
            (
                !returnedUrl ||
                canonicalPublicationUrl(returnedUrl) !==
                    canonicalPublicationUrl(plannedArticle.target_url)
            )
        ) {
            await Promise.all([
                admin
                    .from("articles")
                    .update({
                        wordpress_post_id: String(result.post?.id),
                        wordpress_post_url: returnedUrl,
                        wordpress_site_id: connectionId,
                        published_at: null,
                    })
                    .eq("id", articleId),
                admin
                    .from("planned_articles")
                    .update({
                        publication_status: "draft",
                        publication_url: returnedUrl,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", plannedArticle.id),
            ])
            return NextResponse.json(
                {
                    error:
                        "WordPress returned a permalink that does not match the frozen URL. The post was kept as a draft.",
                    code: "permalink_mismatch",
                    expectedUrl: plannedArticle.target_url,
                    actualUrl: returnedUrl,
                    postId: result.post?.id,
                },
                { status: 409 },
            )
        }

        if (plannedArticle && publishStatus === "publish" && result.post?.id) {
            result = await updatePostStatus(credentials, result.post.id, "publish")
            if (!result.success) {
                return NextResponse.json(
                    {
                        error:
                            result.error ||
                            "The permalink matched, but WordPress could not publish the draft.",
                    },
                    { status: 502 },
                )
            }
            const publishedUrl = result.post?.link
            if (
                !publishedUrl ||
                canonicalPublicationUrl(publishedUrl) !==
                    canonicalPublicationUrl(plannedArticle.target_url)
            ) {
                await updatePostStatus(credentials, result.post!.id, "draft")
                await Promise.all([
                    admin
                        .from("articles")
                        .update({
                            wordpress_post_id: String(result.post?.id),
                            wordpress_post_url: publishedUrl || null,
                            wordpress_site_id: connectionId,
                            published_at: null,
                        })
                        .eq("id", articleId)
                        .eq("user_id", user.id),
                    admin
                        .from("planned_articles")
                        .update({
                            publication_status: "draft",
                            publication_url: publishedUrl || null,
                            published_at: null,
                            updated_at: new Date().toISOString(),
                        })
                        .eq("id", plannedArticle.id)
                        .eq("user_id", user.id),
                ])
                return NextResponse.json(
                    {
                        error:
                            "WordPress changed the permalink while publishing. The post was returned to draft.",
                        code: "permalink_mismatch",
                        expectedUrl: plannedArticle.target_url,
                        actualUrl: publishedUrl || null,
                    },
                    { status: 409 },
                )
            }
        }

        const isPublished = result.post?.status === "publish"
        const publicationTime = isPublished ? new Date().toISOString() : null
        await admin
            .from("articles")
            .update({
                wordpress_post_id: String(result.post?.id),
                wordpress_post_url: result.post?.link,
                wordpress_site_id: connectionId,
                published_at: publicationTime,
            })
            .eq("id", articleId)

        if (plannedArticle) {
            await admin
                .from("planned_articles")
                .update({
                    publication_status: isPublished ? "published" : "draft",
                    publication_url: result.post?.link,
                    published_at: publicationTime,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", plannedArticle.id)
        }

        return NextResponse.json({
            success: true,
            postId: result.post?.id,
            postUrl: result.post?.link,
            status: result.post?.status,
        })

    } catch (error: any) {
        console.error("WordPress publish error:", error)
        return NextResponse.json(
            { error: error.message || "Failed to publish" },
            { status: 500 }
        )
    }
}
