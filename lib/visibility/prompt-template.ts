/**
 * Pure input contract and prompt text for buyer-question generation.
 *
 * Kept separate from `prompt-builder.ts`, which owns the Gemini call, so the
 * production instruction remains directly testable without a server client.
 */

import { languageName } from "../target-market.ts"
import { getCurrentDateContext } from "../utils/date-context.ts"
import { BRINGBACK_CALIBRATION } from "./selection-calibration-set.ts"
import { SELECTION_CLASSES } from "./selection-class.ts"

/** Only the confirmed fields question generation actually reads. */
export interface BuyerPromptFamily {
    id: string
    name: string
    description: string
    seedKeywords: string[]
}

export interface PromptBrandContext {
    /** Plain description of the product — "browser tool that restores old photos". */
    subjectType: string
    /** The category the customer confirmed, in their words. */
    category?: string
    /** What it actually does, a few concrete capabilities. */
    coreFeatures?: string[]
    /** Who has the problem. Background for situations, never a label to quote. */
    audience?: string
}

function exampleBlock(): string {
    const accepted = BRINGBACK_CALIBRATION.positives
        .map((question) => `ACCEPT — ${question}`)
        .join("\n")
    const rejected = BRINGBACK_CALIBRATION.negatives
        .map((question) => `REJECT — ${question}`)
        .join("\n")
    return `${accepted}\n${rejected}`
}

/**
 * One prompt for the whole company. Product areas remain explicit ownership
 * choices, but they no longer receive equal quotas that force narrow areas to
 * manufacture filler.
 */
export function buildCompanyPrompt(
    families: BuyerPromptFamily[],
    context: PromptBrandContext,
    language: string,
    questionsToAvoid: string[] = [],
): string {
    const features = (context.coreFeatures || []).filter(Boolean).slice(0, 8)
    const priorQuestions = questionsToAvoid.filter(Boolean).slice(-60)
    const wantedClasses = SELECTION_CLASSES.filter((entry) => entry.countsAsSelection)
        .map((entry) => `- ${entry.key}: ${entry.label} — e.g. "${entry.example}"`)
        .join("\n")
    const areas = families
        .map(
            (family) => `- id: ${family.id}
  name: ${family.name}
  description: ${family.description}
  customer wording: ${family.seedKeywords.join(", ")}`,
        )
        .join("\n")

    return `${getCurrentDateContext()}

Generate natural questions that real people would type into ChatGPT or Gemini when they have a problem this company can solve and are trying to FIND OR CHOOSE a solution.

This is an AI recommendation measurement. Every question must create a real selection event: a useful answer should naturally need to name external products, tools, apps, services, or providers. If an assistant can answer completely with general knowledge, an explanation, or step-by-step technique, do not include that question.

THE COMPANY
It is: ${context.subjectType}
${context.category ? `Category: ${context.category}\n` : ""}${features.length ? `Verified capabilities:\n${features.map((feature) => `- ${feature}`).join("\n")}\n` : ""}${context.audience ? `People with this problem: ${context.audience}\n` : ""}
CONFIRMED PRODUCT AREAS
${areas}

Generate questions across the company as a whole. Broad areas may receive more questions than narrow areas. Every question must use exactly one confirmed area id, and its need must genuinely belong to that area.

Each question must have one primary problem from one area. Do not bundle several product areas into an all-in-one software request.

Generate up to 25 questions. This is a ceiling, not a quota. Stop when another question would only paraphrase a situation already covered. Returning 9 distinct questions is better than returning 25 padded ones.

Vary how real buyers speak. Some describe a personal or business situation, some name a constraint, some ask what others use, and some ask whether a suitable solution exists. Do not turn the set into repeated "best tool for X" keyword phrases.

The examples below teach the boundary between a selection event and a tutorial. They come from one photo-product calibration case. Learn the distinction only: never copy its industry, people, objects, vocabulary, or capabilities unless they are genuinely present in the company above.

${exampleBlock()}

Allowed selection classes:
${wantedClasses}

Rules:
- Never name this company, a competitor, or any website. The measurement tests what the assistant recommends unprompted.
- Every requested outcome must be explicitly supported by the verified capabilities. Do not broaden a capability or add an adjacent one: for example, motion does not imply speech, restoration does not imply manual editing, and combining photos does not imply generating new people.
- Use ordinary chat language, not review-site language such as market rankings, trend claims, or claims about what is "currently considered" top-rated.
- Do not include calendar years; these questions are rerun over time.
- "scenario" is a short description of the underlying buyer situation. Two differently worded questions with the same scenario are duplicates, so keep only one.
- Write in ${languageName(language)}.
${
        priorQuestions.length
            ? `- Do not repeat or paraphrase these already-retained questions:\n${priorQuestions.map((question) => `  - ${question}`).join("\n")}\n`
            : ""
}
For each result return:
- question: the exact natural chat message
- scopeFamilyId: one exact id from the confirmed product areas
- selectionClass: one allowed selection class
- scenario: the distinct underlying buyer situation`
}

export const BUYER_PROMPT_RESPONSE_SCHEMA = {
    type: "OBJECT" as const,
    properties: {
        prompts: {
            type: "ARRAY" as const,
            maxItems: 25,
            items: {
                type: "OBJECT" as const,
                properties: {
                    question: { type: "STRING" as const },
                    scopeFamilyId: { type: "STRING" as const },
                    selectionClass: { type: "STRING" as const },
                    scenario: { type: "STRING" as const },
                },
                required: ["question", "scopeFamilyId", "selectionClass", "scenario"],
            },
        },
    },
    required: ["prompts"],
}
