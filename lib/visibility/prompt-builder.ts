/**
 * Builds the buyer questions a visibility probe asks.
 *
 * The generator sees the whole company in one call. Confirmed product areas
 * remain mandatory ownership labels, but they are not equal quotas: a narrow
 * area may honestly produce fewer distinct selection situations than a broad
 * one. A single whole-set critic removes tutorials, synthetic phrases and
 * duplicate buyer situations that still slip through generation.
 */

import { normalizeQuery } from "@/lib/harvest/types"
import { DEFAULT_LANGUAGE } from "@/lib/target-market"
import { getGeminiClient } from "@/utils/gemini/geminiClient"
import {
    MAX_GENERATED_PROMPTS,
    PROMPT_INTENTS,
    type PromptIntentKey,
} from "./prompt-config"
import {
    BUYER_PROMPT_RESPONSE_SCHEMA,
    buildCompanyPrompt,
    type BuyerPromptFamily,
    type PromptBrandContext,
} from "./prompt-template"
import { reviewPromptSet } from "./selection-classifier"
import { isSelectionClass, type SelectionClass } from "./selection-class"
import {
    containsCalendarYear,
    incumbentNeedles,
    mentionsIncumbent,
} from "./prompt-selection"

export {
    DEFAULT_PROMPTS_PER_RUN,
    MAX_GENERATED_PROMPTS,
    MAX_PROMPTS_PER_RUN,
    PROMPT_INTENTS,
    type PromptIntentKey,
} from "./prompt-config"

export interface BuyerPrompt {
    /** Durable subscription identity. Present once the confirmed set is saved. */
    trackedPromptId?: string
    text: string
    textNorm: string
    scopeFamilyId: string
    intent: PromptIntentKey
    articleType: "commercial" | "informational" | "howto"
    selectionClass: SelectionClass
    /** Short generator-owned identity of the underlying buyer situation. */
    scenario?: string
    /**
     * The buyer concern this question belongs to, in the model's words.
     *
     * Replaces the product area as the grouping the report shows. An area was
     * a keyword bucket; a concern is a reason someone went looking, which is
     * what actually differs between two people asking about one capability.
     */
    concern?: string
    /**
     * The verified capability this question is really asking for.
     *
     * Drives the coverage pass: a capability with no question means the run
     * cannot say anything about the brand's visibility for a thing it sells.
     */
    capability?: string
    /** The confirmed seed this prompt was built around — its provenance. */
    sourceSeed: string
}

/**
 * WHERE THE QUESTIONS WENT.
 *
 * A live Drawgle run returned six questions and nobody could say why. Ten
 * sequential gates stand between the model's output and a persisted prompt, and
 * this object was already being computed at the end of them — then discarded by
 * the caller, which kept only `errors`. So "the model returned nine" and "the
 * model returned twenty-four and we shredded eighteen" were indistinguishable,
 * and every proposed fix was a guess.
 *
 * Each field below is one gate. They are counted separately because they fail
 * for unrelated reasons and a single "rejected" total would hide which one is
 * actually doing the damage.
 */
export interface PromptBuildReport {
    callsAttempted: number
    callsSucceeded: number
    familiesCovered: number
    /** Rows the model actually returned, before any gate ran. */
    modelReturned: number
    /** The model returned a selection class that is not one of the allowed keys. */
    unclassifiedRejected: number
    /** Failed the shape test: too short, too long, a URL, mostly punctuation. */
    implausibleRejected: number
    /** Named the customer's own brand, which hands the answer over. */
    namedSubjectRejected: number
    /** Carried a calendar year, which would date a durable question. */
    calendarYearRejected: number
    /** Named a tracked rival, asserting a capability we have not verified. */
    rivalNamedRejected: number
    /** The model gave two questions the same underlying buyer situation. */
    duplicateScenarioRejected: number
    /** Killed by the lexical near-duplicate gate against an earlier keeper. */
    nearDuplicateRejected: number
    /** Survived every local gate and was handed to the critic. */
    generatedCandidates: number
    criticRejected: number
    criticRejectionReasons: Record<string, number>
    /** What finally persisted. The number the customer sees. */
    survivors: number
    /** Wall-clock for the whole build, so a timeout can be predicted not guessed. */
    durationMs: number
    /** Verified capabilities the confirmed set asks about, and how many exist. */
    capabilitiesCovered: number
    capabilitiesTotal: number
    /** Named so a thin set can be explained rather than just counted. */
    uncoveredCapabilities: string[]
    /**
     * The questions the critic threw away, with its reason, capped at ten.
     *
     * Counts told us the critic was the largest remaining gate and nothing
     * told us whether it was right. A rejection reason without the question it
     * rejected cannot be argued with — and this gate is the one making taste
     * judgements ("is this a real chat message or a manufactured search
     * phrase"), which is exactly the kind that needs to be reviewable by a
     * person rather than trusted.
     */
    criticRejectedSamples: Array<{ text: string; reason: string }>
    errors: string[]
}

export interface PromptBuildResult {
    prompts: BuyerPrompt[]
    report: PromptBuildReport
}

interface GeneratedPromptRow {
    question?: unknown
    concern?: unknown
    selectionClass?: unknown
    intent?: unknown
    scenario?: unknown
    capability?: unknown
}

/** Loose equality for matching a returned capability back to the verified list. */
function sameCapability(left: string, right: string): boolean {
    const flat = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "")
    return flat(left) === flat(right)
}

/**
 * Catches MALFORMED output. It is not a brevity rule.
 *
 * The upper bounds used to be 200 characters and 30 words, which fitted the
 * short keyword-shaped questions the generator used to write. Once the
 * instruction started asking who is asking and what limits them, the questions
 * got longer — and a measured run had nine of twenty-five rejected here, with
 * the survivors landing on exactly 30 words. The gate was silently deleting the
 * most specific questions in the set, which are the ones worth measuring:
 * "I'm a backend engineer with no visual design background. What tool can I
 * type my mobile app concept into to get high-fidelity UI screens along with
 * exported CSS variables?" is 30 words and is exactly what a real person types.
 *
 * The new ceiling is set where a chat message stops being one question and
 * becomes a paragraph, not where it stops being terse. What this must still
 * reject is unchanged: empty strings, single words, pasted URLs, markup, and
 * anything mostly punctuation.
 */
function isPlausiblePrompt(text: string): boolean {
    const trimmed = text.trim()
    if (trimmed.length < 15 || trimmed.length > 400) return false
    const words = trimmed.split(/\s+/)
    if (words.length < 4 || words.length > 60) return false
    if (/https?:\/\/|[<>{}]/.test(trimmed)) return false
    const letters = (trimmed.match(/\p{L}/gu) || []).length
    return letters / trimmed.length >= 0.6
}

function namesSubject(text: string, subjectTokens: string[]): boolean {
    const flattened = text.toLowerCase().replace(/[^a-z0-9]/g, "")
    return subjectTokens.some((token) => {
        const needle = token.toLowerCase().replace(/[^a-z0-9]/g, "")
        return needle.length >= 4 && flattened.includes(needle)
    })
}

/**
 * Generates a variable-size, company-wide set of distinct selection questions.
 * It never pads to the subscription allowance. The exact reviewed set is what
 * confirmation persists and each subscription cycle measures.
 */
export async function buildBuyerPrompts(
    families: BuyerPromptFamily[],
    options: {
        subjectType: string
        language?: string
        subjectTokens: string[]
        context?: Omit<PromptBrandContext, "subjectType">
        /** Known rivals are rejection-only and never shown to the generator. */
        rivalBrands?: string[]
        maxPrompts?: number
        questionsToAvoid?: string[]
    },
): Promise<PromptBuildResult> {
    const startedAt = Date.now()
    const errors: string[] = []
    const criticRejectionReasons: Record<string, number> = {}
    const cap = Math.min(options.maxPrompts ?? MAX_GENERATED_PROMPTS, MAX_GENERATED_PROMPTS)
    const placeholderFamilyId = families[0]?.id ?? ""
    const existingQuestions = (options.questionsToAvoid || [])
        .map((question) => question.trim())
        .filter(Boolean)
    const rivalTokens = incumbentNeedles(options.rivalBrands || [])

    /**
     * One generation call, told which questions already exist.
     *
     * Split out so it can run twice. A measured Drawgle-shaped run returned
     * **14** rows against a ceiling of 25 — the model stopped well short of the
     * limit on its own, so the largest single loss was never a gate. It was the
     * model deciding it was finished. Handing the first pass back as "already
     * covered" is what a person does when asked for more: they read what they
     * wrote and think about what is missing.
     */
    const generate = async (
        avoid: string[],
        uncovered: string[] = [],
        // One call's ceiling. The schema refuses more than 25 (see above),
        // so asking for the whole pool in one request is not available.
        ceiling: number = 25,
        concernsInUse: string[] = [],
    ): Promise<GeneratedPromptRow[]> => {
        const client = getGeminiClient()
        const response = await client.models.generateContent({
            model: "gemini-3.7-flash",
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            text: buildCompanyPrompt(
                                {
                                    ...(options.context || {}),
                                    subjectType: options.subjectType,
                                },
                                options.language ?? DEFAULT_LANGUAGE,
                                avoid,
                                ceiling,
                                concernsInUse,
                                uncovered,
                            ),
                        },
                    ],
                },
            ],
            config: {
                // Raised from 0.4. The job is to produce many genuinely
                // different buyer situations, and 0.4 is a setting for
                // reproducing the most probable phrasing — which is how a set
                // ends up as variations on "best tool for X". The quality floor
                // is held by the gates below and the critic, not by sampling
                // conservatively enough to avoid needing them.
                temperature: 0.9,
                responseMimeType: "application/json",
                responseSchema: BUYER_PROMPT_RESPONSE_SCHEMA,
            },
        })
        const parsed = JSON.parse(response.text || "{}") as { prompts?: GeneratedPromptRow[] }
        return Array.isArray(parsed.prompts) ? parsed.prompts : []
    }

    const candidates: BuyerPrompt[] = []
    let uncoveredCapabilities: string[] = []
    let capabilitiesTotal = 0
    let capabilitiesCovered = 0
    // Every gate keeps its own tally. Lumping them into one "rejected" count is
    // what made the six-question run undiagnosable.
    let unclassifiedRejected = 0
    let implausibleRejected = 0
    let namedSubjectRejected = 0
    let calendarYearRejected = 0
    let rivalNamedRejected = 0
    let duplicateScenarioRejected = 0
    let nearDuplicateRejected = 0
    const seenScenarios = new Set<string>()

    const absorb = (rows: GeneratedPromptRow[]) => {
    for (const row of rows) {
        const text = String(row.question ?? "").trim()
        const concern = String(row.concern ?? "").trim()
        const scenario = String(row.scenario ?? "").trim()
        const selectionClass = row.selectionClass

        if (!isSelectionClass(selectionClass)) {
            unclassifiedRejected++
            continue
        }
        if (!isPlausiblePrompt(text)) {
            implausibleRejected++
            continue
        }
        if (namesSubject(text, options.subjectTokens)) {
            namedSubjectRejected++
            continue
        }
        if (containsCalendarYear(text)) {
            calendarYearRejected++
            continue
        }
        if (mentionsIncumbent(text, rivalTokens)) {
            rivalNamedRejected++
            continue
        }

        const scenarioNorm = normalizeQuery(scenario)
        if (!scenarioNorm || seenScenarios.has(scenarioNorm)) {
            duplicateScenarioRejected++
            continue
        }
        // THE MODEL LABELS ITS OWN QUESTION.
        //
        // This was `inferPromptIntent`, a regex that read the finished text and
        // guessed. Its `recommendation` branch matched almost any question
        // containing "what/which ... tool", and its fallback was also
        // `recommendation`, so a measured set of 31 distinct questions came
        // back 24 of them `recommendation` — a label carrying no information,
        // printed on the dashboard as though it did. The generator wrote the
        // question, holds the brand context, and returns the class and the
        // scenario in the same object; the label belongs there.
        const intentConfig =
            PROMPT_INTENTS.find((entry) => entry.key === String(row.intent ?? "").trim()) ??
            PROMPT_INTENTS[0]

        candidates.push({
            text,
            textNorm: normalizeQuery(text),
            // NOT NULL on `ai_probe_prompts` and `tracked_prompts`, and nothing
            // reads it any more: capability binding searches every confirmed
            // contract, and the planner groups on the bound operation. It is
            // written so the insert succeeds and will be dropped by the
            // migration that retires scope families.
            scopeFamilyId: placeholderFamilyId,
            concern,
            intent: intentConfig.key,
            articleType: intentConfig.articleType,
            selectionClass,
            scenario,
            capability: String(row.capability ?? "").trim() || undefined,
            // The capability the model named, not a keyword lifted off an area.
            // Downstream this is what a question is really "about".
            sourceSeed: String(row.capability ?? "").trim() || concern,
        })
        seenScenarios.add(scenarioNorm)
    }
    }

    /**
     * GENERATE PAST THE TARGET ON PURPOSE.
     *
     * The cap used to stop the candidate loop at 25, and the critic then removed
     * roughly a third — so a target of 25 delivered 16 and could never deliver
     * 25 by construction. The critic's cut has to come out of surplus, not out
     * of the deliverable. Measured critic loss runs around 30%, so a 40% margin
     * lands on target without asking the model to pad.
     */
    const candidateTarget = Math.ceil(cap * 1.4)

    let passes = 0
    let modelReturned = 0
    try {
        // SEQUENTIAL, SO THE SECOND CALL CAN SEE THE FIRST.
        //
        // These ran in parallel to halve wall clock, and it cost more than it
        // saved. Neither call could see the other's buyer concerns, so both
        // invented their own labels for the same concern — a measured run
        // produced nineteen concerns for twenty-five questions, five of which
        // ("avoiding destructive regenerations", "frustration with full
        // regeneration", "keeping control over edits"…) were one concern under
        // five names. The per-concern limit is what stops rephrasings, and it
        // cannot bind across calls that do not share a list.
        //
        // Running them in sequence costs about thirteen seconds against a 300s
        // budget the whole build now uses forty of. That is the cheapest thing
        // here to spend.
        const first = await generate(existingQuestions)
        passes++
        modelReturned += first.length
        absorb(first)

        const second = await generate(
            [...existingQuestions, ...candidates.map((candidate) => candidate.text)],
            [],
            25,
            // The concerns the first call settled on. Without these it coins a
            // synonym for each and the per-concern limit stops binding.
            [
                ...new Set(
                    candidates
                        .map((candidate) => candidate.concern)
                        .filter((concern): concern is string => Boolean(concern)),
                ),
            ],
        )
        passes++
        modelReturned += second.length
        absorb(second)

        // Only if the pair genuinely fell short, and only once. This is the
        // sequential case, so it is told what already exists: it is asking for
        // what is missing rather than rolling the dice a third time.
        if (candidates.length < candidateTarget) {
            const third = await generate([
                ...existingQuestions,
                ...candidates.map((candidate) => candidate.text),
            ])
            passes++
            modelReturned += third.length
            absorb(third)
        }

        // ── Coverage: does the set ask about everything the brand sells? ──
        //
        // The founder's complaint in its positive form. A question set that
        // never touches half a product's capabilities cannot measure that
        // product's visibility, and no gate can fix that by rejecting things —
        // the missing questions have to be asked for.
        const verified = (options.context?.coreFeatures || []).filter(Boolean)
        if (verified.length > 0) {
            const covered = candidates
                .map((candidate) => candidate.capability)
                .filter((value): value is string => Boolean(value))
            uncoveredCapabilities = verified.filter(
                (capability) =>
                    !covered.some((claimed) => sameCapability(claimed, capability)),
            )
            if (uncoveredCapabilities.length > 0) {
                const rows = await generate(
                    [...existingQuestions, ...candidates.map((candidate) => candidate.text)],
                    uncoveredCapabilities,
                    // One or two questions per gap is all this pass is for.
                    Math.max(uncoveredCapabilities.length * 2, 4),
                )
                passes++
                modelReturned += rows.length
                absorb(rows)
                const nowCovered = candidates
                    .map((candidate) => candidate.capability)
                    .filter((value): value is string => Boolean(value))
                uncoveredCapabilities = verified.filter(
                    (capability) =>
                        !nowCovered.some((claimed) => sameCapability(claimed, capability)),
                )
            }
            capabilitiesTotal = verified.length
            capabilitiesCovered = verified.length - uncoveredCapabilities.length
        }
    } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error))
    }

    let criticRejected = 0
    const criticRejectedSamples: Array<{ text: string; reason: string }> = []
    let survivors = candidates
    if (candidates.length > 0) {
        const { reviews, error } = await reviewPromptSet(
            candidates.map((candidate) => candidate.text),
        )
        if (error) errors.push(`prompt critic failed — ${error}`)

        const reviewByText = new Map(reviews.map((row) => [row.text, row]))
        survivors = []
        for (const candidate of candidates) {
            const review = reviewByText.get(candidate.text)
            if (!review?.accepted) {
                criticRejected++
                const reason = review?.rejectionReason ?? "invalid_critic_response"
                criticRejectionReasons[reason] = (criticRejectionReasons[reason] ?? 0) + 1
                if (criticRejectedSamples.length < 10) {
                    criticRejectedSamples.push({ text: candidate.text, reason })
                }
                continue
            }
            survivors.push(candidate)
        }
    }

    // THE CAP APPLIES HERE, to what the customer actually receives, rather than
    // to what the critic was allowed to look at.
    if (survivors.length > cap) survivors = survivors.slice(0, cap)

    if (modelReturned === 0) errors.push("model returned no prompt candidates")
    if (candidates.length > 0 && survivors.length === 0) {
        errors.push("every generated question was rejected by the selection judge")
    }

    return {
        prompts: survivors,
        report: {
            callsAttempted: passes,
            callsSucceeded: modelReturned > 0 ? passes : 0,
            familiesCovered: new Set(survivors.map((prompt) => prompt.scopeFamilyId)).size,
            modelReturned,
            unclassifiedRejected,
            implausibleRejected,
            namedSubjectRejected,
            calendarYearRejected,
            rivalNamedRejected,
            duplicateScenarioRejected,
            nearDuplicateRejected,
            generatedCandidates: candidates.length,
            criticRejected,
            criticRejectionReasons,
            survivors: survivors.length,
            durationMs: Date.now() - startedAt,
            capabilitiesCovered,
            capabilitiesTotal,
            uncoveredCapabilities,
            criticRejectedSamples,
            errors: errors.slice(0, 5),
        },
    }
}
