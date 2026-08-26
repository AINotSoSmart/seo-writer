/**
 * Pure input contract and prompt text for buyer-question generation.
 *
 * Kept separate from `prompt-builder.ts`, which owns the Gemini call, so the
 * production instruction remains directly testable without a server client.
 */

import { languageName } from "../target-market.ts"
import { getCurrentDateContext } from "../utils/date-context.ts"
import { BRINGBACK_CALIBRATION } from "./selection-calibration-set.ts"
import { PROMPT_INTENTS } from "./prompt-config.ts"
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

/**
 * THE BOUNDARY, TAUGHT ONLY BY WHAT FAILS IT.
 *
 * This block used to carry the calibration positives as well. Counting them
 * explains the Drawgle complaint: 13 of the 16 positives contain "best",
 * "which", "what tool" or "what app", and only 3 of 16 open from a person or a
 * situation. So while the instruction above asked for variety in how buyers
 * speak, the examples underneath it demonstrated one sentence shape sixteen
 * times — and a model copies the form of an example far more reliably than it
 * follows a sentence telling it not to.
 *
 * The negatives do the whole job this block exists for. Their purpose is to
 * mark where a selection event stops and a tutorial begins, and a tutorial is
 * precisely what they are. They also cannot anchor the output form, because the
 * model is being told not to write them.
 *
 * The positives are untouched in `selection-calibration-set.ts`. They are
 * founder-reviewed labels for `POST /api/visibility/calibrate-prompts`, which
 * checks the critic against both populations. They were never meant to be a
 * style guide; that was a second job they picked up by being in this string.
 */
function exampleBlock(): string {
    return BRINGBACK_CALIBRATION.negatives
        .map((question) => `REJECT — ${question}`)
        .join("\n")
}

/**
 * One prompt for the whole company.
 *
 * ## Why the product leads and the areas trail
 *
 * The areas come from `scope-extraction.ts`, which asks for "the SEARCH MARKETS
 * this business competes in" and names each one the way a customer would type
 * it *into Google*. They are keyword clusters. When they were the first
 * concrete block in this instruction and every question had to belong to one,
 * the generator did the obvious thing: it expanded head terms. A live Drawgle
 * run produced six questions, nearly all shaped "best <keyword> for <person>",
 * and a narrow area — "Screenshot to Editable mobile app UI" — yielded exactly
 * one.
 *
 * So the company, its capabilities and its buyers now come first, the areas are
 * demoted to labels applied after the question exists, and the instruction says
 * out loud that area wording must not become question wording.
 *
 * ## Why the anti-padding rule survived that change
 *
 * Because it is not the cause. A previous version handed the model per-family
 * quotas and sentence formulas and got exactly what formulas produce. The fix
 * for under-generation is a breadth frame — who is asking, what limits them,
 * what they start from — not a number to hit. The one sentence removed was the
 * one that praised "9 distinct questions", because naming a low number as the
 * good outcome anchors the model to it.
 */
export function buildCompanyPrompt(
    families: BuyerPromptFamily[],
    context: PromptBrandContext,
    language: string,
    questionsToAvoid: string[] = [],
    /**
     * Capabilities the set does not cover yet.
     *
     * Present only on the final coverage pass. This is the whole point of the
     * generator — a question set for a product that never asks about half of
     * what the product does is not measuring that product's visibility — and it
     * is handled by ASKING FOR MORE rather than by rejecting what came back.
     */
    uncoveredCapabilities: string[] = [],
): string {
    const features = (context.coreFeatures || []).filter(Boolean).slice(0, 8)
    const uncovered = uncoveredCapabilities.filter(Boolean)
    const intents = PROMPT_INTENTS.map(
        (entry) => `- ${entry.key}: ${entry.label}`,
    ).join("\n")
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
WHO IS ASKING
Before each question, settle four things about the person typing it:
- who they are, and how much skill they have
- what they already tried, or already pay for
- the constraint that actually decides it for them
- what they are holding right now, before any tool touches it

These four decide WHICH question gets asked. They are not required to appear in it. Most people do not introduce themselves to a chatbot — they type the shortest thing that gets them an answer, and the situation only shows up when it changes what they need. A question that states all four is a profile, not a question.

Different answers to those four make DIFFERENT questions, even about the same capability. Two people who want the same outcome under different constraints get recommended different things. That difference is the thing being measured.

COVER THE RANGE
Keep moving along these axes across the set instead of settling on one:
- how far along they are: has not realised a tool exists, weighing a field of options, replacing something that disappoints them, checking one specific requirement before committing
- what limits them: no budget, no skill in this area, a deadline, a team convention, something it has to fit alongside
- what they start from: only an idea, a written spec, a rough draft, an existing thing they want changed
- what they need out: the finished result, one specific part of it, or something they have to hand to someone else

CONFIRMED PRODUCT AREAS
${areas}

Generate questions across the company as a whole, then tag each with the area its need belongs to. The areas are labels for grouping results afterwards, NOT the subjects to write about. Do not walk down the list producing questions area by area, and never let an area's own wording become the question's wording — those phrases were written for a search engine, and a person describing their problem does not talk that way.

Each question must have one primary problem. Do not bundle several product areas into an all-in-one software request.

${
        uncovered.length
            ? `THESE CAPABILITIES HAVE NO QUESTION YET
Every question you return in this pass must be about one of these, because nothing in the set so far would make an assistant recommend the company for them:
${uncovered.map((capability) => `- ${capability}`).join("\n")}

`
            : ""
}Generate up to 25 questions. This is a ceiling, not a quota. Stop when another question would only paraphrase a situation already covered, and never pad: a question that restates a situation already in the set is worse than one you did not write. Within that rule, keep going while genuinely different buyer situations remain — most companies have far more of them than first come to mind.

LENGTH IS PART OF THE VARIETY. Real chat messages are wildly uneven: plenty are five to ten words with no context at all, some are one line, a few run long because the situation genuinely matters. Write that spread. If every question in your set is a full sentence of background followed by "what tool can...", you have written one question twenty-five times.

Vary the form too. Some name the constraint and nothing else. Some ask what other people in their position use. Some ask whether the thing they want can be bought at all. Some are a bare noun phrase with a question mark. Do not turn the set into repeated "best tool for X" keyword phrases, and do not turn it into repeated "I am a X who needs Y" preambles either — both are formulas, and a formula is visible in the output no matter which one it is. If more than two questions open with the same two words, rewrite them.

Every question below was rejected for the same reason: an assistant answers it with technique and names no product, so the company's absence from that answer proves nothing. They come from one photo-product case. Learn only the boundary they mark: never copy its industry, people, objects, vocabulary, or capabilities unless they are genuinely present in the company above, and never treat their phrasing as a template for yours.

${exampleBlock()}

Allowed selection classes:
${wantedClasses}

Allowed intents — what kind of answer the person wants:
${intents}

Rules:
- Never name this company, a competitor, or any website. The measurement tests what the assistant recommends unprompted.
- Every requested outcome must be explicitly supported by the verified capabilities. Do not broaden a capability or add an adjacent one: for example, motion does not imply speech, restoration does not imply manual editing, and combining photos does not imply generating new people.
- Use ordinary chat language, not review-site language such as market rankings, trend claims, or claims about what is "currently considered" top-rated.
- Do not include calendar years; these questions are rerun over time.
- "scenario" is a short description of the underlying buyer situation. Two differently worded questions with the same scenario are duplicates, so keep only one. Two questions that share a capability but differ in who is asking, what limits them, or what they start from are NOT duplicates.
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
- intent: one allowed intent, judged from the question you just wrote
- scenario: the distinct underlying buyer situation
- capability: the one verified capability from the list above that this question is really asking for, copied exactly`
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
                    intent: { type: "STRING" as const },
                    scenario: { type: "STRING" as const },
                    capability: { type: "STRING" as const },
                },
                required: [
                    "question",
                    "scopeFamilyId",
                    "selectionClass",
                    "intent",
                    "scenario",
                    "capability",
                ],
            },
        },
    },
    required: ["prompts"],
}
