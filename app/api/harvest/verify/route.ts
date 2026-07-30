import { NextRequest, NextResponse } from "next/server"

import {
    assembleHarvest,
    HarvestAssemblyError,
    type HarvestInput,
} from "@/lib/harvest/assembly"
import { HARVEST_POLICY } from "@/lib/harvest/policy"

export const maxDuration = 300

type CheckState = "PASS" | "FAIL" | "INCONCLUSIVE"

interface VerifyRequest {
    url: string
    scopeFamilies: Array<{
        id?: string
        name: string
        description: string
        seedKeywords?: string[]
        seed_keywords?: string[]
        priority?: number
    }>
    competitors?: string[]
    countryCode?: string
}
export async function POST(req: NextRequest) {
    if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Not available in production" }, { status: 404 })
    }

    const startedAt = Date.now()
    try {
        const body = (await req.json()) as VerifyRequest
        if (!Array.isArray(body.scopeFamilies) || body.scopeFamilies.length === 0) {
            return NextResponse.json(
                {
                    error:
                        "scopeFamilies is required so verification uses the same confirmed-scope contract as production.",
                },
                { status: 400 },
            )
        }
        const scopeFamilies = body.scopeFamilies.map((family, index) => ({
            id: family.id || `verify-scope-${index}`,
            name: family.name,
            description: family.description,
            seedKeywords:
                family.seedKeywords || family.seed_keywords || [],
            priority: family.priority ?? index,
        }))
        const input: HarvestInput = {
            subjectUrl: body.url,
            scopeFamilies,
            competitors: body.competitors || [],
            countryCode: body.countryCode,
        }
        const output = await assembleHarvest(input)
        const { statistics } = output

        const traceableGaps = output.gaps.filter((gap) => gap.sourceUrl)
        const collapseMeasurable =
            statistics.gapCount >= HARVEST_POLICY.minGapsForCollapseCheck
        const checks: Array<{ name: string; state: CheckState; detail: string }> = [
            {
                name: "provenance",
                state:
                    traceableGaps.length === statistics.gapCount ? "PASS" : "FAIL",
                detail: `${traceableGaps.length}/${statistics.gapCount} gaps traceable; require 100%`,
            },
            {
                // Only the ceiling gates. The expected band is reported because
                // the ratio tracks a niche's phrasing redundancy, not clustering
                // quality — a healthy 13-cluster audit was once rejected at
                // 48.4% purely because its competitors publish a lot of FAQs.
                // Duplicate articles are caught directly by `duplicate_articles`.
                name: "collapse_ratio",
                state: !collapseMeasurable
                    ? "INCONCLUSIVE"
                    : statistics.collapseRatio > HARVEST_POLICY.collapseCeiling
                      ? "FAIL"
                      : "PASS",
                detail: collapseMeasurable
                    ? `${(statistics.collapseRatio * 100).toFixed(1)}%; ceiling ${
                          HARVEST_POLICY.collapseCeiling * 100
                      }%, expected ${HARVEST_POLICY.collapseExpectedMin * 100}-${
                          HARVEST_POLICY.collapseExpectedMax * 100
                      }%${
                          statistics.collapseRatio < HARVEST_POLICY.collapseExpectedMin ||
                          statistics.collapseRatio > HARVEST_POLICY.collapseExpectedMax
                              ? " (outside expected band — check source mix)"
                              : ""
                      }`
                    : `only ${statistics.gapCount} gaps; need ${HARVEST_POLICY.minGapsForCollapseCheck}`,
            },
            {
                name: "cluster_size",
                state: statistics.clusterSizes.every(
                    (size) => size <= HARVEST_POLICY.maxClusterArticles,
                )
                    ? "PASS"
                    : "FAIL",
                detail: `largest cluster ${Math.max(0, ...statistics.clusterSizes)}, max ${HARVEST_POLICY.maxClusterArticles}`,
            },
            {
                name: "sources_healthy",
                state: output.reports.every((report) => !report.hardFailure)
                    ? "PASS"
                    : "FAIL",
                detail: output.reports
                    .map(
                        (report) =>
                            `${report.source}=${report.queriesFound}${
                                report.requestsFailed
                                    ? ` (${report.requestsFailed} failed)`
                                    : ""
                            }`,
                    )
                    .join(", "),
            },
        ]
        const verdict: CheckState = checks.some((check) => check.state === "FAIL")
            ? "FAIL"
            : checks.some((check) => check.state === "INCONCLUSIVE")
              ? "INCONCLUSIVE"
              : "PASS"

        return NextResponse.json({
            verdict,
            policyVersion: output.policyVersion,
            resultHash: output.resultHash,
            checks,
            summary: {
                ...statistics,
                collapseRatio: `${(statistics.collapseRatio * 100).toFixed(1)}%`,
                durationMs: Date.now() - startedAt,
            },
            reports: output.reports,
            sourceCallLedger: output.sourceCallLedger,
            demandFilter: {
                dropped: output.droppedByDemandFilter.length,
                droppedSample: output.droppedByDemandFilter.slice(0, 25),
            },
            scopeFilter: {
                dropped: output.droppedByScopeFilter.length,
                // Grouped by rejection class so the deliverability gate can be
                // eyeballed without reading 25 free-text reasons. A healthy
                // audit on a niche with active competitors should show non-zero
                // third_party_branded and publisher_specific counts — those are
                // topics that used to reach the plan.
                droppedByDecision: output.droppedByScopeFilter.reduce(
                    (counts: Record<string, number>, drop) => {
                        counts[drop.decision] = (counts[drop.decision] || 0) + 1
                        return counts
                    },
                    {},
                ),
                undeliverableSample: output.droppedByScopeFilter
                    .filter(
                        (drop) =>
                            drop.decision === "third_party_branded" ||
                            drop.decision === "publisher_specific",
                    )
                    .slice(0, 15),
                droppedSample: output.droppedByScopeFilter.slice(0, 25),
            },
            provenance: traceableGaps
                .slice(0, HARVEST_POLICY.provenanceSampleSize)
                .map((gap) => ({
                    query: gap.query,
                    source: gap.source,
                    sourceUrl: gap.sourceUrl,
                    userStatus: gap.userStatus,
                    userSimilarity: gap.userSimilarity,
                    competitorUrls: gap.competitors.map(
                        (competitor) => competitor.matchedUrl,
                    ),
                })),
            clusters: output.clusters.map((cluster) => ({
                scopeFamilyId: cluster.scopeFamilyId,
                name: cluster.name,
                articleCount: cluster.articles.length,
                sampleArticles: cluster.articles.slice(0, 5).map((article) => ({
                    mainKeyword: article.mainKeyword,
                    supportingKeywords: article.supportingKeywords,
                    articleType: article.articleType,
                })),
            })),
        })
    } catch (error) {
        const harvestError =
            error instanceof HarvestAssemblyError ? error : null
        console.error("[Verify] Failed:", error)
        return NextResponse.json(
            {
                verdict: "FAIL",
                reason: harvestError?.code || "verification_failed",
                error: error instanceof Error ? error.message : "Verification run failed",
                reports: harvestError?.reports || [],
            },
            {
                status:
                    harvestError?.code === "invalid_input"
                        ? 400
                        : harvestError?.code === "source_failure"
                          ? 424
                          : 422,
            },
        )
    }
}
