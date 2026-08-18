/**
 * The AI-visibility report, inside the dashboard.
 *
 * This is the only place the report renders. It resolves the newest completed
 * run for the signed-in user, so the sidebar entry always lands somewhere real.
 *
 * `app/visibility/[runId]` used to be a second, *public* renderer of the same
 * report, addressed by run id and readable by anyone who had one. It is now an
 * ownership-checked redirect into this page and renders nothing. Two renderers
 * meant two places to remember an authorization check, and the second one
 * never had it.
 *
 * Header language is deliberately identical to `/audit` — eyebrow, serif title,
 * one-line explanation — because a report that arrives styled like a different
 * product reads as a bolt-on rather than part of what they bought.
 */

import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"

import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"
import { ENGINE_SPECS, type AiEngine } from "@/lib/visibility/engines"
import {
    VisibilityDashboard,
    type DashboardEngine,
    type DashboardPrompt,
} from "@/components/visibility/visibility-dashboard"
import { PaidProbeConsole } from "@/components/visibility/paid-probe-console"
import {
    deriveQuestionVerdict,
    deriveVisibilitySummaryV2,
    type VisibilityResultFact,
} from "@/lib/visibility/visibility-summary"
import { extractHostname, type CompetitorMention } from "@/lib/visibility/answer-parser"

type ProbePromptRow = DashboardPrompt & {
    tracked_prompt_id: string | null
}

interface ProbeResultRow {
    prompt_id: string
    engine: string
    surface: string | null
    mention_count: number
    citation_count: number
    mention_position: number | null
    competitor_mentions: unknown
    /**
     * Loaded for the cross-links only — clicking a cited site or a rival
     * filters the question list to the questions that produced it.
     *
     * Deliberately just the URLs, never `answer_text`: the report shows counts
     * and the evidence page shows prose, and pulling forty verbatim answers
     * into this payload to build a filter would be a large cost for a link.
     */
    citations: unknown
}

interface TrackedCompetitorRow {
    id?: unknown
    name?: unknown
    domain?: unknown
}

export default async function VisibilityPage() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    // Generated DB types trail the forward-only visibility migrations.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any

    const [{ data: run }, { data: brand }, { data: subscription }] = await Promise.all([
        admin
            .from("ai_probe_runs")
            .select(
                "id, brand_id, subject_name, subject_domains, competitors, status, engines, prompt_count, answer_count, credits_used, engine_ledger, summary, clusters, started_at, audit_id",
            )
            .eq("user_id", user.id)
            .eq("status", "completed")
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        admin
            .from("brand_details")
            .select("id")
            .eq("user_id", user.id)
            .is("deleted_at", null)
            .limit(1)
            .maybeSingle(),
        admin
            .from("dodo_subscriptions")
            .select("id")
            .eq("user_id", user.id)
            .eq("status", "active")
            .limit(1)
            .maybeSingle(),
    ])

    if (!run) {
        return subscription && brand ? (
            <PaidProbeConsole brandId={brand.id} />
        ) : (
            <NoRun />
        )
    }

    const [{ data: promptRows }, { data: resultRows }] = await Promise.all([
        admin
            .from("ai_probe_prompts")
            .select(
                "id, tracked_prompt_id, prompt, intent, verdict, answers_total, answers_present, mean_mention_position",
            )
            .eq("run_id", run.id),
        // Counted facts only — the answer text is never loaded here, only when
        // a reader opens a specific question.
        admin
            .from("ai_probe_results")
            .select(
                "prompt_id, engine, surface, mention_count, citation_count, mention_position, competitor_mentions, citations",
            )
            .eq("run_id", run.id),
    ])

    const observedPrompts = (promptRows || []) as ProbePromptRow[]
    const observedResults = (resultRows || []) as ProbeResultRow[]

    const trackedCompetitors = Array.isArray(run.competitors)
        ? (run.competitors as TrackedCompetitorRow[]).map((competitor) => ({
              id: String(competitor.id ?? competitor.domain ?? competitor.name ?? ""),
              name: String(competitor.name ?? competitor.domain ?? "Tracked competitor"),
              domain: competitor.domain ? String(competitor.domain) : null,
          }))
        : []

    const factsByPrompt = new Map<string, VisibilityResultFact[]>()
    for (const result of observedResults) {
        const rows = factsByPrompt.get(result.prompt_id) ?? []
        rows.push({
            promptId: result.prompt_id,
            mentionCount: result.mention_count ?? 0,
            citationCount: result.citation_count ?? 0,
            mentionPosition: result.mention_position ?? null,
            competitorMentions: Array.isArray(result.competitor_mentions)
                ? (result.competitor_mentions as CompetitorMention[])
                : [],
        })
        factsByPrompt.set(result.prompt_id, rows)
    }

    /**
     * The verdict shown per question is derived, not the stored column.
     *
     * `ai_probe_prompts.verdict` was written before rank correction existed, so
     * it still reports "outranked" for a question whose only rival ahead was
     * one our own question named. Reading it here would print a chip that
     * disagrees with the headline counts on the same screen.
     */
    /**
     * What each question's answers actually referenced, so the report can be
     * navigated instead of only read.
     *
     * A reader who sees "pixreunion.com — 6 citations" wants the six questions,
     * and the only way to get them used to be reading forty rows. These two
     * maps are what turn a number into a link. Built here rather than in the
     * component because it is a join over the same rows already loaded.
     */
    const citedHostsByPrompt = new Map<string, Set<string>>()
    const rivalsByPrompt = new Map<string, Set<string>>()
    for (const result of observedResults) {
        const hosts = citedHostsByPrompt.get(result.prompt_id) ?? new Set<string>()
        for (const citation of Array.isArray(result.citations) ? result.citations : []) {
            const host = extractHostname(String((citation as { url?: unknown })?.url ?? ""))
            if (host) hosts.add(host)
        }
        citedHostsByPrompt.set(result.prompt_id, hosts)

        const rivals = rivalsByPrompt.get(result.prompt_id) ?? new Set<string>()
        for (const mention of Array.isArray(result.competitor_mentions)
            ? (result.competitor_mentions as CompetitorMention[])
            : []) {
            // Either axis counts: a rival that was cited but never named still
            // belongs to this question, and that pairing is the interesting one.
            if (mention.mentionCount > 0 || mention.citationCount > 0) {
                rivals.add(mention.competitorId)
            }
        }
        rivalsByPrompt.set(result.prompt_id, rivals)
    }

    const dashboardPrompts: DashboardPrompt[] = observedPrompts.map((prompt) => ({
        ...prompt,
        verdict: deriveQuestionVerdict(
            factsByPrompt.get(prompt.id) ?? [],
            prompt.prompt,
            trackedCompetitors,
        ),
        citedHosts: [...(citedHostsByPrompt.get(prompt.id) ?? [])],
        rivalIds: [...(rivalsByPrompt.get(prompt.id) ?? [])],
    }))

    const perEngineMap = new Map<
        string,
        { engine: string; label: string; surface: string; total: number; present: number }
    >()
    for (const row of observedResults) {
        const spec = ENGINE_SPECS[row.engine as AiEngine]
        const existing = perEngineMap.get(row.engine)
        if (existing) {
            existing.total++
            if (row.mention_count > 0) existing.present++
        } else {
            perEngineMap.set(row.engine, {
                engine: row.engine,
                label: spec?.label ?? row.engine,
                surface: row.surface ?? spec?.surface ?? "consumer_app",
                total: 1,
                present: row.mention_count > 0 ? 1 : 0,
            })
        }
    }

    const ledger: DashboardEngine[] = (run.engine_ledger || []).map((entry: DashboardEngine) => ({
        engine: entry.engine,
        label: entry.label ?? ENGINE_SPECS[entry.engine as AiEngine]?.label ?? entry.engine,
        surface:
            entry.surface ?? ENGINE_SPECS[entry.engine as AiEngine]?.surface ?? "consumer_app",
        attempted: entry.attempted ?? 0,
        succeeded: entry.succeeded ?? 0,
        failed: entry.failed ?? 0,
        creditsUsed: entry.creditsUsed ?? 0,
        errors: entry.errors ?? [],
    }))

    const summaryV2 = deriveVisibilitySummaryV2({
        prompts: observedPrompts.map((prompt) => ({
            id: prompt.id,
            prompt: prompt.prompt,
        })),
        results: [...factsByPrompt.values()].flat(),
        competitors: trackedCompetitors,
    })

    return (
        <main className="mx-auto w-full max-w-6xl py-6">
            <header className="mb-8 flex flex-col gap-5 border-b border-stone-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-600">
                        <Sparkles className="h-4 w-4" />
                        AI visibility
                    </div>
                    <h1 className="mt-2 font-serif text-3xl text-stone-900">
                        What AI assistants say when buyers ask
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">
                        Your confirmed buyer questions, put to the real ChatGPT and Google
                        AI Mode. Every number below expands to the answer it came from —
                        nothing here is a score you have to take on trust.
                    </p>
                </div>
                <Link
                    href="/content-plan"
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white"
                >
                    Review the delivery plan
                    <ArrowRight className="h-4 w-4" />
                </Link>
            </header>

            <VisibilityDashboard
                runId={run.id}
                subjectName={run.subject_name}
                subjectDomains={run.subject_domains || []}
                startedAt={run.started_at}
                creditsUsed={run.credits_used ?? 0}
                summary={{ ...(run.summary || {}), ...summaryV2 }}
                prompts={dashboardPrompts}
                engines={ledger}
                clusters={run.clusters || []}
                perEngine={[...perEngineMap.values()]}
                auditId={run.audit_id}
                isAuthenticated
                embedded
            />
        </main>
    )
}

function NoRun() {
    return (
        <main className="mx-auto max-w-3xl py-16 text-center">
            <h1 className="font-serif text-3xl text-stone-900">
                No visibility run yet
            </h1>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-stone-600">
                Once your buyer questions have been put to ChatGPT and Google AI Mode,
                the answers and everything measured from them appear here.
            </p>
            <Link
                href="/subscribe"
                className="mt-5 inline-flex rounded-lg bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white"
            >
                View the founding plan
            </Link>
        </main>
    )
}
