/**
 * Turns measured answer-engine absences into `GapItem[]` — the exact shape the
 * existing clusterer already consumes.
 *
 * This module is the whole architectural point of the pivot. Nothing downstream
 * changes: `collapseToArticles`, `groupIntoClusters`, `absorbOrphanedUnits`,
 * `titleArticles` and `nameClusters` run byte-for-byte as they do for a Google
 * harvest. The only thing being replaced is the definition of "gap".
 *
 *     Google harvest:  gap = a real search your site does not answer
 *     AI probe:        gap = a buyer question an engine answers without you
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHY THERE IS NO THRESHOLD IN THIS FILE
 *
 * The standing rule is never to hand-tune a matching threshold. It would have
 * been easy to compute a 0-100 visibility score per prompt and call anything
 * under, say, 30 a gap — that is what upstream does, and the number would have
 * looked authoritative. It would also have been unfalsifiable: no customer can
 * check a weighted composite of mentions, citations, ratio and sentiment, and
 * no movement in it can be attributed to anything in particular.
 *
 * Every verdict here is instead a counted fact about the stored answers:
 *
 *     absent     — the brand appears in none of the answers
 *     outranked  — it appears, but never before a competitor
 *     present    — it appears first in at least one answer
 *
 * A customer can verify any of these by opening the stored answers and reading.
 * That is the same standard the Google harvest is held to, which is the only
 * reason this source is allowed to feed the same clusterer.
 */

import type { GapItem } from "@/lib/harvest/gap-engine"
import type { ArticleType } from "@/lib/harvest/cluster-types"
import type { CapabilityFit, SolutionMode } from "@/lib/writer/article-contract"
import type { AiEngine } from "./engines"
import { ENGINE_LABELS } from "./engines"
import type { ParsedAnswer } from "./answer-parser"
import { meanMentionPosition } from "./answer-parser"

export type PromptVerdict = "absent" | "outranked" | "present"

/** One prompt, its answers from every engine, and what they showed. */
export interface ProbedPrompt {
    id: string
    text: string
    scopeFamilyId: string
    intent: string
    articleType: ArticleType
    sourceSeed: string
    answers: Array<{
        engine: AiEngine
        model: string
        answerText: string
        parsed: ParsedAnswer
    }>
}

export interface PromptOutcome {
    promptId: string
    verdict: PromptVerdict
    answersTotal: number
    answersPresent: number
    meanMentionPosition: number | null
    /** Competitors named across this prompt's answers, most-named first. */
    rivals: Array<{ name: string; url: string; answersNaming: number }>
    /** Hosts the engines cited for this prompt, most-cited first. */
    citedHosts: Array<{ host: string; count: number }>
}

/**
 * Classifies one prompt from its answers. Pure counting, no tuning.
 *
 * The `outranked` case matters commercially and is the one a naive
 * implementation loses: a brand mentioned eighth in a list of eight is
 * "mentioned", scores as visible, and gets no article written for it — while
 * the buyer stopped reading at three.
 */
export function classifyPrompt(answers: ParsedAnswer[]): PromptVerdict {
    if (answers.length === 0) return "absent"

    const naming = answers.filter((answer) => answer.mentionCount > 0)
    if (naming.length === 0) return "absent"

    const ledFirst = naming.some((answer) => answer.mentionPosition === 1)
    return ledFirst ? "present" : "outranked"
}

function hostOf(url: string): string | null {
    try {
        return new URL(url).hostname.toLowerCase().replace(/^www\./, "") || null
    } catch {
        return null
    }
}

/** Rolls one prompt's answers into the outcome the report and mapper read. */
export function summarisePrompt(
    prompt: ProbedPrompt,
    citationsByEngine: Map<AiEngine, Array<{ url: string }>>,
): PromptOutcome {
    const parsed = prompt.answers.map((answer) => answer.parsed)

    const rivalCounts = new Map<string, { name: string; url: string; answersNaming: number }>()
    for (const answer of parsed) {
        for (const competitor of answer.competitorMentions) {
            if (competitor.mentionCount === 0) continue
            const existing = rivalCounts.get(competitor.competitorId)
            if (existing) {
                existing.answersNaming++
            } else {
                rivalCounts.set(competitor.competitorId, {
                    name: competitor.name,
                    url: competitor.domain,
                    answersNaming: 1,
                })
            }
        }
    }

    const hostCounts = new Map<string, number>()
    for (const answer of prompt.answers) {
        for (const citation of citationsByEngine.get(answer.engine) || []) {
            const host = hostOf(citation.url)
            if (host) hostCounts.set(host, (hostCounts.get(host) ?? 0) + 1)
        }
    }

    return {
        promptId: prompt.id,
        verdict: classifyPrompt(parsed),
        answersTotal: parsed.length,
        answersPresent: parsed.filter((answer) => answer.mentionCount > 0).length,
        meanMentionPosition: meanMentionPosition(parsed),
        rivals: [...rivalCounts.values()].sort(
            (a, b) => b.answersNaming - a.answersNaming,
        ),
        citedHosts: [...hostCounts.entries()]
            .map(([host, count]) => ({ host, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10),
    }
}

/**
 * Ranks a gap 0-100 for cluster ordering.
 *
 * Deterministic and evidential, mirroring `scoreGap` in the Google pipeline:
 *
 *   - complete absence outranks being outranked (a bigger absolute opportunity)
 *   - agreement across engines is the strongest signal available — one engine
 *     omitting you is a sample, four engines omitting you is a pattern
 *   - commercial intent outranks informational, because those are the answers
 *     that name vendors at all
 *   - rivals named in your place raise it further: somebody with budget is
 *     already being recommended for this question
 */
export function scoreVisibilityGap(
    outcome: PromptOutcome,
    articleType: ArticleType,
): number {
    let score = outcome.verdict === "absent" ? 40 : 20

    // Cross-engine agreement, saturating at four engines.
    const missing = outcome.answersTotal - outcome.answersPresent
    score += Math.min(missing, 4) * 6

    if (articleType === "commercial") score += 15
    else if (articleType === "howto") score += 5

    score += Math.min(outcome.rivals.length, 4) * 5

    return Math.max(0, Math.min(100, score))
}

/**
 * Builds the internal evidence permalink used as a gap's `source_url`.
 *
 * An AI answer has no public URL, so this points at our stored record instead.
 * It is a real, openable, per-prompt page showing every verbatim answer — which
 * keeps the provenance rule satisfiable in the only way it can be for this
 * source. The report labels these as captured answers rather than passing them
 * off as third-party pages.
 */
export function evidenceUrl(runId: string, promptId: string): string {
    const base = process.env.NEXT_PUBLIC_APP_URL || ""
    return `${base}/evidence/ai-answer/${runId}/${promptId}`
}

const DEFAULT_CAPABILITY_FIT: CapabilityFit = "educational"
const DEFAULT_SOLUTION_MODE: SolutionMode = "category_educational"

/**
 * Maps losing prompts to `GapItem[]`.
 *
 * Only `absent` and `outranked` prompts become gaps. A prompt the brand already
 * leads is reported in the reader — it is the proof the measurement works — but
 * it is never turned into an article, because there is nothing to fix.
 *
 * `sourceContext` carries an excerpt of the answer that produced the gap. The
 * clusterer and the writer both read it, and it is what lets a generated
 * article be about the question the engine was actually answering rather than
 * the keyword alone.
 */
export function toGapItems(
    prompts: ProbedPrompt[],
    outcomes: Map<string, PromptOutcome>,
    runId: string,
    options: { excerptChars?: number } = {},
): GapItem[] {
    const excerptChars = options.excerptChars ?? 600
    const gaps: GapItem[] = []

    for (const prompt of prompts) {
        const outcome = outcomes.get(prompt.id)
        if (!outcome || outcome.verdict === "present") continue

        // Prefer an answer that omitted the brand: that is the one the customer
        // needs to read. Falling back to the first answer keeps a prompt with an
        // unusual mix from losing its evidence entirely.
        const losing =
            prompt.answers.find((answer) => answer.parsed.mentionCount === 0) ??
            prompt.answers[0]

        const excerpt = (losing?.answerText || "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, excerptChars)

        gaps.push({
            queryId: prompt.id,
            query: prompt.text,
            scopeFamilyId: prompt.scopeFamilyId,
            source: "ai_answer",
            sourceUrl: evidenceUrl(runId, prompt.id),
            sourceContext: losing
                ? `${ENGINE_LABELS[losing.engine]} answered: ${excerpt}`
                : prompt.text,
            intentBinding: {
                scopeFamilyId: prompt.scopeFamilyId,
                operationKey: null,
                capabilityFit: DEFAULT_CAPABILITY_FIT,
                solutionMode: DEFAULT_SOLUTION_MODE,
                reason: `Buyer prompt built from the confirmed area's own seed "${prompt.sourceSeed}"; ${
                    outcome.verdict === "absent"
                        ? `named in none of ${outcome.answersTotal} answers`
                        : `named in ${outcome.answersPresent} of ${outcome.answersTotal} answers, never first`
                }.`,
            },
            // The subject's own site is not consulted by this source, so its
            // coverage state is unknown rather than assumed. "gap" here means
            // "absent from the AI answer", which is a claim about the engine,
            // not about the site — conflating the two is how a customer ends up
            // being sold an article for a page they already have.
            userStatus: "gap",
            userMatchedUrl: null,
            userSimilarity: 0,
            competitors: outcome.rivals.map((rival) => ({
                name: rival.name,
                url: rival.url,
                matchedUrl: rival.url,
                similarity: outcome.answersTotal
                    ? rival.answersNaming / outcome.answersTotal
                    : 0,
            })),
            priority: scoreVisibilityGap(outcome, prompt.articleType),
        })
    }

    return gaps.sort((a, b) => b.priority - a.priority)
}

/** Run-level headline numbers. Plain proportions of countable events. */
export interface RunSummary {
    promptCount: number
    answerCount: number
    presentAnswerCount: number
    absentPromptCount: number
    outrankedPromptCount: number
    presentPromptCount: number
    /** Share of prompts where the brand led at least one answer, 0-100. */
    leadRate: number
    /** Share of individual answers naming the brand at all, 0-100. */
    presenceRate: number
    /** Competitors ranked by how many prompts named them. */
    rivalLeaderboard: Array<{ name: string; url: string; promptsNaming: number }>
    /** Domains the engines cited most across the whole run. */
    citedHosts: Array<{ host: string; count: number }>
}

export function summariseRun(outcomes: PromptOutcome[]): RunSummary {
    const answerCount = outcomes.reduce((total, o) => total + o.answersTotal, 0)
    const presentAnswerCount = outcomes.reduce((total, o) => total + o.answersPresent, 0)

    const rivals = new Map<string, { name: string; url: string; promptsNaming: number }>()
    const hosts = new Map<string, number>()
    for (const outcome of outcomes) {
        for (const rival of outcome.rivals) {
            const existing = rivals.get(rival.name)
            if (existing) existing.promptsNaming++
            else rivals.set(rival.name, { name: rival.name, url: rival.url, promptsNaming: 1 })
        }
        for (const host of outcome.citedHosts) {
            hosts.set(host.host, (hosts.get(host.host) ?? 0) + host.count)
        }
    }

    const present = outcomes.filter((o) => o.verdict === "present").length
    const rate = (part: number, whole: number) =>
        whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10

    return {
        promptCount: outcomes.length,
        answerCount,
        presentAnswerCount,
        absentPromptCount: outcomes.filter((o) => o.verdict === "absent").length,
        outrankedPromptCount: outcomes.filter((o) => o.verdict === "outranked").length,
        presentPromptCount: present,
        leadRate: rate(present, outcomes.length),
        presenceRate: rate(presentAnswerCount, answerCount),
        rivalLeaderboard: [...rivals.values()].sort(
            (a, b) => b.promptsNaming - a.promptsNaming,
        ),
        citedHosts: [...hosts.entries()]
            .map(([host, count]) => ({ host, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 20),
    }
}
