import { NextRequest, NextResponse } from "next/server"

import { generateOutlineSystemPrompt } from "@/trigger/generate-blog"
import { selectIntroPattern } from "@/lib/writer/composition"
import { loadPlannedWriterInputs } from "@/lib/writer/planned-article-payload"
import { BrandDetailsSchema } from "@/lib/schemas/brand"
import { createAdminClient } from "@/utils/supabase/admin"

export const maxDuration = 60

/**
 * Dev-only writer input inspector.
 *
 * Answers one question for a real planned article, for free:
 * **what does the article writer actually receive?**
 *
 * Everything upstream of this point is verifiable — provenance URLs open,
 * coverage is calibrated, the scope gate is testable. The writer was the one
 * stage whose inputs had never been looked at, and it was quietly wrong: the
 * outline prompt read `brandDetails.features` and
 * `brandDetails.unique_value_proposition`, neither of which exists on
 * BrandDetailsSchema, so every article was planned against "Features: N/A" and
 * "UVP: undefined" while being told to position the product in comparison
 * tables. A contract test now blocks that specific class, but a test only
 * catches what someone thought to assert. This shows the real thing.
 *
 * It calls no paid API, generates nothing, and writes nothing:
 *   - Gemini, Tavily and fal.ai are never invoked
 *   - no article row is created or modified
 *   - the RESEARCH slot is stubbed and clearly labelled, because filling it
 *     genuinely costs money
 *
 * Usage:
 *   GET /api/writer/dry-run?plannedArticleId=<uuid>
 *   GET /api/writer/dry-run?auditId=<uuid>          (inspects the first article)
 *   GET /api/writer/dry-run?auditId=<uuid>&full=1   (full prompt, not truncated)
 */

const RESEARCH_STUB = {
    __dry_run__:
        "Live Tavily research is not executed here — it costs money. In a real run this slot holds the broad-search + critic + sniper synthesis.",
    authority_links: [] as Array<{ url: string; title: string }>,
}

export async function GET(req: NextRequest) {
    if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Not available in production" }, { status: 404 })
    }

    const params = req.nextUrl.searchParams
    const plannedArticleId = params.get("plannedArticleId")
    const auditId = params.get("auditId")
    const full = params.get("full") === "1"

    if (!plannedArticleId && !auditId) {
        return NextResponse.json(
            { error: "Provide ?plannedArticleId=<uuid> or ?auditId=<uuid>" },
            { status: 400 },
        )
    }

    const db = createAdminClient() as any

    const hydrated = plannedArticleId
        ? await loadPlannedWriterInputs(db, plannedArticleId)
        : auditId
          ? await (async () => {
                const { data: first } = await db
                    .from("planned_articles")
                    .select("id")
                    .eq("audit_id", auditId)
                    .order("is_pillar", { ascending: false })
                    .limit(1)
                    .maybeSingle()
                return first?.id
                    ? loadPlannedWriterInputs(db, first.id)
                    : null
            })()
          : null

    if (!hydrated) {
        return NextResponse.json(
            { error: "No planned article found" },
            { status: 404 },
        )
    }

    const { data: planned } = await db
        .from("planned_articles")
        .select(
            "id, title, main_keyword, generation_status, intent_role, is_pillar, article_id",
        )
        .eq("id", hydrated.plannedArticleId)
        .maybeSingle()

    if (!planned) {
        return NextResponse.json({ error: "No planned article found" }, { status: 404 })
    }

    const clusterPosition = hydrated.clusterPosition

    // --- Brand, loaded exactly as the writer loads it -----------------------
    const { data: brandRec } = await db
        .from("brand_details")
        .select("brand_data, website_url")
        .eq("id", hydrated.brandId)
        .maybeSingle()

    if (!brandRec) {
        return NextResponse.json(
            { error: `Brand ${hydrated.brandId} not found` },
            { status: 404 },
        )
    }

    const parsed = BrandDetailsSchema.safeParse(
        hydrated.auditBrandSnapshot || brandRec.brand_data,
    )
    if (!parsed.success) {
        // The real writer throws here, so surface it as the blocking failure it is.
        return NextResponse.json(
            {
                blocking: "brand_details failed BrandDetailsSchema — generation would throw",
                issues: parsed.error.flatten(),
            },
            { status: 422 },
        )
    }
    const brandDetails = parsed.data

    const frozenLinks = hydrated.frozenLinks

    const payload = {
        articleId: planned.article_id || "(created at ship time)",
        keyword: hydrated.keyword,
        brandId: hydrated.brandId,
        title: hydrated.title,
        articleType: hydrated.articleType,
        supportingKeywords: hydrated.supportingKeywords,
        plannedArticleId: hydrated.plannedArticleId,
        frozenLinks,
        cluster: hydrated.cluster,
        sourceQueries: hydrated.sourceQueries,
        clusterCompetitorUrls: hydrated.clusterCompetitorUrls,
        subNodeIntents: hydrated.subNodeIntents,
        isPillar: hydrated.isPillar,
        clusterPosition,
        clusterId: hydrated.clusterId,
        articleContract: hydrated.articleContract,
        capabilityFacts: hydrated.capabilityFacts,
    }

    const { data: sourceRows } = hydrated.sourceQueries.length
        ? await db
              .from("query_pool")
              .select("query, source, source_url, source_context, intent_binding, competitor_matches")
              .eq("audit_id", hydrated.auditId)
              .in("query", hydrated.sourceQueries)
        : { data: [] }

    const { data: cluster } = hydrated.clusterId
        ? await db
              .from("audit_clusters")
              .select("name, description, competitor_urls")
              .eq("id", hydrated.clusterId)
              .maybeSingle()
        : { data: null }

    const introPattern = selectIntroPattern(
        payload.articleType as any,
        clusterPosition,
        payload.clusterId,
    )

    // --- Assemble the real outline prompt ----------------------------------
    const outlinePrompt = generateOutlineSystemPrompt(
        payload.keyword,
        brandDetails.style_dna,
        RESEARCH_STUB,
        payload.articleType as any,
        brandDetails,
        payload.title,
        frozenLinks,
        payload.supportingKeywords,
        hydrated.articleContract?.articleLength || "long",
        undefined,
        null,
        {
            clusterName: payload.cluster || undefined,
            sourceQueries: payload.sourceQueries,
            competitorUrls: payload.clusterCompetitorUrls,
            subNodeIntents: payload.subNodeIntents,
            isPillar: payload.isPillar,
        },
        hydrated.articleContract || undefined,
        hydrated.capabilityFacts,
    )

    // Every brand fact the outline prompt renders as absent. `brandList()`
    // prints "Not provided" for an empty field; anything listed here is a fact
    // the model is planning without.
    const missingBrandFacts = [
        ["core_features", brandDetails.core_features],
        ["uvp", brandDetails.uvp],
        ["pricing", brandDetails.pricing],
        ["how_it_works", brandDetails.how_it_works],
        ["style_dna", brandDetails.style_dna],
        ["product_name", brandDetails.product_name],
    ]
        .filter(([, value]) =>
            Array.isArray(value) ? value.length === 0 : !String(value || "").trim(),
        )
        .map(([name]) => name)

    return NextResponse.json({
        article: {
            title: planned.title,
            mainKeyword: planned.main_keyword,
            isPillar: planned.is_pillar,
            intentRole: planned.intent_role,
            generationStatus: planned.generation_status,
        },

        /** Exactly what generate-blog-post receives today. */
        writerReceives: payload,

        frozenWriterContract: hydrated.articleContract
            ? {
                  entity: hydrated.articleContract.entity,
                  primaryIntent: hydrated.articleContract.primaryIntent,
                  requiredIntents: hydrated.articleContract.requiredIntents,
                  solutionMode: hydrated.articleContract.solutionMode,
                  allowedProductFacts: hydrated.capabilityFacts,
                  researchQuery: hydrated.articleContract.researchQuery,
                  selectedLength: hydrated.articleContract.articleLength,
              }
            : null,

        brandFacts: {
            productName: brandDetails.product_name,
            audience: brandDetails.audience?.primary,
            coreFeatures: brandDetails.core_features,
            uvp: brandDetails.uvp,
            pricing: brandDetails.pricing,
            howItWorks: brandDetails.how_it_works,
            hasStyleDna: Boolean(brandDetails.style_dna?.trim()),
            missingBrandFacts,
        },

        /**
         * Measured, sourced evidence now forwarded to the writer. Until this
         * was wired, all of it stopped at the plan: the article answering these
         * searches had never seen one of them, and re-researched the topic from
         * scratch with a generic search instead.
         */
        auditEvidencePassedToWriter: {
            clusterName: cluster?.name ?? null,
            clusterDescription: cluster?.description ?? null,
            competitorUrlsOwningThisCluster: cluster?.competitor_urls ?? [],
            sourceQueryCount: sourceRows?.length || 0,
            sourceQueries: (sourceRows || []).map((row: any) => ({
                query: row.query,
                source: row.source,
                sourceUrl: row.source_url,
                sourceContext: row.source_context,
                intentBinding: row.intent_binding,
                competitorMatches: (row.competitor_matches || []).length,
            })),
        },

        /**
         * Intents absorbed from a domain too thin to sustain its own cluster.
         * This article is the only page that will ever answer them, so each
         * must appear as a required H2/FAQ in the outline prompt below.
         */
        absorbedSubNodes: {
            count: hydrated.subNodeIntents.length,
            intents: hydrated.subNodeIntents,
            absorbedFromDomain: null,
        },

        frozenLinks: {
            count: frozenLinks.length,
            note:
                frozenLinks.length === 0
                    ? "No frozen links yet — the graph is frozen at purchase-intent time, so this is expected before checkout."
                    : "Each anchor+URL must appear literally in the finished markdown or the cluster is withheld.",
            links: frozenLinks,
        },

        /**
         * The opening shape assigned to this article. Two articles in the same
         * cluster must never report the same framing+secondMove combination —
         * that is the acceptance test for "every intro reads identical".
         */
        introPattern: {
            clusterPosition,
            framing: introPattern.framing,
            secondMove: introPattern.secondMove,
            note: "Deterministic from cluster position + cluster id. Stable across retries.",
        },

        outlinePrompt: {
            characters: outlinePrompt.length,
            note: "The real prompt, assembled by the real builder. The RESEARCH slot is stubbed.",
            text: full ? outlinePrompt : outlinePrompt.slice(0, 6000),
            truncated: !full && outlinePrompt.length > 6000,
        },
    })
}
