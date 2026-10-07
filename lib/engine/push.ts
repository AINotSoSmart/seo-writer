/* eslint-disable @typescript-eslint/no-explicit-any -- engine tables are absent from generated database types until the migration is applied and types regenerated. */
import "server-only"

import {
    prepareContentForWordPress,
    publishToWordPress,
    uploadContentImagesToWordPress,
} from "@/lib/integrations/wordpress-client"
import { openAppPassword } from "@/lib/integrations/wordpress-credentials"

import type { EngineWordPressConnection } from "./settings"

/**
 * Sends a finished article to WordPress as a draft — the same steps as
 * /api/wordpress/publish (images into the media library, Gutenberg blocks),
 * and the same rule: the app never publishes.
 */
export async function pushArticleDraft(
    admin: any,
    articleId: string,
    connection: EngineWordPressConnection,
): Promise<{ postId: number; postUrl: string }> {
    const { data: article } = await admin
        .from("articles")
        .select("id, outline, final_html, meta_description, slug, featured_image_url, wordpress_post_id")
        .eq("id", articleId)
        .single()
    if (!article?.final_html) throw new Error("The article has no content yet.")
    if (article.wordpress_post_id) throw new Error("This article is already in WordPress.")

    const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://127.0.0.1:3000")
    let featuredImageUrl: string | undefined = article.featured_image_url || undefined
    if (featuredImageUrl?.includes(".r2.cloudflarestorage.com/")) {
        featuredImageUrl = `${appUrl}/api/images/${featuredImageUrl.split(".r2.cloudflarestorage.com/")[1]}`
    } else if (featuredImageUrl?.startsWith("/api/images/")) {
        featuredImageUrl = `${appUrl}${featuredImageUrl}`
    }

    const credentials = {
        siteUrl: connection.site_url,
        username: connection.username,
        appPassword: openAppPassword(connection.app_password),
    }
    let content = article.final_html as string
    try {
        content = await uploadContentImagesToWordPress(credentials, content, appUrl)
    } catch (error) {
        console.error("[engine] Section image upload failed; pushing without re-hosted images:", error)
    }
    content = prepareContentForWordPress(content)

    const result = await publishToWordPress(
        credentials,
        {
            title: article.outline?.title || "Untitled",
            content,
            excerpt: article.meta_description || undefined,
            slug: article.slug || undefined,
            featuredImageUrl,
            categoryId: connection.default_category_id || null,
        },
        "draft",
    )
    if (!result.success || !result.post) throw new Error(result.error || "WordPress refused the draft.")

    await admin
        .from("articles")
        .update({
            wordpress_post_id: String(result.post.id),
            wordpress_post_url: result.post.link,
            wordpress_site_id: connection.id,
            published_at: null,
        })
        .eq("id", articleId)
    return { postId: Number(result.post.id), postUrl: String(result.post.link || "") }
}
