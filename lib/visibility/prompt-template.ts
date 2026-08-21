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
    /**
     * There is deliberately no `incumbents` field.
     *
     * Rival names used to be handed to the model as "tools some of them already
     * use", and up to 15% of the set was allowed to name one. Both are gone —
     * see the naming rule in the instruction below. Rivals now reach the builder
     * as a rejection list only (`rivalBrands` in `buildBuyerPrompts`), never as
     * context, so the model cannot be led into writing them.
     */
}

export function buildFamilyPrompt(
    family: BuyerPromptFamily,
    context: PromptBrandContext,
    language: string,
    questionsToAvoid: string[] = [],
): string {
    const features = (context.coreFeatures || []).filter(Boolean).slice(0, 8)
    const intents = PROMPT_INTENTS.map((intent) => `- ${intent.key}: ${intent.label}`).join("\n")

    const classes = SELECTION_CLASSES.map(
        (entry) =>
            `- ${entry.key}${entry.countsAsSelection ? " (WANTED)" : " (avoid)"}: ${entry.label} — e.g. "${entry.example}"`,
    ).join("\n")

    const priorQuestions = questionsToAvoid.filter(Boolean).slice(-40)

    return `${getCurrentDateContext()}

Below is a real product. Write the questions real people type into ChatGPT **at the moment they are deciding what to use**. The real users use messy, direct, functional language.

THE ONE TEST EVERY QUESTION MUST PASS
A good answer to your question must have to NAME PRODUCTS. Ask yourself: could an assistant answer this completely and helpfully without recommending any tool, app or service? If yes, the question is useless here — throw it away and write a different one.

"how do I remove scratches from a scanned photo" fails: the answer is technique — scan at high resolution, use a healing brush. No product gets named, so it measures nothing.
"what can I actually use to fix a badly scratched photo of my grandfather" passes: the answer has to be a list of tools.

Write from the moment AFTER someone knows the outcome is possible and is now choosing between options — not the moment before they know anything exists.

THE PRODUCT
It is: ${context.subjectType}
${context.category ? `Category: ${context.category}\n` : ""}This part of it: ${family.name} — ${family.description}
The customer's own words for it: ${family.seedKeywords.join(", ")}
${features.length ? `What it does:\n${features.map((feature) => `- ${feature}`).join("\n")}\n` : ""}${context.audience ? `Who has this problem: ${context.audience}\n` : ""}
Write ${PROMPTS_PER_FAMILY} questions someone would type about the problem this part solves.

Background, not instructions: the audience line is there so you know whose situation to write from. People describe what they are working on, not what category of person they are — so do not have anyone announce themselves.

${
    priorQuestions.length
        ? `Questions already kept for other parts of this product:
${priorQuestions.map((question) => `- ${question}`).join("\n")}
Do not restate the same buyer need with different wording. This part must add distinct questions.

`
        : ""
}Rules, all about measurement rather than style:
- Never name ANY product, brand, company or website — not this product, and not a competitor. These questions test what an assistant recommends unprompted. Naming anything hands over part of the answer: the assistant will discuss the tool you named, and whatever it says afterwards measures your question rather than the market.
- Write about the problem and the outcome, never about a named tool. "what can fix cracks in a scanned photo without making faces look plastic" is a real question; "is X good for fixing cracks" is not, it is a survey about X.
- The strongest questions carry a real situation and its constraints, then ask for the pick: "my grandparents died before my children were born — what AI tool can make a realistic portrait of them together from separate photos". Write as many of these as the product areas honestly support.
- These are chat messages, not search keywords. Nobody types "best AI family portrait generator 2026" into a chat box. Context, then problem, then what should I use.
- Stay inside the part described above. A question about an adjacent problem measures a business this is not.
- Do not put a calendar year in a question. These questions are persisted and rerun, so year-stamped wording becomes false and stale.
- Do not invent technical mechanisms, capabilities, or product functions that are not present in the product description above.

Label each question twice.

1. "intent" — the situation it comes from:
${intents}

2. "selectionClass" — how strongly it forces the assistant to choose between products. The four marked WANTED are the point of this exercise; the three marked avoid produce answers that name nothing:
${classes}

Aim for every question to be a WANTED class. If a question you were about to write can only be labelled with an "avoid" class, replace it with a different one.

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
                    selectionClass: { type: "STRING" as const },
                },
                required: ["text", "intent", "selectionClass"],
            },
        },
    },
    required: ["prompts"],
}
