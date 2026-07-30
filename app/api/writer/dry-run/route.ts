import { NextRequest, NextResponse } from "next/server"

import { generateOutlineSystemPrompt } from "@/trigger/generate-blog"
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

    // Select exactly what ship-cluster selects, plus the audit evidence that
    // exists in the database but is NOT currently forwarded to the writer.
    let query = db
        .from("planned_articles")
        .select(
            "id, title, main_keyword, supporting_keywords, article_type, slug, target_url, " +
                "article_id, generation_status, retry_count, brand_id, audit_id, cluster_id, " +
                "scope_family_id, source_query_ids, intent_role, is_pillar",
        )
        .order("is_pillar", { ascending: false })
        .limit(1)

    query = plannedArticleId
        ? query.eq("id", plannedArticleId)
        : query.eq("audit_id", auditId)

    const { data: planned, error: plannedError } = await query.maybeSingle()
    if (plannedError || !planned) {
        return NextResponse.json(
            { error: plannedError?.message || "No planned article found" },
            { status: 404 },
        )
    }

    // --- Brand, loaded exactly as the writer loads it -----------------------
    const { data: brandRec } = await db
        .from("brand_details")
        .select("brand_data, website_url")
        .eq("id", planned.brand_id)
        .maybeSingle()

    if (!brandRec) {
        return NextResponse.json(
            { error: `Brand ${planned.brand_id} not found` },
            { status: 404 },
        )
    }

    const parsed = BrandDetailsSchema.safeParse(brandRec.brand_data)
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

    // --- Frozen links, loaded exactly as ship-cluster loads them ------------
    const { data: linkRows } = await db
        .from("planned_article_links")
        .select("target_url, anchor_text, relationship")
        .eq("source_article_id", planned.id)

    const frozenLinks = (linkRows || []).map((row: any) => ({
        title: row.anchor_text,
        url: row.target_url,
        relationship: row.relationship,
    }))

    // --- Audit evidence, loaded the way ship-cluster loads it --------------
    const { data: sourceQueries } = planned.source_query_ids?.length
        ? await db
              .from("query_pool")
              .select("query, source, source_url, competitor_matches")
              .in("id", planned.source_query_ids)
        : { data: [] }

    const { data: cluster } = planned.cluster_id
        ? await db
              .from("audit_clusters")
              .select("name, description, competitor_urls")
              .eq("id", planned.cluster_id)
              .maybeSingle()
        : { data: null }

    const competitorUrls = Array.isArray(cluster?.competitor_urls)
        ? (cluster.competitor_urls as unknown[])
              .map((entry) =>
                  typeof entry === "string" ? entry : String((entry as any)?.url || ""),
              )
              .filter(Boolean)
              .slice(0, 6)
        : []

    // --- The exact payload ship-cluster would trigger with -----------------
    const payload = {
        articleId: planned.article_id || "(created at ship time)",
        keyword: planned.main_keyword,
        brandId: planned.brand_id,
        title: planned.title,
        articleType: planned.article_type || "informational",
        supportingKeywords: planned.supporting_keywords || [],
        plannedArticleId: planned.id,
        frozenLinks,
        cluster: cluster?.name || "",
        sourceQueries: (sourceQueries || []).slice(0, 8).map((row: any) => row.query),
        clusterCompetitorUrls: competitorUrls,
        isPillar: Boolean(planned.is_pillar),
    }

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
        brandDetails.article_length || "long",
        undefined,
        null,
        {
            clusterName: payload.cluster || undefined,
            sourceQueries: payload.sourceQueries,
            competitorUrls: payload.clusterCompetitorUrls,
            isPillar: payload.isPillar,
        },
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
            sourceQueryCount: sourceQueries?.length || 0,
            sourceQueries: (sourceQueries || []).map((row: any) => ({
                query: row.query,
                source: row.source,
                sourceUrl: row.source_url,
                competitorMatches: (row.competitor_matches || []).length,
            })),
        },

        frozenLinks: {
            count: frozenLinks.length,
            note:
                frozenLinks.length === 0
                    ? "No frozen links yet — the graph is frozen at purchase-intent time, so this is expected before checkout."
                    : "Each anchor+URL must appear literally in the finished markdown or the cluster is withheld.",
            links: frozenLinks,
        },

        outlinePrompt: {
            characters: outlinePrompt.length,
            note: "The real prompt, assembled by the real builder. The RESEARCH slot is stubbed.",
            text: full ? outlinePrompt : outlinePrompt.slice(0, 6000),
            truncated: !full && outlinePrompt.length > 6000,
        },
    })
}
