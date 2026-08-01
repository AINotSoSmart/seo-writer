import { HARVEST_POLICY } from "./policy.ts"

export interface ScopeCluster {
    id: string
    priority: number
    articleCount: number
    scopeFamilyId?: string
    scopeFamilyPriority?: number
}

export interface ProgramScopeSelection {
    selected: ScopeCluster[]
    selectedArticleCount: number
    eligible: boolean
    reason: string | null
}

export function auditCheckoutFreshness(
    completedAt: string | null | undefined,
    now = Date.now(),
): { fresh: boolean; reason: string | null } {
    const completed = completedAt ? new Date(completedAt).getTime() : Number.NaN
    const maxAge =
        HARVEST_POLICY.checkoutFreshnessDays * 24 * 60 * 60 * 1000
    const fresh =
        Number.isFinite(completed) && completed <= now && now - completed <= maxAge
    return {
        fresh,
        reason: fresh
            ? null
            : "This audit is more than 30 days old. Refresh it before checkout.",
    }
}

/**
 * Pure server/UI contract for selecting one finite program. Keeping this logic
 * free of database concerns makes the checkout and audit screens agree exactly.
 */
export function selectQualifiedProgramScope(
    clusters: ScopeCluster[],
    soldClusterIds: Iterable<string>,
    requiresReaudit: boolean,
): ProgramScopeSelection {
    const sold = new Set(soldClusterIds)
    const qualified = [...clusters]
        .filter(
            (cluster) =>
                !sold.has(cluster.id) &&
                cluster.articleCount >=
                    HARVEST_POLICY.minQualifiedClusterArticles &&
                cluster.articleCount <= HARVEST_POLICY.maxClusterArticles,
        )
        .sort(
            (a, b) =>
                a.priority - b.priority || a.id.localeCompare(b.id),
        )

    // Portfolio selection: take one cluster from each confirmed commercial
    // family before taking a second from any family. A flat global sort let one
    // verbose feature dominate the delivery order.
    const byFamily = new Map<string, ScopeCluster[]>()
    for (const cluster of qualified) {
        const familyId = cluster.scopeFamilyId || "__legacy_flat_scope__"
        const rows = byFamily.get(familyId) || []
        rows.push(cluster)
        byFamily.set(familyId, rows)
    }
    const familyOrder = Array.from(byFamily.entries()).sort(
        ([leftId, left], [rightId, right]) =>
            (left[0]?.scopeFamilyPriority ?? 99) -
                (right[0]?.scopeFamilyPriority ?? 99) ||
            leftId.localeCompare(rightId),
    )
    // Every qualified cluster is sold. The scope is whatever the audit measured
    // — 2, 4, 7 or 12 — because a hyper-focused tool and a broad platform do not
    // have the same number of problem pillars, and a fixed count turned the
    // narrower one away at checkout. Round-robin ordering is kept so that when
    // clusters are delivered in sequence, each represented domain is served
    // before any domain gets a second cluster.
    const selected: ScopeCluster[] = []
    let round = 0
    while (familyOrder.some(([, rows]) => rows.length > round)) {
        for (const [, rows] of familyOrder) {
            const cluster = rows[round]
            if (cluster) selected.push(cluster)
        }
        round++
    }

    const selectedArticleCount = selected.reduce(
        (sum, cluster) => sum + cluster.articleCount,
        0,
    )

    // The only remaining ineligible states are "this audit is not usable" and
    // "there is nothing left to sell". A count that is merely small is a
    // smaller program, not a rejection — and the node floor already guarantees
    // every cluster sold is a real one.
    let reason: string | null = null
    if (requiresReaudit) {
        reason =
            "This legacy audit must be refreshed before a program can be purchased."
    } else if (selected.length === 0) {
        reason =
            "No qualified clusters remain for this audit. Refresh it after the business adds products, services, or markets."
    }

    return {
        selected,
        selectedArticleCount,
        eligible: reason === null,
        reason,
    }
}
