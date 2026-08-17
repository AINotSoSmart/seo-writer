/**
 * One policy object governs both the dev verifier and production audits.
 * Change the version whenever any value or stage changes.
 */
export const HARVEST_POLICY = {
    version: "evidence-bound-writer-v5.0.1",
    /** Working set scanned for gap ownership evidence. */
    maxCompetitors: 4,
    /**
     * Discovery + coverage failover reserve. Unreadable candidates (no sitemap,
     * blocked crawl) are skipped and the next reserve fills the working set
     * instead of aborting the whole audit.
     */
    maxCompetitorCandidates: 12,
    /**
     * Competitor discovery searches at most the top three confirmed product
     * areas, by priority. Fewer areas means fewer searches — one to three, not
     * a fixed three.
     *
     * Three, not twelve, because this is paid search and the returns fall off a
     * cliff. Discovery selects `maxCompetitors` (4) rivals in total, and the
     * areas are already priority-ordered: the fourth area's search is competing
     * for a slot the first three have almost certainly filled. A twelve-area
     * brand would have paid for twelve searches to change, at most, which four
     * names came back — and the later areas are the narrow ones least likely to
     * name a rival worth tracking anyway.
     */
    maxCompetitorDiscoveryQueries: 3,
    maxScopeFamilies: 12,
    // A family may carry several genuinely different founder-confirmed searches.
    // The total audit cap below is the cost boundary; never silently truncate a
    // confirmed family to an arbitrary first three.
    maxSeedsPerFamily: 8,
    maxTotalScopeSeeds: 12,
    // At least one ranking-page search can represent every allowed family.
    maxScopeSerpSeeds: 12,
    /**
     * Bounds positive-scope classification cost while preserving each
     * confirmed family and evidence source through a fair round-robin cap.
     */
    maxPreScopeQueries: 600,
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
    minQualifiedClusterArticles: 8,
    minQualifiedClusters: 6,
    minProgramArticles: 25,
    recommendedClusterCount: 6,
    minGapsForCollapseCheck: 60,
    /**
     * Expected collapse band, reported as telemetry — NOT a release gate.
     *
     * Collapse ratio measures how much phrasing redundancy a niche happens to
     * contain, not whether clustering worked. Observed across four real audits:
     * 27.7%, 28.3%, 28.4% and 48.4%. The 48.4% run was entirely healthy — 13
     * clusters, all sized 8-15, every source clean — but its pool was 55%
     * page-derived (141 PAA + 79 competitor titles) versus ~10% on the others.
     * Page titles are distinct and do not merge; autocomplete variants merge
     * roughly 4:1. So the ratio tracks source mix, and source mix depends on how
     * much FAQ/blog content a customer's competitors happen to publish.
     *
     * Gating on it rejected a good audit for a property of someone else's
     * website. The real risk — near-duplicate articles — is now tested directly
     * by `findDuplicateArticlePairs`.
     */
    collapseExpectedMin: 0.25,
    collapseExpectedMax: 0.55,
    /**
     * Hard ceiling. Above this, clustering is genuinely not merging anything and
     * the customer would receive near-duplicate articles.
     */
    collapseCeiling: 0.80,
    provenanceSampleSize: 20,
    checkoutFreshnessDays: 30,
} as const

export type HarvestPolicy = typeof HARVEST_POLICY
