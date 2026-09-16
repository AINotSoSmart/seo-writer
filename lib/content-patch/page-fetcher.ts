import { createAdminClient } from "@/utils/supabase/admin"
import { parseHtmlToContentDocument } from "./content-document.ts"
import type { ContentDocument } from "./content-document.ts"

export interface PageFetchResult {
    success: boolean
    document?: ContentDocument
    snapshotId?: string
    requiresManualInput?: boolean
    error?: string
}

/**
 * Fetches the current live content for a target page, normalizes it into
 * a ContentDocument, and stores a durable snapshot in page_source_snapshots.
 *
 * If standard HTTP fetch is blocked (403, Cloudflare, etc.), checks for a
 * connected WordPress site matching the host and attempts an authenticated fetch.
 */
export async function fetchAndSnapshotPage(input: {
    url: string
    brandId: string
    userId: string
    supabase?: any
}): Promise<PageFetchResult> {
    const { url, brandId, userId } = input
    const db = input.supabase || createAdminClient()

    let rawHtml: string | null = null
    let sourceType: "html" | "wordpress" | "manual" = "html"
    let cmsConnectionId: string | null = null
    let cmsObjectType: string | null = null
    let cmsObjectId: number | null = null
    let sourceModifiedAt: string | null = null

    // 1. Attempt standard HTTP fetch
    try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15_000)

        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 FlipAEOBot/1.0",
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            },
            redirect: "follow",
        })
        clearTimeout(timeoutId)

        if (response.ok) {
            const text = await response.text()
            if (text && text.length > 200) {
                rawHtml = text
            }
        }
    } catch {
        // Direct fetch failed (network timeout, bot protection, etc.)
    }

    // 2. CMS Fallback: If HTTP fetch failed or was blocked, check for connected WordPress
    if (!rawHtml) {
        try {
            const urlObj = new URL(url)
            const hostname = urlObj.hostname.toLowerCase().replace(/^www\./, "")

            const { data: connection } = await db
                .from("wordpress_connections")
                .select("id, site_url, username, app_password")
                .eq("user_id", userId)
                .ilike("site_url", `%${hostname}%`)
                .maybeSingle()

            if (connection) {
                const slug = urlObj.pathname.replace(/^\/|\/$/g, "").split("/").pop() || ""
                const authHeader = `Basic ${Buffer.from(`${connection.username}:${connection.app_password}`).toString("base64")}`
                const wpApiBase = connection.site_url.replace(/\/+$/, "") + "/wp-json/wp/v2"

                // Try posts first, then pages
                for (const type of ["posts", "pages"]) {
                    const wpRes = await fetch(`${wpApiBase}/${type}?slug=${encodeURIComponent(slug)}&context=edit`, {
                        headers: { Authorization: authHeader },
                        signal: AbortSignal.timeout(10_000),
                    })
                    if (wpRes.ok) {
                        const items = await wpRes.json()
                        if (Array.isArray(items) && items.length > 0) {
                            const post = items[0]
                            rawHtml = post.content?.raw || post.content?.rendered || ""
                            sourceType = "wordpress"
                            cmsConnectionId = connection.id
                            cmsObjectType = type === "posts" ? "post" : "page"
                            cmsObjectId = post.id
                            sourceModifiedAt = post.modified_gmt ? new Date(`${post.modified_gmt}Z`).toISOString() : null
                            break
                        }
                    }
                }
            }
        } catch {
            // WordPress fallback failed
        }
    }

    // 3. If still no HTML, return graceful manual fallback requirement
    if (!rawHtml) {
        return {
            success: false,
            requiresManualInput: true,
            error: "Unable to retrieve current page content automatically. Please import or paste the live content.",
        }
    }

    // 4. Normalize into ContentDocument
    const document = parseHtmlToContentDocument(url, rawHtml, sourceType, {
        cmsConnectionId,
        cmsObjectType,
        cmsObjectId,
    })

    // 5. Store snapshot in database
    const { data: snapshot, error: snapshotError } = await db
        .from("page_source_snapshots")
        .insert({
            user_id: userId,
            brand_id: brandId,
            target_url: url,
            source_type: sourceType,
            cms_connection_id: cmsConnectionId,
            cms_object_type: cmsObjectType,
            cms_object_id: cmsObjectId,
            source_content: rawHtml,
            normalized_document: document as any,
            source_hash: document.sourceHash,
            source_modified_at: sourceModifiedAt,
            fetched_at: new Date().toISOString(),
        })
        .select("id")
        .single()

    if (snapshotError) {
        console.error("[fetchAndSnapshotPage] Failed to save snapshot:", snapshotError)
    }

    return {
        success: true,
        document,
        snapshotId: snapshot?.id,
    }
}
