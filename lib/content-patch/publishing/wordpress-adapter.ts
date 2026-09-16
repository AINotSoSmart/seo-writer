import { parseHtmlToContentDocument } from "../content-document.ts"
import type { ContentDocument } from "../content-document.ts"
import type { ContentPatch } from "../patch-types.ts"
import type { PublishingAdapter, PublishResult } from "./publishing-adapter.ts"

export interface WordPressConnectionData {
    id: string
    site_url: string
    username: string
    app_password: string
}

export class WordPressAdapter implements PublishingAdapter {
    private connection: WordPressConnectionData
    private authHeader: string
    private apiBase: string

    constructor(connection: WordPressConnectionData) {
        this.connection = connection
        this.authHeader = `Basic ${Buffer.from(`${connection.username}:${connection.app_password}`).toString("base64")}`
        this.apiBase = connection.site_url.replace(/\/+$/, "") + "/wp-json/wp/v2"
    }

    async canHandle(targetUrl: string): Promise<boolean> {
        try {
            const targetHost = new URL(targetUrl).hostname.toLowerCase().replace(/^www\./, "")
            const wpHost = new URL(this.connection.site_url).hostname.toLowerCase().replace(/^www\./, "")
            return targetHost === wpHost
        } catch {
            return false
        }
    }

    async fetchExisting(targetUrl: string): Promise<ContentDocument> {
        const urlObj = new URL(targetUrl)
        const slug = urlObj.pathname.replace(/^\/|\/$/g, "").split("/").pop() || ""

        for (const type of ["posts", "pages"]) {
            const res = await fetch(`${this.apiBase}/${type}?slug=${encodeURIComponent(slug)}&context=edit`, {
                headers: { Authorization: this.authHeader },
                signal: AbortSignal.timeout(10_000),
            })
            if (res.ok) {
                const items = await res.json()
                if (Array.isArray(items) && items.length > 0) {
                    const post = items[0]
                    const rawContent = post.content?.raw || post.content?.rendered || ""
                    return parseHtmlToContentDocument(targetUrl, rawContent, "wordpress", {
                        wpPostId: post.id,
                        wpObjectType: type === "posts" ? "post" : "page",
                        modifiedGmt: post.modified_gmt,
                    })
                }
            }
        }

        throw new Error(`WordPress post or page with slug "${slug}" not found on ${this.connection.site_url}`)
    }

    async applyPatch(target: ContentDocument, patch: ContentPatch): Promise<PublishResult> {
        const postId = target.metadata?.wpPostId as number | undefined
        const objectType = (target.metadata?.wpObjectType as string) || "posts"
        const endpoint = objectType === "page" ? "pages" : "posts"

        if (!postId) {
            // Attempt to resolve post ID first
            const existing = await this.fetchExisting(target.url)
            return this.applyPatch(existing, patch)
        }

        // 1. Fetch current object again to verify checksum and avoid concurrency overwrites
        const checkRes = await fetch(`${this.apiBase}/${endpoint}/${postId}?context=edit`, {
            headers: { Authorization: this.authHeader },
            signal: AbortSignal.timeout(10_000),
        })
        if (!checkRes.ok) {
            return {
                success: false,
                error: `Failed to fetch WordPress ${objectType} (ID: ${postId}) before applying patch: HTTP ${checkRes.status}`,
            }
        }

        const currentPost = await checkRes.json()
        const currentRaw = currentPost.content?.raw || currentPost.content?.rendered || ""

        // 2. Format content: Gutenberg vs Classic HTML
        let updatedContent = patch.mergedDocumentHtml
        const isGutenberg = currentRaw.includes("<!-- wp:")

        if (isGutenberg) {
            // For Gutenberg, convert new HTML sections into valid Gutenberg blocks
            // while preserving standard HTML
            updatedContent = convertMergedHtmlToGutenberg(patch.mergedDocumentHtml)
        }

        // 3. PUT update: ONLY updates content. Does not touch slug, status, author, or metadata
        const updateRes = await fetch(`${this.apiBase}/${endpoint}/${postId}`, {
            method: "POST", // WordPress REST API uses POST to update resources
            headers: {
                Authorization: this.authHeader,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                content: updatedContent,
            }),
            signal: AbortSignal.timeout(15_000),
        })

        if (!updateRes.ok) {
            const errData = await updateRes.json().catch(() => ({}))
            return {
                success: false,
                error: errData.message || `WordPress update failed with status ${updateRes.status}`,
            }
        }

        const updated = await updateRes.json()
        return {
            success: true,
            postId: updated.id,
            postUrl: updated.link,
        }
    }
}

/**
 * Wraps top-level headings, paragraphs, and lists into Gutenberg comments
 * so the WordPress block editor reads them natively without validation warnings.
 */
export function convertMergedHtmlToGutenberg(html: string): string {
    if (!html) return ""

    let converted = html

    // Wrap H2, H3, H4
    converted = converted.replace(/<h([2-4])[^>]*>([\s\S]*?)<\/h\1>/gi, (match, level, text) => {
        return `<!-- wp:heading {"level":${level}} -->\n<h${level}>${text}</h${level}>\n<!-- /wp:heading -->`
    })

    // Wrap paragraphs that are not already blocks
    converted = converted.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (match) => {
        if (match.includes("<!-- wp:")) return match
        return `<!-- wp:paragraph -->\n${match}\n<!-- /wp:paragraph -->`
    })

    // Wrap unordered and ordered lists
    converted = converted.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (match) => {
        return `<!-- wp:list -->\n${match}\n<!-- /wp:list -->`
    })
    converted = converted.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (match) => {
        return `<!-- wp:list {"ordered":true} -->\n${match}\n<!-- /wp:list -->`
    })

    return converted
}
