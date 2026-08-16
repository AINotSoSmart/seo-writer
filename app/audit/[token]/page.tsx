import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import type {
    AuditScope,
    ClusterSummary,
    GapEvidence,
    PlannedArticleRow,
} from "@/actions/harvest"
import { ScopeResults } from "@/components/audit/scope-results"
import { HARVEST_POLICY } from "@/lib/harvest/policy"
import {
    selectQualifiedProgramScope,
} from "@/lib/harvest/program-contract"
import { createAdminClient } from "@/utils/supabase/admin"

type PublicAuditData = {
    scope: AuditScope
    gaps: GapEvidence[]
    articles: PlannedArticleRow[]
    brandName: string
}

async function loadPublicAudit(token: string): Promise<PublicAuditData | null> {
    if (!token || token.length < 16) return null
    const supabase = createAdminClient() as any
    const { data: audit } = await supabase
        .from("topical_audits")
        .select(
            "id, brand_id, brand_snapshot, subject_url, pool_size, article_count, cluster_count, authority_score, public_token, public_token_revoked_at, completed_at, run_status, requires_reaudit",
        )
        .eq("public_token", token)
        .maybeSingle()
    if (
        !audit ||
        audit.public_token_revoked_at ||
        audit.run_status !== "completed"
    ) {
        return null
    }

    const [
        { data: clusterRows },
        { data: gapRows },
        { data: articleRows },
        { data: scopeRows },
        { data: brand },
    ] =
        await Promise.all([
            supabase
                .from("audit_clusters")
                .select("id, scope_family_id, name, description, priority, article_count, competitor_urls")
                .eq("audit_id", audit.id)
                .order("priority", { ascending: true }),
            supabase
                .from("query_pool")
                .select(
                    "id, scope_family_id, query, observed_value, source, source_url, status, covered_by_url, coverage_similarity, competitor_matches",
                )
                .eq("audit_id", audit.id)
                .in("status", ["gap", "partial"])
                .order("coverage_similarity", { ascending: true })
                .limit(HARVEST_POLICY.maxQueries),
            supabase
                .from("planned_articles")
                .select(
                    "id, scope_family_id, title, main_keyword, supporting_keywords, source_query_ids, article_type, is_pillar, generation_status, delivery_status, publication_status, cluster_id, target_url",
                )
                .eq("audit_id", audit.id)
                .is("cycle_action_id", null)
                .order("is_pillar", { ascending: false }),
            supabase
                .from("audit_scope_families")
                .select("id, name, priority")
                .eq("audit_id", audit.id),
            audit.brand_id
                ? supabase
                      .from("brand_details")
                      .select("brand_data")
                      .eq("id", audit.brand_id)
                      .maybeSingle()
                : Promise.resolve({ data: null }),
        ])

    const scopeById = new Map(
        (scopeRows || []).map((scope: any) => [scope.id, scope]),
    )
    const clusters: ClusterSummary[] = (clusterRows || []).map((cluster: any) => {
        const articleCount = Number(cluster.article_count || 0)
        const scope = scopeById.get(cluster.scope_family_id) as any
        return {
            id: cluster.id,
            scopeFamilyId: cluster.scope_family_id,
            scopeFamilyName: scope?.name || "Unverified legacy scope",
            scopeFamilyPriority: Number(scope?.priority ?? 99),
            name: cluster.name,
            description: cluster.description,
            priority: cluster.priority,
            articleCount,
            competitorUrls: Array.isArray(cluster.competitor_urls)
                ? cluster.competitor_urls
                : [],
            qualified:
                articleCount >= HARVEST_POLICY.minQualifiedClusterArticles &&
                articleCount <= HARVEST_POLICY.maxClusterArticles,
        }
    })
    const selection = selectQualifiedProgramScope(
        clusters,
        [],
        Boolean(audit.requires_reaudit),
    )
    const checkoutEligible = false

    // Every cluster being sold means this audit was BOUGHT, not that it is too
    // small to sell. Without this, a shared public report flipped to "not
    // eligible for a program" the moment the customer paid — on the exact link
    // used for outreach. See the matching guard in actions/harvest.ts.
    const hasActiveProgram = false
    const displayClusterIds = selection.selected.map((cluster) => cluster.id)
    const displayArticleCount = selection.selectedArticleCount

    return {
        scope: {
            auditId: audit.id,
            poolSize: audit.pool_size || 0,
            articleCount: audit.article_count || 0,
            clusterCount: clusters.length,
            authorityScore: audit.authority_score || 0,
            clusters,
            recommendedClusterIds: displayClusterIds,
            recommendedArticleCount: displayArticleCount,
            checkoutEligible,
            eligibilityReason: "Legacy audit reports are evidence only; subscriptions start from confirmed tracked questions.",
            hasActiveProgram,
            belowViableThreshold: !checkoutEligible && !hasActiveProgram,
            publicToken: token,
            completedAt: audit.completed_at,
        },
        gaps: (gapRows || []).map((row: any) => ({
            id: row.id,
            scopeFamilyId: row.scope_family_id,
            query: row.query,
            observedValue: row.observed_value || row.query,
            source: row.source,
            sourceUrl: row.source_url,
            status: row.status,
            userMatchedUrl: row.covered_by_url,
            similarity: row.coverage_similarity,
            competitors: Array.isArray(row.competitor_matches)
                ? row.competitor_matches
                : [],
        })),
        articles: (articleRows || []).map((row: any) => ({
            id: row.id,
            scopeFamilyId: row.scope_family_id,
            title: row.title,
            mainKeyword: row.main_keyword,
            supportingKeywords: Array.isArray(row.supporting_keywords)
                ? row.supporting_keywords
                : [],
            sourceQueryIds: Array.isArray(row.source_query_ids)
                ? row.source_query_ids
                : [],
            articleType: row.article_type,
            isPillar: Boolean(row.is_pillar),
            generationStatus: row.generation_status,
            deliveryStatus: row.delivery_status,
            publicationStatus: row.publication_status,
            status: row.generation_status,
            clusterId: row.cluster_id,
            targetUrl: row.target_url,
        })),
        brandName:
            brand?.brand_data?.product_name ||
            audit.brand_snapshot?.product_name ||
            new URL(audit.subject_url).hostname,
    }
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ token: string }>
}): Promise<Metadata> {
    const { token } = await params
    const data = await loadPublicAudit(token)
    return {
        title: data ? `${data.brandName} evidence audit` : "Audit not found",
        description: data
            ? `${data.scope.poolSize} observed queries mapped into ${data.scope.clusterCount} measured clusters.`
            : undefined,
        robots: { index: false, follow: false },
    }
}

export default async function PublicAuditPage({
    params,
}: {
    params: Promise<{ token: string }>
}) {
    const { token } = await params
    const data = await loadPublicAudit(token)
    if (!data) notFound()

    return (
        <div className="min-h-screen bg-stone-50">
            <header className="border-b border-stone-200 bg-white">
                <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
                    <Link href="/" className="font-serif text-lg">
                        FlipAEO
                    </Link>
                    <span className="text-xs text-stone-500">
                        Shared evidence audit · read only
                    </span>
                </div>
            </header>
            <main className="mx-auto max-w-5xl px-6 py-10">
                <ScopeResults
                    scope={data.scope}
                    gaps={data.gaps}
                    articles={data.articles}
                    brandName={data.brandName}
                    showShareLink={false}
                />
                <div className="mt-12 rounded-lg border border-stone-200 bg-white p-6 text-center">
                    <h3 className="font-serif text-xl">Run an immutable audit for your site</h3>
                    <p className="mx-auto mt-2 max-w-lg text-sm text-stone-500">
                        Every displayed gap retains its observed source. No ranking, traffic,
                        or AI-citation outcome is guaranteed.
                    </p>
                    <Link
                        href="/login?next=/onboarding"
                        className="mt-5 inline-flex rounded-md bg-stone-900 px-5 py-2.5 text-sm font-medium text-white"
                    >
                        Start an audit
                    </Link>
                </div>
            </main>
        </div>
    )
}
