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
 *
 * ## Each brief is a SENTENCE SHAPE, not a topic
 *
 * They used to read like topic labels ("asks for alternatives in this
 * category"), and the model dutifully produced the tidiest sentence matching
 * that description — which is an SEO title with a question mark on it:
 *
 *     "Can you recommend a platform that helps me generate editable mobile UI
 *      screens and provides developer-ready implementation context?"
 *
 * Nobody types that. It is marketing copy in interrogative form, and it is
 * actively harmful as a measurement: fed a formal, category-level question, an
 * answer engine returns the safe top-of-funnel listicle naming whichever legacy
 * tools have the most written about them. The run then reports the customer
 * absent from a conversation no buyer was ever having.
 *
 * Real prompts are: who I am + what is going wrong + what I want. First person,
 * specific, often naming a tool the buyer already uses. So each brief below is
 * the literal structure to fill in, with an incumbent where the shape calls for
 * one — see `buildFamilyPrompt` for the rules that enforce it.
 */
export const PROMPT_INTENTS = [
    {
        key: "recommendation",
        weight: 3,
        brief:
            "CONTEXT + PAIN + ASK. \"I'm [who I am] using [current stack]. I'm trying to [job], but [what is going wrong]. What tool handles this?\" The buyer states their situation before they ask.",
        articleType: "commercial" as const,
    },
    {
        key: "alternatives",
        weight: 2,
        brief:
            "FRUSTRATED SWITCHER. \"[Incumbent] is [too expensive / too heavy / missing X] for [my situation]. What is a simpler alternative that just does [core job]?\" Name a real incumbent — this is the phrasing that makes an engine list challengers.",
        articleType: "commercial" as const,
    },
    {
        key: "comparison",
        weight: 2,
        brief:
            "CONSENSUS CHECK. \"What are most [persona] using now for [job] instead of [legacy incumbent]?\" Asks what the community has moved to, which pushes the engine to synthesise recent discussion rather than recite old documentation.",
        articleType: "commercial" as const,
    },
    {
        key: "problem",
        weight: 2,
        brief:
            "FUNCTIONAL BRIDGE. \"Is there something that takes [input] and gives me [output] without [the step I hate]?\" Pure capability, described in the buyer's own mechanics — no product category named.",
        articleType: "informational" as const,
    },
    {
        key: "howto",
        weight: 1,
        brief:
            "STUCK MID-JOB. \"I need to [specific task] — [constraint that makes it awkward]. How do people do this?\" A real task with a real obstacle, not a tutorial title.",
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
