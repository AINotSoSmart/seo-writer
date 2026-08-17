/* eslint-disable @typescript-eslint/no-explicit-any -- inventory tables are unavailable until the forward migration is applied and types regenerated. */
import "server-only"

import { createHash } from "node:crypto"

import {
    batchExtractHtmlSnapshots,
    batchExtractTitles,
    fetchAllSitemapUrls,
    filterContentUrls,
} from "@/lib/audit/site-scanner"
import { HARVEST_POLICY } from "@/lib/harvest/policy"

export type InventoryPageKind =
    | "home"
    | "blog"
    | "product"
    | "feature"
    | "comparison"
    | "docs"
    | "other"

export interface InventoryPage {
    id?: string
    canonicalUrl: string
    title: string
    titleSource: string
    pageKind: InventoryPageKind
    contentExcerpt: string | null
    fetchStatus: "discovered" | "fetched" | "failed"
}

export interface SiteInventoryResult {
    runId: string
    sitemapUrlCount: number
    truncated: boolean
    pages: InventoryPage[]
}

export function canonicalizeInventoryUrl(value: string): string | null {
    try {
        const url = new URL(value)
        if (url.protocol !== "https:") return null
        url.hash = ""
        url.search = ""
        url.hostname = url.hostname.toLowerCase().replace(/^www\./, "")
        if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "")
        return url.toString()
    } catch {
        return null
    }
}

export function classifyInventoryPage(url: string): InventoryPageKind {
    const path = new URL(url).pathname.toLowerCase()
    if (path === "/") return "home"
    if (/\/(blog|articles?|resources?|guides?)\//.test(path)) return "blog"
    if (/\/(compare|comparison|vs)(\/|-)/.test(path) || /-vs-/.test(path)) {
        return "comparison"
    }
    if (/\/(docs?|documentation|help|support|knowledge-base)\//.test(path)) return "docs"
    if (/\/(features?|solutions?|use-cases?)\//.test(path)) return "feature"
    if (/\/(products?|apps?|tools?)\//.test(path)) return "product"
    return "other"
}

function contentHash(value: string | null): string | null {
    if (!value) return null
    return createHash("sha256").update(value).digest("hex")
}

/** Crawls the full bounded sitemap and freezes the page facts used by planning. */
export async function syncSiteInventory(input: {
    supabase: any
    userId: string
    brandId: string
    websiteUrl: string
}): Promise<SiteInventoryResult> {
    const { supabase, userId, brandId, websiteUrl } = input
    const staleBefore = new Date(Date.now() - 30 * 60_000).toISOString()
    await supabase
        .from("site_inventory_runs")
        .update({
            status: "failed",
            failure_code: "abandoned",
            completed_at: new Date().toISOString(),
        })
        .eq("brand_id", brandId)
        .eq("status", "running")
        .lt("started_at", staleBefore)

    const { data: run, error: runError } = await supabase
        .from("site_inventory_runs")
        .insert({ user_id: userId, brand_id: brandId, status: "running" })
        .select("id")
        .single()
    if (runError || !run) {
        throw new Error(`Could not start site inventory: ${runError?.message ?? "unknown"}`)
    }

    try {
        const rawUrls = await fetchAllSitemapUrls(websiteUrl)
        const canonicalUrls = Array.from(
            new Set(
                filterContentUrls(rawUrls)
                    .map(canonicalizeInventoryUrl)
                    .filter((url): url is string => Boolean(url)),
            ),
        )
        if (canonicalUrls.length === 0) {
            throw new Error("No same-site content URLs were found in the website sitemap.")
        }

        const [titles, snapshots] = await Promise.all([
            batchExtractTitles(canonicalUrls, 8),
            batchExtractHtmlSnapshots(canonicalUrls, 6),
        ])
        const snapshotByUrl = new Map(
            snapshots.map((snapshot) => [canonicalizeInventoryUrl(snapshot.url), snapshot]),
        )
        const pages: InventoryPage[] = titles.map((title) => {
            const canonicalUrl = canonicalizeInventoryUrl(title.url)!
            const snapshot = snapshotByUrl.get(canonicalUrl)
            return {
                canonicalUrl,
                title: title.title,
                titleSource: title.source,
                pageKind: classifyInventoryPage(canonicalUrl),
                contentExcerpt: snapshot?.content ?? null,
                fetchStatus: snapshot ? "fetched" : "discovered",
            }
        })

        const now = new Date().toISOString()
        const { data: stored, error: pageError } = await supabase
            .from("site_inventory_pages")
            .upsert(
                pages.map((page) => ({
                    user_id: userId,
                    brand_id: brandId,
                    inventory_run_id: run.id,
                    canonical_url: page.canonicalUrl,
                    title: page.title,
                    title_source: page.titleSource,
                    page_kind: page.pageKind,
                    content_excerpt: page.contentExcerpt,
                    content_hash: contentHash(page.contentExcerpt),
                    fetch_status: page.fetchStatus,
                    last_seen_at: now,
                    updated_at: now,
                })),
                { onConflict: "inventory_run_id,canonical_url" },
            )
            .select("id, canonical_url")
        if (pageError) throw new Error(`Could not save site inventory: ${pageError.message}`)

        const idByUrl = new Map<string, string>(
            (stored ?? []).map((row: any) => [row.canonical_url, row.id]),
        )
        for (const page of pages) page.id = idByUrl.get(page.canonicalUrl)

        const truncated = rawUrls.length >= HARVEST_POLICY.maxSitemapUrls
        const { error: completionError } = await supabase
            .from("site_inventory_runs")
            .update({
                status: "completed",
                sitemap_url_count: rawUrls.length,
                page_count: pages.length,
                truncated,
                completed_at: now,
            })
            .eq("id", run.id)
        if (completionError) {
            throw new Error(`Could not complete site inventory: ${completionError.message}`)
        }

        return { runId: run.id, sitemapUrlCount: rawUrls.length, truncated, pages }
    } catch (error) {
        await supabase
            .from("site_inventory_runs")
            .update({
                status: "failed",
                failure_code: "inventory_failed",
                completed_at: new Date().toISOString(),
            })
            .eq("id", run.id)
        throw error
    }
}
