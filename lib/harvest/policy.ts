/**
 * One policy object governs both the dev verifier and production audits.
 * Change the version whenever any value or stage changes.
 */
export const HARVEST_POLICY = {
    version: "closed-pool-v2.3.0",
    maxCompetitors: 4,
    maxQueries: 400,
    maxCompetitorCorpusPages: 120,
    maxCoveragePages: 150,
    /**
     * Competitors only need enough depth to establish who owns a gap, not the
     * full-depth scan the customer's own site gets. Without a separate cap the
     * worst case was 250 + 4x250 page fetches inside a 900s task budget.
     */
    maxCompetitorCoveragePages: 80,
    maxSitemapFiles: 20,
    maxSitemapUrls: 5000,
    maxClusterArticles: 15,
    minQualifiedClusterArticles: 3,
    minQualifiedClusters: 6,
    minProgramArticles: 25,
    recommendedClusterCount: 6,
    minGapsForCollapseCheck: 60,
    collapseMin: 0.25,
    collapseMax: 0.40,
    provenanceSampleSize: 20,
    checkoutFreshnessDays: 30,
} as const

export type HarvestPolicy = typeof HARVEST_POLICY
