/**
 * How likely a question is to make an assistant *choose between products*.
 *
 * MUST STAY DEPENDENCY-FREE — the contract suite imports it under plain
 * `node --experimental-strip-types`, same rule as `lib/scope-mechanics.ts`.
 *
 * ## Why this axis exists at all
 *
 * The product's claim is "when a buyer asks, does an assistant recommend you?"
 * That needs a **selection event**: an answer that names products. If a
 * question is fully answerable without naming any product, the brand's absence
 * from that answer is not a loss — there was nothing to lose.
 *
 * A live BringBack run returned 32 tutorials out of 40 ("how do I remove
 * scratches from scanned family pictures"). An assistant answers that with
 * technique — scan high-res, healing brush — and names no tool. The brand was
 * absent from all of them and the fact carried no information, yet all 40 sat
 * in one denominator, so "named in 4 of 40" read as 10% visibility when it was
 * really 4 hits over an unknown number of real chances.
 *
 * ## Why this is NOT the existing `intent` axis
 *
 * `PROMPT_INTENTS` in `prompt-config.ts` is an SEO-intent label that decides
 * `articleType`, which flows into the writer's frozen `ArticleContract`. It has
 * to keep meaning exactly what it means. This is a second, orthogonal axis:
 * intent answers "what kind of page would serve this?", selection class answers
 * "is this question a competitive selection event?". A question can be
 * `howto` intent and `constrained` selection class at once.
 */

/** Ordered weakest-to-strongest by entity-selection probability. */
export const SELECTION_CLASSES = [
    {
        key: "knowledge",
        label: "asking how something works",
        example: "how does AI photo restoration work",
        countsAsSelection: false,
    },
    {
        key: "instruction",
        label: "asking to be taught the steps",
        example: "how do I repair scratches in an old photo",
        countsAsSelection: false,
    },
    {
        key: "exploration",
        label: "asking whether the outcome is possible at all",
        example: "can a badly torn photo be restored",
        countsAsSelection: false,
    },
    {
        key: "solution",
        label: "asking what to use, without naming a category of tool",
        example: "what can I use to restore a damaged family photo",
        countsAsSelection: true,
    },
    {
        key: "discovery",
        label: "asking for the field of options",
        example: "best AI tools for restoring old family photos",
        countsAsSelection: true,
    },
    {
        key: "recommendation",
        label: "asking for one pick for a specific job",
        example: "best tool for combining separate photos into one portrait",
        countsAsSelection: true,
    },
    {
        key: "constrained",
        label: "a real situation with constraints, asking for the right pick",
        example:
            "my dad died before my wedding — what AI tool can add him to a wedding photo realistically",
        countsAsSelection: true,
    },
] as const

export type SelectionClass = (typeof SELECTION_CLASSES)[number]["key"]

const BY_KEY = new Map(SELECTION_CLASSES.map((entry) => [entry.key, entry]))

export const SELECTION_CLASS_KEYS: SelectionClass[] = SELECTION_CLASSES.map(
    (entry) => entry.key,
)

export function isSelectionClass(value: unknown): value is SelectionClass {
    return typeof value === "string" && BY_KEY.has(value as SelectionClass)
}

/**
 * True when a miss on this question is a competitive loss.
 *
 * The four strongest classes create a selection set; the three weakest do not.
 * A miss on `instruction` is not a loss and must never be counted as one — that
 * conflation is the whole defect this axis exists to remove.
 */
export function countsAsSelection(value: unknown): boolean {
    return isSelectionClass(value) ? Boolean(BY_KEY.get(value)!.countsAsSelection) : false
}

/**
 * The class to fall back to when a model returns something unusable.
 *
 * Deliberately the weakest one. An unclassifiable question must not be able to
 * inflate the headline metric by accident — an unknown is excluded from the
 * recommendation denominator until something classifies it, which is the safe
 * direction to be wrong in.
 */
export const UNKNOWN_SELECTION_CLASS: SelectionClass = "knowledge"

/** Human-facing name for the two metrics this axis splits the report into. */
export const SELECTION_METRIC_LABELS = {
    recommendation: "Recommendation visibility",
    organic: "Organic mention visibility",
} as const
