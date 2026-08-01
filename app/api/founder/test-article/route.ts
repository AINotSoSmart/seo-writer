import { NextRequest, NextResponse } from "next/server"

import { generateBlogPost } from "@/trigger/generate-blog"
import { isFounderUser } from "@/lib/founder"
import { ensureProfileRow } from "@/lib/writer/ensure-profile"
import { loadPlannedWriterInputs } from "@/lib/writer/planned-article-payload"
import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"

export const maxDuration = 60

/**
 * Founder-only single-article generation, for quality checks.
 *
 * Runs the REAL writer with the same inputs ship-cluster would send. When
 * `hydrateFromPlannedId` is supplied, audit evidence, sub-nodes, cluster
 * context and any frozen links already in the database are loaded from that
 * planned article — but `plannedArticleId` is deliberately NOT passed to the
 * writer task, so no real cluster generation state is mutated.
 *
 * POST body:
 *   brandId              required unless hydrateFromPlannedId supplies it
 *   title, keyword       required unless hydrating from a planned article
 *   hydrateFromPlannedId optional — load production writer inputs from DB
 *   articleType, supportingKeywords, sourceQueries, cluster, clusterPosition,
 *   isPillar, subNodeIntents, clusterCompetitorUrls — manual overrides
 */
export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user || !isFounderUser(user.id)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const body = await req.json().catch(() => ({}))
    const db = createAdminClient() as any

    const hydrateFromPlannedId =
        typeof body.hydrateFromPlannedId === "string"
            ? body.hydrateFromPlannedId.trim()
            : typeof body.plannedArticleId === "string"
              ? body.plannedArticleId.trim()
              : ""

    let hydrated = hydrateFromPlannedId
        ? await loadPlannedWriterInputs(db, hydrateFromPlannedId)
        : null

    if (hydrateFromPlannedId && !hydrated) {
        return NextResponse.json(
            { error: "Planned article not found for hydration." },
            { status: 404 },
        )
    }

    const brandId =
        (typeof body.brandId === "string" ? body.brandId.trim() : "") ||
        hydrated?.brandId ||
        ""
    const title =
        (typeof body.title === "string" ? body.title.trim() : "") ||
        hydrated?.title ||
        ""
    const keyword =
        (typeof body.keyword === "string" ? body.keyword.trim() : "") ||
        hydrated?.keyword ||
        ""

    if (!brandId || !title || !keyword) {
        return NextResponse.json(
            { error: "brandId, title and keyword are required." },
            { status: 400 },
        )
    }

    const articleType = ["informational", "commercial", "howto"].includes(body.articleType)
        ? body.articleType
        : hydrated?.articleType || "informational"

    const pickStrings = (
        manual: unknown,
        fallback: string[] | undefined,
    ): string[] => {
        if (Array.isArray(manual)) {
            const values = manual.filter((entry): entry is string => typeof entry === "string")
            if (values.length > 0) return values
        }
        return fallback || []
    }

    const supportingKeywords = pickStrings(
        body.supportingKeywords,
        hydrated?.supportingKeywords,
    )

    const sourceQueries = pickStrings(body.sourceQueries, hydrated?.sourceQueries)

    const subNodeIntents = pickStrings(body.subNodeIntents, hydrated?.subNodeIntents)

    const cluster =
        typeof body.cluster === "string" && body.cluster.trim()
            ? body.cluster.trim()
            : hydrated?.cluster || ""

    const clusterCompetitorUrls = pickStrings(
        body.clusterCompetitorUrls,
        hydrated?.clusterCompetitorUrls,
    )

    const clusterPosition = Number.isInteger(body.clusterPosition)
        ? body.clusterPosition
        : hydrated?.clusterPosition ?? 0

    const clusterId =
        typeof body.clusterId === "string" && body.clusterId.trim()
            ? body.clusterId.trim()
            : hydrated?.clusterId || `qa-${brandId}`

    const isPillar =
        typeof body.isPillar === "boolean" ? body.isPillar : hydrated?.isPillar ?? false

    const frozenLinks =
        hydrated?.frozenLinks?.length && !Array.isArray(body.skipFrozenLinks)
            ? hydrated.frozenLinks
            : []

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

    if (hydrated && hydrated.brandId !== brandId) {
        return NextResponse.json(
            { error: "Planned article does not belong to the selected brand." },
            { status: 400 },
        )
    }

    try {
        await ensureProfileRow(db, brand.user_id, user.email)
    } catch (profileError) {
        return NextResponse.json(
            {
                error:
                    profileError instanceof Error
                        ? profileError.message
                        : "Could not ensure profile row.",
            },
            { status: 500 },
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
            user_id: brand.user_id,
            brand_id: brandId,
            keyword,
            slug,
            status: "queued",
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

    const writerPayload = {
        articleId: article.id,
        brandId,
        keyword,
        title,
        articleType,
        supportingKeywords,
        sourceQueries,
        subNodeIntents,
        cluster,
        clusterCompetitorUrls,
        clusterPosition,
        clusterId,
        isPillar,
        ...(hydrated?.articleContract
            ? {
                  articleContract: hydrated.articleContract,
                  capabilityFacts: hydrated.capabilityFacts,
                  auditBrandSnapshot: hydrated.auditBrandSnapshot,
              }
            : {}),
        ...(frozenLinks.length > 0 ? { frozenLinks } : {}),
    }

    try {
        const handle = await generateBlogPost.trigger(writerPayload)

        return NextResponse.json({
            articleId: article.id,
            runId: handle.id,
            slug,
            hydratedFrom: hydrateFromPlannedId || null,
            writerReceives: {
                ...writerPayload,
                frozenLinkCount: frozenLinks.length,
            },
            testing: {
                title,
                keyword,
                articleType,
                introPatternPosition: clusterPosition,
                sourceQueryCount: sourceQueries.length,
                subNodeCount: subNodeIntents.length,
            },
            note:
                "Real generation with real provider cost. No planned-article status " +
                "writes, no credit consumed, no program touched.",
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
