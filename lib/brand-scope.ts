import { createHash, randomUUID } from "crypto"

import {
    BrandDetailsSchema,
    ScopeFamilySchema,
    type BrandDetails,
    type ScopeFamily,
// Relative, not "@/lib/...": this module is imported directly by the contract
// suite, which runs under plain node and cannot resolve the tsconfig alias.
} from "./schemas/brand.ts"
import {
    MAX_SEARCH_DIRECTIONS,
    trimFamiliesToSearchCap,
} from "./scope-search-cap.ts"

export const SCOPE_CONTRACT_VERSION = "confirmed-business-scope-v1"
export const MAX_SCOPE_FAMILIES = 12
export const MAX_TOTAL_SCOPE_SEEDS = MAX_SEARCH_DIRECTIONS
export { trimFamiliesToSearchCap }

type CrawledPage = {
    url: string
    content: string
}

export type ScopeValidationIssue = {
    family?: string
    message: string
}

function normalizeText(value: string): string {
    return value
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
}

export function normalizeSeed(value: string): string {
    return value
        .normalize("NFKC")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim()
}

function sameCanonicalHost(left: string, right: string): boolean {
    try {
        const host = (value: string) =>
            new URL(value).hostname.toLowerCase().replace(/^www\./, "")
        return host(left) === host(right)
    } catch {
        return false
    }
}

function canonicalEvidenceUrl(value: string): string | null {
    try {
        const url = new URL(value)
        url.hash = ""
        url.search = ""
        url.hostname = url.hostname.toLowerCase().replace(/^www\./, "")
        url.pathname =
            url.pathname === "/" ? "/" : url.pathname.replace(/\/+$/, "")
        return url.toString()
    } catch {
        return null
    }
}

/** Minimum share of a quote's words that must appear together on the page. */
export const QUOTE_OVERLAP_THRESHOLD = 0.7

function contentTokens(value: string): string[] {
    return normalizeText(value).split(" ").filter(Boolean)
}

/**
 * Two-stage quote verification, mirroring coverage measurement.
 *
 * Stage 1 is an exact substring match — high precision, and the only thing the
 * original gate did. That alone deleted real product areas, because models
 * reconstruct quotes rather than copying them: one changed preposition and a
 * genuine capability vanished from the customer's scope.
 *
 * Stage 2 recovers those. It slides a window the length of the quote across the
 * page and asks how much of the quote appears *together* in one place. A
 * paraphrase of a real sentence scores high; a fabricated claim whose words are
 * merely scattered around the site does not.
 */
export function verifyQuote(quote: string, pageText: string): boolean {
    const normalizedQuote = normalizeText(quote)
    if (normalizedQuote.length < 8) return false
    if (pageText.includes(normalizedQuote)) return true

    const quoteTokens = contentTokens(quote)
    const pageTokens = pageText.split(" ").filter(Boolean)
    if (quoteTokens.length === 0 || pageTokens.length === 0) return false

    // Cap the window at the page length. A quote longer than the page it cites
    // is normal for a short landing page, and must still be comparable.
    const windowSize = Math.min(quoteTokens.length, pageTokens.length)
    const wanted = new Set(quoteTokens)
    let best = 0
    for (let start = 0; start + windowSize <= pageTokens.length; start++) {
        const window = new Set(pageTokens.slice(start, start + windowSize))
        let matched = 0
        for (const token of wanted) if (window.has(token)) matched++
        best = Math.max(best, matched / wanted.size)
        if (best >= QUOTE_OVERLAP_THRESHOLD) return true
    }
    return false
}

function titleCase(value: string): string {
    return value
        .split(" ")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
}

/**
 * Extracted families must cite text that was actually crawled from the audited
 * host. Founder- and user-created families are authoritative and need no quote.
 *
 * Nothing is deleted here. An extracted family whose quote cannot be verified
 * is kept and marked `verified: false` for the founder to confirm or remove,
 * and every founder target search that no family claimed becomes its own
 * family. Silent removal is what produced a single vague product area for a
 * business that plainly sells more than one thing.
 */
export function validateGroundedScope(
    rawFamilies: unknown,
    pages: CrawledPage[],
    subjectUrl: string,
    targetSeeds: string[] = [],
): {
    families: ScopeFamily[]
    issues: ScopeValidationIssue[]
    unassignedTargetSeeds: string[]
} {
    const issues: ScopeValidationIssue[] = []
    const pageByUrl = new Map(
        pages
            .filter((page) => sameCanonicalHost(page.url, subjectUrl))
            .flatMap((page) => {
                const canonical = canonicalEvidenceUrl(page.url)
                return canonical
                    ? [[canonical, normalizeText(page.content)] as const]
                    : []
            }),
    )
    const parsedFamilies = Array.isArray(rawFamilies) ? rawFamilies : []
    if (parsedFamilies.length > MAX_SCOPE_FAMILIES) {
        return {
            families: [],
            issues: [
                {
                    message: `Website analysis returned ${parsedFamilies.length} product areas; the maximum supported scope is ${MAX_SCOPE_FAMILIES}. Nothing was silently removed.`,
                },
            ],
            unassignedTargetSeeds: Array.from(
                new Set(targetSeeds.map(normalizeSeed).filter(Boolean)),
            ),
        }
    }
    const families: ScopeFamily[] = []
    const seenNames = new Set<string>()

    for (const candidate of parsedFamilies) {
        const parsed = ScopeFamilySchema.safeParse(candidate)
        if (!parsed.success) {
            issues.push({ message: "An extracted product area had an invalid shape." })
            continue
        }

        const family = parsed.data
        const nameNorm = normalizeText(family.name)
        if (seenNames.has(nameNorm)) {
            issues.push({
                family: family.name,
                message: "Duplicate product area was removed.",
            })
            continue
        }

        const seeds = Array.from(
            new Set(family.seed_keywords.map(normalizeSeed).filter(Boolean)),
        ).slice(0, 8)
        if (seeds.length === 0) {
            issues.push({
                family: family.name,
                message: "Product area has no usable search direction.",
            })
            continue
        }

        const evidence = family.evidence.filter((item) => {
            const canonical = canonicalEvidenceUrl(item.url)
            const page = canonical ? pageByUrl.get(canonical) : undefined
            if (!page) return false
            return verifyQuote(item.quote, page)
        })

        const verified = family.source !== "extracted" || evidence.length > 0
        if (!verified) {
            issues.push({
                family: family.name,
                message:
                    "We could not match this product area to an exact line on your site. Confirm it is real, or remove it.",
            })
        }

        seenNames.add(nameNorm)
        families.push({
            ...family,
            id: family.id || randomUUID(),
            seed_keywords: seeds,
            evidence,
            // Never let an area point at itself; that renders as a nonsense
            // "sub-area of itself" badge on the confirmation screen.
            parent_hint:
                family.parent_hint &&
                normalizeText(family.parent_hint) !== nameNorm
                    ? family.parent_hint
                    : null,
            verified,
            priority: families.length,
            enabled: true,
        })
    }

    // Any target search still unclaimed becomes its own family. The founder
    // told us what they sell; refusing to carry that forward is how a tool that
    // converts prompts into mobile UI got filed under "design handoff".
    const claimed = new Set(
        families.flatMap((family) => family.seed_keywords.map(normalizeSeed)),
    )
    const orphanSeeds = Array.from(
        new Set(targetSeeds.map(normalizeSeed).filter(Boolean)),
    ).filter((seed) => !claimed.has(seed))

    for (const seed of orphanSeeds) {
        if (families.length >= MAX_SCOPE_FAMILIES) break
        const name = titleCase(seed).slice(0, 100)
        if (seenNames.has(normalizeText(name))) continue
        seenNames.add(normalizeText(name))
        families.push({
            id: randomUUID(),
            name,
            description: `Searches about ${seed}. Rename this to match how you describe it.`,
            seed_keywords: [seed],
            evidence: [],
            source: "founder",
            verified: true,
            priority: families.length,
            enabled: true,
        })
        issues.push({
            family: name,
            message: `Created from your target search "${seed}" because the site analysis did not cover it. Rename or merge it.`,
        })
    }

    const assigned = new Set(
        families.flatMap((family) => family.seed_keywords.map(normalizeSeed)),
    )
    const unassignedTargetSeeds = Array.from(
        new Set(targetSeeds.map(normalizeSeed).filter(Boolean)),
    ).filter((seed) => !assigned.has(seed))

    return { families, issues, unassignedTargetSeeds }
}

/**
 * Turn extraction's advisory `parent_hint` into a stable family id link.
 * Absorption uses this to fold thin sub-intents into the parent's cluster
 * before falling back to embedding proximity.
 */
export function resolveParentScopeFamilyIds(
    families: ScopeFamily[],
): ScopeFamily[] {
    const idByName = new Map(
        families
            .filter((family) => family.id)
            .map((family) => [normalizeText(family.name), family.id!]),
    )

    return families.map((family) => {
        let parentId = family.parent_scope_family_id ?? null
        if (!parentId && family.parent_hint) {
            const hinted = idByName.get(normalizeText(family.parent_hint))
            if (hinted && hinted !== family.id) parentId = hinted
        }
        if (parentId === family.id) parentId = null
        return { ...family, parent_scope_family_id: parentId }
    })
}

export function validateConfirmedScope(brandData: BrandDetails): {
    families: ScopeFamily[]
    errors: string[]
} {
    const parsed = BrandDetailsSchema.safeParse(brandData)
    if (!parsed.success) {
        return { families: [], errors: ["Brand details are invalid."] }
    }

    const families = parsed.data.scope_families
        .filter((family) => family.enabled)
        .sort((a, b) => a.priority - b.priority)
        .map((family, index) => ({
            ...family,
            priority: index,
            seed_keywords: Array.from(
                new Set(family.seed_keywords.map(normalizeSeed).filter(Boolean)),
            ).slice(0, 8),
        }))

    const errors: string[] = []
    if (families.length === 0) {
        errors.push("Confirm at least one product or service area.")
    }
    if (families.length > MAX_SCOPE_FAMILIES) {
        errors.push(`Confirm no more than ${MAX_SCOPE_FAMILIES} product areas.`)
    }
    const totalSeeds = families.reduce(
        (sum, family) => sum + family.seed_keywords.length,
        0,
    )
    if (totalSeeds > MAX_TOTAL_SCOPE_SEEDS) {
        errors.push(
            `The confirmed scope contains ${totalSeeds} search directions; maximum is ${MAX_TOTAL_SCOPE_SEEDS}.`,
        )
    }

    const familyNames = new Set<string>()
    const seedOwners = new Map<string, string>()
    for (const family of families) {
        const normalizedName = normalizeText(family.name)
        if (familyNames.has(normalizedName)) {
            errors.push(`Product area names must be unique: ${family.name}.`)
        }
        familyNames.add(normalizedName)

        for (const seed of family.seed_keywords) {
            const existingOwner = seedOwners.get(seed)
            if (existingOwner && existingOwner !== family.name) {
                errors.push(
                    `"${seed}" is assigned to both "${existingOwner}" and "${family.name}". Every search direction must belong to exactly one product area.`,
                )
            } else {
                seedOwners.set(seed, family.name)
            }
        }
    }

    const assigned = new Set(
        families.flatMap((family) => family.seed_keywords.map(normalizeSeed)),
    )
    const missingTargets = parsed.data.target_seed_keywords
        .map(normalizeSeed)
        .filter((seed) => seed && !assigned.has(seed))
    if (missingTargets.length > 0) {
        errors.push(
            `Assign every target search to a product area: ${missingTargets.join(", ")}.`,
        )
    }

    const resolved = resolveParentScopeFamilyIds(families)
    const familyIds = new Set(resolved.map((family) => family.id).filter(Boolean))
    for (const family of resolved) {
        if (
            family.parent_scope_family_id &&
            !familyIds.has(family.parent_scope_family_id)
        ) {
            errors.push(
                `Product area "${family.name}" points at a parent that is not in the confirmed scope.`,
            )
        }
    }

    return { families: resolved, errors }
}

export function scopeHash(families: ScopeFamily[]): string {
    const stable = families
        .filter((family) => family.enabled)
        .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name))
        .map((family) => ({
            name: normalizeText(family.name),
            description: normalizeText(family.description),
            seeds: [...family.seed_keywords].map(normalizeSeed).sort(),
            priority: family.priority,
            parent: family.parent_scope_family_id ?? null,
        }))
    return createHash("sha256").update(JSON.stringify(stable)).digest("hex")
}
