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
    /**
     * How many questions ONE call may return.
     *
     * Not the size of the set the customer receives — that cap is applied after
     * the critic, in `prompt-builder.ts`. This is the per-call ceiling, and it
     * exists because the critic removes roughly a third: if a call can only
     * return 25, reaching 35 candidates needs a second round trip. Raising the
     * ceiling does the same work in one call instead of two.
     */
    ceiling: number = 25,
    /**
     * Concern labels already in use.
     *
     * The instruction tells the model to reuse an existing label rather than
     * coin a synonym, and it cannot do that if it has never seen the labels. A
     * measured run passed only the prior QUESTIONS, and the second call duly
     * invented "Feeding AI coding tools" for the concern the first had called
     * "feeding designs to ai coders" — six questions on one need, with every
     * label individually obeying the one-to-three rule.
     */
    concernsInUse: string[] = [],
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
    const enemies = (context.enemy || []).filter(Boolean).slice(0, 5)
    const uvps = (context.uvp || []).filter(Boolean).slice(0, 6)
    const plans = (context.pricing || []).filter(Boolean).slice(0, 5)
    const uncovered = uncoveredCapabilities.filter(Boolean)
    const intents = PROMPT_INTENTS.map(
        (entry) => `- ${entry.key}: ${entry.label}`,
    ).join("\n")
    const priorQuestions = questionsToAvoid.filter(Boolean).slice(-60)
    const wantedClasses = SELECTION_CLASSES.filter((entry) => entry.countsAsSelection)
        .map((entry) => `- ${entry.key}: ${entry.label} — e.g. "${entry.example}"`)
        .join("\n")
    return `${getCurrentDateContext()}

Generate natural questions that real people would type into ChatGPT or Gemini when they have a problem this company can solve and are trying to FIND OR CHOOSE a solution.

This is an AI recommendation measurement. Every question must create a real selection event: a useful answer should naturally need to name external products, tools, apps, services, or providers. If an assistant can answer completely with general knowledge, an explanation, or step-by-step technique, do not include that question.

THE COMPANY
It is: ${context.subjectType}
${context.category ? `Category: ${context.category}\n` : ""}${features.length ? `Verified capabilities:\n${features.map((feature) => `- ${feature}`).join("\n")}\n` : ""}${context.audience ? `People with this problem: ${context.audience}\n` : ""}${context.audiencePsychology ? `What worries them: ${context.audiencePsychology}\n` : ""}
WHY PEOPLE END UP LOOKING
These describe the situation someone is in before they search. They are NOT capabilities and nothing here may be turned into a claim about what the product does — the verified list above remains the only thing it can do. Use them to work out who is looking and why.
${context.enemy ? `The problem it exists to fight: ${context.enemy}\n` : ""}${context.notThis ? `What it is deliberately not: ${context.notThis}\n` : ""}${uvps.length ? `Why people pick it over the alternative:\n${uvps.map((point) => `- ${point}`).join("\n")}\n` : ""}${plans.length ? `What it costs:\n${plans.map((plan) => `- ${plan}`).join("\n")}\n` : ""}
Read "what it is deliberately not" as a list of people: for each one, somebody tried that other thing first and it did not work. Read the price the same way — someone is deciding whether this is worth it, and someone else cannot spend that at all.

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

WORK OUT THE BUYER CONCERNS FIRST
Before writing anything, decide what DISTINCT REASONS a person could have for wanting this product.

A CONCERN IS NOT A CAPABILITY. If your concerns line up one-to-one with the verified capabilities above, you have renamed the feature list and stopped early — and every question inside one will be a rephrasing of the others. A concern is what a person was doing when they started looking, and the same capability serves several: someone who lost their source files and someone benchmarking a rival both want a screenshot turned into layers, and they ask completely differently.

Reach for concerns that cut ACROSS capabilities — the situation, the constraint, the deadline, the thing that went wrong — not the feature that answers them.

Concerns worth reaching for, when the capabilities support them:
- getting the output into the hands of whoever builds or uses it next
- starting from something that already exists rather than from nothing
- keeping control over the result instead of accepting whatever comes back
- the thing being frustrating or wrong in whatever they use today
- doing it at all, when they lack the skill or the budget the usual route needs
- doing it fast, against a date that is already fixed

That fourth one is where the sharpest questions live and it is the easiest to miss. A capability usually exists because something else does it badly, and a person who has hit that badness types a very specific question.

Then write ONE TO THREE questions per concern — never more. A fourth is always a rephrasing, and rephrasings are what make a measurement set worthless: the same reader, asking the same thing, counted repeatedly.

Name each concern in three or four words and REUSE THAT EXACT LABEL for every question belonging to it.

Within one concern, every question must differ in WHO is asking or WHAT they are starting from. Two questions that describe the same person in the same position, one phrased generally and one with a situation attached, are one question written twice.
${
        concernsInUse.length
            ? `
These concerns are already covered. Reuse a label verbatim if you are adding to it, and prefer concerns that are NOT on this list:
${concernsInUse.map((concern) => `- ${concern}`).join("\n")}
`
            : ""
}

Each question must have one primary problem. Do not bundle several capabilities into an all-in-one software request.

${
        uncovered.length
            ? `THESE CAPABILITIES HAVE NO QUESTION YET
Every question you return in this pass must be about one of these, because nothing in the set so far would make an assistant recommend the company for them:
${uncovered.map((capability) => `- ${capability}`).join("\n")}

`
            : ""
}Generate up to ${ceiling} questions. This is a ceiling, not a quota. Stop when another question would only paraphrase a situation already covered, and never pad: a question that restates a situation already in the set is worse than one you did not write. Within that rule, keep going while genuinely different buyer situations remain — most companies have far more of them than first come to mind.

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
- concern: the buyer concern it belongs to, in three or four words
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
            // Must be at least the largest `ceiling` any caller passes, or the
            // model is told one number and bounded by a smaller one.
            maxItems: 25,
            items: {
                type: "OBJECT" as const,
                properties: {
                    question: { type: "STRING" as const },
                    concern: { type: "STRING" as const },
                    selectionClass: { type: "STRING" as const },
                    intent: { type: "STRING" as const },
                    scenario: { type: "STRING" as const },
                    capability: { type: "STRING" as const },
                },
                required: [
                    "question",
                    "concern",
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
