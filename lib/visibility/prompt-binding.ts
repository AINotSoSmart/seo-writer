/**
 * Rebinds user-confirmed buyer prompts onto the audit's frozen scope families.
 *
 * ## Why this exists
 *
 * Onboarding asks the customer to confirm buyer questions *before* the brand is
 * saved, so each prompt carries whatever identifier the screen had at the time:
 * a `brand_scope_families` uuid, an ad-hoc `family-1` placeholder minted by
 * `POST /api/visibility/prompts/generate`, or — for a hand-written question —
 * the family's own name (`prompts-step.tsx` uses `family.id || family.name`).
 *
 * `create_customer_audit_with_scope` then copies the confirmed families into
 * `audit_scope_families` with **new** row ids, keeping the brand family id in
 * `brand_scope_family_id`. So none of those three identifiers is the id the
 * audit actually uses.
 *
 * Left unbound, the run does not fail loudly. Every gap reaches
 * `finalize_audit_run`, which raises `Query references scope outside its audit`,
 * and `run-probe.ts` catches that around the whole persistence block — so the
 * probe reports success, the dashboard renders, and not one article, cluster or
 * query row is written. That silent half-success is exactly the failure this
 * module exists to prevent, which is why an unbindable prompt is returned to the
 * caller rather than dropped.
 */

/** The subset of an `audit_scope_families` row needed to bind a prompt. */
export interface AuditScopeBinding {
    /** `audit_scope_families.id` — the only id downstream persistence accepts. */
    id: string
    /** The `brand_scope_families` row this was frozen from, if any. */
    brandScopeFamilyId: string | null
    name: string
    seedKeywords: string[]
}

/** The prompt fields consulted. Deliberately structural, so the real
 *  `BuyerPrompt` and the onboarding `PromptItem` both satisfy it. */
export interface BindablePrompt {
    scopeFamilyId: string
    sourceSeed?: string
}

export interface PromptBindingResult<T extends BindablePrompt> {
    /** Prompts whose `scopeFamilyId` is now an `audit_scope_families.id`. */
    bound: T[]
    /** Prompts that match no confirmed family. Never silently discarded. */
    unbound: T[]
}

function normalize(value: string | undefined | null): string {
    return (value ?? "").trim().toLocaleLowerCase()
}

/**
 * Rewrites `scopeFamilyId` to the audit's own family id.
 *
 * Resolution is ordered most-authoritative first, and stops at the first hit:
 *
 * 1. the audit family id itself (a re-run against an existing audit),
 * 2. the brand family id it was frozen from (the normal onboarding case),
 * 3. the family name (a custom question added on the prompts screen),
 * 4. a confirmed seed keyword (the placeholder-id case, where `sourceSeed` is
 *    the only provenance the prompt kept).
 *
 * Steps 3 and 4 read `sourceSeed` as well as `scopeFamilyId` because the
 * prompts screen puts the family name in one field and the generator puts the
 * seed in the other.
 */
export function bindPromptsToAuditScope<T extends BindablePrompt>(
    prompts: T[],
    families: AuditScopeBinding[],
): PromptBindingResult<T> {
    const byAuditId = new Map<string, string>()
    const byBrandId = new Map<string, string>()
    const byName = new Map<string, string>()
    const bySeed = new Map<string, string>()

    for (const family of families) {
        byAuditId.set(family.id, family.id)
        if (family.brandScopeFamilyId) {
            byBrandId.set(family.brandScopeFamilyId, family.id)
        }
        const name = normalize(family.name)
        // First writer wins: confirmed scope forbids duplicate names, and a
        // seed shared by two areas is a scope error rather than a binding one.
        if (name && !byName.has(name)) byName.set(name, family.id)
        for (const seed of family.seedKeywords) {
            const key = normalize(seed)
            if (key && !bySeed.has(key)) bySeed.set(key, family.id)
        }
    }

    const bound: T[] = []
    const unbound: T[] = []

    for (const prompt of prompts) {
        const raw = prompt.scopeFamilyId ?? ""
        const seed = prompt.sourceSeed ?? ""
        const resolved =
            byAuditId.get(raw) ??
            byBrandId.get(raw) ??
            byName.get(normalize(raw)) ??
            byName.get(normalize(seed)) ??
            bySeed.get(normalize(raw)) ??
            bySeed.get(normalize(seed)) ??
            null

        if (resolved) {
            bound.push({ ...prompt, scopeFamilyId: resolved })
        } else {
            unbound.push(prompt)
        }
    }

    return { bound, unbound }
}
