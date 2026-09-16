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

/**
 * Everything the generator is told about the company.
 *
 * It used to be four fields — subject, category, capabilities, audience — while
 * brand analysis extracts eleven. The five below were being thrown away, and
 * they are the ones that produce *concerns* rather than features:
 *
 *   `enemy`      the problem this product exists to fight, which is the same
 *                thing as the reason a person starts looking
 *   `notThis`    what it is deliberately not — every "not" implies someone who
 *                tried that other thing and found it wanting
 *   `uvp`        distinct reasons to choose, each a different buyer
 *   `pricing`    makes budget-shaped concerns possible; there were none at all
 *   `audiencePsychology`  what the buyer is actually worried about
 *
 * Without them the model can only derive concerns from the feature list, so it
 * returns one concern per feature and rephrases within each. A measured Drawgle
 * run supported about eighteen genuinely distinct questions on four fields.
 */
export interface PromptBrandContext {
    /** Plain description of the product — "browser tool that restores old photos". */
    subjectType: string
    /** The category the customer confirmed, in their words. */
    category?: string
    /** What it actually does, a few concrete capabilities. */
    coreFeatures?: string[]
    /** Who has the problem. Background for situations, never a label to quote. */
    audience?: string
    /** The buyer's own worry, in the analyst's words. */
    audiencePsychology?: string
    /** The problems the product exists to fight. An ARRAY in brand_data. */
    enemy?: string[]
    /** What the product is deliberately distinct from. */
    notThis?: string
    /** Permanent selling points — reasons to pick this over the alternative. */
    uvp?: string[]
    /** Real plan lines, so cost-shaped situations can exist. */
    pricing?: string[]
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
 * One prompt for the whole company, organised by BUYER CONCERN.
 *
 * ## Why the product areas are gone
 *
 * They came from `scope-extraction.ts`, which asks for "the SEARCH MARKETS this
 * business competes in" and names each the way a customer would type it *into
 * Google*. They are keyword head terms, and they were the first concrete block
 * in this instruction, with every question required to carry one.
 *
 * The previous pass demoted them in wording — "labels for grouping results
 * afterwards, NOT the subjects to write about" — and it did not work. A live
 * Drawgle run came back 8/7/5/5 across four areas, suspiciously even, and five
 * of the questions in one area were five phrasings of "where can I find
 * templates I can fork and restyle". A structured list in the prompt beats a
 * sentence telling the model to ignore it.
 *
 * Asking for questions per feature bucket returns rephrasings of the bucket.
 * Asking for questions per buyer concern returns different angles, because the
 * concerns are what differ between people. "Granular element editing" is not a
 * search market; it is a reason someone goes looking, and it cuts across every
 * area this product has.
 *
 * Nothing downstream lost anything. Areas were routing questions to a
 * capability contract, and the generator now names the `capability` directly —
 * see `prompt-builder.ts`. `scope_family_id` is still written because the
 * column is NOT NULL; it no longer influences a single decision.
 */
export function buildCompanyPrompt(
    context: PromptBrandContext,
    language: string,
    questionsToAvoid: string[] = [],
    ceiling: number = 25,
    concernsInUse: string[] = [],
): string {
    const enemies = (context.enemy || []).filter(Boolean).slice(0, 5)
    const uvps = (context.uvp || []).filter(Boolean).slice(0, 6)
    const plans = (context.pricing || []).filter(Boolean).slice(0, 5)
    const intents = PROMPT_INTENTS.map(
        (entry) => `- ${entry.key}: ${entry.label}`,
    ).join("\n")
    const priorQuestions = questionsToAvoid.filter(Boolean).slice(-60)
    const wantedClasses = SELECTION_CLASSES.filter((entry) => entry.countsAsSelection)
        .map((entry) => `- ${entry.key}: ${entry.label} — e.g. "${entry.example}"`)
        .join("\n")

    return `${getCurrentDateContext()}

Generate natural questions that real people would type into ChatGPT, Gemini, or Perplexity when they have a problem in this market category and are trying to FIND OR CHOOSE a solution.

This is an unprompted AI recommendation measurement. Every question must create a real selection event: a useful answer should naturally need to name external products, tools, apps, services, or providers. If an assistant can answer completely with general knowledge, an explanation, or step-by-step technique, do not include that question.

MARKET & BUYER CONTEXT
Category: ${context.category || context.subjectType}
${context.audience ? `Target audience / Who has this problem: ${context.audience}\n` : ""}${context.audiencePsychology ? `What worries them: ${context.audiencePsychology}\n` : ""}
WHY BUYERS LOOK FOR SOLUTIONS
These describe the situation, pains, and goals someone has before searching. Use them to work out WHO is looking and WHAT they are trying to achieve.
${enemies.length ? `Problems & pains they want to escape:\n${enemies.map((e) => `- ${e}`).join("\n")}\n` : ""}${context.notThis ? `What failed them in other alternatives: ${context.notThis}\n` : ""}${uvps.length ? `Key outcomes and goals they seek:\n${uvps.map((point) => `- ${point}`).join("\n")}\n` : ""}${plans.length ? `Budget / Pricing context:\n${plans.map((plan) => `- ${plan}`).join("\n")}\n` : ""}
CRITICAL RULE: BRAND-BLIND & SPEC-FREE DISCOVERY
Generate questions somebody could naturally ask WITHOUT knowing this brand or its proprietary feature names exist.
- NEVER manufacture demand around internal product mechanics. Do not write questions that read like a reverse-engineered feature checklist, internal technical specification, or obscure technical export format. Buyers search for their overall goals, workflow needs, and human constraints, not internal software architectures or niche code generation mechanics.
- Write how authentic buyers actually search:
  * "What's the best AI tool for designing a mobile app?"
  * "I have an app idea. What AI tool can turn it into UI screens?"
  * "What's the best AI app designer for a founder building an MVP without a designer?"
  * "Can an AI tool recreate a mobile UI from a screenshot?"
  * "Which AI tools are best for creating iOS app mockups?"
  * "How can I quickly prototype screens for a mobile app?"

WHO IS ASKING
Before each question, settle four things about the person typing it:
- who they are, and how much skill they have
- what they already tried, or already pay for
- the constraint that actually decides it for them
- what they are holding right now, before any tool touches it

Different answers to those four make DIFFERENT questions. Two people who want the same outcome under different constraints get recommended different things.

COVER THE RANGE
Keep moving along these axes across the set instead of settling on one:
- how far along they are: has not realised a tool exists, weighing a field of options, replacing something that disappoints them, checking one specific requirement before committing
- what limits them: no budget, no skill in this area, a deadline, a team convention, something it has to fit alongside
- what they start from: only an idea, a written spec, a rough draft, an existing screenshot or design
- what they need out: a working mockup, production-ready screens, interactive prototype

WORK OUT THE BUYER CONCERNS FIRST
Decide what DISTINCT REASONS a person could have for wanting a solution in this category.
- getting screens ready for developers or investors
- starting from something that already exists (wireframe, screenshot, idea) rather than nothing
- keeping visual control over the result
- what is frustrating or wrong in whatever they use today (e.g. complex tools are overkill, agencies are too expensive)
- doing it fast against an urgent deadline

Write ONE TO THREE questions per concern — never more.
Name each concern in three or four words and REUSE THAT EXACT LABEL for every question belonging to it.
${
        concernsInUse.length
            ? `
These concerns are already covered. Reuse a label verbatim if you are adding to it, and prefer concerns that are NOT on this list:
${concernsInUse.map((concern) => `- ${concern}`).join("\n")}
`
            : ""
}
${
        (context.coreFeatures || []).length
            ? `COMPANY CAPABILITIES
These are the verified things this company's product can actually do. Every question must be an authentic way someone asks to achieve one of these outcomes:
${(context.coreFeatures || []).map((cap) => `- ${cap}`).join("\n")}
`
            : ""
}Generate up to ${ceiling} questions. This is a ceiling, not a quota. Stop when another question would only paraphrase a situation already covered, and never pad.

LENGTH & FORM VARIETY:
Real chat messages vary widely: some are short and punchy ("best AI tool to design an iOS app"), some state a constraint, some ask for recommendations for their specific role ("I'm a solo developer, what can I use to mockup my app?"). Vary the phrasing and sentence structure.

Every question below was rejected for the same reason: an assistant answers it with technique and names no product. They come from one photo-product case. Learn only the boundary they mark: never copy its industry, people, objects, vocabulary, or capabilities unless they are genuinely present in the company above, and never treat their phrasing as a template for yours.
${exampleBlock()}

Allowed selection classes:
${wantedClasses}

Allowed intents:
${intents}

Rules:
- Never name this company, a competitor, or any website URL.
- Never write questions that sound like reverse-engineered product specs or feature checklists.
- Use ordinary conversational chat language.
- Do not include calendar years.
- "scenario" is a short description of the underlying buyer situation. Two differently worded questions with the same scenario are duplicates.
- Write in ${languageName(language)}.
${
        priorQuestions.length
            ? `- Do not repeat or paraphrase these already-retained questions:\n${priorQuestions.map((question) => `  - ${question}`).join("\n")}\n`
            : ""
}
For each result return:
- question: the exact natural chat message
- concern: the buyer concern it belongs to, in three or four words
- selectionClass: one allowed selection class
- intent: one allowed intent, judged from the question you just wrote
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
                    concern: { type: "STRING" as const },
                    selectionClass: { type: "STRING" as const },
                    intent: { type: "STRING" as const },
                    scenario: { type: "STRING" as const },
                },
                required: [
                    "question",
                    "concern",
                    "selectionClass",
                    "intent",
                    "scenario",
                ],
            },
        },
    },
    required: ["prompts"],
}
