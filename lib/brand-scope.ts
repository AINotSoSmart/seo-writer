import { createHash, randomUUID } from "crypto"

import {
    BrandDetailsSchema,
    ScopeFamilySchema,
    type BrandDetails,
    type ScopeFamily,
} from "@/lib/schemas/brand"

export const SCOPE_CONTRACT_VERSION = "confirmed-business-scope-v1"
export const MAX_SCOPE_FAMILIES = 12
export const MAX_TOTAL_SCOPE_SEEDS = 12

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

/**
 * Extracted families must cite text that was actually crawled from the audited
 * host. User-created families are authoritative and may have no site quote.
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
            const quote = normalizeText(item.quote)
            return quote.length >= 8 && page.includes(quote)
        })

        if (family.source === "extracted" && evidence.length === 0) {
            issues.push({
                family: family.name,
                message:
                    "Product area was removed because its claimed website evidence could not be verified.",
            })
            continue
        }

        seenNames.add(nameNorm)
        families.push({
            ...family,
            id: family.id || randomUUID(),
            seed_keywords: seeds,
            evidence,
            priority: families.length,
            enabled: true,
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

    return { families, errors }
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
        }))
    return createHash("sha256").update(JSON.stringify(stable)).digest("hex")
}
