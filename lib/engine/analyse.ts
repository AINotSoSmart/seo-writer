/* eslint-disable @typescript-eslint/no-explicit-any -- engine tables are absent from generated database types until the migration is applied and types regenerated. */
import "server-only"

import { generateEmbedding } from "@/lib/gemini-embedding"
import { clusterPromptsByBuyerIntent, type PlanningPrompt } from "@/lib/visibility/intent-clusterer"

import { nearestPages } from "./evidence"
import { buildFindings, runHealth, type Finding } from "./findings"
import { syncEngineInventory, type InventoryPage } from "./inventory"
import { judgeCoverage, judgeDuplicate, type CitedPage } from "./judge"
import { readPages } from "./page-text"
import { loadBrandContext, pageSuggestionOutput, type ActionEvidence } from "./produce"
import { previousWeekStart } from "./schedule"
import { loadEngineSettings } from "./settings"
import { decideBucket, type ActionKind } from "./triage-rules"

/** Our pages the judge reads per gap cluster. Recall only. */
const OWN_PAGES_PER_CLUSTER = 5
/** Rival pages the judge reads per gap cluster, most-cited first. */
const CITED_PAGES_PER_CLUSTER = 4
/** Action states that mean a question is already being worked on. */
const OPEN_STATES = ["planned", "producing", "ready"]

export interface AnalyseResult {
    state: "producing" | "ready" | "partial"
    stats: Record<string, unknown>
}

interface PlannedAction {
    kind: ActionKind
    title: string
    reason: string
    trackedPromptIds: string[]
    prompts: string[]
    targetUrl: string | null
    inventoryPageId: string | null
    evidence: ActionEvidence
    duplicateCheck: Record<string, unknown> | null
}

function engineStats(findings: Finding[]) {
    const engines = new Map<string, { answered: number; mentioned: number; cited: number }>()
    for (const finding of findings) {
        for (const fact of finding.perEngine) {
            const entry = engines.get(fact.engine) ?? { answered: 0, mentioned: 0, cited: 0 }
            if (fact.answered) entry.answered++
            if (fact.mentioned) entry.mentioned++
            if (fact.ownCitations.length > 0) entry.cited++
            engines.set(fact.engine, entry)
        }
    }
    return Object.fromEntries(engines)
}

/**
 * Turns a finished measurement into this week's findings and work.
 *
 *   findings  → counted facts per question (no model involved)
 *   health    → a week with too many failed engine calls stops here
 *   inventory → everything the tool has, WordPress drafts included
 *   per gap cluster: nearest own pages + cited rival pages → coverage judge
 *   (verified quotes only) → bucket → duplicate guard for anything new
 */
export async function analyseWeek(admin: any, weekId: string): Promise<AnalyseResult> {
    const { data: week } = await admin
        .from("engine_weeks")
        .select("id, brand_id, user_id, week_start, probe_run_id")
        .eq("id", weekId)
        .single()
    if (!week?.probe_run_id) throw new Error(`Week ${weekId} has no measurement run.`)

    const { data: run } = await admin
        .from("ai_probe_runs")
        .select("id, status, engines, engine_ledger")
        .eq("id", week.probe_run_id)
        .single()
    if (!run || run.status !== "completed") throw new Error(`Measurement ${week.probe_run_id} has not completed.`)

    const settings = await loadEngineSettings(admin, week.brand_id)
    const engines: string[] = Array.isArray(run.engines) ? run.engines : []

    const { data: promptRows } = await admin
        .from("ai_probe_prompts")
        .select("id, tracked_prompt_id, prompt, source_seed")
        .eq("run_id", run.id)
    const { data: resultRows } = await admin
        .from("ai_probe_results")
        .select("prompt_id, engine, mention_count, mention_position, citations")
        .eq("run_id", run.id)

    // Last week's gaps, for confirmation.
    const { data: previousWeek } = await admin
        .from("engine_weeks")
        .select("id")
        .eq("brand_id", week.brand_id)
        .eq("week_start", previousWeekStart(week.week_start))
        .maybeSingle()
    const previousGaps = new Set<string>()
    if (previousWeek) {
        const { data: rows } = await admin
            .from("engine_findings")
            .select("tracked_prompt_id")
            .eq("week_id", previousWeek.id)
            .eq("state", "gap")
        for (const row of rows ?? []) previousGaps.add(row.tracked_prompt_id)
    }

    const findings = buildFindings({
        prompts: (promptRows ?? []).map((row: any) => ({
            id: row.id,
            trackedPromptId: row.tracked_prompt_id,
            prompt: row.prompt,
        })),
        results: (resultRows ?? []).map((row: any) => ({
            promptId: row.prompt_id,
            engine: row.engine,
            mentionCount: Number(row.mention_count ?? 0),
            mentionPosition: row.mention_position ?? null,
            citations: Array.isArray(row.citations) ? row.citations : [],
        })),
        engines,
        ownedHosts: settings.ownedHosts,
        previousGaps,
    })

    await admin.from("engine_findings").delete().eq("week_id", weekId)
    if (findings.length > 0) {
        const { error } = await admin.from("engine_findings").insert(
            findings.map((finding) => ({
                week_id: weekId,
                brand_id: week.brand_id,
                user_id: week.user_id,
                tracked_prompt_id: finding.trackedPromptId,
                probe_prompt_id: finding.probePromptId,
                prompt: finding.prompt,
                state: finding.state,
                confirmed: finding.confirmed,
                engines_expected: finding.enginesExpected,
                engines_answered: finding.enginesAnswered,
                engines_mentioning: finding.enginesMentioning,
                engines_citing: finding.enginesCiting,
                per_engine: finding.perEngine,
                cited_rival_urls: finding.citedRivalUrls.slice(0, 20),
            })),
        )
        if (error) throw new Error(`Could not save findings: ${error.message}`)
    }

    const counts: Record<string, number> = { gap: 0, partial: 0, outranked: 0, won: 0, insufficient: 0 }
    for (const finding of findings) counts[finding.state]++
    const health = runHealth(Array.isArray(run.engine_ledger) ? run.engine_ledger : [])
    const stats: Record<string, any> = {
        questions: findings.length,
        ...counts,
        confirmedGaps: findings.filter((finding) => finding.confirmed).length,
        health,
        engines: engineStats(findings),
    }

    if (!health.healthy) {
        stats.note = `${health.failed} of ${health.attempted} engine calls failed, so absence is not proven this week and no work was created.`
        await finishWeek(admin, weekId, "partial", stats)
        return { state: "partial", stats }
    }

    // A rerun of the same week replaces its unstarted plan.
    await admin
        .from("engine_actions")
        .delete()
        .eq("week_id", weekId)
        .or("state.in.(planned,failed,blocked_duplicate),kind.eq.monitor")

    // Questions already being worked on (any week) are not planned twice.
    const { data: openActions } = await admin
        .from("engine_actions")
        .select("tracked_prompt_ids")
        .eq("brand_id", week.brand_id)
        .in("kind", ["create", "refresh", "page_suggestion"])
        .in("state", OPEN_STATES)
    const inProgress = new Set<string>((openActions ?? []).flatMap((row: any) => row.tracked_prompt_ids ?? []))

    const gaps = findings
        .filter((finding) => finding.state === "gap" && !inProgress.has(finding.trackedPromptId))
        .sort((a, b) => Number(b.confirmed) - Number(a.confirmed))
    stats.gapsAlreadyInProgress = findings.filter((f) => f.state === "gap" && inProgress.has(f.trackedPromptId)).length

    if (gaps.length === 0) {
        await finishWeek(admin, weekId, "ready", { ...stats, actions: {} })
        return { state: "ready", stats }
    }

    const { data: brandRow } = await admin.from("brand_details").select("website_url").eq("id", week.brand_id).single()
    const inventory = await syncEngineInventory({ admin, settings, websiteUrl: brandRow?.website_url ?? "" })
    stats.inventory = { pages: inventory.pages.length, notes: inventory.notes }
    const pagesById = new Map(inventory.pages.map((page) => [page.id, page]))
    const brand = await loadBrandContext(admin, week.brand_id)

    const sourceSeedById = new Map<string, string>((promptRows ?? []).map((row: any) => [row.tracked_prompt_id, row.source_seed ?? ""]))
    const planningPrompts = gaps.map(
        (finding) =>
            ({
                opportunityId: finding.trackedPromptId,
                trackedPromptId: finding.trackedPromptId,
                scopeFamilyId: "",
                prompt: finding.prompt,
                sourceSeed: sourceSeedById.get(finding.trackedPromptId) ?? "",
                priority: finding.confirmed ? 0 : 1,
                reason: "",
                binding: null,
                customerJob: "",
                capabilityFactIds: [],
            }) as unknown as PlanningPrompt,
    )
    const clusters = await clusterPromptsByBuyerIntent(planningPrompts)
    const findingById = new Map(gaps.map((finding) => [finding.trackedPromptId, finding]))

    // Read every rival page any cluster needs, once.
    const clusterRivals = clusters.map((cluster) => {
        const tally = new Map<string, number>()
        for (const prompt of cluster.prompts) {
            for (const rival of findingById.get(prompt.trackedPromptId)?.citedRivalUrls ?? []) {
                tally.set(rival.url, (tally.get(rival.url) ?? 0) + rival.count)
            }
        }
        return [...tally.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, CITED_PAGES_PER_CLUSTER)
            .map(([url, count]) => ({ url, count }))
    })
    const rivalTexts = await readPages([...new Set(clusterRivals.flat().map((rival) => rival.url))])

    const planned: PlannedAction[] = []
    const now = new Date()
    for (const [index, cluster] of clusters.entries()) {
        const clusterFindings = cluster.prompts
            .map((prompt) => findingById.get(prompt.trackedPromptId))
            .filter((finding): finding is Finding => Boolean(finding))
        if (clusterFindings.length === 0) continue
        const questions = clusterFindings.map((finding) => finding.prompt)

        const queryEmbeddings: number[][] = []
        for (const question of questions) {
            try {
                queryEmbeddings.push(await generateEmbedding(question, "RETRIEVAL_QUERY"))
            } catch {
                // A question without an embedding still has the others.
            }
        }
        const nearest = queryEmbeddings.length
            ? nearestPages(queryEmbeddings, inventory.pages.filter((page) => page.text), OWN_PAGES_PER_CLUSTER)
            : []

        const citedPages: CitedPage[] = clusterRivals[index]
            .filter((rival) => rivalTexts.has(rival.url))
            .map((rival, position) => ({ id: `c${position + 1}`, url: rival.url, text: rivalTexts.get(rival.url)!.text }))

        const verdict = await judgeCoverage({
            brandName: brand.name,
            brandIdentity: brand.identity,
            questions,
            ownPages: nearest.map((hit, position) => ({
                id: `p${position + 1}`,
                url: hit.page.canonicalUrl,
                kind: hit.page.source,
                title: hit.page.title,
                text: hit.page.text,
            })),
            citedPages,
        })
        const ownIdToPage = new Map(nearest.map((hit, position) => [`p${position + 1}`, hit.page]))
        const covering = verdict.coveringPageId ? ownIdToPage.get(verdict.coveringPageId) ?? null : null
        const bucket = decideBucket({
            covering: covering ? { source: covering.source, modifiedAt: covering.modifiedAt } : null,
            verifiedMissingItems: verdict.missingItems.length,
            now,
        })

        const evidence: ActionEvidence = {
            questions,
            confirmedGaps: clusterFindings.filter((finding) => finding.confirmed).length,
            bucketWhy: bucket.why,
            coveringPage: covering
                ? {
                      id: covering.id,
                      url: covering.canonicalUrl,
                      title: covering.title,
                      source: covering.source,
                      quotes: verdict.coveringQuotes,
                  }
                : null,
            missingItems: verdict.missingItems,
            citedPages: clusterRivals[index].map((rival) => ({ ...rival, read: rivalTexts.has(rival.url) })),
            nearestPages: nearest.map((hit) => ({
                url: hit.page.canonicalUrl,
                title: hit.page.title,
                source: hit.page.source,
                similarity: Number(hit.similarity.toFixed(4)),
            })),
            droppedItems: verdict.droppedItems,
            rejectedClaims: verdict.rejectedClaims,
        }

        // A new page with nothing verified to say is not worth writing.
        if (bucket.kind === "create" && verdict.missingItems.length === 0 && citedPages.length === 0) {
            evidence.bucketWhy =
                "No page of yours answers this, but none of the pages the engines cited could be read, so there is no evidence to write from yet."
            planned.push(makeAction("monitor", cluster.title, evidence, clusterFindings, null))
            continue
        }

        if (bucket.kind !== "create") {
            planned.push(makeAction(bucket.kind, cluster.title, evidence, clusterFindings, covering))
            continue
        }

        // Duplicate guard: our nearest pages plus this week's other new pieces.
        const existing = [
            ...nearest.map((hit) => ({
                id: hit.page.id,
                url: hit.page.canonicalUrl,
                title: hit.page.title,
                text: hit.page.text,
            })),
            ...planned
                .map((action, position) => ({ action, position }))
                .filter(({ action }) => action.kind === "create")
                .map(({ action, position }) => ({
                    id: `planned:${position}`,
                    url: `planned:${action.title}`,
                    title: action.title,
                    text: `${action.title}\n${action.prompts.join("\n")}\n${action.evidence.missingItems.map((item) => item.item).join("\n")}`,
                })),
        ]
        const duplicate = await judgeDuplicate({ brandName: brand.name, proposal: { title: cluster.title, questions }, existing })
        const duplicateCheck = { stage: "plan", ...duplicate, compared: existing.map((page) => page.url) }

        if (duplicate.duplicateOfId?.startsWith("planned:")) {
            // Same intent as a piece already planned this week: one article answers both.
            const target = planned[Number(duplicate.duplicateOfId.slice("planned:".length))]
            target.trackedPromptIds.push(...clusterFindings.map((finding) => finding.trackedPromptId))
            target.prompts.push(...questions)
            target.evidence.questions.push(...questions)
            target.evidence.missingItems.push(
                ...verdict.missingItems.map((item, offset) => ({ ...item, id: `m${target.evidence.missingItems.length + offset + 1}` })),
            )
            continue
        }

        const duplicateOf = duplicate.duplicateOfId ? pagesById.get(duplicate.duplicateOfId) ?? null : null
        if (duplicateOf) {
            // The guard found a page that already targets this intent, which the
            // coverage judge did not prove answers it. Improve that page instead.
            const kind: ActionKind =
                duplicateOf.source === "wordpress"
                    ? verdict.missingItems.length > 0
                        ? "refresh"
                        : "monitor"
                    : duplicateOf.source === "sitemap"
                      ? verdict.missingItems.length > 0
                          ? "page_suggestion"
                          : "monitor"
                      : "monitor"
            evidence.bucketWhy = `A new article would duplicate ${duplicateOf.canonicalUrl}: "${duplicate.overlapQuote}". ${duplicate.reason}`
            evidence.coveringPage = {
                id: duplicateOf.id,
                url: duplicateOf.canonicalUrl,
                title: duplicateOf.title,
                source: duplicateOf.source,
                quotes: duplicate.overlapQuote ? [duplicate.overlapQuote] : [],
            }
            planned.push({ ...makeAction(kind, cluster.title, evidence, clusterFindings, duplicateOf), duplicateCheck })
            continue
        }

        planned.push({ ...makeAction("create", cluster.title, evidence, clusterFindings, null), duplicateCheck })
    }

    const actionCounts: Record<string, number> = {}
    const inserted: Array<{ id: string; kind: ActionKind }> = []
    for (const action of planned) {
        actionCounts[action.kind] = (actionCounts[action.kind] ?? 0) + 1
        const isDone = action.kind === "monitor" || action.kind === "page_suggestion"
        const { data: row, error } = await admin
            .from("engine_actions")
            .insert({
                week_id: weekId,
                brand_id: week.brand_id,
                user_id: week.user_id,
                kind: action.kind,
                // Monitors need nothing produced; page suggestions are the evidence itself.
                state: isDone ? "ready" : "planned",
                title: action.title,
                reason: action.reason,
                tracked_prompt_ids: action.trackedPromptIds,
                prompts: action.prompts,
                target_url: action.targetUrl,
                inventory_page_id: action.inventoryPageId,
                evidence: action.evidence,
                duplicate_check: action.duplicateCheck,
                output: action.kind === "page_suggestion" ? pageSuggestionOutput(action.evidence) : null,
            })
            .select("id")
            .single()
        if (error || !row) throw new Error(`Could not save action "${action.title}": ${error?.message}`)
        inserted.push({ id: row.id, kind: action.kind })
    }
    stats.actions = actionCounts

    const hasWork = inserted.some((action) => action.kind === "create" || action.kind === "refresh")
    const state = hasWork ? "producing" : "ready"
    await finishWeek(admin, weekId, state, stats)
    return { state, stats }
}

function makeAction(
    kind: ActionKind,
    title: string,
    evidence: ActionEvidence,
    findings: Finding[],
    page: InventoryPage | null,
): PlannedAction {
    return {
        kind,
        title: page && kind !== "create" ? page.title || title : title,
        reason: evidence.bucketWhy,
        trackedPromptIds: findings.map((finding) => finding.trackedPromptId),
        prompts: findings.map((finding) => finding.prompt),
        targetUrl: page && !page.canonicalUrl.startsWith("app-article:") ? page.canonicalUrl : null,
        inventoryPageId: page?.id ?? null,
        evidence,
        duplicateCheck: null,
    }
}

async function finishWeek(admin: any, weekId: string, state: string, stats: Record<string, unknown>) {
    await admin
        .from("engine_weeks")
        .update({
            state,
            stats,
            analysed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq("id", weekId)
}
