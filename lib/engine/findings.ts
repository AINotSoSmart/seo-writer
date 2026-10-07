/**
 * One week's counted facts per tracked question. Pure: no I/O, no model call,
 * so every rule here is asserted under plain node (tests/engine.test.mjs).
 *
 * The measurement asks each question once per engine. One random answer cannot
 * decide a question on its own, so work is only created where the engines
 * AGREE: a gap is a question that every engine answered and none of them named
 * the tool in. Anything less certain is reported and never actioned.
 */

export type FindingState = "gap" | "partial" | "outranked" | "won" | "insufficient"

export interface ResultRow {
    promptId: string
    engine: string
    mentionCount: number
    mentionPosition: number | null
    citations: Array<{ url: string; title?: string }>
}

export interface PromptRow {
    id: string
    trackedPromptId: string | null
    prompt: string
}

export interface EngineFact {
    engine: string
    answered: boolean
    mentioned: boolean
    position: number | null
    /** The tool's own pages this engine cited. */
    ownCitations: string[]
    /** Every other page this engine cited. */
    otherCitations: Array<{ url: string; title?: string }>
}

export interface Finding {
    trackedPromptId: string
    probePromptId: string
    prompt: string
    state: FindingState
    /** A gap this week that was also a gap last week. */
    confirmed: boolean
    enginesExpected: number
    enginesAnswered: number
    enginesMentioning: number
    enginesCiting: number
    perEngine: EngineFact[]
    /** Non-owned pages the engines cited, most-cited first. */
    citedRivalUrls: Array<{ url: string; title?: string; count: number }>
}

export interface RunHealth {
    attempted: number
    failed: number
    /** More than this share of failed engine calls makes the week partial. */
    healthy: boolean
}

/** A week with more than a fifth of its engine calls failed creates no work. */
export const MAX_FAILED_CALL_SHARE = 0.2

export function runHealth(ledger: Array<{ attempted?: number; failed?: number }>): RunHealth {
    const attempted = ledger.reduce((sum, entry) => sum + (entry.attempted ?? 0), 0)
    const failed = ledger.reduce((sum, entry) => sum + (entry.failed ?? 0), 0)
    return {
        attempted,
        failed,
        healthy: attempted > 0 && failed / attempted <= MAX_FAILED_CALL_SHARE,
    }
}

export function hostOf(url: string): string | null {
    try {
        return new URL(url).hostname.toLowerCase().replace(/^www\./, "") || null
    } catch {
        return null
    }
}

/** Exact host or any subdomain of an owned host. Never a substring match. */
export function isOwnedUrl(url: string, ownedHosts: string[]): boolean {
    const host = hostOf(url)
    if (!host) return false
    return ownedHosts.some((owned) => host === owned || host.endsWith(`.${owned}`))
}

export function classifyFinding(facts: EngineFact[], enginesExpected: number): FindingState {
    const answered = facts.filter((fact) => fact.answered)
    const mentioning = answered.filter((fact) => fact.mentioned)
    if (mentioning.length === 0) {
        return answered.length >= enginesExpected && answered.length > 0 ? "gap" : "insufficient"
    }
    if (mentioning.length < answered.length) return "partial"
    return mentioning.some((fact) => fact.position === 1) ? "won" : "outranked"
}

export function buildFindings(input: {
    prompts: PromptRow[]
    results: ResultRow[]
    engines: string[]
    ownedHosts: string[]
    /** tracked_prompt_id → was it a gap in the previous week. */
    previousGaps: Set<string>
}): Finding[] {
    const { prompts, results, engines, ownedHosts, previousGaps } = input
    const byPrompt = new Map<string, ResultRow[]>()
    for (const row of results) {
        const list = byPrompt.get(row.promptId) ?? []
        list.push(row)
        byPrompt.set(row.promptId, list)
    }

    const findings: Finding[] = []
    for (const prompt of prompts) {
        if (!prompt.trackedPromptId) continue
        const rows = byPrompt.get(prompt.id) ?? []
        const perEngine: EngineFact[] = engines.map((engine) => {
            const row = rows.find((candidate) => candidate.engine === engine)
            if (!row) {
                return { engine, answered: false, mentioned: false, position: null, ownCitations: [], otherCitations: [] }
            }
            const citations = Array.isArray(row.citations) ? row.citations : []
            return {
                engine,
                answered: true,
                mentioned: row.mentionCount > 0,
                position: row.mentionPosition,
                ownCitations: citations.filter((c) => isOwnedUrl(c.url, ownedHosts)).map((c) => c.url),
                otherCitations: citations.filter((c) => c.url && !isOwnedUrl(c.url, ownedHosts)),
            }
        })

        const state = classifyFinding(perEngine, engines.length)
        const rivalCounts = new Map<string, { url: string; title?: string; count: number }>()
        for (const fact of perEngine) {
            for (const citation of fact.otherCitations) {
                const key = citation.url.replace(/[#?].*$/, "").replace(/\/+$/, "")
                const entry = rivalCounts.get(key) ?? { url: citation.url, title: citation.title, count: 0 }
                entry.count++
                rivalCounts.set(key, entry)
            }
        }

        findings.push({
            trackedPromptId: prompt.trackedPromptId,
            probePromptId: prompt.id,
            prompt: prompt.prompt,
            state,
            confirmed: state === "gap" && previousGaps.has(prompt.trackedPromptId),
            enginesExpected: engines.length,
            enginesAnswered: perEngine.filter((fact) => fact.answered).length,
            enginesMentioning: perEngine.filter((fact) => fact.mentioned).length,
            enginesCiting: perEngine.filter((fact) => fact.ownCitations.length > 0).length,
            perEngine,
            citedRivalUrls: [...rivalCounts.values()].sort((a, b) => b.count - a.count),
        })
    }
    return findings
}
