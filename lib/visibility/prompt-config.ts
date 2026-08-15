/**
 * Prompt-generation constants, with no imports.
 *
 * Split out of `prompt-builder.ts` for the same reason `cluster-types.ts` was
 * split out of `clusterer.ts`: the builder needs the Gemini client, which makes
 * it alias-bound and unloadable under plain node, so anything importing it can
 * only be asserted as text. These values are load-bearing enough to deserve
 * real assertions.
 *
 * The second reason is the method panel. It is a `"use client"` component and
 * it renders these values; importing them from the builder dragged a
 * server-side client into a client module's import graph. Nothing broke, but
 * only because `geminiClient.ts` happens to read its key inside the function
 * rather than at module scope. That is luck, not design.
 */

/**
 * The buyer situations worth testing, and why each is here.
 *
 * `weight` is how many candidate prompts of that intent each confirmed family
 * gets. Commercial intents are weighted up because they are the ones where an
 * engine answers with a list of named products — an informational prompt that
 * returns an explanation mentions nobody, and an absence there means very
 * little.
 */
export const PROMPT_INTENTS = [
    {
        key: "recommendation",
        weight: 3,
        brief: "asks the assistant to recommend a tool or provider for a specific job",
        articleType: "commercial" as const,
    },
    {
        key: "alternatives",
        weight: 2,
        brief: "asks for alternatives or options in this category, without naming any brand",
        articleType: "commercial" as const,
    },
    {
        key: "comparison",
        weight: 2,
        brief: "asks how to choose between options, or what to look for when choosing",
        articleType: "commercial" as const,
    },
    {
        key: "problem",
        weight: 2,
        brief: "describes the underlying problem in the buyer's own words and asks how to solve it",
        articleType: "informational" as const,
    },
    {
        key: "howto",
        weight: 1,
        brief: "asks how to actually carry out the job",
        articleType: "howto" as const,
    },
] as const

export type PromptIntentKey = (typeof PROMPT_INTENTS)[number]["key"]

/** Candidate prompts generated per family, before the run's budget applies. */
export const PROMPTS_PER_FAMILY = PROMPT_INTENTS.reduce(
    (total, intent) => total + intent.weight,
    0,
)

/**
 * How many prompts a run asks when the caller doesn't say.
 *
 * Deliberately small. Every prompt costs real Cloro credits on every engine
 * (~9 for the default ChatGPT + Google AI Mode pair), and until a run has
 * actually happened nobody knows whether the generated questions are ones a
 * buyer would type. Ten is enough to answer that — which is the only question
 * worth answering first — for roughly 90 credits, about four cents.
 *
 * **A 10-prompt run will usually produce no cluster plan.** A qualified cluster
 * needs 8-15 articles, and ten prompts cannot collapse into that. The report
 * still shows presence, rivals, sources and fan-out; the plan section says the
 * scope was too thin rather than showing an empty list. That is the expected
 * outcome of a sanity run, not a fault.
 *
 * Raise it per request via `maxPrompts` once the questions look right — no
 * redeploy needed, up to `MAX_PROMPTS_PER_RUN`.
 */
export const DEFAULT_PROMPTS_PER_RUN = 10

/**
 * Hard ceiling on one probe run, protecting spend and wall-clock.
 *
 * Separate from the default on purpose: the default is a cost decision that
 * changes as confidence grows, the ceiling is a safety rail that shouldn't.
 */
export const MAX_PROMPTS_PER_RUN = 60
