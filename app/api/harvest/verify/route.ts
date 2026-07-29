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
    seeds: string[]
    competitors?: string[]
    countryCode?: string
    brandContext?: string
    excludeContext?: string
}
export async function POST(req: NextRequest) {
    if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Not available in production" }, { status: 404 })
    }

    const startedAt = Date.now()
    try {
        const body = (await req.json()) as VerifyRequest
        const input: HarvestInput = {
            subjectUrl: body.url,
            seeds: body.seeds,
            competitors: body.competitors || [],
            countryCode: body.countryCode,
            brandContext: body.brandContext,
            excludeContext: body.excludeContext,
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
                name: "collapse_ratio",
                state: !collapseMeasurable
                    ? "INCONCLUSIVE"
                    : statistics.collapseRatio >= HARVEST_POLICY.collapseMin &&
                        statistics.collapseRatio <= HARVEST_POLICY.collapseMax
                      ? "PASS"
                      : "FAIL",
                detail: collapseMeasurable
                    ? `${(statistics.collapseRatio * 100).toFixed(1)}%; require ${
                          HARVEST_POLICY.collapseMin * 100
                      }-${HARVEST_POLICY.collapseMax * 100}%`
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
            nicheFilter: {
                dropped: output.droppedByNicheFilter.length,
                droppedSample: output.droppedByNicheFilter.slice(0, 25),
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
