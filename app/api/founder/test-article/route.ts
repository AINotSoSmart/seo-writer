import { NextRequest, NextResponse } from "next/server"

import { generateBlogPost } from "@/trigger/generate-blog"
import { isFounderUser } from "@/lib/founder"
import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"

export const maxDuration = 60

/**
 * Founder-only single-article generation, for quality checks.
 *
 * Generating one article previously meant shipping a whole cluster: paying for
 * 10+ articles and waiting for the program scheduler, just to read one intro.
 * This runs the REAL writer against real brand data with an overridable title
 * and keyword, and nothing else.
 *
 * It deliberately bypasses the program pipeline rather than reproducing it:
 *
 *   - **No planned_articles row.** `plannedArticleId` is omitted, so every
 *     generation/delivery status write inside the task is skipped. Nothing can
 *     mark a real cluster generating, blocked, or delivered.
 *   - **No frozen link graph.** `frozenLinks` is empty, so the writer falls
 *     back to `getRelevantInternalLinks` — the same path used before programs
 *     existed. This is the "internal linking freezing point" concern: the graph
 *     is frozen at purchase-intent time and simply does not exist for a test
 *     article, and the writer already handles that.
 *   - **No credit consumption.** `consume_program_credit` lives in
 *     ship-cluster, never in the writer, so no paid allowance is spent.
 *   - **No program, cluster, or audit is touched.** The only row created is one
 *     `articles` record, tagged so it is obvious it was a test.
 *
 * Provider costs are real — this makes live Gemini, Tavily and fal.ai calls.
 *
 * POST body:
 *   brandId            required — supplies style_dna, product facts, search prefs
 *   title              required — the headline to test
 *   keyword            required — the primary search intent
 *   articleType        optional — informational | commercial | howto
 *   supportingKeywords optional string[]
 *   sourceQueries      optional string[] — simulates audit evidence
 *   cluster            optional — cluster name, for the topical-context block
 *   clusterPosition    optional number — selects the intro pattern to test
 *   isPillar           optional boolean
 */
export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    // Founder-only, and 404 rather than 403 so the route is not discoverable.
    if (!user || !isFounderUser(user.id)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const body = await req.json().catch(() => ({}))
    const brandId = typeof body.brandId === "string" ? body.brandId.trim() : ""
    const title = typeof body.title === "string" ? body.title.trim() : ""
    const keyword = typeof body.keyword === "string" ? body.keyword.trim() : ""

    if (!brandId || !title || !keyword) {
        return NextResponse.json(
            { error: "brandId, title and keyword are required." },
            { status: 400 },
        )
    }

    const articleType = ["informational", "commercial", "howto"].includes(body.articleType)
        ? body.articleType
        : "informational"

    const db = createAdminClient() as any

    // Brand must exist and belong to the caller — this route reads real brand
    // data, so it must not become a way to generate against someone else's.
    const { data: brand } = await db
        .from("brand_details")
        .select("id, user_id, website_url")
        .eq("id", brandId)
        .maybeSingle()

    if (!brand || brand.user_id !== user.id) {
        return NextResponse.json(
            { error: "Brand not found for this account." },
            { status: 404 },
        )
    }

    const slug = `qa-test-${title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60)}-${Date.now().toString(36)}`

    const { data: article, error: articleError } = await db
        .from("articles")
        .insert({
            user_id: user.id,
            brand_id: brandId,
            keyword,
            slug,
            status: "queued",
            // Visible immediately: cluster withholding does not apply to a test.
            delivery_visible_at: new Date().toISOString(),
        })
        .select("id")
        .single()

    if (articleError || !article) {
        return NextResponse.json(
            { error: articleError?.message || "Could not create the test article row." },
            { status: 500 },
        )
    }

    try {
        const handle = await generateBlogPost.trigger({
            articleId: article.id,
            brandId,
            keyword,
            title,
            articleType,
            supportingKeywords: Array.isArray(body.supportingKeywords)
                ? body.supportingKeywords.filter((k: unknown) => typeof k === "string")
                : [],
            // Audit-evidence inputs are optional everywhere downstream, so a
            // test can exercise them or leave them out.
            sourceQueries: Array.isArray(body.sourceQueries)
                ? body.sourceQueries.filter((q: unknown) => typeof q === "string")
                : [],
            cluster: typeof body.cluster === "string" ? body.cluster : "",
            clusterPosition: Number.isInteger(body.clusterPosition) ? body.clusterPosition : 0,
            clusterId: `qa-${brandId}`,
            isPillar: Boolean(body.isPillar),
            // Explicitly omitted: plannedArticleId and frozenLinks. See the note
            // at the top of this file — that omission is what keeps this run
            // outside the program pipeline.
        })

        return NextResponse.json({
            articleId: article.id,
            runId: handle.id,
            slug,
            testing: {
                title,
                keyword,
                articleType,
                introPatternPosition: Number.isInteger(body.clusterPosition)
                    ? body.clusterPosition
                    : 0,
            },
            note:
                "Real generation with real provider cost. No planned article, no frozen link graph, " +
                "no credit consumed, no cluster or program touched.",
        })
    } catch (triggerError) {
        await db.from("articles").delete().eq("id", article.id)
        return NextResponse.json(
            {
                error:
                    triggerError instanceof Error
                        ? triggerError.message
                        : "Could not queue the generation task.",
            },
            { status: 500 },
        )
    }
}
