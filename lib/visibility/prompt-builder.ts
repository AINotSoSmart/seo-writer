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
    inferPromptIntent,
    mentionsIncumbent,
    promptsAreNearDuplicates,
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
    /** The confirmed seed this prompt was built around — its provenance. */
    sourceSeed: string
}

export interface PromptBuildReport {
    callsAttempted: number
    callsSucceeded: number
    familiesCovered: number
    generatedCandidates: number
    rivalNamedRejected: number
    criticRejected: number
    criticRejectionReasons: Record<string, number>
    errors: string[]
}

export interface PromptBuildResult {
    prompts: BuyerPrompt[]
    report: PromptBuildReport
}

interface GeneratedPromptRow {
    question?: unknown
    scopeFamilyId?: unknown
    selectionClass?: unknown
    scenario?: unknown
}

function isPlausiblePrompt(text: string): boolean {
    const trimmed = text.trim()
    if (trimmed.length < 15 || trimmed.length > 200) return false
    const words = trimmed.split(/\s+/)
    if (words.length < 4 || words.length > 30) return false
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
    const errors: string[] = []
    const criticRejectionReasons: Record<string, number> = {}
    const cap = Math.min(options.maxPrompts ?? MAX_GENERATED_PROMPTS, MAX_GENERATED_PROMPTS)
    const familyById = new Map(families.map((family) => [family.id, family]))
    const existingQuestions = (options.questionsToAvoid || [])
        .map((question) => question.trim())
        .filter(Boolean)
    const rivalTokens = incumbentNeedles(options.rivalBrands || [])

    let parsedRows: GeneratedPromptRow[] = []
    try {
        const client = getGeminiClient()
        const response = await client.models.generateContent({
            model: "gemini-3.7-flash",
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            text: buildCompanyPrompt(
                                families,
                                {
                                    ...(options.context || {}),
                                    subjectType: options.subjectType,
                                },
                                options.language ?? DEFAULT_LANGUAGE,
                                existingQuestions,
                            ),
                        },
                    ],
                },
            ],
            config: {
                temperature: 0.4,
                responseMimeType: "application/json",
                responseSchema: BUYER_PROMPT_RESPONSE_SCHEMA,
            },
        })
        const parsed = JSON.parse(response.text || "{}") as { prompts?: GeneratedPromptRow[] }
        parsedRows = Array.isArray(parsed.prompts) ? parsed.prompts : []
    } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error))
    }

    const candidates: BuyerPrompt[] = []
    let rivalNamedRejected = 0
    const seenScenarios = new Set<string>()

    for (const row of parsedRows) {
        const text = String(row.question ?? "").trim()
        const scopeFamilyId = String(row.scopeFamilyId ?? "").trim()
        const scenario = String(row.scenario ?? "").trim()
        const selectionClass = row.selectionClass
        const family = familyById.get(scopeFamilyId)

        if (
            !family ||
            !isSelectionClass(selectionClass) ||
            !isPlausiblePrompt(text) ||
            namesSubject(text, options.subjectTokens) ||
            containsCalendarYear(text)
        ) {
            continue
        }
        if (mentionsIncumbent(text, rivalTokens)) {
            rivalNamedRejected++
            continue
        }

        const scenarioNorm = normalizeQuery(scenario)
        if (!scenarioNorm || seenScenarios.has(scenarioNorm)) continue
        if (
            [...existingQuestions, ...candidates.map((candidate) => candidate.text)].some(
                (question) => promptsAreNearDuplicates(question, text),
            )
        ) {
            continue
        }

        const intent = inferPromptIntent(text, "recommendation")
        const intentConfig = PROMPT_INTENTS.find((entry) => entry.key === intent)!
        candidates.push({
            text,
            textNorm: normalizeQuery(text),
            scopeFamilyId,
            intent,
            articleType: intentConfig.articleType,
            selectionClass,
            scenario,
            sourceSeed: family.seedKeywords[0] ?? family.name,
        })
        seenScenarios.add(scenarioNorm)
        if (candidates.length >= cap) break
    }

    let criticRejected = 0
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
                continue
            }
            survivors.push(candidate)
        }
    }

    if (parsedRows.length === 0) errors.push("model returned no prompt candidates")
    if (candidates.length > 0 && survivors.length === 0) {
        errors.push("every generated question was rejected by the selection judge")
    }

    return {
        prompts: survivors,
        report: {
            callsAttempted: 1,
            callsSucceeded: parsedRows.length > 0 ? 1 : 0,
            familiesCovered: new Set(survivors.map((prompt) => prompt.scopeFamilyId)).size,
            generatedCandidates: candidates.length,
            rivalNamedRejected,
            criticRejected,
            criticRejectionReasons,
            errors: errors.slice(0, 5),
        },
    }
}
