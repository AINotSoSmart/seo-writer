/**
 * Absorption of article units from domains too thin to form their own cluster.
 *
 * WHY THIS FILE EXISTS AT ALL:
 * `groupIntoClusters` used to filter undersized groups into a `residual`
 * counter and return nothing. One production audit measured 6 confirmed
 * domains and 373 queries; three of those domains produced real gap demand
 * (14, 14 and 24 queries) and **zero** articles. 52 of 156 gap queries — 33% —
 * were destroyed there, including a product's core commercial intent. The audit
 * then showed 4 clusters, failed a fixed six-cluster checkout gate, and told a
 * customer their site was "not eligible for a program".
 *
 * WHY TWO PASSES:
 * Folding every thin-domain unit in as an H2/FAQ sub-node would bury genuinely
 * searchable intents inside another domain's article, where they can never rank
 * alone or be linked to. The graph is the thing being sold, so a corroborated
 * intent has to stay an addressable node.
 *
 *   Pass 1  triage inside the thin domain
 *             backed by 2+ observed phrasings -> standalone article
 *             backed by exactly one           -> sub-node of one of those
 *   Pass 2  the promoted articles join the nearest qualifying cluster
 *
 * Lives in its own alias-free module so the conservation invariant can be
 * asserted directly by the contract suite, which runs under plain node and
 * cannot resolve the `@/...` imports in clusterer.ts.
 */

import type { ArticleCluster, ArticleUnit } from "./cluster-types.ts"

/**
 * Distinct observed phrasings that must back a unit for it to stand alone.
 *
 * Not a tuned threshold: one query is a single observation, two or more are
 * independent corroboration that the intent is really searched. Same evidential
 * standard the rest of the pipeline uses.
 */
export const STANDALONE_MIN_BACKING_QUERIES = 2

/** Local copy — identical to lib/audit/site-scanner.ts, which is alias-bound. */
export function cosine(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0
    let dot = 0
    let normA = 0
    let normB = 0
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i]
        normA += a[i] * a[i]
        normB += b[i] * b[i]
    }
    if (normA === 0 || normB === 0) return 0
    return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export function centroidOf(units: ArticleUnit[]): number[] {
    const length = units[0]?.embedding.length || 0
    const sum = new Array(length).fill(0)
    for (const unit of units) {
        for (let i = 0; i < length; i++) sum[i] += unit.embedding[i]
    }
    return sum.map((value) => value / Math.max(1, units.length))
}

export interface AbsorptionOptions {
    /**
     * Thin family id -> broader parent family id from the confirmed scope
     * taxonomy. When set, absorption prefers the parent's qualifying cluster
     * before falling back to embedding proximity.
     */
    parentByFamilyId?: Map<string, string>
}

export function buildParentByFamilyId(
    families: Array<{ id: string; parentScopeFamilyId?: string | null }>,
): Map<string, string> {
    const parentByFamilyId = new Map<string, string>()
    for (const family of families) {
        if (family.parentScopeFamilyId) {
            parentByFamilyId.set(family.id, family.parentScopeFamilyId)
        }
    }
    return parentByFamilyId
}

function nearestUnit(units: ArticleUnit[], embedding: number[]): ArticleUnit | null {
    let best: ArticleUnit | null = null
    let bestSimilarity = -Infinity
    for (const unit of units) {
        const similarity = cosine(unit.embedding, embedding)
        if (similarity > bestSimilarity) {
            bestSimilarity = similarity
            best = unit
        }
    }
    return best
}

function nearestClusterTo(
    clusters: ArticleCluster[],
    embedding: number[],
    preferredFamilyId?: string,
): ArticleCluster | null {
    const preferred = preferredFamilyId
        ? clusters.filter((cluster) => cluster.scopeFamilyId === preferredFamilyId)
        : []
    const pool = preferred.length > 0 ? preferred : clusters

    let best: ArticleCluster | null = null
    let bestSimilarity = -Infinity
    for (const cluster of pool) {
        if (cluster.articles.length === 0) continue
        const similarity = cosine(centroidOf(cluster.articles), embedding)
        if (similarity > bestSimilarity) {
            bestSimilarity = similarity
            best = cluster
        }
    }
    return best
}

function articlePoolForFamily(
    clusters: ArticleCluster[],
    familyId: string,
): ArticleUnit[] {
    return clusters
        .filter((cluster) => cluster.scopeFamilyId === familyId)
        .flatMap((cluster) => cluster.articles)
}

/**
 * Absorbs orphaned units into qualifying clusters. Conserves every query.
 *
 * `splitAfterAbsorb` is injected rather than imported so this module stays free
 * of the alias-bound clusterer; assembly passes the existing `splitOversized`.
 */
export function absorbOrphanedUnits(
    clusters: ArticleCluster[],
    orphanedUnits: ArticleUnit[],
    splitAfterAbsorb: (articles: ArticleUnit[]) => ArticleUnit[][] = (a) => [a],
    options: AbsorptionOptions = {},
): { clusters: ArticleCluster[]; unsold: ArticleUnit[] } {
    const parentByFamilyId = options.parentByFamilyId ?? new Map<string, string>()
    if (orphanedUnits.length === 0) return { clusters, unsold: [] }

    if (clusters.length === 0) {
        // Nothing qualifies anywhere. Surface as measured-but-unsold evidence
        // rather than deleting demand the customer can still act on.
        console.log(
            `[Absorption] ${orphanedUnits.length} orphaned units and no qualifying ` +
                `cluster to absorb them — surfaced as unsold evidence`,
        )
        return { clusters, unsold: orphanedUnits }
    }

    const byFamily = new Map<string, ArticleUnit[]>()
    for (const unit of orphanedUnits) {
        const rows = byFamily.get(unit.scopeFamilyId) || []
        rows.push(unit)
        byFamily.set(unit.scopeFamilyId, rows)
    }

    let promoted = 0
    let folded = 0

    for (const [, units] of byFamily) {
        const thinFamilyId = units[0]?.scopeFamilyId
        const preferredParentId = thinFamilyId
            ? parentByFamilyId.get(thinFamilyId)
            : undefined

        const standalone = units.filter(
            (unit) => unit.sourceQueryIds.length >= STANDALONE_MIN_BACKING_QUERIES,
        )
        const weak = units.filter(
            (unit) => unit.sourceQueryIds.length < STANDALONE_MIN_BACKING_QUERIES,
        )

        // Pass 1 — sub-nodes attach to their OWN domain's promoted articles when
        // there are any, so related intent stays together.
        const hosts = standalone.length > 0 ? standalone : null
        for (const unit of weak) {
            const host = hosts
                ? nearestUnit(hosts, unit.embedding)
                : (() => {
                      const parentArticles = preferredParentId
                          ? articlePoolForFamily(clusters, preferredParentId)
                          : []
                      const pool =
                          parentArticles.length > 0
                              ? parentArticles
                              : clusters.flatMap((cluster) => cluster.articles)
                      return nearestUnit(pool, unit.embedding)
                  })()
            if (!host) continue
            host.subNodes.push({
                intent: unit.mainKeyword,
                sourceQueryIds: unit.sourceQueryIds,
            })
            folded++
        }

        if (!hosts) continue

        // Pass 2 — promoted articles join the nearest qualifying cluster,
        // preferring the declared parent domain when it has one.
        const host = nearestClusterTo(
            clusters,
            centroidOf(standalone),
            preferredParentId,
        )
        if (!host) continue
        for (const unit of standalone) {
            host.articles.push({
                ...unit,
                // planned_articles_cluster_scope_fkey requires the article and
                // its cluster to share a family, so it adopts the host's.
                originScopeFamilyId: unit.scopeFamilyId,
                scopeFamilyId: host.scopeFamilyId,
            })
            promoted++
        }
    }

    // Absorption can push a host past the ceiling.
    const rebalanced = clusters.flatMap((cluster) =>
        splitAfterAbsorb(cluster.articles).map((articles) => ({
            ...cluster,
            articles,
        })),
    )

    console.log(
        `[Absorption] ${orphanedUnits.length} orphaned units: ${promoted} promoted to ` +
            `standalone articles, ${folded} folded as sub-nodes ` +
            `(${clusters.length} → ${rebalanced.length} clusters)`,
    )

    return { clusters: rebalanced, unsold: [] }
}
