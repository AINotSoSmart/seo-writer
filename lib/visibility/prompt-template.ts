/**
 * Pure input contract and prompt text for buyer-question generation.
 *
 * Kept separate from `prompt-builder.ts`, which owns Gemini calls and retries,
 * so the exact production instruction can be exercised by contract tests and
 * the live verification script without importing a server client.
 */

import { languageName } from "../target-market.ts"
import { getCurrentDateContext } from "../utils/date-context.ts"
import { PROMPT_INTENTS, PROMPTS_PER_FAMILY } from "./prompt-config.ts"
import { MAX_INCUMBENT_PROMPT_SHARE } from "./prompt-selection.ts"

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
    /** Tools these buyers already use; comparative context, not a required form. */
    incumbents?: string[]
}

export function buildFamilyPrompt(
    family: BuyerPromptFamily,
    context: PromptBrandContext,
    language: string,
    questionsToAvoid: string[] = [],
): string {
    const features = (context.coreFeatures || []).filter(Boolean).slice(0, 8)
    const incumbents = (context.incumbents || []).filter(Boolean).slice(0, 6)
    const intents = PROMPT_INTENTS.map((intent) => `- ${intent.key}: ${intent.label}`).join("\n")

    const priorQuestions = questionsToAvoid.filter(Boolean).slice(-40)
    const maxNamedIncumbents = Math.floor(PROMPTS_PER_FAMILY * MAX_INCUMBENT_PROMPT_SHARE)
    const minUnnamed = PROMPTS_PER_FAMILY - maxNamedIncumbents

    return `${getCurrentDateContext()}

Below is a real product. Write the questions real people actually type into ChatGPT when they have the problem it solves — before they know this product, or any product, exists. The real users use messy, direct, functional language. Users search relative to dominant market leaders they already use.

THE PRODUCT
It is: ${context.subjectType}
${context.category ? `Category: ${context.category}\n` : ""}This part of it: ${family.name} — ${family.description}
The customer's own words for it: ${family.seedKeywords.join(", ")}
${features.length ? `What it does:\n${features.map((feature) => `- ${feature}`).join("\n")}\n` : ""}${context.audience ? `Who has this problem: ${context.audience}\n` : ""}${incumbents.length ? `Tools some of them already use: ${incumbents.join(", ")}\n` : ""}
Write ${PROMPTS_PER_FAMILY} questions someone would type about the problem this part solves.

Background, not instructions: the last two lines are there so you know whose situation to write from and what they might already have tried. People describe what they are working on, not what category of person they are — so do not have anyone announce themselves. At least ${minUnnamed} of the ${PROMPTS_PER_FAMILY} questions must name no product at all; a named tool is allowed only where that is genuinely how someone would put it.

${
    priorQuestions.length
        ? `Questions already kept for other parts of this product:
${priorQuestions.map((question) => `- ${question}`).join("\n")}
Do not restate the same buyer need with different wording. This part must add distinct questions.

`
        : ""
}Two rules, both about measurement rather than style:
- Never name this product or its website. These questions test whether an assistant recommends it unprompted, and naming it hands over the answer.
- Stay inside the part described above. A question about an adjacent problem measures a business this is not.
- Do not put a calendar year in a question. These questions are persisted and rerun, so year-stamped wording becomes false and stale.
- Do not invent technical mechanisms, capabilities, or product functions that are not present in the product description above.

Label each question with the situation it comes from:
${intents}

Write them in ${languageName(language)}.`
}

export const BUYER_PROMPT_RESPONSE_SCHEMA = {
    type: "OBJECT" as const,
    properties: {
        prompts: {
            type: "ARRAY" as const,
            items: {
                type: "OBJECT" as const,
                properties: {
                    text: { type: "STRING" as const },
                    intent: { type: "STRING" as const },
                },
                required: ["text", "intent"],
            },
        },
    },
    required: ["prompts"],
}
