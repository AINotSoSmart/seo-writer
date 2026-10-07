/* eslint-disable @typescript-eslint/no-explicit-any -- engine tables are absent from generated database types until the migration is applied and types regenerated. */
import "server-only"

import { tasks } from "@trigger.dev/sdk/v3"

import type { generateBlogPost } from "@/trigger/generate-blog"

import { nearestPages } from "./evidence"
import { generateEmbedding } from "@/lib/gemini-embedding"
import { judgeDuplicate, type MissingItem } from "./judge"
import { htmlToText } from "./page-text"
import { writeRefresh } from "./refresh-writer"
import { loadEngineSettings } from "./settings"

/** What the action's evidence column holds. */
export interface ActionEvidence {
    questions: string[]
    confirmedGaps: number
    bucketWhy: string
    coveringPage: { id: string; url: string; title: string; source: string; quotes: string[] } | null
    missingItems: MissingItem[]
    citedPages: Array<{ url: string; count: number; read: boolean }>
    nearestPages: Array<{ url: string; title: string; source: string; similarity: number }>
    droppedItems: number
    rejectedClaims: Array<{ pageId: string; reason: string }>
}

export interface BrandContext {
    name: string
    identity: string
    facts: string[]
}

function list(value: unknown): string[] {
    if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean)
    if (typeof value === "string" && value.trim()) return [value.trim()]
    return []
}

/** The tool's own description: the only source a writer may state product claims from. */
export async function loadBrandContext(admin: any, brandId: string): Promise<BrandContext> {
    const { data: brand } = await admin
        .from("brand_details")
        .select("website_url, brand_data")
        .eq("id", brandId)
        .single()
    const data = (brand?.brand_data ?? {}) as Record<string, any>
    return {
        name: String(data.product_name || brand?.website_url || "the tool"),
        identity: String(data.product_identity?.literally || data.category || ""),
        facts: [...list(data.core_features), ...list(data.how_it_works), ...list(data.pricing)].slice(0, 24),
    }
}

/**
 * Starts writing a new article for a create action through the existing
 * writer. The brief carries the questions, the cited pages and the verified
 * points any answer must cover; nothing else is invented here.
 */
export async function startCreate(admin: any, actionId: string): Promise<void> {
    const { data: action } = await admin
        .from("engine_actions")
        .select("id, brand_id, user_id, kind, state, title, prompts, evidence, article_id")
        .eq("id", actionId)
        .single()
    if (!action || action.kind !== "create" || action.state !== "planned") return

    const evidence = (action.evidence ?? {}) as ActionEvidence
    const questions: string[] = action.prompts ?? []
    const keyword = questions[0] ?? action.title
    const slug = `${action.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 70)}`

    const { data: article, error } = await admin
        .from("articles")
        .insert({
            user_id: action.user_id,
            brand_id: action.brand_id,
            keyword,
            slug,
            status: "queued",
            delivery_visible_at: new Date().toISOString(),
        })
        .select("id")
        .single()
    if (error || !article) {
        await markFailed(admin, actionId, `Could not create the article row: ${error?.message}`)
        return
    }

    const mustCover = (evidence.missingItems ?? [])
        .map((item) => `- ${item.item} (source: ${item.sourceUrl})`)
        .join("\n")
    const instructions = [
        `This article exists because AI answer engines did not mention us for these buyer questions. Answer them directly and completely:`,
        ...questions.map((question) => `- ${question}`),
        mustCover ? `\nThe pages the engines cited cover these points; the article must cover each accurately:\n${mustCover}` : "",
    ]
        .filter(Boolean)
        .join("\n")

    try {
        const handle = await tasks.trigger<typeof generateBlogPost>("generate-blog-post", {
            articleId: article.id,
            keyword,
            brandId: action.brand_id,
            title: action.title,
            supportingKeywords: questions.slice(1),
            instructions,
            sourceQueries: questions,
            clusterCompetitorUrls: (evidence.citedPages ?? []).map((page) => page.url).slice(0, 6),
        })
        await admin
            .from("engine_actions")
            .update({
                state: "producing",
                article_id: article.id,
                attempts: 1,
                output: { triggerRunId: handle.id },
                updated_at: new Date().toISOString(),
            })
            .eq("id", actionId)
    } catch (triggerError) {
        await admin.from("articles").update({ status: "failed", error_message: "Writer could not be queued" }).eq("id", article.id)
        await markFailed(admin, actionId, `The writer could not be queued: ${triggerError instanceof Error ? triggerError.message : triggerError}`)
    }
}

/**
 * A site page that is not in WordPress cannot be rewritten here. Its output is
 * the list of verified points it lacks, each with the cited page and passage,
 * for the owner to apply in the page's repository.
 */
export function pageSuggestionOutput(evidence: ActionEvidence) {
    return {
        targetUrl: evidence.coveringPage?.url ?? null,
        coveringQuotes: evidence.coveringPage?.quotes ?? [],
        suggestions: (evidence.missingItems ?? []).map((item) => ({
            id: item.id,
            add: item.item,
            why: item.why,
            sourceUrl: item.sourceUrl,
            sourceQuote: item.sourceQuote,
        })),
    }
}

export async function markFailed(admin: any, actionId: string, reason: string): Promise<void> {
    await admin
        .from("engine_actions")
        .update({ state: "failed", failure_reason: reason.slice(0, 1000), updated_at: new Date().toISOString() })
        .eq("id", actionId)
}

/** Writes and stores a refresh. Never writes to WordPress. */
export async function produceRefresh(admin: any, actionId: string): Promise<"ready" | "failed" | "skipped"> {
    const { data: action } = await admin
        .from("engine_actions")
        .select("id, brand_id, kind, state, prompts, evidence, inventory_page_id, attempts")
        .eq("id", actionId)
        .single()
    if (!action || action.kind !== "refresh" || !["planned", "producing"].includes(action.state)) return "skipped"

    const { data: page } = await admin
        .from("engine_inventory_pages")
        .select("id, source, wp_object_type, wp_object_id")
        .eq("id", action.inventory_page_id)
        .maybeSingle()
    if (!page || page.source !== "wordpress" || !page.wp_object_id) {
        await markFailed(admin, actionId, "The post to refresh is no longer in WordPress.")
        return "failed"
    }

    const settings = await loadEngineSettings(admin, action.brand_id)
    if (!settings.wordpressConnectionId) {
        await markFailed(admin, actionId, "The tool has no WordPress connection to read the post from.")
        return "failed"
    }

    await admin
        .from("engine_actions")
        .update({ state: "producing", attempts: (action.attempts ?? 0) + 1, updated_at: new Date().toISOString() })
        .eq("id", actionId)

    const evidence = (action.evidence ?? {}) as ActionEvidence
    const output = await writeRefresh({
        admin,
        connectionId: settings.wordpressConnectionId,
        wordpressType: page.wp_object_type === "page" ? "page" : "post",
        wordpressId: Number(page.wp_object_id),
        questions: action.prompts ?? [],
        missingItems: evidence.missingItems ?? [],
        brand: await loadBrandContext(admin, action.brand_id),
    })
    await admin
        .from("engine_actions")
        .update({ state: "ready", output, failure_reason: null, updated_at: new Date().toISOString() })
        .eq("id", actionId)
    return "ready"
}

/**
 * Moves create actions on once their article is written: the finished draft
 * passes the duplicate guard a second time, now with its real text, before it
 * is shown as ready.
 */
export async function advanceCreate(admin: any, action: any): Promise<string> {
    if (!action.article_id) return action.state
    const { data: article } = await admin
        .from("articles")
        .select("id, status, raw_content, final_html, error_message, outline")
        .eq("id", action.article_id)
        .maybeSingle()
    if (!article) {
        await markFailed(admin, action.id, "The article row disappeared.")
        return "failed"
    }
    if (article.status === "failed") {
        await markFailed(admin, action.id, `The writer failed: ${article.error_message ?? "unknown error"}`)
        return "failed"
    }
    if (article.status !== "completed") return action.state

    const draftText = article.raw_content || htmlToText(article.final_html || "").text
    const brand = await loadBrandContext(admin, action.brand_id)
    const { data: pages } = await admin
        .from("engine_inventory_pages")
        .select("id, canonical_url, source, title, content_text, embedding, article_id")
        .eq("brand_id", action.brand_id)
        .is("gone_at", null)
    const candidates: Array<{ id: string; embedding: number[] | null; canonical_url: string; title: string; content_text: string }> =
        (pages ?? []).filter((page: any) => page.article_id !== article.id && page.content_text)

    let duplicateCheck: any = { stage: "draft", duplicateOfId: null, reason: "Nothing similar exists." }
    if (candidates.length > 0) {
        const query = await generateEmbedding(`${action.title}\n\n${draftText}`.slice(0, 6_000), "RETRIEVAL_QUERY")
        const nearest = nearestPages([query], candidates, 5).map((hit) => hit.page)
        const verdict = await judgeDuplicate({
            brandName: brand.name,
            proposal: { title: action.title, questions: action.prompts ?? [], text: draftText },
            existing: nearest.map((page) => ({
                id: page.id,
                url: page.canonical_url,
                title: page.title,
                text: page.content_text,
            })),
        })
        const hit = nearest.find((page) => page.id === verdict.duplicateOfId)
        duplicateCheck = {
            stage: "draft",
            duplicateOfId: verdict.duplicateOfId,
            duplicateOfUrl: hit?.canonical_url ?? null,
            overlapQuote: verdict.overlapQuote,
            reason: verdict.reason,
            compared: nearest.map((page) => page.canonical_url),
        }
    }

    const state = duplicateCheck.duplicateOfId ? "blocked_duplicate" : "ready"
    await admin
        .from("engine_actions")
        .update({
            state,
            duplicate_check: { ...(action.duplicate_check ?? {}), draft: duplicateCheck },
            updated_at: new Date().toISOString(),
        })
        .eq("id", action.id)
    return state
}
