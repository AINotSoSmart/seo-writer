import type { CompetitorMention } from "./answer-parser"

export const VISIBILITY_SUMMARY_VERSION = 2 as const

export interface VisibilityCompetitor {
    id: string
    name: string
    domain: string | null
}

export interface VisibilityPromptFact {
    id: string
    prompt: string
}

export interface VisibilityResultFact {
    promptId: string
    mentionCount: number
    citationCount: number
    mentionPosition: number | null
    competitorMentions: CompetitorMention[]
}

export interface NamedCompetitorRow {
    id: string
    name: string
    domain: string | null
    namedAnswers: number
    namedQuestions: number
    brandAbsentQuestions: number
}

export interface CitedCompetitorRow {
    id: string
    name: string
    domain: string | null
    citationOccurrences: number
    citingAnswers: number
    citingQuestions: number
    brandNamedAlongsideAnswers: number
    brandCitedAlongsideAnswers: number
    brandNotCitedQuestions: number
    brandNotNamedQuestions: number
}

export interface VisibilitySummaryV2 {
    version: typeof VISIBILITY_SUMMARY_VERSION
    brandVisibility: {
        questionsTotal: number
        answersTotal: number
        namedAnswers: number
        citedAnswers: number
        namedAndCitedAnswers: number
        namedOnlyAnswers: number
        citedOnlyAnswers: number
        neitherAnswers: number
        ledQuestions: number
        namedNeverFirstQuestions: number
        notNamedQuestions: number
        /**
         * Questions whose stored rank said "outranked" but whose only rivals
         * ahead were introduced by our own question or were never counted.
         * Reported so the correction is visible rather than silent.
         */
        promptInducedRankCorrections: number
    }
    competitorVisibility: {
        trackedCount: number
        promptInducedNamedAnswersExcluded: number
        citationOccurrences: number
        citedCompetitorCount: number
        citingAnswers: number
        citingQuestions: number
        competitorCitedBrandNotCitedQuestions: number
        competitorCitedBrandNotNamedQuestions: number
        namedRows: NamedCompetitorRow[]
        citedRows: CitedCompetitorRow[]
    }
}

function flat(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function promptNamesCompetitor(prompt: string, competitor: VisibilityCompetitor): boolean {
    const haystack = flat(prompt)
    const candidates = [competitor.name, competitor.domain ?? ""]
        .map(flat)
        .filter((candidate) => candidate.length >= 4)
    return candidates.some((candidate) => haystack.includes(candidate))
}

function competitorMention(
    result: VisibilityResultFact,
    competitor: VisibilityCompetitor,
): CompetitorMention | undefined {
    const domain = competitor.domain?.toLowerCase().replace(/^www\./, "")
    return result.competitorMentions.find((mention) => {
        if (mention.competitorId === competitor.id) return true
        const mentionDomain = mention.domain?.toLowerCase().replace(/^www\./, "")
        if (domain && mentionDomain === domain) return true
        return flat(mention.name) === flat(competitor.name)
    })
}

/**
 * The brand's rank once the entities that never earned one are removed.
 *
 * The stored `mentionPosition` is the raw observation: the brand's place among
 * every tracked competitor the parser located in the answer. Two kinds of rival
 * inflate it, and both are judgements this layer owns rather than facts the
 * parser should bake in:
 *
 * 1. **The question introduced it.** Asking "what is better than X?" guarantees
 *    the answer opens with X. Counting that as X outranking the brand measures
 *    our own prompt, not the engine's preference — and the report already says
 *    so in the rival leaderboard, which excludes exactly these. Leaving the
 *    brand's own rank unadjusted made the page contradict its own stated rule.
 * 2. **Nothing counted it.** Before the parser fix, casing drift let a rival
 *    hold a rank while scoring zero mentions, so a question could read "Named,
 *    never first" beside an empty list of who outranked you. Runs measured
 *    before that fix still carry those rows, so the guard stays here too — it is
 *    cheap, and it repairs history rather than requiring a re-probe.
 *
 * Returns 1 when every rival ahead of the brand falls into one of those two
 * buckets, which is what "you were named first" actually means.
 */
export function adjustedBrandRank(
    result: VisibilityResultFact,
    prompt: string,
    competitors: VisibilityCompetitor[],
): number | null {
    if (result.mentionCount <= 0 || result.mentionPosition === null) return null

    const ahead = result.competitorMentions.filter((mention) => {
        if (mention.mentionPosition === null) return false
        if (mention.mentionPosition >= (result.mentionPosition ?? 0)) return false
        // A rival nothing counted never earned the slot it is holding.
        if (mention.mentionCount <= 0) return false
        const tracked =
            competitors.find(
                (competitor) =>
                    competitor.id === mention.competitorId ||
                    flat(competitor.name) === flat(mention.name) ||
                    (competitor.domain &&
                        mention.domain &&
                        competitor.domain.toLowerCase().replace(/^www\./, "") ===
                            mention.domain.toLowerCase().replace(/^www\./, "")),
            ) ??
            ({
                id: mention.competitorId,
                name: mention.name,
                domain: mention.domain || null,
            } satisfies VisibilityCompetitor)
        return !promptNamesCompetitor(prompt, tracked)
    })

    return ahead.length + 1
}

export type DerivedVerdict = "absent" | "outranked" | "present"

/**
 * One question's verdict, recomputed from the same rule the summary counts by.
 *
 * The stored `ai_probe_prompts.verdict` predates `adjustedBrandRank`, so it
 * still says "outranked" for a question whose only rival ahead was one our own
 * question named. Displaying the stored value beside a corrected headline count
 * would put two different answers to the same question on one screen, so the
 * report derives this and the stored column becomes history rather than truth.
 */
export function deriveQuestionVerdict(
    answers: VisibilityResultFact[],
    prompt: string,
    competitors: VisibilityCompetitor[],
): DerivedVerdict {
    if (!answers.some((answer) => answer.mentionCount > 0)) return "absent"
    const led = answers.some(
        (answer) => adjustedBrandRank(answer, prompt, competitors) === 1,
    )
    return led ? "present" : "outranked"
}

/**
 * Derives every client-facing count from persisted result facts.
 *
 * Question outcomes and answer outcomes deliberately remain separate. A
 * two-engine run may name a brand in one answer and cite it in the other; no
 * percentage is meaningful unless its denominator is explicit.
 */
export function deriveVisibilitySummaryV2(input: {
    prompts: VisibilityPromptFact[]
    results: VisibilityResultFact[]
    competitors: VisibilityCompetitor[]
}): VisibilitySummaryV2 {
    const promptById = new Map(input.prompts.map((prompt) => [prompt.id, prompt]))
    const resultsByPrompt = new Map<string, VisibilityResultFact[]>()
    for (const result of input.results) {
        if (!promptById.has(result.promptId)) continue
        const rows = resultsByPrompt.get(result.promptId) ?? []
        rows.push(result)
        resultsByPrompt.set(result.promptId, rows)
    }

    const usablePromptIds = [...resultsByPrompt.keys()]
    let ledQuestions = 0
    let namedNeverFirstQuestions = 0
    let notNamedQuestions = 0
    let promptInducedRankCorrections = 0
    for (const promptId of usablePromptIds) {
        const answers = resultsByPrompt.get(promptId) ?? []
        const prompt = promptById.get(promptId)
        const named = answers.some((answer) => answer.mentionCount > 0)
        const led = answers.some((answer) => {
            if (answer.mentionCount <= 0) return false
            const adjusted = adjustedBrandRank(answer, prompt?.prompt ?? "", input.competitors)
            if (adjusted === 1 && answer.mentionPosition !== 1) {
                promptInducedRankCorrections++
            }
            return adjusted === 1
        })
        if (led) ledQuestions++
        else if (named) namedNeverFirstQuestions++
        else notNamedQuestions++
    }

    let namedAndCitedAnswers = 0
    let namedOnlyAnswers = 0
    let citedOnlyAnswers = 0
    let neitherAnswers = 0
    for (const result of input.results) {
        const named = result.mentionCount > 0
        const cited = result.citationCount > 0
        if (named && cited) namedAndCitedAnswers++
        else if (named) namedOnlyAnswers++
        else if (cited) citedOnlyAnswers++
        else neitherAnswers++
    }

    const namedRows: NamedCompetitorRow[] = []
    const citedRows: CitedCompetitorRow[] = []
    let promptInducedNamedAnswersExcluded = 0

    const anyCompetitorCitedAnswer = new Set<number>()
    const anyCompetitorCitedQuestion = new Set<string>()
    const competitorCitedBrandNotCitedQuestions = new Set<string>()
    const competitorCitedBrandNotNamedQuestions = new Set<string>()

    for (const competitor of input.competitors) {
        const namedAnswers = new Set<number>()
        const namedQuestions = new Set<string>()
        const brandAbsentQuestions = new Set<string>()
        const citingAnswers = new Set<number>()
        const citingQuestions = new Set<string>()
        const brandNotCitedQuestions = new Set<string>()
        const brandNotNamedQuestions = new Set<string>()
        let citationOccurrences = 0
        let brandNamedAlongsideAnswers = 0
        let brandCitedAlongsideAnswers = 0

        input.results.forEach((result, resultIndex) => {
            const prompt = promptById.get(result.promptId)
            if (!prompt) return
            const mention = competitorMention(result, competitor)
            if (!mention) return

            if (mention.mentionCount > 0) {
                if (promptNamesCompetitor(prompt.prompt, competitor)) {
                    promptInducedNamedAnswersExcluded++
                } else {
                    namedAnswers.add(resultIndex)
                    namedQuestions.add(result.promptId)
                    const promptAnswers = resultsByPrompt.get(result.promptId) ?? []
                    if (!promptAnswers.some((answer) => answer.mentionCount > 0)) {
                        brandAbsentQuestions.add(result.promptId)
                    }
                }
            }

            if (mention.citationCount <= 0) return
            citationOccurrences += mention.citationCount
            citingAnswers.add(resultIndex)
            citingQuestions.add(result.promptId)
            anyCompetitorCitedAnswer.add(resultIndex)
            anyCompetitorCitedQuestion.add(result.promptId)
            if (result.mentionCount > 0) brandNamedAlongsideAnswers++
            if (result.citationCount > 0) brandCitedAlongsideAnswers++
        })

        // These are question-level claims. A question counts as "competitor but
        // not us" only when none of its usable engine answers cite/name the
        // customer. Looking at one answer at a time would mislabel a mixed
        // ChatGPT/Google outcome.
        for (const promptId of citingQuestions) {
            const promptAnswers = resultsByPrompt.get(promptId) ?? []
            if (!promptAnswers.some((answer) => answer.citationCount > 0)) {
                brandNotCitedQuestions.add(promptId)
                competitorCitedBrandNotCitedQuestions.add(promptId)
            }
            if (!promptAnswers.some((answer) => answer.mentionCount > 0)) {
                brandNotNamedQuestions.add(promptId)
                competitorCitedBrandNotNamedQuestions.add(promptId)
            }
        }

        namedRows.push({
            id: competitor.id,
            name: competitor.name,
            domain: competitor.domain,
            namedAnswers: namedAnswers.size,
            namedQuestions: namedQuestions.size,
            brandAbsentQuestions: brandAbsentQuestions.size,
        })
        citedRows.push({
            id: competitor.id,
            name: competitor.name,
            domain: competitor.domain,
            citationOccurrences,
            citingAnswers: citingAnswers.size,
            citingQuestions: citingQuestions.size,
            brandNamedAlongsideAnswers,
            brandCitedAlongsideAnswers,
            brandNotCitedQuestions: brandNotCitedQuestions.size,
            brandNotNamedQuestions: brandNotNamedQuestions.size,
        })
    }

    namedRows.sort(
        (a, b) =>
            b.namedQuestions - a.namedQuestions ||
            b.namedAnswers - a.namedAnswers ||
            a.name.localeCompare(b.name),
    )
    citedRows.sort(
        (a, b) =>
            b.citationOccurrences - a.citationOccurrences ||
            b.citingQuestions - a.citingQuestions ||
            a.name.localeCompare(b.name),
    )

    return {
        version: VISIBILITY_SUMMARY_VERSION,
        brandVisibility: {
            questionsTotal: usablePromptIds.length,
            answersTotal: input.results.length,
            namedAnswers: namedAndCitedAnswers + namedOnlyAnswers,
            citedAnswers: namedAndCitedAnswers + citedOnlyAnswers,
            namedAndCitedAnswers,
            namedOnlyAnswers,
            citedOnlyAnswers,
            neitherAnswers,
            ledQuestions,
            namedNeverFirstQuestions,
            notNamedQuestions,
            promptInducedRankCorrections,
        },
        competitorVisibility: {
            trackedCount: input.competitors.length,
            promptInducedNamedAnswersExcluded,
            citationOccurrences: citedRows.reduce(
                (total, row) => total + row.citationOccurrences,
                0,
            ),
            citedCompetitorCount: citedRows.filter(
                (row) => row.citationOccurrences > 0,
            ).length,
            citingAnswers: anyCompetitorCitedAnswer.size,
            citingQuestions: anyCompetitorCitedQuestion.size,
            competitorCitedBrandNotCitedQuestions:
                competitorCitedBrandNotCitedQuestions.size,
            competitorCitedBrandNotNamedQuestions:
                competitorCitedBrandNotNamedQuestions.size,
            namedRows,
            citedRows,
        },
    }
}
