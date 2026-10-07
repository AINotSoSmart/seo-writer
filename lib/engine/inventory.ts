/* eslint-disable @typescript-eslint/no-explicit-any -- engine tables are absent from generated database types until the migration is applied and types regenerated. */
import "server-only"

import { createHash } from "node:crypto"

import { fetchAllSitemapUrls, filterContentUrls } from "@/lib/audit/site-scanner"
import { generateEmbedding } from "@/lib/gemini-embedding"
import { wordpressAuthHeader } from "@/lib/integrations/wordpress-credentials"
import { canonicalizeInventoryUrl } from "@/lib/visibility/site-inventory"

import { htmlToText, MAX_PAGE_TEXT_CHARS, readPages } from "./page-text"
import type { EngineSettings, EngineWordPressConnection } from "./settings"
import { loadWordPressConnection } from "./settings"

export type InventorySource = "wordpress" | "sitemap" | "app_article"

export interface InventoryPage {
    id: string
    canonicalUrl: string
    source: InventorySource
    wpObjectType: string | null
    wpObjectId: number | null
    wpStatus: string | null
    articleId: string | null
    title: string
    text: string
    modifiedAt: string | null
    embedding: number[] | null
}

/** Sitemap-only site pages read per week. Marketing sites are far smaller. */
const MAX_SITEMAP_PAGES = 250

export interface WordPressItem {
    id: number
    type: "post" | "page"
    status: string
    link: string
    title: string
    rawContent: string
    modifiedGmt: string | null
}

/**
 * Every post and page in the tool's WordPress, in every status.
 *
 * This is the reason the engine can say "you already have this" with
 * certainty: the REST API lists the whole site, drafts included, instead of a
 * sitemap sample of what happens to be public.
 */
export async function listWordPressItems(connection: EngineWordPressConnection): Promise<WordPressItem[]> {
    const base = connection.site_url.replace(/\/+$/, "") + "/wp-json/wp/v2"
    const headers = { Authorization: wordpressAuthHeader(connection) }
    const items: WordPressItem[] = []
    for (const type of ["posts", "pages"] as const) {
        for (let page = 1; page <= 50; page++) {
            const url =
                `${base}/${type}?context=edit&per_page=100&page=${page}` +
                `&status=publish,draft,pending,private,future` +
                `&_fields=id,type,status,link,title,content,modified_gmt`
            const response = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) })
            if (response.status === 400 && page > 1) break // past the last page
            if (!response.ok) {
                throw new Error(`WordPress ${type} listing failed: HTTP ${response.status}`)
            }
            const rows = (await response.json()) as any[]
            for (const row of rows) {
                items.push({
                    id: Number(row.id),
                    type: type === "posts" ? "post" : "page",
                    status: String(row.status || ""),
                    link: String(row.link || ""),
                    title: String(row.title?.raw ?? row.title?.rendered ?? ""),
                    rawContent: String(row.content?.raw ?? row.content?.rendered ?? ""),
                    modifiedGmt: row.modified_gmt ? new Date(`${row.modified_gmt}Z`).toISOString() : null,
                })
            }
            const totalPages = Number(response.headers.get("x-wp-totalpages") || "1")
            if (page >= totalPages || rows.length === 0) break
        }
    }
    return items
}

/** One WordPress post or page, fresh, with its raw block content. */
export async function getWordPressItem(
    connection: EngineWordPressConnection,
    type: "post" | "page",
    id: number,
): Promise<WordPressItem> {
    const base = connection.site_url.replace(/\/+$/, "") + "/wp-json/wp/v2"
    const response = await fetch(`${base}/${type === "post" ? "posts" : "pages"}/${id}?context=edit`, {
        headers: { Authorization: wordpressAuthHeader(connection) },
        signal: AbortSignal.timeout(20_000),
    })
    if (!response.ok) throw new Error(`WordPress ${type} ${id} could not be read: HTTP ${response.status}`)
    const row = (await response.json()) as any
    return {
        id: Number(row.id),
        type,
        status: String(row.status || ""),
        link: String(row.link || ""),
        title: String(row.title?.raw ?? row.title?.rendered ?? ""),
        rawContent: String(row.content?.raw ?? ""),
        modifiedGmt: row.modified_gmt ? new Date(`${row.modified_gmt}Z`).toISOString() : null,
    }
}

function hash(value: string): string {
    return createHash("sha256").update(value).digest("hex")
}

function canonical(url: string): string {
    return canonicalizeInventoryUrl(url) ?? url
}

/** Text that represents a page for retrieval: title first, then the opening. */
export function embeddingText(title: string, text: string): string {
    return `${title}\n\n${text}`.slice(0, 6_000)
}

/**
 * Rebuilds the tool's inventory: WordPress (complete), sitemaps of every owned
 * host (site pages WordPress does not hold), and articles this app wrote that
 * are not in WordPress yet. Embeddings are recomputed only for changed pages.
 */
export async function syncEngineInventory(input: {
    admin: any
    settings: EngineSettings
    websiteUrl: string
}): Promise<{ pages: InventoryPage[]; notes: string[] }> {
    const { admin, settings } = input
    const notes: string[] = []
    const seenAt = new Date().toISOString()
    type Row = Omit<InventoryPage, "id" | "embedding">
    const rows = new Map<string, Row>()

    // 1. WordPress: the authoritative list of what the blog has.
    const connection = settings.wordpressConnectionId
        ? await loadWordPressConnection(admin, settings.wordpressConnectionId)
        : null
    if (connection) {
        const items = await listWordPressItems(connection)
        for (const item of items) {
            if (!item.link) continue
            const { text } = htmlToText(item.rawContent)
            rows.set(canonical(item.link), {
                canonicalUrl: canonical(item.link),
                source: "wordpress",
                wpObjectType: item.type,
                wpObjectId: item.id,
                wpStatus: item.status,
                articleId: null,
                title: item.title,
                text,
                modifiedAt: item.modifiedGmt,
            })
        }
        notes.push(`${items.length} WordPress posts and pages read.`)
    } else {
        notes.push("No WordPress site is linked to this tool, so existing posts are known only from sitemaps.")
    }

    // 2. Sitemaps of every owned host: site pages (e.g. Next.js) and any blog
    // post WordPress did not return.
    const sitemapUrls: string[] = []
    for (const host of settings.ownedHosts) {
        try {
            const urls = filterContentUrls(await fetchAllSitemapUrls(`https://${host}`))
            for (const url of urls) {
                const key = canonical(url)
                if (!rows.has(key) && !sitemapUrls.includes(key)) sitemapUrls.push(key)
            }
        } catch (error) {
            notes.push(`Sitemap for ${host} could not be read: ${error instanceof Error ? error.message : error}`)
        }
    }
    if (sitemapUrls.length > MAX_SITEMAP_PAGES) {
        notes.push(`Only the first ${MAX_SITEMAP_PAGES} of ${sitemapUrls.length} sitemap pages were read.`)
    }
    const read = await readPages(sitemapUrls.slice(0, MAX_SITEMAP_PAGES))
    for (const url of sitemapUrls.slice(0, MAX_SITEMAP_PAGES)) {
        const page = read.get(url)
        rows.set(url, {
            canonicalUrl: url,
            source: "sitemap",
            wpObjectType: null,
            wpObjectId: null,
            wpStatus: null,
            articleId: null,
            title: page?.title || new URL(url).pathname,
            text: page?.text ?? "",
            modifiedAt: null,
        })
    }

    // 3. Articles written here and not pushed yet. They are not on the site,
    // but planning a second article on the same question would still be a
    // duplicate.
    const { data: articles } = await admin
        .from("articles")
        .select("id, keyword, outline, raw_content, wordpress_post_id, status, updated_at")
        .eq("brand_id", settings.brandId)
        .in("status", ["completed", "queued", "researching", "outlining", "writing"])
        .is("wordpress_post_id", null)
    for (const article of articles ?? []) {
        if (article.outline?.isPatch) continue
        const key = `app-article:${article.id}`
        rows.set(key, {
            canonicalUrl: key,
            source: "app_article",
            wpObjectType: null,
            wpObjectId: null,
            wpStatus: article.status,
            articleId: article.id,
            title: String(article.outline?.title || article.keyword || ""),
            text: String(article.raw_content || article.keyword || "").slice(0, MAX_PAGE_TEXT_CHARS),
            modifiedAt: article.updated_at,
        })
    }

    // Persist, re-embedding only what changed.
    const { data: existing } = await admin
        .from("engine_inventory_pages")
        .select("id, canonical_url, embedding, embedded_hash")
        .eq("brand_id", settings.brandId)
    const previous = new Map<string, any>((existing ?? []).map((row: any) => [row.canonical_url, row]))

    const pages: InventoryPage[] = []
    for (const row of rows.values()) {
        const contentHash = hash(`${row.title}\n${row.text}`)
        const before = previous.get(row.canonicalUrl)
        let embedding: number[] | null = before?.embedded_hash === contentHash ? before.embedding : null
        if (!embedding && (row.title || row.text)) {
            try {
                embedding = await generateEmbedding(embeddingText(row.title, row.text), "RETRIEVAL_DOCUMENT")
            } catch {
                embedding = null
            }
        }
        const { data: stored, error } = await admin
            .from("engine_inventory_pages")
            .upsert(
                {
                    brand_id: settings.brandId,
                    user_id: settings.userId,
                    canonical_url: row.canonicalUrl,
                    source: row.source,
                    wp_object_type: row.wpObjectType,
                    wp_object_id: row.wpObjectId,
                    wp_status: row.wpStatus,
                    article_id: row.articleId,
                    title: row.title,
                    content_text: row.text,
                    content_hash: contentHash,
                    embedding,
                    embedded_hash: embedding ? contentHash : null,
                    modified_at: row.modifiedAt,
                    last_seen_at: seenAt,
                    gone_at: null,
                    updated_at: seenAt,
                },
                { onConflict: "brand_id,canonical_url" },
            )
            .select("id")
            .single()
        if (error || !stored) throw new Error(`Could not save inventory page ${row.canonicalUrl}: ${error?.message}`)
        pages.push({ ...row, id: stored.id, embedding })
    }

    // Pages that disappeared are kept for history but never matched again.
    await admin
        .from("engine_inventory_pages")
        .update({ gone_at: seenAt })
        .eq("brand_id", settings.brandId)
        .lt("last_seen_at", seenAt)
        .is("gone_at", null)

    return { pages, notes }
}
