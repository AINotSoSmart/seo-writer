import Link from "next/link"
import {
    CalendarDays,
    CheckCircle2,
    CircleDashed,
    ExternalLink,
    FileCheck2,
    FileText,
} from "lucide-react"

import {
    getAuditScope,
    getGapEvidence,
    getPlannedArticles,
} from "@/actions/harvest"
import { ScopeResults } from "@/components/audit/scope-results"
import { ProgramDeliveryControls } from "@/components/program/ProgramDeliveryControls"
import { createClient } from "@/utils/supabase/server"

export default async function ContentPlanPage() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data: brand } = await supabase
        .from("brand_details")
        .select("id, current_audit_id, brand_data")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle()
    if (!brand) return <NoProgram />

    const { data: program } = await (supabase as any)
        .from("programs")
        .select(
            "id, audit_id, tier, clusters_per_month, total_articles, scope_status, cancellation_status, publication_url_pattern, started_at",
        )
        .eq("user_id", user.id)
        .eq("brand_id", brand.id)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle()

    if (!program) {
        const [scope, gaps, articles] = await Promise.all([
            getAuditScope(brand.id),
            getGapEvidence(brand.id),
            getPlannedArticles(brand.id),
        ])
        if (!scope) return <NoProgram />

        return (
            <main className="mx-auto w-full max-w-6xl py-6">
                <header className="mb-7 flex flex-col gap-4 border-b border-stone-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                    <h1 className="font-serif text-3xl text-stone-900">
                        Proposed content program
                    </h1>
                    <p className="mt-2 text-sm text-stone-600">
                        Nothing has been purchased or frozen. Inspect every cluster, article,
                        and supporting source below before deciding.
                    </p>
                    </div>
                    <Link
                        href="/audit"
                        className="inline-flex shrink-0 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800"
                    >
                        Open permanent audit
                    </Link>
                </header>
                <ScopeResults
                    scope={scope}
                    gaps={gaps}
                    articles={articles}
                    brandName={(brand.brand_data as any)?.product_name || "Your Site"}
                />
            </main>
        )
    }

    const { data: clusterRows } = await (supabase as any)
        .from("program_clusters")
        .select(
            "id, audit_cluster_id, sequence, scheduled_for, state, ready_at, delivered_at, failure_code, audit_clusters(name, article_count)",
        )
        .eq("program_id", program.id)
        .order("sequence", { ascending: true })
    const clusterIds = (clusterRows || []).map((row: any) => row.audit_cluster_id)
    const { data: articleRows } = clusterIds.length
        ? await (supabase as any)
              .from("planned_articles")
              .select(
                  "id, cluster_id, title, target_url, generation_status, delivery_status, publication_status, publication_url",
              )
              .eq("audit_id", program.audit_id)
              .in("cluster_id", clusterIds)
              .order("is_pillar", { ascending: false })
        : { data: [] }

    const articles = articleRows || []
    const generated = articles.filter(
        (article: any) => article.generation_status === "generated",
    ).length
    const delivered = articles.filter(
        (article: any) => article.delivery_status === "delivered",
    ).length
    const published = articles.filter(
        (article: any) => article.publication_status === "published",
    ).length
    const total = Number(program.total_articles || articles.length)
    const deliveredPercent = total ? Math.round((delivered / total) * 100) : 0

    return (
        <main className="mx-auto w-full max-w-6xl py-6">
            <header className="flex flex-col gap-5 border-b border-stone-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                        {program.tier} · {program.clusters_per_month} cluster
                        {program.clusters_per_month === 1 ? "" : "s"} per month
                    </p>
                    <h1 className="mt-1 font-serif text-3xl text-stone-900">
                        {program.scope_status === "scope_delivered"
                            ? "Program scope delivered"
                            : "Six-cluster delivery program"}
                    </h1>
                    <p className="mt-2 text-sm text-stone-600">
                        Generated work stays withheld until every article in its cluster is ready.
                    </p>
                </div>
                <ProgramDeliveryControls
                    programId={program.id}
                    scopeStatus={program.scope_status}
                    publicationUrlPattern={program.publication_url_pattern}
                />
            </header>

            <section className="grid gap-3 py-6 sm:grid-cols-3">
                <ProgressCard
                    icon={FileText}
                    label="Generated"
                    value={`${generated}/${total}`}
                />
                <ProgressCard
                    icon={FileCheck2}
                    label="Delivered"
                    value={`${delivered}/${total}`}
                />
                <ProgressCard
                    icon={CheckCircle2}
                    label="Published"
                    value={`${published}/${total}`}
                    detail="Optional customer progress"
                />
            </section>

            <section className="mb-8 rounded-xl border border-stone-200 bg-white p-5">
                <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-stone-900">Delivery burn-down</span>
                    <span className="text-stone-500">{deliveredPercent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                    <div
                        className="h-full bg-stone-900"
                        style={{ width: `${deliveredPercent}%` }}
                    />
                </div>
                <p className="mt-3 text-xs text-stone-500">
                    Cancellation: {humanize(program.cancellation_status)}. Access remains
                    available through the paid billing period.
                </p>
            </section>

            <section className="space-y-4">
                {(clusterRows || []).map((cluster: any) => {
                    const members = articles.filter(
                        (article: any) => article.cluster_id === cluster.audit_cluster_id,
                    )
                    return (
                        <article
                            key={cluster.id}
                            className="overflow-hidden rounded-xl border border-stone-200 bg-white"
                        >
                            <header className="flex flex-col gap-3 border-b border-stone-100 bg-stone-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-stone-400">
                                            {String(cluster.sequence).padStart(2, "0")}
                                        </span>
                                        <h2 className="font-medium text-stone-900">
                                            {cluster.audit_clusters?.name || "Topic cluster"}
                                        </h2>
                                    </div>
                                    <div className="mt-1 flex items-center gap-1 text-xs text-stone-500">
                                        <CalendarDays className="h-3.5 w-3.5" />
                                        {formatDate(cluster.scheduled_for)}
                                    </div>
                                </div>
                                <StatePill state={cluster.state} />
                            </header>
                            <div className="divide-y divide-stone-100">
                                {members.map((article: any) => (
                                    <div
                                        key={article.id}
                                        className="grid gap-2 px-5 py-3 text-sm sm:grid-cols-[1fr_auto_auto_auto]"
                                    >
                                        <div>
                                            <div className="text-stone-900">{article.title}</div>
                                            <div className="mt-0.5 truncate font-mono text-[11px] text-stone-400">
                                                {article.target_url}
                                            </div>
                                        </div>
                                        <ArticleState
                                            label="Generated"
                                            active={article.generation_status === "generated"}
                                        />
                                        <ArticleState
                                            label="Delivered"
                                            active={article.delivery_status === "delivered"}
                                        />
                                        <div className="flex items-center justify-end gap-2">
                                            <ArticleState
                                                label={humanize(article.publication_status)}
                                                active={article.publication_status === "published"}
                                            />
                                            {article.publication_url && (
                                                <a
                                                    href={article.publication_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    aria-label="Open published article"
                                                >
                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </article>
                    )
                })}
            </section>
        </main>
    )
}

function ProgressCard({
    icon: Icon,
    label,
    value,
    detail,
}: {
    icon: React.ElementType
    label: string
    value: string
    detail?: string
}) {
    return (
        <div className="rounded-xl border border-stone-200 bg-white p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
                <Icon className="h-4 w-4" /> {label}
            </div>
            <div className="mt-3 font-serif text-3xl text-stone-900">{value}</div>
            {detail && <p className="mt-1 text-xs text-stone-500">{detail}</p>}
        </div>
    )
}

function StatePill({ state }: { state: string }) {
    const delivered = state === "delivered"
    return (
        <span
            className={cnState(
                delivered ? "bg-emerald-50 text-emerald-700" : "bg-stone-200 text-stone-700",
            )}
        >
            {delivered ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleDashed className="h-3.5 w-3.5" />}
            {humanize(state)}
        </span>
    )
}

function ArticleState({ label, active }: { label: string; active: boolean }) {
    return (
        <span className={active ? "text-emerald-700" : "text-stone-400"}>
            {active ? "✓" : "○"} {label}
        </span>
    )
}

function NoProgram() {
    return (
        <main className="mx-auto max-w-3xl py-16 text-center">
            <h1 className="font-serif text-3xl">Start with an evidence-backed audit</h1>
            <Link href="/onboarding" className="mt-5 inline-block underline">
                Open audit
            </Link>
        </main>
    )
}

function humanize(value: string) {
    return String(value || "").replaceAll("_", " ")
}

function formatDate(value: string) {
    return new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
    }).format(new Date(value))
}

function cnState(className: string) {
    return `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${className}`
}
