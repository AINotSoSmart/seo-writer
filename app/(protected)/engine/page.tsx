/* eslint-disable @typescript-eslint/no-explicit-any -- engine tables are absent from generated database types until the migration is applied and types regenerated. */
/**
 * The internal engine, one tool at a time: this week's measurement, the work
 * it produced, and the reports that show whether the work is paying off.
 */

import Link from "next/link"
import { redirect } from "next/navigation"

import { ActionButtons, RunNowButton, SettingsForm } from "@/components/engine/engine-controls"
import type { FindingState } from "@/lib/engine/findings"
import {
    buildActionOutcomes,
    buildCitationReport,
    buildQuestionHistory,
    buildShareOfVoice,
    buildTrend,
    type AnswerRow,
    type FindingRow,
    type QuestionChange,
    type WeekRow,
} from "@/lib/engine/report"
import { loadEngineSettings, type EngineSettings } from "@/lib/engine/settings"
import { ENGINE_SPECS, type AiEngine } from "@/lib/visibility/engines"
import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"

const KIND_LABEL: Record<string, string> = {
    create: "New articles",
    refresh: "Refresh existing posts",
    page_suggestion: "Site page suggestions",
    monitor: "Monitor (no change needed)",
}
const KIND_ORDER = ["create", "refresh", "page_suggestion", "monitor"]

const STATE_LABEL: Record<string, string> = {
    planned: "Planned",
    producing: "Writing",
    ready: "Ready for you",
    failed: "Failed",
    blocked_duplicate: "Blocked: duplicate",
    pushed: "In WordPress as draft",
    done: "Done",
    dismissed: "Dismissed",
}

const WEEK_STATE_LABEL: Record<string, string> = {
    measuring: "Asking the answer engines",
    analysing: "Analysing answers and your pages",
    producing: "Writing this week's work",
    ready: "Ready",
    partial: "Partial: too many engine calls failed, no work created",
    failed: "Failed",
}

const FINDING_STYLE: Record<FindingState, { label: string; className: string }> = {
    gap: { label: "Not mentioned", className: "bg-red-500" },
    partial: { label: "Some engines", className: "bg-amber-400" },
    outranked: { label: "Mentioned, not first", className: "bg-sky-400" },
    won: { label: "Named first", className: "bg-emerald-500" },
    insufficient: { label: "Not enough answers", className: "bg-stone-300" },
}

const CHANGE_LABEL: Record<QuestionChange, string> = {
    won_back: "Won back",
    lost: "Lost",
    no_change: "No measurable change",
    new: "New",
}

function engineLabel(engine: string): string {
    return ENGINE_SPECS[engine as AiEngine]?.label ?? engine
}

function percent(part: number, whole: number): string {
    return whole ? `${Math.round((part / whole) * 100)}%` : "–"
}

export default async function EnginePage({ searchParams }: { searchParams: Promise<{ brand?: string }> }) {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) redirect("/login")
    const { brand: brandParam } = await searchParams
    const admin = createAdminClient() as any

    const { data: brands } = await admin
        .from("brand_details")
        .select("id, website_url, brand_data")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
    const tools = (brands ?? []).map((brand: any) => ({
        id: brand.id as string,
        name: String(brand.brand_data?.product_name || brand.website_url),
    }))
    const tool = tools.find((candidate: { id: string }) => candidate.id === brandParam) ?? tools[0]
    if (!tool) redirect("/onboarding")

    let settings: EngineSettings
    try {
        settings = await loadEngineSettings(admin, tool.id)
    } catch (error) {
        return (
            <main className="mx-auto max-w-3xl py-16">
                <h1 className="font-serif text-3xl text-stone-900">The engine is not set up yet</h1>
                <p className="mt-2 text-sm text-stone-600">
                    Apply <code>supabase/migrations/20261007_internal_engine.sql</code> in the Supabase SQL editor, then reload.
                </p>
                <p className="mt-2 text-xs text-stone-500">{error instanceof Error ? error.message : String(error)}</p>
            </main>
        )
    }

    const [{ data: connectionRows }, { data: weekRows }, { data: actionRows }] = await Promise.all([
        admin.from("wordpress_connections").select("id, site_url").eq("user_id", user.id),
        admin
            .from("engine_weeks")
            .select("id, week_start, state, stats, failure_reason, probe_run_id, started_at")
            .eq("brand_id", tool.id)
            .order("week_start", { ascending: false })
            .limit(12),
        admin
            .from("engine_actions")
            .select("id, week_id, kind, state, title, reason, prompts, tracked_prompt_ids, target_url, evidence, failure_reason, wordpress_url, article_id, updated_at")
            .eq("brand_id", tool.id)
            .order("created_at", { ascending: false })
            .limit(300),
    ])
    const weeksDesc = (weekRows ?? []) as any[]
    const latestWeek = weeksDesc[0] ?? null
    const weeks: WeekRow[] = weeksDesc.map((week) => ({ id: week.id, weekStart: week.week_start, state: week.state }))

    const { data: findingRows } = weeks.length
        ? await admin
              .from("engine_findings")
              .select("week_id, tracked_prompt_id, prompt, state, confirmed, per_engine")
              .in("week_id", weeks.map((week) => week.id))
        : { data: [] }
    const findings: FindingRow[] = (findingRows ?? []).map((row: any) => ({
        weekId: row.week_id,
        trackedPromptId: row.tracked_prompt_id,
        prompt: row.prompt,
        state: row.state,
        perEngine: Array.isArray(row.per_engine) ? row.per_engine : [],
    }))

    const { data: answerRows } = latestWeek?.probe_run_id
        ? await admin
              .from("ai_probe_results")
              .select("engine, mention_count, citations, competitor_mentions")
              .eq("run_id", latestWeek.probe_run_id)
        : { data: [] }
    const answers: AnswerRow[] = (answerRows ?? []).map((row: any) => ({
        engine: row.engine,
        mentionCount: Number(row.mention_count ?? 0),
        citations: Array.isArray(row.citations) ? row.citations : [],
        competitorMentions: Array.isArray(row.competitor_mentions) ? row.competitor_mentions : [],
    }))

    const actions = (actionRows ?? []) as any[]
    const currentActions = actions.filter(
        (action) =>
            action.week_id === latestWeek?.id ||
            ["planned", "producing", "ready", "failed", "blocked_duplicate", "pushed"].includes(action.state),
    )
    const finished = actions.filter((action) => ["done", "pushed"].includes(action.state) && action.kind !== "monitor")

    const trend = buildTrend(weeks, findings)
    const history = buildQuestionHistory(weeks, findings)
    const voice = buildShareOfVoice(tool.name, answers)
    const citations = buildCitationReport(answers, settings.ownedHosts)
    const outcomes = buildActionOutcomes(
        finished.map((action) => ({
            id: action.id,
            title: action.title,
            kind: action.kind,
            weekId: action.week_id,
            trackedPromptIds: action.tracked_prompt_ids ?? [],
            prompts: action.prompts ?? [],
        })),
        weeks,
        findings,
    )
    const latestTrend = trend[trend.length - 1]
    const engines = latestTrend ? Object.keys(latestTrend.perEngine) : []
    const running = latestWeek ? ["measuring", "analysing"].includes(latestWeek.state) : false
    const stats = (latestWeek?.stats ?? {}) as Record<string, any>

    return (
        <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
            <header className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                    {tools.map((candidate: { id: string; name: string }) => (
                        <Link
                            key={candidate.id}
                            href={`/engine?brand=${candidate.id}`}
                            className={`rounded-full border px-3 py-1 text-xs ${
                                candidate.id === tool.id
                                    ? "border-stone-900 bg-stone-900 text-white"
                                    : "border-stone-300 text-stone-700 hover:bg-stone-50"
                            }`}
                        >
                            {candidate.name}
                        </Link>
                    ))}
                    <Link href="/onboarding" className="rounded-full border border-dashed border-stone-300 px-3 py-1 text-xs text-stone-600">
                        + Add a tool
                    </Link>
                </div>
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-stone-500">AI search engine</p>
                        <h1 className="mt-1 font-serif text-3xl text-stone-900">{tool.name}</h1>
                        <p className="mt-1 text-sm text-stone-600">
                            {latestWeek
                                ? `Week of ${latestWeek.week_start}: ${WEEK_STATE_LABEL[latestWeek.state] ?? latestWeek.state}`
                                : "Not measured yet."}{" "}
                            {settings.enabled ? "Runs every Monday at 08:30 GMT." : "Weekly run is off."}
                        </p>
                        {latestWeek?.failure_reason && <p className="mt-1 text-sm text-red-700">{latestWeek.failure_reason}</p>}
                        {stats.note && <p className="mt-1 text-sm text-amber-700">{stats.note}</p>}
                    </div>
                    <div className="flex items-start gap-3">
                        <Link href={`/visibility?brand=${tool.id}`} className="text-xs text-stone-600 underline">
                            Full answer report
                        </Link>
                        <RunNowButton brandId={tool.id} running={running} />
                    </div>
                </div>
            </header>

            {latestTrend && (
                <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    <Stat label="Questions tracked" value={String(latestTrend.questions)} />
                    <Stat
                        label="Mentioned by any engine"
                        value={percent(latestTrend.mentionedAnywhere, latestTrend.questions)}
                        detail={`${latestTrend.mentionedAnywhere} of ${latestTrend.questions}`}
                    />
                    <Stat
                        label="Gaps (no engine named you)"
                        value={String(latestTrend.gaps)}
                        detail={stats.confirmedGaps ? `${stats.confirmedGaps} also last week` : undefined}
                    />
                    <Stat
                        label="Your pages cited"
                        value={percent(latestTrend.citedAnywhere, latestTrend.questions)}
                        detail={`${citations.ownCitations} of ${citations.totalCitations} citations`}
                    />
                    <Stat
                        label="Engine calls failed"
                        value={stats.health ? `${stats.health.failed}/${stats.health.attempted}` : "–"}
                        detail={stats.health && !stats.health.healthy ? "Too many: no work created" : undefined}
                    />
                </section>
            )}

            <section className="flex flex-col gap-6">
                <h2 className="font-serif text-2xl text-stone-900">This week&apos;s work</h2>
                {currentActions.length === 0 && (
                    <p className="text-sm text-stone-600">
                        {latestWeek?.state === "ready"
                            ? "No gaps need work this week."
                            : "Work appears here once the week's answers are analysed."}
                    </p>
                )}
                {KIND_ORDER.map((kind) => {
                    const group = currentActions.filter((action) => action.kind === kind)
                    if (group.length === 0) return null
                    return (
                        <div key={kind} className="flex flex-col gap-3">
                            <h3 className="text-sm font-semibold text-stone-800">
                                {KIND_LABEL[kind]} ({group.length})
                            </h3>
                            {group.map((action) => (
                                <article key={action.id} className="rounded-lg border border-stone-200 bg-white p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <Link href={`/engine/actions/${action.id}`} className="font-medium text-stone-900 hover:underline">
                                                {action.title}
                                            </Link>
                                            {action.target_url && (
                                                <a href={action.target_url} target="_blank" rel="noreferrer" className="block truncate text-xs text-stone-500 underline">
                                                    {action.target_url}
                                                </a>
                                            )}
                                        </div>
                                        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-700">
                                            {STATE_LABEL[action.state] ?? action.state}
                                        </span>
                                    </div>
                                    <p className="mt-2 text-sm text-stone-700">{action.reason}</p>
                                    <ul className="mt-2 list-disc pl-5 text-xs text-stone-600">
                                        {(action.prompts ?? []).map((prompt: string) => (
                                            <li key={prompt}>{prompt}</li>
                                        ))}
                                    </ul>
                                    {(action.evidence?.missingItems?.length ?? 0) > 0 && (
                                        <p className="mt-2 text-xs text-stone-500">
                                            {action.evidence.missingItems.length} verified point(s) from the cited pages.{" "}
                                            <Link href={`/engine/actions/${action.id}`} className="underline">
                                                See the evidence
                                            </Link>
                                        </p>
                                    )}
                                    {action.failure_reason && <p className="mt-2 text-xs text-red-700">{action.failure_reason}</p>}
                                    {action.wordpress_url && (
                                        <a href={action.wordpress_url} target="_blank" rel="noreferrer" className="mt-2 block text-xs underline">
                                            Open the WordPress draft
                                        </a>
                                    )}
                                    <div className="mt-3">
                                        <ActionButtons
                                            actionId={action.id}
                                            kind={action.kind}
                                            state={action.state}
                                            canPush={Boolean(settings.wordpressConnectionId)}
                                        />
                                    </div>
                                </article>
                            ))}
                        </div>
                    )
                })}
            </section>

            {trend.length > 0 && (
                <section className="flex flex-col gap-3">
                    <h2 className="font-serif text-2xl text-stone-900">Week by week</h2>
                    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-stone-50 text-stone-600">
                                <tr>
                                    <th className="p-2">Week</th>
                                    <th className="p-2">Mentioned anywhere</th>
                                    {engines.map((engine) => (
                                        <th key={engine} className="p-2">
                                            {engineLabel(engine)}: mentioned / cited
                                        </th>
                                    ))}
                                    <th className="p-2">Gaps</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[...trend].reverse().map((point) => (
                                    <tr key={point.weekStart} className="border-t border-stone-100">
                                        <td className="p-2 font-medium">{point.weekStart}</td>
                                        <td className="p-2">{percent(point.mentionedAnywhere, point.questions)}</td>
                                        {engines.map((engine) => {
                                            const entry = point.perEngine[engine]
                                            return (
                                                <td key={engine} className="p-2">
                                                    {entry ? `${percent(entry.mentioned, entry.answered)} / ${percent(entry.cited, entry.answered)}` : "–"}
                                                </td>
                                            )
                                        })}
                                        <td className="p-2">{point.gaps}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-stone-500">
                        Each question is asked once per engine per week, so one week&apos;s percentage moves by a whole question. A question
                        counts as won back or lost only when every engine agrees.
                    </p>
                </section>
            )}

            {answers.length > 0 && (
                <section className="grid gap-6 md:grid-cols-2">
                    <div className="flex flex-col gap-3">
                        <h2 className="font-serif text-2xl text-stone-900">Share of voice</h2>
                        <p className="text-xs text-stone-500">
                            Of this week&apos;s {voice.answers} answers, how often each product was named.
                        </p>
                        <ul className="flex flex-col gap-2">
                            {voice.entries.slice(0, 10).map((entry) => (
                                <li key={entry.name} className="text-xs">
                                    <div className="flex justify-between">
                                        <span className={entry.isUs ? "font-semibold" : ""}>{entry.name}</span>
                                        <span>
                                            {entry.answers} answers · {percent(entry.share, 1)}
                                        </span>
                                    </div>
                                    <div className="mt-1 h-1.5 rounded bg-stone-100">
                                        <div
                                            className={`h-1.5 rounded ${entry.isUs ? "bg-stone-900" : "bg-stone-400"}`}
                                            style={{ width: `${Math.round(entry.share * 100)}%` }}
                                        />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="flex flex-col gap-3">
                        <h2 className="font-serif text-2xl text-stone-900">Who gets cited</h2>
                        <p className="text-xs text-stone-500">Domains the engines cited this week, by number of answers.</p>
                        <ul className="flex flex-col gap-1 text-xs">
                            {citations.topDomains.map((domain) => (
                                <li key={domain.domain} className="flex justify-between">
                                    <span className={domain.owned ? "font-semibold" : ""}>
                                        {domain.domain}
                                        {domain.owned ? " (yours)" : ""}
                                    </span>
                                    <span>{domain.answers}</span>
                                </li>
                            ))}
                        </ul>
                        {citations.ownPages.length > 0 && (
                            <>
                                <h3 className="mt-2 text-sm font-semibold text-stone-800">Your pages that were cited</h3>
                                <ul className="flex flex-col gap-1 text-xs">
                                    {citations.ownPages.map((page) => (
                                        <li key={page.url} className="flex justify-between gap-2">
                                            <a href={page.url} target="_blank" rel="noreferrer" className="truncate underline">
                                                {page.url}
                                            </a>
                                            <span>{page.count}</span>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </div>
                </section>
            )}

            {history.length > 0 && (
                <section className="flex flex-col gap-3">
                    <h2 className="font-serif text-2xl text-stone-900">Every question</h2>
                    <div className="flex flex-wrap gap-3 text-xs text-stone-600">
                        {Object.values(FINDING_STYLE).map((style) => (
                            <span key={style.label} className="flex items-center gap-1">
                                <span className={`inline-block h-2.5 w-2.5 rounded-sm ${style.className}`} /> {style.label}
                            </span>
                        ))}
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-stone-50 text-stone-600">
                                <tr>
                                    <th className="p-2">Question</th>
                                    <th className="p-2">Last weeks (oldest first)</th>
                                    <th className="p-2">Change</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((row) => (
                                    <tr key={row.trackedPromptId} className="border-t border-stone-100">
                                        <td className="p-2">{row.prompt}</td>
                                        <td className="p-2">
                                            <div className="flex gap-1">
                                                {row.states.map((state, index) => (
                                                    <span
                                                        key={index}
                                                        title={state ? FINDING_STYLE[state].label : "Not measured"}
                                                        className={`inline-block h-3 w-3 rounded-sm ${state ? FINDING_STYLE[state].className : "bg-stone-100"}`}
                                                    />
                                                ))}
                                            </div>
                                        </td>
                                        <td className="p-2">{CHANGE_LABEL[row.change]}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {outcomes.length > 0 && (
                <section className="flex flex-col gap-3">
                    <h2 className="font-serif text-2xl text-stone-900">Did the work pay off?</h2>
                    <ul className="flex flex-col gap-2">
                        {outcomes.map((outcome) => (
                            <li key={outcome.actionId} className="rounded-lg border border-stone-200 bg-white p-3 text-xs">
                                <div className="flex justify-between">
                                    <Link href={`/engine/actions/${outcome.actionId}`} className="font-medium underline">
                                        {outcome.title}
                                    </Link>
                                    <span className="text-stone-500">
                                        {KIND_LABEL[outcome.kind]} · week of {outcome.weekStart}
                                    </span>
                                </div>
                                <ul className="mt-1 text-stone-600">
                                    {outcome.questions.map((question) => (
                                        <li key={question.prompt}>
                                            {question.prompt}: {question.then ? FINDING_STYLE[question.then].label : "–"} →{" "}
                                            {question.now ? FINDING_STYLE[question.now].label : "not measured since"} ({CHANGE_LABEL[question.change]})
                                        </li>
                                    ))}
                                </ul>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <section className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4">
                <h2 className="font-serif text-xl text-stone-900">Tool settings</h2>
                <SettingsForm
                    brandId={tool.id}
                    enabled={settings.enabled}
                    ownedHosts={settings.ownedHosts}
                    aliases={settings.aliases}
                    wordpressConnectionId={settings.wordpressConnectionId}
                    connections={(connectionRows ?? []).map((row: any) => ({ id: row.id, siteUrl: row.site_url }))}
                />
                <p className="text-xs text-stone-500">
                    Add a WordPress site under <Link href="/integrations" className="underline">Integrations</Link>, then pick it here.
                </p>
            </section>
        </main>
    )
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
    return (
        <div className="rounded-lg border border-stone-200 bg-white p-3">
            <p className="text-xs text-stone-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-stone-900">{value}</p>
            {detail && <p className="text-xs text-stone-500">{detail}</p>}
        </div>
    )
}
