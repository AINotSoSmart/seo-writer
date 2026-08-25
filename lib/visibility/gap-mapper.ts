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
import type { AiEngine } from "./engines"
import { ENGINE_LABELS } from "./engines"
import type { ParsedAnswer } from "./answer-parser"
import { meanMentionPosition } from "./answer-parser"
import { summariseFanOut, type FanOutSummary } from "./fan-out"
import type { CapabilityContract } from "@/lib/writer/article-contract"
import { bindPromptCapability } from "./capability-binding"

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
        /** Sub-queries this engine ran. Empty when the surface exposes none. */
        searchQueries: string[]
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
    /**
     * Hosts the engines cited for this prompt, most-cited first.
     *
     * `answersNaming` is how many of the answers citing this host also named
     * the brand. It is deliberately a co-occurrence count and nothing more: we
     * have not fetched the page, so we cannot claim the page omits the brand —
     * only that the answers built on it did not mention it.
     */
    citedHosts: Array<{ host: string; count: number; answersNaming: number }>
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
    citationsByEngine: Map<AiEngine, Array<{ url: string; title?: string }>>,
): PromptOutcome {
    const parsed = prompt.answers.map((answer) => answer.parsed)

    /**
     * A competitor the PROMPT named cannot count as a rival for that prompt.
     *
     * Buyer prompts may now name incumbents — "Figma is overkill for this, what
     * else…" — because that is how people actually ask and it is what makes an
     * engine list challengers. The cost is that the named tool then appears in
     * the answer by construction, and counting it would put our own prompt text
     * at the top of the rival leaderboard. That is measuring ourselves.
     *
     * Absence of the *subject* is unaffected: nothing lets a prompt name the
     * customer's own brand, so "they were not mentioned" stays a real finding.
     */
    const promptText = prompt.text.toLowerCase().replace(/[^a-z0-9]/g, "")
    const namedInPrompt = (name: string): boolean => {
        const needle = name.toLowerCase().replace(/[^a-z0-9]/g, "")
        return needle.length >= 4 && promptText.includes(needle)
    }

    const rivalCounts = new Map<string, { name: string; url: string; answersNaming: number }>()
    for (const answer of parsed) {
        for (const competitor of answer.competitorMentions) {
            if (competitor.mentionCount === 0) continue
            if (namedInPrompt(competitor.name)) continue
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

    // Preserve only the factual host and co-occurrence counts needed on the
    // question outcome. Source relationships and page evidence are built from
    // the immutable result rows by source-report.ts; no source taxonomy belongs
    // in the production summary.
    const hostCounts = new Map<string, { count: number; answersNaming: number }>()

    for (const answer of prompt.answers) {
        const named = answer.parsed.mentionCount > 0
        for (const citation of citationsByEngine.get(answer.engine) || []) {
            const host = hostOf(citation.url)
            if (!host) continue
            const entry = hostCounts.get(host) ?? { count: 0, answersNaming: 0 }
            entry.count++
            if (named) entry.answersNaming++
            hostCounts.set(host, entry)
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
            .map(([host, entry]) => ({
                host,
                count: entry.count,
                answersNaming: entry.answersNaming,
            }))
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
    options: {
        excerptChars?: number
        capabilityContracts?: Map<string, CapabilityContract>
    } = {},
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

        const capability = bindPromptCapability({
            scopeFamilyId: prompt.scopeFamilyId,
            prompt: prompt.text,
            sourceSeed: prompt.sourceSeed,
            contract: options.capabilityContracts?.get(prompt.scopeFamilyId),
        })

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
                ...capability.binding,
                reason: `${capability.binding.reason} Buyer question came from the confirmed seed "${prompt.sourceSeed}" and was ${
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
    /**
     * How the tracked competitor list was assembled, and whether an empty
     * `rivalLeaderboard` is a finding or a failure.
     *
     * Mentions are counted against the supplied list only — there is no
     * open-ended entity extraction — so an empty list means the run *could not*
     * have named a rival. Reporting that as "no competitor was named" would be
     * the same lie the engine ledger exists to prevent one stage later. Written
     * by `runVisibilityProbe`, not by `summariseRun`, because it describes
     * discovery rather than answers.
     */
    competitorTracking?: {
        tracked: number
        supplied: number
        discovered: number
        discoveryAttempted: boolean
        discoveryFailed: boolean
    }
    /**
     * The sub-queries the engines actually ran. Observed behaviour on the AI
     * surface — never a volume estimate. See `fan-out.ts`.
     */
    fanOut: FanOutSummary
}

export function summariseRun(
    outcomes: PromptOutcome[],
    prompts: ProbedPrompt[] = [],
): RunSummary {
    const answerCount = outcomes.reduce((total, o) => total + o.answersTotal, 0)
    const presentAnswerCount = outcomes.reduce((total, o) => total + o.answersPresent, 0)

    const rivals = new Map<string, { name: string; url: string; promptsNaming: number }>()
    for (const outcome of outcomes) {
        for (const rival of outcome.rivals) {
            const existing = rivals.get(rival.name)
            if (existing) existing.promptsNaming++
            else rivals.set(rival.name, { name: rival.name, url: rival.url, promptsNaming: 1 })
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
        fanOut: summariseFanOut(
            prompts.map((prompt) => ({
                promptId: prompt.id,
                answers: prompt.answers.map((answer) => ({
                    engine: answer.engine,
                    namedBrand: answer.parsed.mentionCount > 0,
                    searchQueries: answer.searchQueries ?? [],
                })),
            })),
        ),
    }
}
