import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { parseHtmlToContentDocument } from "@/lib/content-patch/content-document"
import type { ContentPatch } from "@/lib/content-patch/patch-types"
import { WordPressAdapter } from "@/lib/content-patch/publishing/wordpress-adapter"

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const admin = createAdminClient() as any

    // 1. Fetch article
    const { data: article, error: articleError } = await admin
        .from("articles")
        .select("id, user_id, brand_id, planned_article_id, outline, final_html, raw_content")
        .eq("id", id)
        .eq("user_id", user.id)
        .single()

    if (articleError || !article) {
        return NextResponse.json({ error: "Article not found" }, { status: 404 })
    }

    const outline = article.outline || {}
    if (!outline.isPatch || !outline.targetUrl) {
        return NextResponse.json(
            { error: "This article is not a page improvement patch or lacks a target URL." },
            { status: 400 }
        )
    }

    const targetUrl = outline.targetUrl as string
    const targetHost = new URL(targetUrl).hostname.toLowerCase().replace(/^www\./, "")

    // 2. Resolve WordPress connection for this host
    const { data: connection, error: connError } = await admin
        .from("wordpress_connections")
        .select("id, site_url, username, app_password")
        .eq("user_id", user.id)
        .ilike("site_url", `%${targetHost}%`)
        .maybeSingle()

    if (connError || !connection) {
        return NextResponse.json(
            {
                error: `No connected WordPress site matches ${targetHost}. Please connect WordPress under Integrations.`,
            },
            { status: 404 }
        )
    }

    // 3. Assemble ContentPatch and ContentDocument
    const patch: ContentPatch = {
        targetUrl,
        sourceHash: outline.sourceHash || "",
        changes: outline.changes || [],
        mergedDocumentHtml: article.final_html || "",
        mergedDocumentMarkdown: article.raw_content || "",
    }

    const adapter = new WordPressAdapter(connection)

    try {
        const targetDoc = await adapter.fetchExisting(targetUrl)
        const result = await adapter.applyPatch(targetDoc, patch)

        if (!result.success) {
            return NextResponse.json({ error: result.error || "WordPress update failed." }, { status: 502 })
        }

        // 4. Update publication status in database
        await admin
            .from("articles")
            .update({
                wordpress_post_url: result.postUrl,
                wordpress_post_id: result.postId ? Number(result.postId) : null,
                status: "published",
                updated_at: new Date().toISOString(),
            })
            .eq("id", article.id)

        if (article.planned_article_id) {
            await admin
                .from("planned_articles")
                .update({
                    publication_status: "published",
                    publication_url: result.postUrl,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", article.planned_article_id)
        }

        return NextResponse.json({
            success: true,
            postUrl: result.postUrl,
            message: `Live WordPress post updated successfully!`,
        })
    } catch (err: any) {
        console.error("[apply-patch] Failed to apply WordPress patch:", err)
        return NextResponse.json(
            { error: err?.message || "Failed to update WordPress post." },
            { status: 500 }
        )
    }
}
