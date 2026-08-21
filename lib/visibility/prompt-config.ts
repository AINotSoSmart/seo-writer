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
 * The vocabulary a generated prompt may be labelled with — **an output label,
 * not an input quota.**
 *
 * ## What used to be here, and why it was deleted
 *
 * This was a weighted mix of five buyer situations, each with a literal
 * sentence formula the model was told to fill in — "I'm [who I am] using
 * [current stack]", "[Incumbent] is [friction] for [my situation]" — plus a
 * required count per shape.
 *
 * Those formulas produced exactly what a formula produces. A live run for a
 * photo-restoration tool returned questions from "family archivists" and
 * "genealogists" complaining that a named rival was "too expensive" and "does
 * not seem to get updates" — an SEO consultant's idea of a person. What real
 * buyers type describes the thing on their desk and the outcome they are afraid
 * of: *"I scanned an old torn photo of my grandparents from the 1950s. What can
 * fix the cracks without making their faces look like smooth plastic?"*
 *
 * The scaffolding was the cause. Dictating a form guarantees the output has
 * that form, and the filters added afterwards could only delete the escapees —
 * which shrank the set and skewed it further toward the two comparative shapes.
 *
 * So the model is now given context and a goal. It proposes one of these keys,
 * then `inferPromptIntent` checks the finished question for explicit signals.
 * The live FlipAEO run labeled all ten distinct questions `alternatives`; model
 * labels are useful fallbacks, not a trustworthy taxonomy. The resolved label
 * flows into `articleType` and decides how the writer treats the piece.
 *
 * ## Why dropping the fixed mix is safe now
 *
 * The mix existed so two runs of the same audit would ask structurally
 * comparable questions. Under the subscription model prompts are **persisted
 * and re-run** — comparability comes from tracking the same questions every
 * month, not from regenerating the same shapes. The reason for the quota
 * disappeared the moment prompts became durable. See `SUBSCRIPTION_PIVOT.md`.
 */
export const PROMPT_INTENTS = [
    {
        key: "recommendation",
        label: "asking what to use for a specific job",
        articleType: "commercial" as const,
    },
    {
        key: "alternatives",
        label: "looking for options, or something other than what they have",
        articleType: "commercial" as const,
    },
    {
        key: "comparison",
        label: "weighing choices, or asking what others use",
        articleType: "commercial" as const,
    },
    {
        key: "problem",
        label: "understanding a problem or concept and how to address it",
        articleType: "informational" as const,
    },
    {
        key: "howto",
        label: "asking how to actually carry out the job",
        articleType: "howto" as const,
    },
] as const

export type PromptIntentKey = (typeof PROMPT_INTENTS)[number]["key"]

/**
 * Maximum candidates the whole-company generator may return. This is a safety
 * ceiling, not a required count: stopping before it has to paraphrase a buyer
 * situation is the desired behaviour.
 */
export const MAX_GENERATED_PROMPTS = 25

/**
 * How many prompts a run asks when the caller doesn't say.
 *
 * This is the subscription's durable measurement set, not a temporary sanity
 * sample. Forty questions are confirmed once, persisted, and re-run each cycle;
 * comparability comes from stable identity. At the current two-engine Cloro
 * estimate this is roughly 360 credits, about sixteen cents per cycle.
 */
export const DEFAULT_PROMPTS_PER_RUN = MAX_GENERATED_PROMPTS

/**
 * Hard ceiling on one probe run, protecting spend and wall-clock.
 *
 * Separate from the default on purpose: the default is a cost decision that
 * changes as confidence grows, the ceiling is a safety rail that shouldn't.
 */
export const MAX_PROMPTS_PER_RUN = 60
