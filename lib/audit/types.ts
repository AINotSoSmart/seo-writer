// ============================================================
// Topical Authority Audit — Core Types
// ============================================================

// --- Niche Blueprint (the "required coverage" map) ---

export interface RequiredTopic {
    question: string                 // "What is privacy-first analytics?"
    intent: "informational" | "commercial" | "navigational"
    importance: "critical" | "important" | "supporting"
}

export interface NichePillar {
    name: string                     // "Core Concepts"
    description: string              // Why this pillar matters
    weight: number                   // 1-10 importance for authority scoring
    required_topics: RequiredTopic[]
}

export interface NicheBlueprint {
    niche_name: string               // "Privacy-First Web Analytics"
    pillars: NichePillar[]
    total_required_topics: number
}

// --- Coverage Mapping ---

export interface CoveredTopic {
    topic_question: string           // The blueprint topic this page answers
    covered_by_url: string           // URL that covers it
    covered_by_title: string         // Actual page title
    coverage_quality: "strong" | "partial" | "weak"
    similarity_score: number         // Cosine similarity (0-1)
}

export interface PillarCoverage {
    pillar_name: string
    pillar_weight: number
    covered_topics: CoveredTopic[]
    missing_topics: RequiredTopic[]  // Full topic objects for missing ones
    score: number                    // 0-100
}

export interface SiteCoverage {
    site_url: string
    site_name: string
    pages_analyzed: number
    pillar_coverage: PillarCoverage[]
    overall_score: number            // 0-100 weighted authority score
}

// --- Gap Matrix ---

export interface CompetitorMatch {
    competitor_name: string          // "Frase"
    competitor_url: string           // "https://frase.io"
    matched_page_url: string         // "https://frase.io/blog/content-briefs"
    matched_page_title: string       // "How to Create Content Briefs"
    coverage_quality: "strong" | "partial"
    similarity_score: number         // 0-1 cosine similarity
}

export interface GapItem {
    topic: string                    // The question/topic not covered
    pillar: string                   // Which pillar it belongs to
    importance: "critical" | "important" | "supporting"
    user_covered: boolean
    user_coverage_quality?: "strong" | "partial" | "weak"
    user_matched_url?: string        // URL of user's matching page
    user_matched_title?: string      // Title of user's matching page
    competitors_covering: string[]   // Names of competitors who cover this (backward compat)
    competitor_matches: CompetitorMatch[] // Detailed proof for drilldown
}

export interface PillarSuggestion {
    pillar_name: string
    suggested_title: string          // "Complete Guide to Privacy-First Analytics"
    suggested_slug: string           // "/privacy-first-analytics-guide"
    description: string              // Why this pillar page matters
    key_sections: string[]           // H2s to include
    articles_to_link: number         // How many plan articles will link back
}

// --- Final Audit Result ---

export interface PillarScore {
    pillar: string
    user_score: number
    best_competitor_name: string
    best_competitor_score: number
}

export interface TopicalAuditResult {
    niche_blueprint: NicheBlueprint
    user_coverage: SiteCoverage
    competitor_coverages: SiteCoverage[]
    authority_score: number          // User's overall 0-100
    pillar_scores: PillarScore[]
    gap_matrix: GapItem[]
    pillar_suggestions: PillarSuggestion[]
    projected_score_after_plan: number
    audit_meta: {
        competitors_scanned: number
        topics_analyzed: number
        user_pages_scanned: number
        duration_ms: number
    }
}

// --- Page Info (extracted from sitemap + fetch) ---

export interface PageInfo {
    url: string
    title: string
    source: "html_title" | "og_title" | "meta_title" | "h1" | "url_slug"
}

// --- Embedding cache for cross-site reuse ---

export interface TopicEmbedding {
    question: string
    pillar_name: string
    importance: "critical" | "important" | "supporting"
    embedding: number[]
}
