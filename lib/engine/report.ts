/**
 * The engine's reports, computed from stored rows. Pure, so every number on
 * the page is asserted under plain node (tests/engine.test.mjs).
 *
 * Change is claimed only when it is real: one answer per engine per week is a
 * single sample, so a question counts as "won back" or "lost" only when it
 * flipped in every engine. Anything else reads as no measurable change.
 */

import type { FindingState } from "./findings.ts"
import { hostOf, isOwnedUrl } from "./findings.ts"

export interface WeekRow {
    id: string
    weekStart: string
    state: string
}

export interface FindingRow {
    weekId: string
    trackedPromptId: string
    prompt: string
    state: FindingState
    perEngine: Array<{ engine: string; answered: boolean; mentioned: boolean; ownCitations: string[] }>
}

export interface AnswerRow {
    engine: string
    mentionCount: number
    citations: Array<{ url: string }>
    competitorMentions: Array<{ name: string; domain?: string; mentionCount: number }>
}

/** States where every engine that answered named the tool. */
const MENTIONED_EVERYWHERE: FindingState[] = ["won", "outranked"]

export interface TrendPoint {
    weekStart: string
    questions: number
    /** Share of questions named by at least one engine. */
    mentionedAnywhere: number
    /** Per engine: share of its answers naming the tool. */
    perEngine: Record<string, { mentioned: number; cited: number; answered: number }>
    /** Share of questions where at least one engine cited a page of ours. */
    citedAnywhere: number
    gaps: number
}

export function buildTrend(weeks: WeekRow[], findings: FindingRow[]): TrendPoint[] {
    return [...weeks]
        .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
        .map((week) => {
            const rows = findings.filter((row) => row.weekId === week.id)
            const perEngine: TrendPoint["perEngine"] = {}
            for (const row of rows) {
                for (const fact of row.perEngine) {
                    const entry = (perEngine[fact.engine] ??= { mentioned: 0, cited: 0, answered: 0 })
                    if (!fact.answered) continue
                    entry.answered++
                    if (fact.mentioned) entry.mentioned++
                    if (fact.ownCitations.length > 0) entry.cited++
                }
            }
            return {
                weekStart: week.weekStart,
                questions: rows.length,
                mentionedAnywhere: rows.filter((row) => row.perEngine.some((fact) => fact.mentioned)).length,
                perEngine,
                citedAnywhere: rows.filter((row) => row.perEngine.some((fact) => fact.ownCitations.length > 0)).length,
                gaps: rows.filter((row) => row.state === "gap").length,
            }
        })
}

export type QuestionChange = "won_back" | "lost" | "no_change" | "new"

/** Week-over-week change for one question, claimed only on a flip in every engine. */
export function questionChange(previous: FindingState | null, current: FindingState): QuestionChange {
    if (!previous) return "new"
    if (previous === "gap" && MENTIONED_EVERYWHERE.includes(current)) return "won_back"
    if (MENTIONED_EVERYWHERE.includes(previous) && current === "gap") return "lost"
    return "no_change"
}

export interface QuestionHistory {
    trackedPromptId: string
    prompt: string
    /** Oldest first; null for a week the question was not measured. */
    states: Array<FindingState | null>
    change: QuestionChange
}

export function buildQuestionHistory(weeks: WeekRow[], findings: FindingRow[], limit = 8): QuestionHistory[] {
    const ordered = [...weeks].sort((a, b) => a.weekStart.localeCompare(b.weekStart)).slice(-limit)
    const latest = ordered[ordered.length - 1]
    if (!latest) return []
    const byKey = new Map(findings.map((row) => [`${row.weekId}:${row.trackedPromptId}`, row]))
    return findings
        .filter((row) => row.weekId === latest.id)
        .map((row) => {
            const states = ordered.map((week) => byKey.get(`${week.id}:${row.trackedPromptId}`)?.state ?? null)
            const previous = states.length > 1 ? states[states.length - 2] : null
            return {
                trackedPromptId: row.trackedPromptId,
                prompt: row.prompt,
                states,
                change: questionChange(previous, row.state),
            }
        })
}

export interface ShareOfVoice {
    answers: number
    entries: Array<{ name: string; answers: number; share: number; isUs: boolean }>
}

/** Of the answers that named anyone we track, how often each name appeared. */
export function buildShareOfVoice(brandName: string, answers: AnswerRow[]): ShareOfVoice {
    const counts = new Map<string, { name: string; answers: number; isUs: boolean }>()
    counts.set("__us__", { name: brandName, answers: 0, isUs: true })
    for (const answer of answers) {
        if (answer.mentionCount > 0) counts.get("__us__")!.answers++
        const seen = new Set<string>()
        for (const competitor of answer.competitorMentions ?? []) {
            if (!competitor?.name || competitor.mentionCount <= 0) continue
            const key = competitor.name.toLowerCase()
            if (seen.has(key)) continue
            seen.add(key)
            const entry = counts.get(key) ?? { name: competitor.name, answers: 0, isUs: false }
            entry.answers++
            counts.set(key, entry)
        }
    }
    const total = [...counts.values()].reduce((sum, entry) => sum + entry.answers, 0)
    return {
        answers: answers.length,
        entries: [...counts.values()]
            .filter((entry) => entry.answers > 0 || entry.isUs)
            .map((entry) => ({ ...entry, share: total ? entry.answers / total : 0 }))
            .sort((a, b) => b.answers - a.answers),
    }
}

export interface CitationReport {
    totalCitations: number
    ownCitations: number
    ownPages: Array<{ url: string; count: number }>
    topDomains: Array<{ domain: string; answers: number; owned: boolean }>
}

export function buildCitationReport(answers: AnswerRow[], ownedHosts: string[], limit = 12): CitationReport {
    let totalCitations = 0
    let ownCitations = 0
    const ownPages = new Map<string, number>()
    const domains = new Map<string, number>()
    for (const answer of answers) {
        const answerDomains = new Set<string>()
        for (const citation of answer.citations ?? []) {
            if (!citation?.url) continue
            totalCitations++
            const domain = hostOf(citation.url)
            if (domain) answerDomains.add(domain)
            if (isOwnedUrl(citation.url, ownedHosts)) {
                ownCitations++
                const key = citation.url.replace(/[#?].*$/, "")
                ownPages.set(key, (ownPages.get(key) ?? 0) + 1)
            }
        }
        for (const domain of answerDomains) domains.set(domain, (domains.get(domain) ?? 0) + 1)
    }
    return {
        totalCitations,
        ownCitations,
        ownPages: [...ownPages.entries()].map(([url, count]) => ({ url, count })).sort((a, b) => b.count - a.count),
        topDomains: [...domains.entries()]
            .map(([domain, count]) => ({
                domain,
                answers: count,
                owned: ownedHosts.some((owned) => domain === owned || domain.endsWith(`.${owned}`)),
            }))
            .sort((a, b) => b.answers - a.answers)
            .slice(0, limit),
    }
}

export interface ActionOutcome {
    actionId: string
    title: string
    kind: string
    weekStart: string
    questions: Array<{ prompt: string; then: FindingState | null; now: FindingState | null; change: QuestionChange }>
}

/** For finished work: what happened to its questions since. */
export function buildActionOutcomes(
    actions: Array<{ id: string; title: string; kind: string; weekId: string; trackedPromptIds: string[]; prompts: string[] }>,
    weeks: WeekRow[],
    findings: FindingRow[],
): ActionOutcome[] {
    const latest = [...weeks].sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0]
    const weekStartById = new Map(weeks.map((week) => [week.id, week.weekStart]))
    const byKey = new Map(findings.map((row) => [`${row.weekId}:${row.trackedPromptId}`, row.state]))
    return actions.map((action) => ({
        actionId: action.id,
        title: action.title,
        kind: action.kind,
        weekStart: weekStartById.get(action.weekId) ?? "",
        questions: action.trackedPromptIds.map((trackedPromptId, index) => {
            const then = byKey.get(`${action.weekId}:${trackedPromptId}`) ?? null
            const now = latest && latest.id !== action.weekId ? byKey.get(`${latest.id}:${trackedPromptId}`) ?? null : null
            return {
                prompt: action.prompts[index] ?? "",
                then,
                now,
                change: now ? questionChange(then, now) : "no_change",
            }
        }),
    }))
}
