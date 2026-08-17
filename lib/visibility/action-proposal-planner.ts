/* eslint-disable @typescript-eslint/no-explicit-any -- proposal/inventory relations are unavailable until the forward migrations are applied and types regenerated. */
import "server-only"

import { normalizeQuery } from "@/lib/harvest/types"
import type { CapabilityContract, QueryIntentBinding } from "@/lib/writer/article-contract"
import { bindPromptCapability } from "./capability-binding"
import { assessPromptRemedy, type PromptRemedyAssessment, type StoredCitation } from "./prompt-remedy"
import { syncSiteInventory, type InventoryPage } from "./site-inventory"
import { matchExistingPage } from "./site-coverage-match"

function articleTitle(prompt: string): string {
    const cleaned = prompt.trim().replace(/[?.!]+$/, "")
    const rewritten = cleaned
        .replace(/^how (?:do|can|should) (?:i|you)\s+/i, "How to ")
        .replace(/^what is the best way to\s+/i, "How to ")
    return rewritten.charAt(0).toUpperCase() + rewritten.slice(1)
}

type PlanningPrompt = {
    opportunityId: string
    trackedPromptId: string
    scopeFamilyId: string
    prompt: string
    sourceSeed: string
    priority: number
    reason: string
    binding: QueryIntentBinding
    customerJob: string
    capabilityFactIds: string[]
    remedy: PromptRemedyAssessment
}

type Candidate = {
    resolutionType: "create" | "refresh" | "report_only"
    deliverableType: "full_article" | "full_page_replacement" | "section_patch" | "report_only"
    title: string
    targetUrl: string | null
    targetPageKind: InventoryPage["pageKind"] | null
    priority: number
    reason: string
    prompts: PlanningPrompt[]
    binding: QueryIntentBinding
    evidence: Record<string, unknown>
}

function groupCandidates(prompts: PlanningPrompt[], pages: InventoryPage[]): Candidate[] {
    const refresh = new Map<string, { match: ReturnType<typeof matchExistingPage>; prompts: PlanningPrompt[] }>()
    const creates = new Map<string, PlanningPrompt[]>()
    const reports = new Map<string, PlanningPrompt[]>()

    for (const prompt of prompts.sort((a, b) => b.priority - a.priority)) {
        if (prompt.remedy.kind !== "content") {
            const reportKey = `${prompt.scopeFamilyId}:${prompt.remedy.kind}`
            const group = reports.get(reportKey) ?? []
            group.push(prompt)
            reports.set(reportKey, group)
            continue
        }
        // Include the confirmed scope seed and operation-shaped customer job.
        // This gives synonymous buyer wording a chance to match a real page
        // without accepting a generic category page on one shared token.
        const coverageQuery = `${prompt.prompt} ${prompt.sourceSeed} ${prompt.customerJob}`
        const match = matchExistingPage(coverageQuery, pages)
        if (match) {
            const current = refresh.get(match.page.canonicalUrl) ?? { match, prompts: [] }
            current.prompts.push(prompt)
            if ((current.match?.confidence ?? 0) < match.confidence) current.match = match
            refresh.set(match.page.canonicalUrl, current)
            continue
        }

        // The confirmed scope + evidenced product operation is a stronger
        // dedupe boundary than surface word overlap. Educational questions have
        // no product operation, so their confirmed source seed is the topic key.
        const topicKey = prompt.binding.operationKey
            ? `operation:${prompt.binding.operationKey}`
            : `topic:${normalizeQuery(prompt.sourceSeed)}`
        const createKey = `${prompt.scopeFamilyId}:${topicKey}`
        const group = creates.get(createKey) ?? []
        group.push(prompt)
        creates.set(createKey, group)
    }

    const candidates: Candidate[] = []
    for (const { match, prompts: grouped } of refresh.values()) {
        if (!match) continue
        const blog = match.page.pageKind === "blog"
        candidates.push({
            resolutionType: "refresh",
            deliverableType: blog ? "full_page_replacement" : "section_patch",
            title: blog ? `Refresh: ${match.page.title}` : `Patch: ${match.page.title}`,
            targetUrl: match.page.canonicalUrl,
            targetPageKind: match.page.pageKind,
            priority: Math.round(Math.max(...grouped.map((prompt) => prompt.priority))),
            reason: `${grouped.length} measured buyer question${grouped.length === 1 ? "" : "s"} maps to this existing ${match.page.pageKind} page; refresh it instead of publishing a duplicate.`,
            prompts: grouped,
            binding: commonBinding(grouped),
            evidence: {
                matchConfidence: Math.round(match.confidence * 100) / 100,
                inventoryPageId: match.page.id ?? null,
                capabilityFactIds: unique(grouped.flatMap((prompt) => prompt.capabilityFactIds)),
            },
        })
    }
    for (const grouped of creates.values()) {
        const lead = grouped[0]
        candidates.push({
            resolutionType: "create",
            deliverableType: "full_article",
            title: articleTitle(lead.prompt),
            targetUrl: null,
            targetPageKind: null,
            priority: Math.round(Math.max(...grouped.map((prompt) => prompt.priority))),
            reason: `${grouped.length} measured buyer question${grouped.length === 1 ? " has" : "s have"} no supported match in the current sitemap inventory.`,
            prompts: grouped,
            binding: commonBinding(grouped),
            evidence: {
                customerJobs: unique(grouped.map((prompt) => prompt.customerJob)),
                capabilityFactIds: unique(grouped.flatMap((prompt) => prompt.capabilityFactIds)),
            },
        })
    }
    for (const grouped of reports.values()) {
        const lead = grouped[0]
        const review = grouped.some((prompt) => prompt.remedy.kind === "founder_review")
        candidates.push({
            resolutionType: "report_only",
            deliverableType: "report_only",
            title: review ? `Founder review: ${articleTitle(lead.prompt)}` : `Earned placement: ${articleTitle(lead.prompt)}`,
            targetUrl: null,
            targetPageKind: null,
            priority: Math.round(Math.max(...grouped.map((prompt) => prompt.priority))),
            reason: review
                ? `${grouped.length} measured buyer question${grouped.length === 1 ? " has" : "s have"} unresolved citation evidence. It cannot enter production until reviewed.`
                : `${grouped.length} measured buyer question${grouped.length === 1 ? " points" : "s point"} to third-party placement work, not another owned article.`,
            prompts: grouped,
            binding: commonBinding(grouped),
            evidence: {
                remedyReasons: unique(grouped.map((prompt) => prompt.remedy.reason)),
                citationActionability: grouped.map((prompt) => prompt.remedy.counts),
            },
        })
    }
    return candidates.sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title))
}

function unique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))]
}

function commonBinding(prompts: PlanningPrompt[]): QueryIntentBinding {
    const first = prompts[0].binding
    if (prompts.every((prompt) => prompt.binding.operationKey === first.operationKey)) return first
    return {
        scopeFamilyId: first.scopeFamilyId,
        operationKey: null,
        capabilityFit: "educational",
        solutionMode: "category_educational",
        reason: "This grouped action spans more than one product operation and cannot make a single product-led claim.",
    }
}

/** Builds a reviewable proposal set; it never selects production work. */
export async function buildActionProposalsForRun(input: {
    supabase: any
    runId: string
}): Promise<{ proposalSetId: string; proposalCount: number }> {
    const { supabase, runId } = input
    const { data: run, error: runError } = await supabase
        .from("ai_probe_runs")
        .select("id, user_id, brand_id, status, subject_domains, competitors")
        .eq("id", runId)
        .single()
    if (runError || !run || run.status !== "completed") {
        throw new Error("Only a completed visibility measurement can be planned.")
    }
    const { data: cycle } = await supabase
        .from("subscription_cycles")
        .select("id, state")
        .eq("measurement_run_id", runId)
        .single()
    if (!cycle || cycle.state !== "awaiting_input") {
        throw new Error("The completed measurement is not bound to a cycle awaiting review.")
    }
    const { data: existing } = await supabase
        .from("action_proposal_sets")
        .select("id, state, action_proposals(id)")
        .eq("cycle_id", cycle.id)
        .eq("measurement_run_id", runId)
        .maybeSingle()
    if (existing && ["review", "confirmed"].includes(existing.state)) {
        return {
            proposalSetId: existing.id,
            proposalCount: Array.isArray(existing.action_proposals)
                ? existing.action_proposals.length
                : 0,
        }
    }

    const { data: brand } = await supabase
        .from("brand_details")
        .select("website_url")
        .eq("id", run.brand_id)
        .eq("user_id", run.user_id)
        .single()
    if (!brand?.website_url) throw new Error("The measured brand has no website URL.")

    const inventory = await syncSiteInventory({
        supabase,
        userId: run.user_id,
        brandId: run.brand_id,
        websiteUrl: brand.website_url,
    })
    const { data: opportunityRows, error: opportunityError } = await supabase
        .from("content_opportunities")
        .select("id, tracked_prompt_id, last_priority, last_reason")
        .eq("last_seen_run_id", runId)
        // `needs_input` includes a delivered create whose publication URL has
        // not been confirmed. Turning it into another create proposal would
        // knowingly manufacture a duplicate draft.
        .in("state", ["open", "needs_input"])
    if (opportunityError) throw new Error(opportunityError.message)

    const opportunityIds = (opportunityRows ?? []).map((row: any) => row.id)
    const { data: deliveredCreateLinks, error: deliveredCreateError } = opportunityIds.length
        ? await supabase
              .from("cycle_action_opportunities")
              .select("opportunity_id, cycle_actions!inner(state, resolution_type)")
              .in("opportunity_id", opportunityIds)
              .eq("cycle_actions.state", "delivered")
              .eq("cycle_actions.resolution_type", "create")
        : { data: [], error: null }
    if (deliveredCreateError) throw new Error(deliveredCreateError.message)
    const deliveredCreateOpportunityIds = new Set(
        (deliveredCreateLinks ?? []).map((row: any) => row.opportunity_id),
    )
    const plannableOpportunityRows = (opportunityRows ?? []).filter(
        (row: any) => !deliveredCreateOpportunityIds.has(row.id),
    )

    const trackedIds = plannableOpportunityRows.map((row: any) => row.tracked_prompt_id)
    const { data: trackedRows, error: trackedError } = trackedIds.length
        ? await supabase
              .from("tracked_prompts")
              .select("id, scope_family_id, prompt, source_seed, intent_binding")
              .in("id", trackedIds)
        : { data: [], error: null }
    if (trackedError) throw new Error(trackedError.message)

    const { data: observationRows, error: observationError } = trackedIds.length
        ? await supabase
              .from("ai_probe_prompts")
              .select("id, tracked_prompt_id")
              .eq("run_id", runId)
              .in("tracked_prompt_id", trackedIds)
        : { data: [], error: null }
    if (observationError) throw new Error(observationError.message)
    const observationIds = (observationRows ?? []).map((row: any) => row.id)
    const { data: resultRows, error: resultError } = observationIds.length
        ? await supabase
              .from("ai_probe_results")
              .select("prompt_id, citations")
              .eq("run_id", runId)
              .in("prompt_id", observationIds)
        : { data: [], error: null }
    if (resultError) throw new Error(resultError.message)
    const trackedByObservation = new Map<string, string>(
        (observationRows ?? []).map((row: any) => [row.id, row.tracked_prompt_id]),
    )
    const citationsByTracked = new Map<string, StoredCitation[]>()
    for (const result of resultRows ?? []) {
        const trackedId = trackedByObservation.get(result.prompt_id)
        if (!trackedId) continue
        const citations = citationsByTracked.get(trackedId) ?? []
        if (Array.isArray(result.citations)) {
            citations.push(
                ...result.citations.filter(
                    (citation: unknown): citation is StoredCitation =>
                        Boolean(citation) &&
                        typeof citation === "object" &&
                        typeof (citation as StoredCitation).url === "string",
                ),
            )
        }
        citationsByTracked.set(trackedId, citations)
    }

    const familyIds = unique((trackedRows ?? []).map((row: any) => row.scope_family_id))
    const { data: familyRows } = familyIds.length
        ? await supabase
              .from("brand_scope_families")
              .select("id, capability_contract")
              .in("id", familyIds)
        : { data: [] }
    const familyContract = new Map<string, CapabilityContract>(
        (familyRows ?? []).map((row: any) => [row.id, row.capability_contract as CapabilityContract]),
    )
    const opportunityByPrompt = new Map<string, any>(
        plannableOpportunityRows.map((row: any) => [row.tracked_prompt_id, row]),
    )
    const competitorDomains = Array.isArray(run.competitors)
        ? run.competitors
              .map((competitor: any) => competitor?.domain)
              .filter((domain: unknown): domain is string => typeof domain === "string")
        : []
    const planningPrompts: PlanningPrompt[] = (trackedRows ?? []).map((row: any) => {
        const opportunity = opportunityByPrompt.get(row.id)
        const bound = bindPromptCapability({
            scopeFamilyId: row.scope_family_id,
            prompt: row.prompt,
            sourceSeed: row.source_seed,
            contract: familyContract.get(row.scope_family_id),
        })
        return {
            opportunityId: opportunity.id,
            trackedPromptId: row.id,
            scopeFamilyId: row.scope_family_id,
            prompt: row.prompt,
            sourceSeed: row.source_seed,
            priority: Math.max(0, Math.min(100, Math.round(opportunity.last_priority ?? 0))),
            reason: opportunity.last_reason,
            remedy: assessPromptRemedy({
                citations: citationsByTracked.get(row.id) ?? [],
                subjectDomains: run.subject_domains ?? [],
                competitorDomains,
            }),
            ...bound,
        }
    })

    let proposalSetId = existing?.id as string | undefined
    if (proposalSetId) {
        const { error: resetProposalError } = await supabase
            .from("action_proposals")
            .delete()
            .eq("proposal_set_id", proposalSetId)
        if (resetProposalError) throw new Error(resetProposalError.message)
        const { error: resetSetError } = await supabase
            .from("action_proposal_sets")
            .update({
                inventory_run_id: inventory.runId,
                state: "draft",
                failure_code: null,
                updated_at: new Date().toISOString(),
            })
            .eq("id", proposalSetId)
        if (resetSetError) throw new Error(resetSetError.message)
    } else {
        const { data: created, error: createError } = await supabase
            .from("action_proposal_sets")
            .insert({
                user_id: run.user_id,
                brand_id: run.brand_id,
                cycle_id: cycle.id,
                measurement_run_id: runId,
                inventory_run_id: inventory.runId,
                state: "draft",
            })
            .select("id")
            .single()
        if (createError || !created) throw new Error(createError?.message ?? "Proposal set was not created.")
        proposalSetId = created.id
    }

    if (!proposalSetId) throw new Error("Proposal set id was not resolved.")
    const candidates = groupCandidates(planningPrompts, inventory.pages)
    for (const candidate of candidates) {
        const normalizedTitle = normalizeQuery(candidate.title)
        const dedupeKey = candidate.targetUrl
            ? `refresh:${candidate.targetUrl}`
            : `create:${normalizedTitle}`
        const { data: proposal, error: proposalError } = await supabase
            .from("action_proposals")
            .insert({
                user_id: run.user_id,
                brand_id: run.brand_id,
                proposal_set_id: proposalSetId,
                resolution_type: candidate.resolutionType,
                deliverable_type: candidate.deliverableType,
                title: candidate.title,
                normalized_title: normalizedTitle,
                dedupe_key: dedupeKey,
                target_url: candidate.targetUrl,
                target_page_kind: candidate.targetPageKind,
                priority: candidate.priority,
                reason: candidate.reason,
                intent_binding: candidate.binding,
                evidence: candidate.evidence,
            })
            .select("id")
            .single()
        if (proposalError || !proposal) throw new Error(proposalError?.message ?? "Proposal was not saved.")

        const { error: linkError } = await supabase.from("action_proposal_prompts").insert(
            candidate.prompts.map((prompt) => ({
                user_id: run.user_id,
                brand_id: run.brand_id,
                proposal_set_id: proposalSetId,
                proposal_id: proposal.id,
                tracked_prompt_id: prompt.trackedPromptId,
                opportunity_id: prompt.opportunityId,
            })),
        )
        if (linkError) throw new Error(linkError.message)
    }

    const { error: reviewError } = await supabase
        .from("action_proposal_sets")
        .update({ state: "review", updated_at: new Date().toISOString() })
        .eq("id", proposalSetId)
    if (reviewError) throw new Error(reviewError.message)
    return { proposalSetId, proposalCount: candidates.length }
}
