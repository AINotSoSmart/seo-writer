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
    // verbose feature consume the entire six-cluster program.
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
    const selected: ScopeCluster[] = []
    let round = 0
    while (
        selected.length < HARVEST_POLICY.recommendedClusterCount &&
        familyOrder.some(([, rows]) => rows.length > round)
    ) {
        for (const [, rows] of familyOrder) {
            const cluster = rows[round]
            if (cluster) selected.push(cluster)
            if (selected.length >= HARVEST_POLICY.recommendedClusterCount) break
        }
        round++
    }

    const selectedArticleCount = selected.reduce(
        (sum, cluster) => sum + cluster.articleCount,
        0,
    )

    let reason: string | null = null
    if (requiresReaudit) {
        reason =
            "This legacy audit must be refreshed before a program can be purchased."
    } else if (selected.length < HARVEST_POLICY.recommendedClusterCount) {
        reason = `This site currently has ${selected.length} unsold qualified clusters. The program requires six.`
    } else if (selectedArticleCount < HARVEST_POLICY.minProgramArticles) {
        reason = `The six-cluster scope contains ${selectedArticleCount} articles. At least ${HARVEST_POLICY.minProgramArticles} are required.`
    }

    return {
        selected,
        selectedArticleCount,
        eligible: reason === null,
        reason,
    }
}
