/**
 * The one definition of "this product area has confirmed mechanics".
 *
 * WHY THIS FILE EXISTS. The rule used to live only inside `validateConfirmedScope`
 * (server). The onboarding UI could not see it, so a founder could add a category,
 * fill in every field the screen showed them, press Continue, and be told the
 * category "needs confirmed mechanics" — with no way to discover which field
 * meant that. Worse, `validateGroundedScope` auto-creates rescue families from
 * `fallbackCapabilityContract`, whose empty `facts`/`evidenceRefs` are exactly
 * what this rule rejects: one validator created families so demand would not be
 * lost, and the other refused every one of them.
 *
 * MUST STAY FREE OF NODE BUILTINS. `lib/brand-scope.ts` imports `crypto`, so a
 * client component cannot import the rule from there. Keep this module pure so
 * both sides compute the identical answer, and so the contract suite can import
 * it under plain `node --experimental-strip-types`.
 *
 * WHY THE RULE IS STRICT. The capability contract is the writer's only licence
 * to say anything about the product. A family with no facts still gets
 * `solution_mode: "product_led"` (lib/harvest/scope-classifier.ts), so the writer
 * is told to lead with the product and handed zero true sentences about it —
 * the exact pressure that produced the fabrications repaired in PIVOT §0 item 4.
 * Loosening this does not open a hole in fact-checking; it starves it.
 */

import type { CapabilityContract } from "./writer/article-contract.ts"

export type MechanicsGap =
    | "missing_contract"
    | "missing_delivery_mode"
    | "missing_action"
    | "placeholder_action"
    | "no_confirmed_facts"

/**
 * Placeholder prose must never become the definition of the business.
 *
 * `lib/harvest/scope-classifier.ts` inlines `action=` verbatim into the prompt
 * that classifies every harvested query, so "Describe what your product does"
 * would silently become the yardstick the whole audit is measured against.
 */
const PLACEHOLDER_ACTION = /^describe\b/i

/** Shortest action that can carry meaning. Below this it is a stray keystroke. */
const MIN_ACTION_LENGTH = 4

export function isPlaceholderAction(action: string): boolean {
    const trimmed = action.trim()
    return trimmed.length < MIN_ACTION_LENGTH || PLACEHOLDER_ACTION.test(trimmed)
}

/**
 * Every reason this contract would be rejected, most blocking first.
 *
 * Returns [] when the family is ready to confirm.
 */
export function mechanicsGaps(
    contract: CapabilityContract | null | undefined,
): MechanicsGap[] {
    if (!contract) return ["missing_contract"]

    const gaps: MechanicsGap[] = []
    if (!contract.deliveryMode.trim()) gaps.push("missing_delivery_mode")
    if (contract.operations.length === 0) {
        gaps.push("missing_action")
    } else if (contract.operations.some((operation) => !operation.action.trim())) {
        gaps.push("missing_action")
    } else if (contract.operations.some((operation) => isPlaceholderAction(operation.action))) {
        gaps.push("placeholder_action")
    }
    // Facts and evidenceRefs fail together in practice — a fact is only ever
    // minted alongside the ref that points at it — so they report as one gap
    // the founder can actually act on.
    if (
        contract.facts.length === 0 ||
        contract.operations.some((operation) => operation.evidenceRefs.length === 0)
    ) {
        gaps.push("no_confirmed_facts")
    }
    return gaps
}

export function isMechanicsConfirmed(
    contract: CapabilityContract | null | undefined,
): boolean {
    return mechanicsGaps(contract).length === 0
}

/** Written for a founder, not an engineer. Each names the field to go fix. */
export const MECHANICS_GAP_COPY: Record<MechanicsGap, string> = {
    missing_contract:
        "This area has no mechanics recorded yet — name it, say what it helps with, and how customers get it.",
    missing_delivery_mode:
        "Say how customers get this (for example: browser software, done-for-you service).",
    missing_action:
        "Say in one line what this helps with.",
    placeholder_action:
        "Replace the placeholder wording with what it actually does — this sentence is what we match your customers’ searches against.",
    no_confirmed_facts:
        "Say in one line what this helps with so we have something verified to write from.",
}

/** The single gap worth surfacing when there is only room for one line. */
export function primaryMechanicsGap(
    contract: CapabilityContract | null | undefined,
): MechanicsGap | null {
    return mechanicsGaps(contract)[0] ?? null
}
