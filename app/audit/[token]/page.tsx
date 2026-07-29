import { notFound } from "next/navigation"
import Link from "next/link"
import type { Metadata } from "next"
import { createAdminClient } from "@/utils/supabase/admin"
import { ScopeResults } from "@/components/audit/scope-results"
import { MIN_VIABLE_ARTICLES } from "@/lib/harvest/run-harvest"
import type { AuditScope, GapEvidence, ClusterSummary } from "@/actions/harvest"

/**
 * Public, un-authenticated audit page.
 *
 * This is the cold-outreach artifact: run a harvest on a prospect's site, send
 * them one link. It works without an account on purpose — the old funnel put a
 * signup wall in front of any value at all, and 78% of signups never got past it.
 *
 * Read-only, keyed by an unguessable token. No account data is exposed beyond
 * the audit itself.
 */

const RECOMMENDED_CLUSTER_COUNT = 6

interface PageProps {
    params: Promise<{ token: string }>
}

async function loadPublicAudit(token: string): Promise<{
    scope: AuditScope
    gaps: GapEvidence[]
    brandName: string
} | null> {
    if (!token || token.length < 16) return null

    const supabase = createAdminClient() as any

    const { data: audit } = await supabase
        .from("topical_audits")
        .select("brand_id, pool_size, article_count, cluster_count, authority_score, public_token")
        .eq("public_token", token)
        .maybeSingle()

    if (!audit) return null

    const { data: brand } = await supabase
        .from("brand_details")
        .select("brand_data")
        .eq("id", audit.brand_id)
        .maybeSingle()

    const { data: clusterRows } = await supabase
        .from("audit_clusters")
        .select("id, name, priority, article_count, competitor_urls")
        .eq("brand_id", audit.brand_id)
        .order("priority", { ascending: true })

    const clusters: ClusterSummary[] = (clusterRows || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        priority: c.priority,
        articleCount: c.article_count,
        competitorUrls: Array.isArray(c.competitor_urls) ? c.competitor_urls : [],
    }))

    const { data: gapRows } = await supabase
        .from("query_pool")
        .select("query, source, source_url, status, covered_by_url, coverage_similarity, competitor_matches")
        .eq("brand_id", audit.brand_id)
        .in("status", ["gap", "partial"])
        .order("coverage_similarity", { ascending: true })
        .limit(100)

    const gaps: GapEvidence[] = (gapRows || []).map((row: any) => ({
        query: row.query,
        source: row.source,
        sourceUrl: row.source_url,
        status: row.status,
        userMatchedUrl: row.covered_by_url,
        similarity: row.coverage_similarity,
        competitors: Array.isArray(row.competitor_matches)
            ? row.competitor_matches.map((c: any) => ({
                name: c.name,
                matchedUrl: c.matchedUrl,
                similarity: c.similarity,
            }))
            : [],
    }))

    const recommended = clusters.slice(0, RECOMMENDED_CLUSTER_COUNT)
    const articleCount = audit.article_count ?? clusters.reduce((s, c) => s + c.articleCount, 0)

    const scope: AuditScope = {
        poolSize: audit.pool_size ?? 0,
        articleCount,
        clusterCount: clusters.length,
        authorityScore: audit.authority_score ?? 0,
        clusters,
        recommendedClusterIds: recommended.map((c) => c.id),
        recommendedArticleCount: recommended.reduce((s, c) => s + c.articleCount, 0),
        velocity: [
            { tier: "close", clustersPerMonth: 1 },
            { tier: "accelerate", clustersPerMonth: 2 },
            { tier: "dominate", clustersPerMonth: 4 },
        ].map(({ tier, clustersPerMonth }) => ({
            tier,
            clustersPerMonth,
            months: Math.max(1, Math.ceil(recommended.length / clustersPerMonth)),
        })),
        belowViableThreshold: articleCount < MIN_VIABLE_ARTICLES,
        publicToken: token,
    }

    return {
        scope,
        gaps,
        brandName: brand?.brand_data?.product_name || "This site",
    }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { token } = await params
    const data = await loadPublicAudit(token)

    if (!data) return { title: "Audit not found" }

    return {
        title: `${data.brandName} — topical gap audit`,
        description: `${data.scope.articleCount} uncovered articles across ${data.scope.clusterCount} clusters, harvested from ${data.scope.poolSize} real search queries.`,
        // A shared audit is for one recipient, not for the index
        robots: { index: false, follow: false },
    }
}

export default async function PublicAuditPage({ params }: PageProps) {
    const { token } = await params
    const data = await loadPublicAudit(token)

    if (!data) notFound()

    return (
        <div className="min-h-screen bg-stone-50">
            <header className="border-b border-stone-200 bg-white">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href="/" className="font-serif text-lg text-stone-900">
                        FlipAEO
                    </Link>
                    <span className="text-xs text-stone-500">Shared audit · read only</span>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-6 py-10">
                <ScopeResults
                    scope={data.scope}
                    gaps={data.gaps}
                    brandName={data.brandName}
                />

                <div className="mt-12 rounded-lg border border-stone-200 bg-white p-6 text-center">
                    <h3 className="font-serif text-xl text-stone-900">
                        Want this run on your own sites?
                    </h3>
                    <p className="text-sm text-stone-500 mt-2 max-w-lg mx-auto">
                        Every gap above links to the page it was observed on. Nothing here was
                        generated by a model guessing what your niche contains.
                    </p>
                    <Link
                        href="/login"
                        className="inline-flex items-center mt-5 px-5 py-2.5 rounded-md bg-stone-900 text-white text-sm font-medium hover:bg-stone-800"
                    >
                        Run an audit
                    </Link>
                </div>
            </main>
        </div>
    )
}
