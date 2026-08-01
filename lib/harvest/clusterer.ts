/**
 * Clustering and article collapse.
 *
 * Two levels of grouping turn a flat pool of gap queries into a shippable plan:
 *
 *   queries  ──(merge same-intent variants)──▶  article units
 *   article units  ──(merge same theme)──▶  clusters
 *
 * The LLM's only job in this file is writing a headline for each article unit
 * and naming each cluster. It receives N units and must return N titles. It
 * never invents a topic, never adds one, never drops one — which is the entire
 * difference between this and the deleted `generateContentPlan()`.
 */

import { getGeminiClient } from "@/utils/gemini/geminiClient"
import { cosineSimilarity } from "@/lib/audit/site-scanner"
import { GapItem } from "./gap-engine"
import { HARVEST_POLICY } from "./policy"
import type {
    ArticleCluster,
    ArticleType,
    ArticleUnit,
    ClusterGrouping,
} from "./cluster-types.ts"
export type {
    ArticleCluster,
    ArticleType,
    ArticleUnit,
    ClusterGrouping,
    SubNode,
} from "./cluster-types.ts"
export {
    absorbOrphanedUnits,
    buildParentByFamilyId,
    STANDALONE_MIN_BACKING_QUERIES,
} from "./absorption.ts"

/**
 * Merge thresholds.
 *
 * CALIBRATION STATUS: PROVISIONAL — see COVERAGE_THRESHOLDS in coverage.ts for
 * the calibration procedure. `assertCollapseRatio()` below is the guard that
 * catches these being badly wrong in production.
 */
export const CLUSTER_THRESHOLDS = {
    /** Above this, two queries are the same article */
    ARTICLE_MERGE: 0.78,
    /** Above this, two articles belong in the same thematic cluster */
    CLUSTER_MERGE: 0.62,
}

const MAX_SUPPORTING_KEYWORDS = 5
const TARGET_CLUSTER_MIN = HARVEST_POLICY.minQualifiedClusterArticles
const TARGET_CLUSTER_MAX = HARVEST_POLICY.maxClusterArticles

/**
 * Classifies intent from query shape. Deterministic, no model call.
 *
 * This replaces the old prompt that demanded a fixed 12/8/6/4 split and warned
 * to the console when the LLM ignored it. Intent is a property of the query,
 * not a quota to be filled.
 */
export function classifyArticleType(query: string): ArticleType {
    const q = query.toLowerCase()

    if (/^(how to|how do|how can|how does|steps to|guide to)\b/.test(q)) return "howto"

    if (/\b(vs|versus|best|top \d|alternative|alternatives|review|reviews|pricing|price|cost|cheapest|comparison|compare)\b/.test(q)) {
        return "commercial"
    }

    return "informational"
}

/**
 * Greedy single-pass agglomeration seeded by priority.
 *
 * Highest-priority query becomes an article's main keyword; everything close
 * enough to it folds in as a supporting keyword. Deterministic given the same
 * input ordering.
 */
export function collapseToArticles(
    gaps: GapItem[],
    embeddings: Map<string, number[]>
): ArticleUnit[] {
    const ordered = [...gaps].sort((a, b) => b.priority - a.priority)
    const assigned = new Set<string>()
    const units: ArticleUnit[] = []

    for (const gap of ordered) {
        if (assigned.has(gap.queryId)) continue

        const primaryEmbedding = embeddings.get(gap.queryId)
        if (!primaryEmbedding) continue

        assigned.add(gap.queryId)

        // Every near-duplicate is absorbed, but only the first few are listed as
        // supporting keywords.
        //
        // This loop used to `break` once it had MAX_SUPPORTING_KEYWORDS matches,
        // which left the remaining duplicates unassigned — and an unassigned
        // query goes on to become its own article. A cluster of eight identical
        // phrasings therefore shipped as one article plus three duplicates of it.
        // The cap belongs on what the writer is shown, never on what the merge
        // step consumes.
        const supporting: GapItem[] = []
        const absorbed: GapItem[] = []

        for (const candidate of ordered) {
            if (assigned.has(candidate.queryId)) continue

            const candidateEmbedding = embeddings.get(candidate.queryId)
            if (!candidateEmbedding) continue

            const similarity = cosineSimilarity(primaryEmbedding, candidateEmbedding)
            if (similarity >= CLUSTER_THRESHOLDS.ARTICLE_MERGE) {
                assigned.add(candidate.queryId)
                if (supporting.length < MAX_SUPPORTING_KEYWORDS) {
                    supporting.push(candidate)
                } else {
                    // Still merged and still traceable, just not in the prompt.
                    absorbed.push(candidate)
                }
            }
        }

        const members = [gap, ...supporting, ...absorbed]
        const competitorUrls = Array.from(
            new Set(members.flatMap((m) => m.competitors.map((c) => c.matchedUrl)))
        )

        units.push({
            scopeFamilyId: gap.scopeFamilyId,
            mainKeyword: gap.query,
            supportingKeywords: supporting.map((s) => s.query),
            sourceQueryIds: members.map((m) => m.queryId),
            subNodes: [],
            articleType: classifyArticleType(gap.query),
            priority: gap.priority,
            competitorUrls,
            title: "", // filled by titleArticles()
            embedding: primaryEmbedding,
        })
    }

    console.log(
        `[Clusterer] Collapsed ${gaps.length} queries into ${units.length} article units`
    )

    return units
}

/**
 * Second-level grouping: article units into thematic clusters.
 *
 * Undersized thematic groups fold into a neighbour that already reached the
 * minimum. A domain with no group reaching TARGET_CLUSTER_MIN emits zero
 * clusters — a 1–7 article "program cluster" is not what is sold — but its
 * units are now RETURNED as orphans for assembly to absorb, not discarded.
 */
export function groupIntoClusters(units: ArticleUnit[]): ClusterGrouping {
    const assigned = new Set<number>()
    const raw: ArticleUnit[][] = []

    const ordered = units
        .map((unit, index) => ({ unit, index }))
        .sort((a, b) => b.unit.priority - a.unit.priority)

    for (const { unit, index } of ordered) {
        if (assigned.has(index)) continue
        assigned.add(index)

        const group = [unit]

        for (const candidate of ordered) {
            if (assigned.has(candidate.index)) continue
            if (group.length >= TARGET_CLUSTER_MAX) break

            const similarity = cosineSimilarity(unit.embedding, candidate.unit.embedding)
            if (similarity >= CLUSTER_THRESHOLDS.CLUSTER_MERGE) {
                group.push(candidate.unit)
                assigned.add(candidate.index)
            }
        }

        raw.push(group)
    }

    // Fold undersized groups into their nearest surviving cluster
    const large = raw.filter((g) => g.length >= TARGET_CLUSTER_MIN)
    const small = raw.filter((g) => g.length < TARGET_CLUSTER_MIN)

    if (large.length === 0) {
        // Not enough distinct thematic depth for a qualified cluster of its own.
        // The units are handed back so assembly can absorb them into another
        // domain's cluster. Returning [] here is what destroyed 33% of one
        // audit's measured demand.
        console.log(
            `[Clusterer] ${units.length} articles below minimum ${TARGET_CLUSTER_MIN} — ` +
                `0 clusters; ${units.length} units returned for absorption`,
        )
        return { clusters: [], orphanedUnits: units }
    }

    for (const group of small) {
        let bestIndex = 0
        let bestSimilarity = -1

        for (let i = 0; i < large.length; i++) {
            const similarity = cosineSimilarity(group[0].embedding, large[i][0].embedding)
            if (similarity > bestSimilarity) {
                bestSimilarity = similarity
                bestIndex = i
            }
        }
        large[bestIndex].push(...group)
    }

    // Merging undersized groups can push a cluster past the maximum — the first
    // run produced clusters of 18 and 40 against a configured max of 15. Split
    // after merging, not before.
    const sized = large.flatMap(splitOversized)

    // Defense in depth: never return a cluster below the target minimum after
    // split (a pathological split should not invent thin program rows).
    const clusters = sized
        .filter((group) => group.length >= TARGET_CLUSTER_MIN)
        .map(buildCluster)
        .sort((a, b) => b.priority - a.priority)

    // A pathological split can still leave a stub. It is returned for
    // absorption rather than counted and forgotten.
    const orphanedUnits = sized
        .filter((group) => group.length < TARGET_CLUSTER_MIN)
        .flat()

    console.log(
        `[Clusterer] ${units.length} articles grouped into ${clusters.length} clusters ` +
            `(sizes: ${clusters.map((c) => c.articles.length).join(", ") || "none"}` +
            (orphanedUnits.length > 0
                ? `; ${orphanedUnits.length} units returned for absorption`
                : "") +
            `)`,
    )

    const oversized = clusters.filter((c) => c.articles.length > TARGET_CLUSTER_MAX)
    if (oversized.length > 0) {
        console.warn(
            `[Clusterer] ${oversized.length} clusters still exceed ${TARGET_CLUSTER_MAX} after splitting`
        )
    }

    return { clusters, orphanedUnits }
}

/**
 * Splits a cluster larger than TARGET_CLUSTER_MAX into balanced parts.
 *
 * Balanced rather than greedy chunking, so 40 articles become three clusters of
 * ~13 instead of 15/15/10 — a trailing stub reads like a mistake to the customer
 * looking at their map.
 */
export function splitOversized(articles: ArticleUnit[]): ArticleUnit[][] {
    if (articles.length <= TARGET_CLUSTER_MAX) return [articles]

    const partCount = Math.ceil(articles.length / TARGET_CLUSTER_MAX)
    const baseSize = Math.floor(articles.length / partCount)
    const remainder = articles.length % partCount

    // Keep semantically adjacent articles together: order by similarity to the
    // lead article before cutting, so each part stays coherent.
    const [lead, ...rest] = [...articles].sort((a, b) => b.priority - a.priority)
    const ordered = [
        lead,
        ...rest.sort(
            (a, b) =>
                cosineSimilarity(lead.embedding, b.embedding) -
                cosineSimilarity(lead.embedding, a.embedding)
        ),
    ]

    const parts: ArticleUnit[][] = []
    let cursor = 0

    for (let i = 0; i < partCount; i++) {
        const size = baseSize + (i < remainder ? 1 : 0)
        parts.push(ordered.slice(cursor, cursor + size))
        cursor += size
    }

    console.log(
        `[Clusterer] Split oversized cluster of ${articles.length} into ` +
        `${parts.length} parts (${parts.map((p) => p.length).join(", ")})`
    )

    return parts
}

function buildCluster(articles: ArticleUnit[]): ArticleCluster {
    const sorted = [...articles].sort((a, b) => b.priority - a.priority)
    const scopeFamilyId = sorted[0]?.scopeFamilyId
    if (
        !scopeFamilyId ||
        sorted.some((article) => article.scopeFamilyId !== scopeFamilyId)
    ) {
        throw new Error("A content cluster crossed confirmed business families")
    }
    return {
        scopeFamilyId,
        // Placeholder until nameClusters() runs; falls back to the lead keyword
        name: sorted[0].mainKeyword,
        articles: sorted,
        priority: Math.round(
            sorted.reduce((sum, a) => sum + a.priority, 0) / sorted.length
        ),
        competitorUrls: Array.from(new Set(sorted.flatMap((a) => a.competitorUrls))),
    }
}

/**
 * Deterministic title fallback: title-cases the keyword.
 * Used whenever the model returns the wrong number of titles, so a bad model
 * response degrades to a plain headline instead of a fabricated topic.
 */
function fallbackTitle(keyword: string): string {
    const minorWords = new Set(["a", "an", "the", "for", "and", "or", "of", "to", "in", "on", "vs", "with"])
    return keyword
        .split(/\s+/)
        .map((word, i) =>
            i > 0 && minorWords.has(word.toLowerCase())
                ? word.toLowerCase()
                : word.charAt(0).toUpperCase() + word.slice(1)
        )
        .join(" ")
}

/**
 * Writes a headline for each article unit.
 *
 * The contract with the model is strict: N inputs, N outputs, same order. If it
 * returns any other count the whole response is discarded and every article
 * falls back to its deterministic title. The model cannot add, remove, or
 * substitute a topic.
 */
export async function titleArticles(units: ArticleUnit[]): Promise<ArticleUnit[]> {
    if (units.length === 0) return units

    const client = getGeminiClient()

    const prompt = `You are writing headlines for articles that have ALREADY been chosen.

Below are ${units.length} target search queries, numbered. For each one, write a headline
that a person would click, which clearly promises an answer to that exact query.

STRICT RULES:
- Return EXACTLY ${units.length} titles, in the same order as the input.
- Title ${units.length} must correspond to query ${units.length}. Do not reorder.
- Do NOT invent, merge, split, skip, or substitute topics. The queries are fixed.
- The title must NOT be identical to the query — the query is what people search,
  the title is what earns the click.
- Maximum 70 characters.
- No "Ultimate Guide", "Everything You Need to Know", "The Complete Guide", or
  any variation of those.

QUERIES:
${units.map((u, i) => `${i + 1}. ${u.mainKeyword}`).join("\n")}`

    try {
        const response = await client.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT" as const,
                    properties: {
                        titles: { type: "ARRAY" as const, items: { type: "STRING" as const } },
                    },
                    required: ["titles"],
                },
            },
        })

        const parsed = JSON.parse(response.text || "{}")
        const titles: string[] = parsed.titles || []

        if (titles.length !== units.length) {
            console.warn(
                `[Clusterer] Titler returned ${titles.length} titles for ${units.length} ` +
                `articles — discarding response and using deterministic titles`
            )
            return units.map((u) => ({ ...u, title: fallbackTitle(u.mainKeyword) }))
        }

        return units.map((u, i) => {
            const title = (titles[i] || "").trim()
            const usable =
                title.length > 3 &&
                title.toLowerCase() !== u.mainKeyword.toLowerCase()
            return { ...u, title: usable ? title : fallbackTitle(u.mainKeyword) }
        })
    } catch (error) {
        console.error("[Clusterer] Titling failed, using deterministic titles:", error)
        return units.map((u) => ({ ...u, title: fallbackTitle(u.mainKeyword) }))
    }
}

/**
 * Names each cluster from its own articles.
 * Same contract as the titler: N in, N out, or fall back.
 */
export async function nameClusters(clusters: ArticleCluster[]): Promise<ArticleCluster[]> {
    if (clusters.length === 0) return clusters

    const client = getGeminiClient()

    const prompt = `Name each of these ${clusters.length} content clusters.

A cluster name is a short noun phrase (2-5 words) describing the theme its
articles share. It is a label, not a headline.

STRICT RULES:
- Return EXACTLY ${clusters.length} names, in input order.
- Do not reorder, merge, or skip clusters.

CLUSTERS:
${clusters
            .map(
                (c, i) =>
                    `${i + 1}. ${c.articles.slice(0, 6).map((a) => a.mainKeyword).join(" | ")}`
            )
            .join("\n")}`

    try {
        const response = await client.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT" as const,
                    properties: {
                        names: { type: "ARRAY" as const, items: { type: "STRING" as const } },
                    },
                    required: ["names"],
                },
            },
        })

        const parsed = JSON.parse(response.text || "{}")
        const names: string[] = parsed.names || []

        if (names.length !== clusters.length) {
            console.warn(
                `[Clusterer] Namer returned ${names.length} names for ${clusters.length} clusters — keeping fallbacks`
            )
            return clusters.map((c) => ({ ...c, name: fallbackTitle(c.name) }))
        }

        return clusters.map((c, i) => ({
            ...c,
            name: (names[i] || "").trim() || fallbackTitle(c.name),
        }))
    } catch (error) {
        console.error("[Clusterer] Cluster naming failed:", error)
        return clusters.map((c) => ({ ...c, name: fallbackTitle(c.name) }))
    }
}

export interface DuplicateArticlePair {
    a: string
    b: string
    similarity: number
}

/**
 * Finds article units that should have been merged and were not.
 *
 * This is the invariant that actually protects the customer. `collapseToArticles`
 * folds any query within `ARTICLE_MERGE` of an existing unit into it, so after
 * clustering **no two units should be that close to each other**. A pair above
 * the threshold means the merge step genuinely failed — which is the only way a
 * customer receives two articles about the same thing.
 *
 * It replaces gating on the collapse ratio, which measured how much phrasing
 * redundancy a niche happened to contain and rejected a perfectly healthy audit
 * because its competitors published a lot of FAQ pages.
 */
export function findDuplicateArticlePairs(
    units: ArticleUnit[],
    threshold: number = CLUSTER_THRESHOLDS.ARTICLE_MERGE
): DuplicateArticlePair[] {
    const pairs: DuplicateArticlePair[] = []

    for (let i = 0; i < units.length; i++) {
        for (let j = i + 1; j < units.length; j++) {
            const similarity = cosineSimilarity(units[i].embedding, units[j].embedding)
            if (similarity >= threshold) {
                pairs.push({
                    a: units[i].mainKeyword,
                    b: units[j].mainKeyword,
                    similarity: Math.round(similarity * 1000) / 1000,
                })
            }
        }
    }

    return pairs.sort((x, y) => y.similarity - x.similarity)
}

/**
 * QA guard on the collapse ratio.
 *
 * If article count approaches query count, same-intent variants are not being
 * merged and the customer would receive near-duplicate articles — the exact
 * failure this rewrite exists to prevent. Fail loudly rather than ship it.
 */
export function assertCollapseRatio(poolSize: number, articleCount: number): void {
    if (poolSize === 0) return

    const ratio = articleCount / poolSize
    console.log(
        `[Clusterer] Collapse ratio: ${articleCount}/${poolSize} = ${(ratio * 100).toFixed(1)}%`
    )

    if (ratio > 0.8) {
        throw new Error(
            `Clustering failed: ${articleCount} articles from ${poolSize} queries ` +
            `(${(ratio * 100).toFixed(0)}%). Same-intent variants are not merging — ` +
            `check CLUSTER_THRESHOLDS.ARTICLE_MERGE (currently ${CLUSTER_THRESHOLDS.ARTICLE_MERGE}).`
        )
    }

    if (ratio > 0.55) {
        console.warn(
            `[Clusterer] Collapse ratio ${(ratio * 100).toFixed(0)}% is higher than the ` +
            `expected 25-40%. Articles may be too granular.`
        )
    }
}
