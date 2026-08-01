/**
 * Shared cluster shapes.
 *
 * Split out of clusterer.ts so the pure absorption logic — and the contract
 * suite, which runs under plain node — can use them without pulling in the
 * `@/...` alias imports that clusterer.ts needs for Gemini and the site scanner.
 */

export type ArticleType = "informational" | "commercial" | "howto"
import type {
    ArticleContract,
    CapabilityFit,
    SolutionMode,
} from "../writer/article-contract"

/** An intent answered as an H2/FAQ section inside another article. */
export interface SubNode {
    intent: string
    sourceQueryIds: string[]
    scopeFamilyId: string
    operationKey: string | null
    capabilityFit: CapabilityFit
    solutionMode: SolutionMode
    sourceContext: string
}

export interface ArticleUnit {
    scopeFamilyId: string
    /**
     * The domain this demand was measured under, when the article was absorbed
     * into another domain's cluster. `scopeFamilyId` must equal the host
     * cluster's family because of `planned_articles_cluster_scope_fkey`, so the
     * true origin is preserved here rather than lost.
     */
    originScopeFamilyId?: string
    /** The query this article primarily targets */
    mainKeyword: string
    /** Same-intent variants folded into this article */
    supportingKeywords: string[]
    /** Pool row IDs this unit was collapsed from — full traceability */
    sourceQueryIds: string[]
    operationKey: string | null
    capabilityFit: CapabilityFit
    solutionMode: SolutionMode
    sourceContext: string
    /** Thin-domain intents this article must answer as H2/FAQ sections */
    subNodes: SubNode[]
    articleType: ArticleType
    priority: number
    competitorUrls: string[]
    /** Filled by the titler */
    title: string
    /** Centroid used for second-level grouping */
    embedding: number[]
    /** Frozen after cluster formation, when pillar position and subnodes are known. */
    articleContract?: ArticleContract
}

export interface ArticleCluster {
    scopeFamilyId: string
    name: string
    articles: ArticleUnit[]
    priority: number
    competitorUrls: string[]
}

export interface ClusterGrouping {
    clusters: ArticleCluster[]
    /**
     * Units from a domain too thin to form its own cluster. Never discarded —
     * assembly absorbs these into the nearest qualifying cluster from any
     * family. Returning nothing here is what destroyed 33% of one audit's
     * measured demand.
     */
    orphanedUnits: ArticleUnit[]
}
