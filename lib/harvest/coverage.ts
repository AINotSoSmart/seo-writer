/**
 * Coverage measurement against the harvested query pool.
 *
 * TWO STAGES, because one is not enough:
 *
 *   1. RETRIEVAL (recall) — embed the page as a full document and find the
 *      closest page for each query, scored by similarity plus how far that page
 *      stands out from its own siblings.
 *   2. EVIDENCE (precision) — verify the matched page actually contains the
 *      query's defining terms. See lib/harvest/evidence.ts.
 *
 * Stage 2 exists because stage 1 provably cannot decide coverage on its own.
 * Calibrated against pixreunion.com, none of the three candidate scorers
 * separated hand-labelled positives from negatives (gaps of -0.031, -0.069 and
 * -0.064 — all overlapping). Embedding similarity measures subject adjacency,
 * and a restoration page sits close to "animate old photos with ai" whether or
 * not it says anything about animation.
 *
 * Also fixed here relative to the old `mapSiteToBlueprint()`: pages are embedded
 * as documents rather than bare `<title>` strings, and queries/documents use the
 * asymmetric RETRIEVAL_QUERY / RETRIEVAL_DOCUMENT task types the old code
 * omitted entirely.
 */

import { generateEmbedding } from "@/lib/gemini-embedding"
import {
    fetchAllSitemapUrls,
    cosineSimilarity,
    filterContentUrls,
    hasMeaningfulTitle,
} from "@/lib/audit/site-scanner"
import { batchExtractDocuments, PageDocument } from "./page-document"
import { buildDocumentFrequency, definingTerms, checkEvidence } from "./evidence"
import { HARVEST_POLICY } from "./policy"
import { mapWithConcurrency } from "./types"

/**
 * Match thresholds — CONTRASTIVE, not absolute.
 *
 * WHY THE ABSOLUTE VERSION FAILED (2026-07-29, bringback.pro vs pixreunion.com):
 * with a fixed cutoff of 0.62, the observed similarity distribution ran
 * min 0.604 / median 0.729. Every query cleared it, so the site was reported as
 * covering 390 of 392 queries — 99% "authority". Queries provably absent from
 * all 72 pages ("old photo restoration dublin", "old photo restoration with
 * gimp", a competitor's own support FAQ) were all marked COVERED.
 *
 * The reason is structural: a query and a page from the same broad subject area
 * embed close together whether or not the page answers the query. An absolute
 * cutoff therefore measures topic adjacency, not coverage.
 *
 * The fix is to ask a relative question instead: does one page stand out from
 * the rest of this site for this query? A site with a dedicated article shows a
 * clear outlier. A site that is merely about the same subject shows a flat
 * distribution where the best page barely beats the median.
 *
 *     margin = bestSimilarity - medianSimilarityAcrossPages
 *
 * The margin is self-calibrating per site and per query, so it does not drift
 * with niche or embedding model the way an absolute cutoff does.
 *
 * CALIBRATION STATUS: PROVISIONAL — derive real values with
 * POST /api/harvest/calibrate, which scores labelled positive and negative
 * queries and reports the separating margin. Do not hand-pick these.
 */
export const COVERAGE_THRESHOLDS = {
    /**
     * score = similarity + margin
     *
     * At or above COVERED, the site owns the query.
     *
     * CALIBRATED 2026-07-29 against bringback.pro (70 pages) with 10 positives
     * mapped to dedicated pages and 6 negatives hand-verified absent from all
     * 72 sitemap URLs. Separation of the three candidate scoring functions:
     *
     *   similarity only   minPos 0.711  maxNeg 0.704  gap +0.007
     *   margin only       minPos 0.131  maxNeg 0.135  gap -0.004  (overlaps)
     *   similarity+margin minPos 0.864  maxNeg 0.817  gap +0.047
     *
     * Margin alone does not work — a competitor's support FAQ scored a higher
     * margin (0.135) than "old photo restoration" (0.131). Absolute alone
     * ranks correctly but with almost no daylight. The sum separates ~7x
     * wider than either, so COVERED sits at the midpoint of its gap.
     *
     * `similarity + 2*margin` scored wider still (gap 0.067) but choosing that
     * weight from 16 labelled points would be fitting noise. Equal weighting is
     * the simplest defensible combination.
     *
     * RE-TUNED FOR RECALL once the evidence stage existed. Retrieval no longer
     * has to be the precision gate, so this threshold is deliberately permissive
     * — its job is to nominate candidates, and lib/harvest/evidence.ts decides.
     * At 0.84 it was silently rejecting queries the site does answer: "merge
     * family photos from separate pictures" scored 0.789 on pixreunion.com while
     * passing the evidence check outright. 0.78 sits below the lowest labelled
     * positive across both calibration sets (0.789 and 0.863).
     *
     * LIMITS: 36 labelled points across two sites, binary labels. PARTIAL is
     * *not* calibrated — neither labelled set has a partial class.
     */
    COVERED: 0.78,
    PARTIAL: 0.74,
    /**
     * Absolute sanity floor, applied before scoring. A page cannot answer a
     * query it is nowhere near, however much it outranks its own siblings.
     */
    MIN_ABSOLUTE: 0.60,
}
const EMBEDDING_CONCURRENCY = 5
/**
 * How many top-ranked pages the evidence stage may consider.
 *
 * Retrieval's top hit is not reliably the page that answers the query — on
 * pixreunion.com the closest page to "merge family photos from separate
 * pictures" lacked the terms while a lower-ranked page carried them. Widening
 * to a small candidate set recovers that without weakening the check, since
 * every candidate still has to pass on its own merits.
 */
const EVIDENCE_CANDIDATES = 3

export type CoverageStatus = "covered" | "partial" | "gap"

export interface QueryCoverage {
    queryId: string
    query: string
    status: CoverageStatus
    /** Terms that distinguish this query from the site's general subject */
    definingTerms: string[]
    /** Defining terms actually present on the matched page */
    evidenceFound: string[]
    /** Defining terms absent — why a semantic match was rejected */
    evidenceMissing: string[]
    /** Best absolute cosine across the site's pages */
    similarity: number
    /** How far the best page beat this site's median for this query */
    margin: number
    /** Median similarity across pages — the "generic topical adjacency" baseline */
    baseline: number
    matchedUrl: string | null
    matchedTitle: string | null
}

export interface PoolQuery {
    id: string
    query: string
    embedding: number[]
}

export interface SiteCoverageResult {
    siteUrl: string
    siteName: string
    pagesScanned: number
    pagesAttempted: number
    pages: Array<{ url: string; title: string; embedding: number[] }>
    coverage: QueryCoverage[]
    /** Share of pool queries at `covered` status, 0-100 */
    coveredPercent: number
}

/** Percentile helper for the distribution log */
function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0
    const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
    return sorted[index]
}

/**
 * Scans a site and classifies every pool query against it.
 *
 * Used for both the user's own site and each competitor — coverage is the same
 * computation regardless of whose site it is, which is what makes the gap
 * matrix a straightforward set operation later.
 */
export async function scanCoverage(
    siteUrl: string,
    siteName: string,
    poolQueries: PoolQuery[]
): Promise<SiteCoverageResult> {
    const urls = await fetchAllSitemapUrls(siteUrl)

    if (urls.length === 0) {
        console.warn(`[Coverage] No sitemap for ${siteUrl} — treating as zero coverage`)
        return {
            siteUrl,
            siteName,
            pagesScanned: 0,
            pagesAttempted: 0,
            pages: [],
            coverage: poolQueries.map((q) => ({
                queryId: q.id,
                query: q.query,
                status: "gap" as const,
                definingTerms: [],
                evidenceFound: [],
                evidenceMissing: [],
                similarity: 0,
                margin: 0,
                baseline: 0,
                matchedUrl: null,
                matchedTitle: null,
            })),
            coveredPercent: 0,
        }
    }

    // Skip assets, admin paths, and taxonomy archives before spending fetches
    const contentUrls = filterContentUrls(urls)
    console.log(
        `[Coverage] ${siteName}: ${contentUrls.length} content pages (from ${urls.length} sitemap URLs)`
    )

    const attemptedUrls = contentUrls.slice(0, HARVEST_POLICY.maxCoveragePages)
    const allDocuments = await batchExtractDocuments(attemptedUrls)

    // Drop pages whose titles carry no topical signal ("Home", "Contact", ...)
    const documents = allDocuments.filter((d) => hasMeaningfulTitle(d.title))

    // Pages are the "document" side of the asymmetric match
    const embeddings = await mapWithConcurrency(
        documents,
        EMBEDDING_CONCURRENCY,
        (doc: PageDocument) => generateEmbedding(doc.documentText, "RETRIEVAL_DOCUMENT")
    )

    const embeddedPages = documents
        .map((doc, i) => ({ doc, embedding: embeddings[i] }))
        .filter((p): p is { doc: PageDocument; embedding: number[] } => p.embedding !== null)

    console.log(
        `[Coverage] ${siteName}: embedded ${embeddedPages.length}/${documents.length} pages`
    )

    // Document frequency across this site, so "defining" is decided per site
    // rather than by a fixed word list.
    const documentFrequency = buildDocumentFrequency(embeddedPages.map((p) => p.doc))

    const coverage: QueryCoverage[] = []
    const similarities: number[] = []
    const margins: number[] = []
    let evidenceRejections = 0

    for (const query of poolQueries) {
        // Score against every page, not just the best — the shape of this
        // distribution is what distinguishes "owns the query" from
        // "is vaguely in the same field".
        const scored = embeddedPages.map(({ doc, embedding }) => ({
            doc,
            similarity: cosineSimilarity(query.embedding, embedding),
        }))

        if (scored.length === 0) {
            coverage.push({
                queryId: query.id,
                query: query.query,
                status: "gap",
                definingTerms: [],
                evidenceFound: [],
                evidenceMissing: [],
                similarity: 0,
                margin: 0,
                baseline: 0,
                matchedUrl: null,
                matchedTitle: null,
            })
            continue
        }

        const sortedScores = scored.map((s) => s.similarity).sort((a, b) => a - b)
        const baseline = percentile(sortedScores, 50)
        const best = scored.reduce((a, b) => (b.similarity > a.similarity ? b : a))
        const margin = best.similarity - baseline

        similarities.push(best.similarity)
        margins.push(margin)

        // Combined score: raw closeness plus how far the best page stands out
        // from the rest of this site. Neither term separates on its own.
        const score = best.similarity + margin

        let status: CoverageStatus = "gap"
        if (best.similarity >= COVERAGE_THRESHOLDS.MIN_ABSOLUTE) {
            if (score >= COVERAGE_THRESHOLDS.COVERED) status = "covered"
            else if (score >= COVERAGE_THRESHOLDS.PARTIAL) status = "partial"
        }

        // --- Stage 2: lexical evidence over a candidate set ---
        // Retrieval supplies recall, this supplies precision. Checking only the
        // single top page conflated the two failure modes: "merge family photos
        // from separate pictures" was rejected because the top hit lacked the
        // terms, even though another page carried them. Retrieval nominates
        // candidates; evidence decides which one actually answers the query.
        const terms = definingTerms(query.query, documentFrequency, embeddedPages.length)

        const candidates = [...scored]
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, EVIDENCE_CANDIDATES)

        let supporting: { doc: PageDocument; similarity: number } | null = null
        let evidence = checkEvidence(best.doc, terms)

        for (const candidate of candidates) {
            const check = checkEvidence(candidate.doc, terms)
            if (check.pass) {
                supporting = candidate
                evidence = check
                break
            }
        }

        if (status !== "gap" && !supporting) {
            // Semantically adjacent, but no candidate page carries the intent
            status = "gap"
            evidenceRejections++
        }

        // Credit the page that actually supports the query, not merely the
        // closest one — that URL is the evidence shown to the customer.
        const matched = supporting ?? best

        coverage.push({
            queryId: query.id,
            query: query.query,
            status,
            similarity: Math.round(best.similarity * 1000) / 1000,
            margin: Math.round(margin * 1000) / 1000,
            baseline: Math.round(baseline * 1000) / 1000,
            definingTerms: evidence.required,
            evidenceFound: evidence.found,
            evidenceMissing: evidence.missing,
            // Only attach evidence when there is a real match to point at
            matchedUrl: status === "gap" ? null : matched.doc.url,
            matchedTitle: status === "gap" ? null : matched.doc.title,
        })
    }

    // Distribution logs — calibration data for both gates
    const sorted = [...similarities].sort((a, b) => a - b)
    const sortedMargins = [...margins].sort((a, b) => a - b)
    console.log(
        `[Coverage] Similarity for ${siteName} (n=${sorted.length}): ` +
        `min=${percentile(sorted, 0).toFixed(3)} ` +
        `median=${percentile(sorted, 50).toFixed(3)} ` +
        `max=${percentile(sorted, 100).toFixed(3)}`
    )
    console.log(
        `[Coverage] Margin for ${siteName}: ` +
        `min=${percentile(sortedMargins, 0).toFixed(3)} ` +
        `p25=${percentile(sortedMargins, 25).toFixed(3)} ` +
        `median=${percentile(sortedMargins, 50).toFixed(3)} ` +
        `p75=${percentile(sortedMargins, 75).toFixed(3)} ` +
        `max=${percentile(sortedMargins, 100).toFixed(3)}`
    )

    console.log(
        `[Coverage] Evidence stage rejected ${evidenceRejections} semantic matches for ${siteName} ` +
        `(page did not contain the query's defining terms)`
    )

    const coveredCount = coverage.filter((c) => c.status === "covered").length
    const partialCount = coverage.filter((c) => c.status === "partial").length
    const coveredPercent = poolQueries.length > 0
        ? Math.round((coveredCount / poolQueries.length) * 100)
        : 0

    console.log(
        `[Coverage] ${siteName}: ${coveredCount} covered, ${partialCount} partial, ` +
        `${coverage.length - coveredCount - partialCount} gaps (${coveredPercent}%)`
    )

    return {
        siteUrl,
        siteName,
        pagesScanned: embeddedPages.length,
        pagesAttempted: attemptedUrls.length,
        pages: embeddedPages.map(({ doc, embedding }) => ({
            url: doc.url,
            title: doc.title,
            embedding,
        })),
        coverage,
        coveredPercent,
    }
}
