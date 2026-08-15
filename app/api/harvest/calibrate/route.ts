import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"

import { generateEmbedding } from "@/lib/gemini-embedding"
import { mapWithConcurrency } from "@/lib/harvest/types"
import {
    scanCoverage,
    COVERAGE_THRESHOLDS,
    PoolQuery,
    QueryCoverage,
} from "@/lib/harvest/coverage"

/**
 * Dev-only coverage calibration harness.
 *
 * Coverage thresholds must be derived from labelled data, not chosen by eye.
 * The absolute-cutoff version of this system reported bringback.pro as covering
 * 390 of 392 queries — including a competitor's own support FAQ and
 * location-specific searches that appear on none of its 72 pages — because
 * every query in a broad subject area clears a fixed cosine floor.
 *
 * Feed this endpoint queries you have checked by hand:
 *
 *   positives — the site demonstrably answers these
 *   negatives — it demonstrably does not; competitor-branded queries,
 *               location-specific searches, and rival-tool tutorials are the
 *               important controls, because those are what the broken version
 *               got wrong
 *
 * It reports whether the two populations separate at all, and if so where the
 * boundary sits. If they overlap, no threshold will work and the scoring method
 * itself needs to change — that is a real result, not a tuning failure.
 *
 *   curl -X POST http://localhost:3000/api/harvest/calibrate \
 *     -H 'content-type: application/json' \
 *     -d '{"url":"https://bringback.pro",
 *          "positives":["ai family photo generator","restore old photo online"],
 *          "negatives":["old photo restoration dublin","Can I order prints directly through PixReunion?"]}'
 */

export const maxDuration = 300

interface CalibrateRequest {
    url: string
    positives: string[]
    negatives: string[]
}

const EMBEDDING_CONCURRENCY = 5

interface LabelledResult {
    query: string
    expected: "covered" | "gap"
    actual: string
    similarity: number
    baseline: number
    margin: number
    definingTerms: string[]
    evidenceFound: string[]
    evidenceMissing: string[]
    matchedUrl: string | null
    correct: boolean
}

function toLabelled(
    coverage: QueryCoverage,
    expected: "covered" | "gap"
): LabelledResult {
    // "partial" counts as covered for calibration: the question is whether the
    // site was credited with the query at all.
    const treatedAsCovered = coverage.status !== "gap"
    const correct = expected === "covered" ? treatedAsCovered : !treatedAsCovered

    return {
        query: coverage.query,
        expected,
        actual: coverage.status,
        similarity: coverage.similarity,
        baseline: coverage.baseline,
        margin: coverage.margin,
        definingTerms: coverage.definingTerms,
        evidenceFound: coverage.evidenceFound,
        evidenceMissing: coverage.evidenceMissing,
        matchedUrl: coverage.matchedUrl,
        correct,
    }
}

export async function POST(req: NextRequest) {
    if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Not available in production" }, { status: 404 })
    }

    try {
        const { url, positives = [], negatives = [] } = (await req.json()) as CalibrateRequest

        if (!url || positives.length === 0 || negatives.length === 0) {
            return NextResponse.json(
                { error: "Provide `url`, a non-empty `positives` array, and a non-empty `negatives` array" },
                { status: 400 }
            )
        }

        const labelled = [
            ...positives.map((q) => ({ query: q, expected: "covered" as const })),
            ...negatives.map((q) => ({ query: q, expected: "gap" as const })),
        ]

        const embeddings = await mapWithConcurrency(labelled, EMBEDDING_CONCURRENCY, (l) =>
            generateEmbedding(l.query, "RETRIEVAL_QUERY")
        )

        const poolQueries: PoolQuery[] = []
        const expectedById = new Map<string, "covered" | "gap">()

        labelled.forEach((l, i) => {
            const embedding = embeddings[i]
            if (!embedding) return
            const id = randomUUID()
            poolQueries.push({ id, query: l.query, embedding })
            expectedById.set(id, l.expected)
        })

        if (poolQueries.length === 0) {
            return NextResponse.json({ error: "All embeddings failed" }, { status: 502 })
        }

        // Runs the exact production coverage path
        const result = await scanCoverage(url, "Calibration target", poolQueries)

        const results = result.coverage.map((c) =>
            toLabelled(c, expectedById.get(c.queryId) || "gap")
        )

        const positiveResults = results.filter((r) => r.expected === "covered")
        const negativeResults = results.filter((r) => r.expected === "gap")

        // Compare candidate scoring functions rather than assuming one. The
        // first attempt at this pipeline assumed margin alone would separate;
        // it does not, and only measuring showed that.
        const scorers: Record<string, (r: LabelledResult) => number> = {
            similarity_only: (r) => r.similarity,
            margin_only: (r) => r.margin,
            similarity_plus_margin: (r) => r.similarity + r.margin,
        }

        const scoringComparison = Object.entries(scorers).map(([name, fn]) => {
            const minPos = Math.min(...positiveResults.map(fn))
            const maxNeg = Math.max(...negativeResults.map(fn))
            return {
                scorer: name,
                minPositive: Number(minPos.toFixed(3)),
                maxNegative: Number(maxNeg.toFixed(3)),
                gap: Number((minPos - maxNeg).toFixed(3)),
                separable: minPos > maxNeg,
                suggestedThreshold: minPos > maxNeg ? Number(((minPos + maxNeg) / 2).toFixed(3)) : null,
            }
        })

        const best = [...scoringComparison].sort((a, b) => b.gap - a.gap)[0]

        const minPositiveMargin = Math.min(...positiveResults.map((r) => r.margin))
        const maxNegativeMargin = Math.max(...negativeResults.map((r) => r.margin))
        const separable = minPositiveMargin > maxNegativeMargin

        const minPositiveSimilarity = Math.min(...positiveResults.map((r) => r.similarity))
        const maxNegativeSimilarity = Math.max(...negativeResults.map((r) => r.similarity))

        const truePositives = positiveResults.filter((r) => r.correct).length
        const trueNegatives = negativeResults.filter((r) => r.correct).length

        return NextResponse.json({
            pagesScanned: result.pagesScanned,
            currentThresholds: COVERAGE_THRESHOLDS,
            // Which scoring function actually separates these labels
            scoringComparison,
            bestScorer: best,
            accuracy: {
                truePositives,
                falseNegatives: positiveResults.length - truePositives,
                trueNegatives,
                falsePositives: negativeResults.length - trueNegatives,
                overall: `${truePositives + trueNegatives}/${results.length}`,
            },
            separation: {
                minPositiveMargin: Number(minPositiveMargin.toFixed(3)),
                maxNegativeMargin: Number(maxNegativeMargin.toFixed(3)),
                separable,
                // Midpoint of the gap when the populations do not overlap
                recommendedStrongMargin: separable
                    ? Number(((minPositiveMargin + maxNegativeMargin) / 2).toFixed(3))
                    : null,
                note: separable
                    ? "Margin separates the labelled sets. Set STRONG_MARGIN to the recommendation and re-run."
                    : "Margin does NOT separate the labelled sets — no threshold can fix this. " +
                      "The scoring method needs to change, or the labels need review.",
            },
            absoluteGate: {
                minPositiveSimilarity: Number(minPositiveSimilarity.toFixed(3)),
                maxNegativeSimilarity: Number(maxNegativeSimilarity.toFixed(3)),
                separable: minPositiveSimilarity > maxNegativeSimilarity,
                note:
                    minPositiveSimilarity > maxNegativeSimilarity
                        ? "Absolute similarity alone separates these labels."
                        : "Absolute similarity alone CANNOT separate these labels — this is why the fixed cutoff failed.",
            },
            // Sorted so misclassifications surface first
            results: results.sort((a, b) => Number(a.correct) - Number(b.correct)),
        })
    } catch (error: any) {
        console.error("[Calibrate] Failed:", error)
        return NextResponse.json(
            { error: error.message || "Calibration run failed" },
            { status: 500 }
        )
    }
}
