/**
 * The acceptance test a buyer question has to pass, and its scoring.
 *
 * MUST STAY DEPENDENCY-FREE — the contract suite and the calibration harness
 * both import it under plain node. The Gemini call that produces these
 * judgements lives in `selection-classifier.ts`; this file is only the shape of
 * a judgement and the rule applied to it, so the rule can be tested and
 * calibrated without a network.
 *
 * ## Why a classifier and not a word list
 *
 * CLAUDE.md: *"Do not add regex blocklists for content quality. Tried twice;
 * each round caught the previous examples and missed the next."* A rule like
 * `/^how do i/` would reject "how do I choose between AI photo restoration
 * tools" — a strong selection question — and accept "what is the best technique
 * for removing scratches", which names nothing. The property being measured is
 * semantic, so the judge has to be semantic.
 */

import {
    countsAsSelection,
    isSelectionClass,
    UNKNOWN_SELECTION_CLASS,
    type SelectionClass,
} from "./selection-class.ts"

/**
 * One model judgement about one candidate question.
 *
 * The three booleans are the acceptance test in the plan, in the order they
 * matter. `naturalness` is separate because a question can pass all three and
 * still be something no human would ever type.
 */
export interface SelectionJudgement {
    /**
     * Could an assistant answer this completely without naming any product?
     * `true` means the question measures nothing — this is the decisive field.
     */
    answerableWithoutProduct: boolean
    /** Would a good answer naturally name products, services or providers? */
    benefitsFromNamingProducts: boolean
    /** Can the tracked brand actually satisfy the underlying need? */
    brandCanSatisfy: boolean
    /** 0-1. Would a real person type this into a chat box? */
    naturalness: number
    selectionClass: SelectionClass
}

/** A judgement paired with the candidate it describes. */
export interface JudgedPrompt {
    text: string
    judgement: SelectionJudgement
}

export const NATURALNESS_FLOOR = 0.5

/**
 * The plan's acceptance condition, as one number in 0-1.
 *
 *     benefits-from-entities x commercial-relevance x brand-capability x naturalness
 *
 * Multiplicative, not additive, and that is the point: any one factor at zero
 * takes the whole score to zero. A question that is beautifully natural, deeply
 * commercial and squarely in the brand's wheelhouse still scores 0 if an
 * assistant would answer it without naming anything — because that question
 * cannot produce the event the product claims to measure. An additive score
 * would let three strong factors outvote the one that decides whether there is
 * anything to measure at all.
 */
export function selectionScore(judgement: SelectionJudgement): number {
    const requiresEntities = judgement.answerableWithoutProduct ? 0 : 1
    const benefits = judgement.benefitsFromNamingProducts ? 1 : 0
    const capable = judgement.brandCanSatisfy ? 1 : 0
    const natural = Math.min(1, Math.max(0, judgement.naturalness))
    return requiresEntities * benefits * capable * natural
}

/**
 * Every reason a candidate was rejected, most decisive first.
 *
 * Returned as a list rather than a boolean so the calibration harness and the
 * build report can say *which* factor failed. "Rejected" with no reason is how
 * a filter becomes folklore.
 */
export function selectionRejections(judgement: SelectionJudgement): string[] {
    const reasons: string[] = []
    if (judgement.answerableWithoutProduct) {
        reasons.push("answerable_without_product")
    }
    if (!judgement.benefitsFromNamingProducts) reasons.push("names_no_products")
    if (!judgement.brandCanSatisfy) reasons.push("outside_brand_capability")
    if (judgement.naturalness < NATURALNESS_FLOOR) reasons.push("unnatural_phrasing")
    if (!countsAsSelection(judgement.selectionClass)) {
        reasons.push(`weak_class_${judgement.selectionClass}`)
    }
    return reasons
}

/**
 * Whether to keep a candidate, at a calibrated score threshold.
 *
 * The threshold is a parameter and has no default here on purpose. CLAUDE.md:
 * *"Never hand-tune a matching threshold. Use the calibration harness with
 * hand-labelled positives and negatives. If the populations overlap, the method
 * is wrong — report that instead of picking a midpoint."*
 */
export function acceptsSelectionPrompt(
    judgement: SelectionJudgement,
    threshold: number,
): boolean {
    // EVERY rejection reason counts, not just the ones the score multiplies.
    //
    // This read `selectionScore(...) >= threshold` alone, and calibration
    // caught it immediately: questions the judge had labelled `instruction` or
    // `exploration` scored 0.90 and were accepted, because the class never
    // entered the score. The rule was enforced in `selectionRejections` and
    // forgotten in its sibling — the exact defect shape this codebase keeps
    // producing. Acceptance now requires a clean rejection list AND the score.
    return selectionRejections(judgement).length === 0 && selectionScore(judgement) >= threshold
}

/** Coerces whatever a model returned into a judgement, failing safe. */
export function normaliseJudgement(raw: unknown): SelectionJudgement {
    const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
    const bool = (value: unknown, fallbackWhenMissing: boolean) =>
        typeof value === "boolean" ? value : fallbackWhenMissing
    const naturalness = Number(row.naturalness)
    return {
        // Missing fields fail CLOSED: an unjudged question is assumed to be
        // answerable without a product and outside the brand's capability, so a
        // malformed model response cannot quietly admit tutorials.
        answerableWithoutProduct: bool(row.answerableWithoutProduct, true),
        benefitsFromNamingProducts: bool(row.benefitsFromNamingProducts, false),
        brandCanSatisfy: bool(row.brandCanSatisfy, false),
        naturalness: Number.isFinite(naturalness)
            ? Math.min(1, Math.max(0, naturalness))
            : 0,
        selectionClass: isSelectionClass(row.selectionClass)
            ? row.selectionClass
            : UNKNOWN_SELECTION_CLASS,
    }
}
