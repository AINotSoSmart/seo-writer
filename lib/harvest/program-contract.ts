import { HARVEST_POLICY } from "./policy.ts"

export interface ScopeCluster {
    id: string
    priority: number
    articleCount: number
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
    const selected = [...clusters]
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
        .slice(0, HARVEST_POLICY.recommendedClusterCount)

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
