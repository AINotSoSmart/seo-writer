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

import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"
import { ENGINE_SPECS, type AiEngine } from "@/lib/visibility/engines"
import {
    VisibilityDashboard,
    type DashboardEngine,
    type DashboardPrompt,
} from "@/components/visibility/visibility-dashboard"
import type {
    DashboardActionItem,
    DashboardActionSummary,
    DashboardQuestionAction,
} from "@/components/visibility/dashboard-model"
import { PaidProbeConsole } from "@/components/visibility/paid-probe-console"
import {
    deriveQuestionVerdict,
    deriveVisibilitySummaryV2,
    type VisibilityResultFact,
} from "@/lib/visibility/visibility-summary"
import { extractHostname, type CompetitorMention } from "@/lib/visibility/answer-parser"
import { isSelectionClass } from "@/lib/visibility/selection-class"
import { buildSourceReport } from "@/lib/visibility/source-report"

type ProbePromptRow = Omit<
    DashboardPrompt,
    "scopeFamilyName" | "citationCount" | "action"
> & {
    tracked_prompt_id: string | null
    scope_family_id: string
    selection_class: string | null
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

interface ActionProposalRow {
    id: string
    resolution_type: "create" | "refresh" | "report_only"
    title: string
    target_url: string | null
    status: "suggested" | "confirmed" | "rejected"
    priority: number
}

interface ProposalPromptLinkRow {
    proposal_id: string
    tracked_prompt_id: string
}

interface CycleActionRow {
    id: string
    proposal_id: string | null
    resolution_type: "create" | "refresh"
    state: string
    rank: number
    target_url: string | null
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
                "id, brand_id, subject_name, subject_domains, competitors, status, engines, country_code, prompt_count, answer_count, credits_used, engine_ledger, summary, clusters, started_at, audit_id",
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

    const [
        { data: promptRows },
        { data: resultRows },
        { data: scopeFamilyRows },
        { data: proposalSet },
        { data: cycle },
    ] = await Promise.all([
        admin
            .from("ai_probe_prompts")
            .select(
                "id, tracked_prompt_id, scope_family_id, prompt, intent, verdict, answers_total, answers_present, mean_mention_position, selection_class",
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
        run.audit_id
            ? admin
                  .from("audit_scope_families")
                  .select("id, name")
                  .eq("audit_id", run.audit_id)
            : Promise.resolve({ data: [] }),
        admin
            .from("action_proposal_sets")
            .select("id, state")
            .eq("measurement_run_id", run.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        admin
            .from("subscription_cycles")
            .select(
                "id, state, action_allowance, eligible_action_groups, backlog_action_groups",
            )
            .eq("measurement_run_id", run.id)
            .maybeSingle(),
    ])

    const observedPrompts = (promptRows || []) as ProbePromptRow[]
    const observedResults = (resultRows || []) as ProbeResultRow[]

    const [{ data: actionProposalRows }, { data: cycleActionRows }] = await Promise.all([
        proposalSet
            ? admin
                  .from("action_proposals")
                  .select("id, resolution_type, title, target_url, status, priority")
                  .eq("proposal_set_id", proposalSet.id)
                  .order("priority", { ascending: false })
            : Promise.resolve({ data: [] }),
        cycle
            ? admin
                  .from("cycle_actions")
                  .select("id, proposal_id, resolution_type, state, rank, target_url")
                  .eq("cycle_id", cycle.id)
                  .order("rank", { ascending: true })
            : Promise.resolve({ data: [] }),
    ])

    const proposals = (actionProposalRows || []) as ActionProposalRow[]
    const cycleActions = (cycleActionRows || []) as CycleActionRow[]
    const proposalIds = proposals.map((proposal) => proposal.id)
    const { data: proposalPromptLinkRows } = proposalIds.length
        ? await admin
              .from("action_proposal_prompts")
              .select("proposal_id, tracked_prompt_id")
              .in("proposal_id", proposalIds)
        : { data: [] }
    const proposalPromptLinks = (proposalPromptLinkRows || []) as ProposalPromptLinkRow[]

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

    const scopeFamilyNameById = new Map<string, string>(
        (scopeFamilyRows || []).map((family: { id: string; name: string }) => [
            family.id,
            family.name,
        ]),
    )
    const proposalById = new Map(proposals.map((proposal) => [proposal.id, proposal]))
    const cycleActionByProposalId = new Map(
        cycleActions
            .filter((action) => action.proposal_id)
            .map((action) => [action.proposal_id as string, action]),
    )
    const linksByProposalId = new Map<string, ProposalPromptLinkRow[]>()
    const questionActionByTrackedId = new Map<string, DashboardQuestionAction>()
    for (const link of proposalPromptLinks) {
        const links = linksByProposalId.get(link.proposal_id) ?? []
        links.push(link)
        linksByProposalId.set(link.proposal_id, links)

        const proposal = proposalById.get(link.proposal_id)
        if (!proposal || proposal.status === "rejected") continue
        questionActionByTrackedId.set(link.tracked_prompt_id, {
            id: proposal.id,
            kind: proposal.resolution_type,
            title: proposal.title,
            targetUrl: proposal.target_url,
            status: proposal.status,
        })
    }

    const activeProposals = proposals.filter((proposal) => proposal.status !== "rejected")
    const productionProposals = activeProposals.filter(
        (proposal) => proposal.resolution_type !== "report_only",
    )
    const actionItems: DashboardActionItem[] = activeProposals.map((proposal) => ({
        id: proposal.id,
        kind: proposal.resolution_type,
        title: proposal.title,
        targetUrl: proposal.target_url,
        status: proposal.status,
        questionCount: linksByProposalId.get(proposal.id)?.length ?? 0,
        productionState: cycleActionByProposalId.get(proposal.id)?.state ?? null,
    }))
    const selectedCount = cycleActions.length
    const eligibleCount = Math.max(
        Number(cycle?.eligible_action_groups ?? 0),
        productionProposals.length,
    )
    const backlogCount = cycle
        ? Number(cycle.backlog_action_groups ?? 0)
        : Math.max(eligibleCount - selectedCount, 0)
    const actionPhase: DashboardActionSummary["phase"] =
        proposalSet?.state === "review"
            ? "review"
            : cycle?.state === "producing"
              ? "producing"
              : cycle?.state === "ready"
                ? "ready"
                : cycle?.state === "delivered"
                  ? "delivered"
                  : cycle?.state === "failed" || proposalSet?.state === "failed"
                    ? "failed"
                    : "none"
    const actionSummary: DashboardActionSummary = {
        phase: actionPhase,
        allowance: Number(cycle?.action_allowance ?? 8),
        eligibleCount,
        selectedCount,
        backlogCount,
        reportOnlyCount: activeProposals.filter(
            (proposal) => proposal.resolution_type === "report_only",
        ).length,
        items: actionItems,
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
        scopeFamilyName:
            scopeFamilyNameById.get(prompt.scope_family_id) || "Other questions",
        citationCount: (factsByPrompt.get(prompt.id) ?? []).reduce(
            (total, fact) => total + fact.citationCount,
            0,
        ),
        verdict: deriveQuestionVerdict(
            factsByPrompt.get(prompt.id) ?? [],
            prompt.prompt,
            trackedCompetitors,
        ),
        citedHosts: [...(citedHostsByPrompt.get(prompt.id) ?? [])],
        rivalIds: [...(rivalsByPrompt.get(prompt.id) ?? [])],
        action: prompt.tracked_prompt_id
            ? questionActionByTrackedId.get(prompt.tracked_prompt_id)
            : undefined,
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
            selectionClass: isSelectionClass(prompt.selection_class)
                ? prompt.selection_class
                : undefined,
        })),
        results: [...factsByPrompt.values()].flat(),
        competitors: trackedCompetitors,
    })
    const sourceReport = buildSourceReport(
        observedResults.map((result) => ({
            promptId: result.prompt_id,
            engine: result.engine,
            namedBrand: result.mention_count > 0,
            citations: result.citations,
        })),
        {
            subjectDomains: (run.subject_domains || []).map(String),
            competitorDomains: trackedCompetitors.flatMap((competitor) =>
                competitor.domain ? [competitor.domain] : [],
            ),
        },
    )

    return (
        <main className="mx-auto w-full py-6">
            <VisibilityDashboard
                runId={run.id}
                subjectName={run.subject_name}
                subjectDomains={run.subject_domains || []}
                startedAt={run.started_at}
                creditsUsed={run.credits_used ?? 0}
                marketName={countryName(run.country_code)}
                summary={{ ...(run.summary || {}), ...summaryV2 }}
                sourceReport={sourceReport}
                prompts={dashboardPrompts}
                engines={ledger}
                clusters={run.clusters || []}
                perEngine={[...perEngineMap.values()]}
                auditId={run.audit_id}
                actionSummary={actionSummary}
                isAuthenticated
                embedded
            />
        </main>
    )
}

function countryName(countryCode: string | null): string {
    if (!countryCode) return "Global"
    try {
        return (
            new Intl.DisplayNames(["en"], { type: "region" }).of(
                countryCode.toUpperCase(),
            ) || countryCode.toUpperCase()
        )
    } catch {
        return countryCode.toUpperCase()
    }
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
