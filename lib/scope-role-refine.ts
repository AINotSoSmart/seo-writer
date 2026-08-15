/**
 * Scope role refinement.
 *
 * Extraction often emits delivery mechanics (export format, agent handoff,
 * packaging) as peer "product areas". Those seeds are searched in harvest and
 * pull generic adjacent SERPs. This module classifies each family and seed as
 * an acquisition job vs a delivery/workflow mechanism, then folds mechanisms
 * into their parent job before confirm — so bad markets never become harvest
 * scope.
 *
 * `applyScopeRoleRefinement` is pure and contract-tested. `classifyScopeRoles`
 * is the LLM pass; `refineScopeRoles` ties them together.
 */

import { MAX_SEEDS_PER_FAMILY } from "./scope-search-cap.ts"
import {
    normalizeSeed,
    resolveParentScopeFamilyIds,
    type ScopeValidationIssue,
} from "./brand-scope.ts"
import type { CapabilityContract, ScopeFamily } from "./schemas/brand.ts"
import {
    CAPABILITY_CONTRACT_VERSION,
    fallbackCapabilityContract,
} from "./writer/article-contract.ts"

export const SCOPE_ROLES = [
    "acquisition_job",
    "delivery_artifact",
    "workflow_step",
] as const

export type ScopeRole = (typeof SCOPE_ROLES)[number]

export type ScopeBrandProfile = {
    product_name: string
    product_identity: { literally: string }
    category?: string
    core_features?: string[]
    how_it_works?: string[]
    uvp?: string[]
}

export type ScopeSeedRoleDecision = {
    seed: string
    role: ScopeRole
}

export type ScopeFamilyRoleDecision = {
    name: string
    role: ScopeRole
    /** Exact parent family name when this should fold into another job. */
    fold_into: string | null
    seeds: ScopeSeedRoleDecision[]
}

export type ScopeRoleDecisions = {
    families: ScopeFamilyRoleDecision[]
}

function normalizeName(value: string): string {
    return value
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
}

function isMechanism(role: ScopeRole): boolean {
    return role === "delivery_artifact" || role === "workflow_step"
}

function asList(value: string | string[] | undefined): string[] {
    if (!value) return []
    return Array.isArray(value) ? value.map(String).filter(Boolean) : [String(value)]
}

function mergeCapabilityContracts(
    parent: CapabilityContract | null | undefined,
    child: CapabilityContract | null | undefined,
    parentMeta: { name: string; description: string },
): CapabilityContract {
    const base = parent || fallbackCapabilityContract(parentMeta)
    const extra = child
    if (!extra) return base

    const seenFacts = new Set(
        base.facts.map((fact) => `${fact.url}\n${normalizeName(fact.quote)}`),
    )
    const facts = [...base.facts]
    for (const fact of extra.facts) {
        const key = `${fact.url}\n${normalizeName(fact.quote)}`
        if (seenFacts.has(key)) continue
        seenFacts.add(key)
        facts.push(fact)
        if (facts.length >= 12) break
    }

    const seenOps = new Set(base.operations.map((op) => op.key))
    const operations = [...base.operations]
    for (const op of extra.operations) {
        let key = op.key
        if (seenOps.has(key)) {
            key = `${op.key}_folded`
            let n = 2
            while (seenOps.has(key)) {
                key = `${op.key}_folded${n}`
                n += 1
            }
        }
        seenOps.add(key)
        operations.push({ ...op, key })
        if (operations.length >= 6) break
    }

    return {
        version: CAPABILITY_CONTRACT_VERSION,
        deliveryMode: base.deliveryMode || extra.deliveryMode,
        operations,
        facts,
    }
}

function decisionForFamily(
    family: ScopeFamily,
    decisions: ScopeRoleDecisions,
): ScopeFamilyRoleDecision | null {
    const want = normalizeName(family.name)
    return (
        decisions.families.find((row) => normalizeName(row.name) === want) ||
        null
    )
}

function seedRoleMap(decision: ScopeFamilyRoleDecision | null): Map<string, ScopeRole> {
    const map = new Map<string, ScopeRole>()
    if (!decision) return map
    for (const row of decision.seeds) {
        map.set(normalizeSeed(row.seed), row.role)
    }
    return map
}

function findFamilyByName(
    families: ScopeFamily[],
    name: string | null | undefined,
): ScopeFamily | null {
    if (!name?.trim()) return null
    const want = normalizeName(name)
    return families.find((family) => normalizeName(family.name) === want) || null
}

/**
 * Pure applicator. Classified mechanism families fold into their parent job;
 * mechanism seeds are stripped from harvest directions. Founder target seeds
 * are never demoted.
 */
export function applyScopeRoleRefinement(
    families: ScopeFamily[],
    decisions: ScopeRoleDecisions,
    targetSeeds: string[] = [],
): { families: ScopeFamily[]; issues: ScopeValidationIssue[] } {
    const issues: ScopeValidationIssue[] = []
    const founderSeeds = new Set(
        targetSeeds.map(normalizeSeed).filter(Boolean),
    )

    const working: ScopeFamily[] = families.map((family) => ({
        ...family,
        seed_keywords: [...family.seed_keywords],
        evidence: [...(family.evidence || [])],
        capability_contract: family.capability_contract
            ? {
                  ...family.capability_contract,
                  operations: [...family.capability_contract.operations],
                  facts: [...family.capability_contract.facts],
              }
            : family.capability_contract,
    }))

    const acquisitionNames = new Set<string>()
    for (const family of working) {
        const decision = decisionForFamily(family, decisions)
        const role = decision?.role || "acquisition_job"
        if (!isMechanism(role)) acquisitionNames.add(normalizeName(family.name))
    }

    const primaryAcquisition =
        acquisitionNames.size === 1
            ? working.find((family) => acquisitionNames.has(normalizeName(family.name))) ||
              null
            : null

    const foldAway = new Set<string>()

    for (const family of working) {
        const decision = decisionForFamily(family, decisions)
        const role = decision?.role || "acquisition_job"
        if (!isMechanism(role)) continue

        const foldTarget =
            findFamilyByName(working, decision?.fold_into) ||
            findFamilyByName(working, family.parent_hint) ||
            primaryAcquisition

        if (
            foldTarget &&
            normalizeName(foldTarget.name) !== normalizeName(family.name) &&
            !foldAway.has(foldTarget.id || foldTarget.name)
        ) {
            const roles = seedRoleMap(decision)
            const keepSeeds = family.seed_keywords.filter((seed) => {
                const norm = normalizeSeed(seed)
                if (founderSeeds.has(norm)) return true
                return (roles.get(norm) || "delivery_artifact") === "acquisition_job"
            })

            foldTarget.seed_keywords = Array.from(
                new Set([
                    ...foldTarget.seed_keywords.map(normalizeSeed),
                    ...keepSeeds.map(normalizeSeed),
                ]),
            ).slice(0, MAX_SEEDS_PER_FAMILY)

            foldTarget.evidence = [
                ...foldTarget.evidence,
                ...family.evidence.filter(
                    (item) =>
                        !foldTarget.evidence.some(
                            (existing) =>
                                existing.url === item.url &&
                                normalizeName(existing.quote) === normalizeName(item.quote),
                        ),
                ),
            ].slice(0, 5)

            foldTarget.capability_contract = mergeCapabilityContracts(
                foldTarget.capability_contract,
                family.capability_contract,
                foldTarget,
            )

            // Preserve a parent link for any remaining real children later.
            if (!foldTarget.parent_hint && family.parent_hint) {
                // no-op — parent stays root
            }

            foldAway.add(family.id || family.name)
            issues.push({
                family: foldTarget.name,
                message: `Folded "${family.name}" into "${foldTarget.name}" — that area describes how you deliver the job, not a separate search market strangers use to find you.`,
            })
            continue
        }

        // No resolvable parent: strip mechanism seeds; drop the family if
        // nothing founder-authoritative remains.
        const roles = seedRoleMap(decision)
        const kept = family.seed_keywords.filter((seed) => {
            const norm = normalizeSeed(seed)
            if (founderSeeds.has(norm)) return true
            return (roles.get(norm) || role) === "acquisition_job"
        })
        if (kept.length === 0) {
            foldAway.add(family.id || family.name)
            issues.push({
                family: family.name,
                message: `Removed "${family.name}" as a product area — its searches looked like delivery or workflow mechanics, not a customer acquisition job. Add it back only if buyers actually search for it before choosing a product.`,
            })
        } else {
            family.seed_keywords = kept.slice(0, MAX_SEEDS_PER_FAMILY)
            issues.push({
                family: family.name,
                message: `Kept "${family.name}" only for founder-confirmed searches; delivery/workflow phrases were removed from harvest directions.`,
            })
        }
    }

    const keptFamilies = working.filter(
        (family) => !foldAway.has(family.id || family.name),
    )

    for (const family of keptFamilies) {
        const decision = decisionForFamily(family, decisions)
        if (!decision || isMechanism(decision.role)) continue
        const roles = seedRoleMap(decision)
        const before = family.seed_keywords
        const after = before.filter((seed) => {
            const norm = normalizeSeed(seed)
            if (founderSeeds.has(norm)) return true
            const seedRole = roles.get(norm)
            // Unclassified seeds on an acquisition job stay — only strip when
            // the classifier explicitly marked them as mechanism.
            if (!seedRole) return true
            return !isMechanism(seedRole)
        })
        if (after.length === before.length) continue
        if (after.length === 0) {
            // Never leave an acquisition job with zero seeds: keep founder
            // seeds if any were mis-marked, else keep original and warn.
            const founderKept = before.filter((seed) =>
                founderSeeds.has(normalizeSeed(seed)),
            )
            if (founderKept.length > 0) {
                family.seed_keywords = founderKept.slice(0, MAX_SEEDS_PER_FAMILY)
            }
            issues.push({
                family: family.name,
                message: `Some searches under "${family.name}" looked like delivery mechanics; review the remaining directions before continuing.`,
            })
            continue
        }
        const stripped = before.filter(
            (seed) => !after.some((keep) => normalizeSeed(keep) === normalizeSeed(seed)),
        )
        family.seed_keywords = after.slice(0, MAX_SEEDS_PER_FAMILY)
        issues.push({
            family: family.name,
            message: `Removed non-acquisition searches from "${family.name}": ${stripped.join(", ")}. Those describe how you deliver, not what buyers type to find you.`,
        })
    }

    // Ensure every founder seed still lives on some family.
    const claimed = new Set(
        keptFamilies.flatMap((family) => family.seed_keywords.map(normalizeSeed)),
    )
    for (const seed of founderSeeds) {
        if (claimed.has(seed)) continue
        const host =
            primaryAcquisition ||
            keptFamilies.find((family) => {
                const decision = decisionForFamily(family, decisions)
                return !decision || !isMechanism(decision.role)
            }) ||
            keptFamilies[0]
        if (!host) continue
        if (host.seed_keywords.length >= MAX_SEEDS_PER_FAMILY) continue
        host.seed_keywords = Array.from(
            new Set([...host.seed_keywords, seed]),
        ).slice(0, MAX_SEEDS_PER_FAMILY)
        claimed.add(seed)
        issues.push({
            family: host.name,
            message: `Kept your target search "${seed}" on "${host.name}" — founder searches are never dropped by role refinement.`,
        })
    }

    const prioritized = keptFamilies.map((family, index) => ({
        ...family,
        priority: index,
    }))

    return {
        families: resolveParentScopeFamilyIds(prioritized),
        issues,
    }
}

function parseRole(value: unknown): ScopeRole {
    const raw = String(value || "")
    if (raw === "delivery_artifact" || raw === "workflow_step") return raw
    return "acquisition_job"
}

/**
 * LLM pass: label each grounded family and seed against the confirmed brand.
 */
export async function classifyScopeRoles(
    families: ScopeFamily[],
    brandProfile: ScopeBrandProfile,
): Promise<ScopeRoleDecisions> {
    if (families.length === 0) return { families: [] }

    const { getGeminiClient } = await import("../utils/gemini/geminiClient.ts")
    const brandBlock = [
        `Product: ${brandProfile.product_name}`,
        `What it is: ${brandProfile.product_identity.literally}`,
        `Category: ${brandProfile.category || "(none)"}`,
        `Core features: ${asList(brandProfile.core_features).join("; ") || "(none)"}`,
        `How it works: ${asList(brandProfile.how_it_works).join("; ") || "(none)"}`,
        `UVP: ${asList(brandProfile.uvp).join("; ") || "(none)"}`,
    ].join("\n")

    const familyBlock = families
        .map((family, index) => {
            const seeds = family.seed_keywords.map((seed) => `    - ${seed}`).join("\n")
            return `${index + 1}. name=${family.name}
  description=${family.description}
  parent_hint=${family.parent_hint || "null"}
  seeds:
${seeds || "    (none)"}`
        })
        .join("\n\n")

    const prompt = `You classify product-area proposals for an SEO/AEO audit.

BRAND (founder-confirmed):
${brandBlock}

PROPOSED PRODUCT AREAS:
${familyBlock}

For each area, assign a role:
- acquisition_job: a job a FIRST-TIME BUYER would Google to find a product like this brand, before they know the brand. Peers that are genuinely different customer jobs stay acquisition_job even if one is narrower.
- delivery_artifact: how the product packages or outputs the result (export format, zip, code handoff, file type, agent context pack, API response shape). Not what strangers search to discover the product.
- workflow_step: a post-purchase step inside using the product (compile, handoff to Android Studio, publish, integrate).

Also label EACH seed the same way. A seed naming an output format, IDE, agent tool, export path, or packaging step is delivery_artifact or workflow_step even when its parent family is an acquisition_job.

When role is delivery_artifact or workflow_step, set fold_into to the exact name of the acquisition_job family it belongs under (usually parent_hint, or the brand's primary job). When role is acquisition_job, fold_into must be null.

Do not invent new family names. Only use names from PROPOSED PRODUCT AREAS.
Do not use brand names as searches.
Return one decision object per proposed area.`

    const client = getGeminiClient()
    const response = await client.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
            temperature: 0,
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT" as const,
                properties: {
                    families: {
                        type: "ARRAY" as const,
                        items: {
                            type: "OBJECT" as const,
                            properties: {
                                name: { type: "STRING" as const },
                                role: {
                                    type: "STRING" as const,
                                    format: "enum",
                                    enum: [...SCOPE_ROLES],
                                },
                                fold_into: {
                                    type: "STRING" as const,
                                    nullable: true,
                                },
                                seeds: {
                                    type: "ARRAY" as const,
                                    items: {
                                        type: "OBJECT" as const,
                                        properties: {
                                            seed: { type: "STRING" as const },
                                            role: {
                                                type: "STRING" as const,
                                                format: "enum",
                                                enum: [...SCOPE_ROLES],
                                            },
                                        },
                                        required: ["seed", "role"],
                                    },
                                },
                            },
                            required: ["name", "role", "fold_into", "seeds"],
                        },
                    },
                },
                required: ["families"],
            },
        },
    })

    const raw = JSON.parse(response.text || "{}") as {
        families?: Array<Record<string, unknown>>
    }
    const knownNames = new Set(families.map((family) => normalizeName(family.name)))

    const parsed: ScopeFamilyRoleDecision[] = (Array.isArray(raw.families) ? raw.families : [])
        .map((row) => {
            const name = String(row.name || "").trim()
            const foldRaw =
                row.fold_into === null || row.fold_into === undefined
                    ? null
                    : String(row.fold_into).trim() || null
            const role = parseRole(row.role)
            return {
                name,
                role,
                fold_into:
                    foldRaw && knownNames.has(normalizeName(foldRaw))
                        ? families.find(
                              (family) =>
                                  normalizeName(family.name) === normalizeName(foldRaw),
                          )?.name || null
                        : null,
                seeds: Array.isArray(row.seeds)
                    ? row.seeds.map((seedRow) => {
                          const item = seedRow as Record<string, unknown>
                          return {
                              seed: String(item.seed || "").trim(),
                              role: parseRole(item.role),
                          }
                      }).filter((seed) => seed.seed)
                    : [],
            }
        })
        .filter((row) => row.name && knownNames.has(normalizeName(row.name)))

    // Default any missing family to acquisition_job so apply never invents drops.
    for (const family of families) {
        if (parsed.some((row) => normalizeName(row.name) === normalizeName(family.name))) {
            continue
        }
        parsed.push({
            name: family.name,
            role: "acquisition_job",
            fold_into: null,
            seeds: family.seed_keywords.map((seed) => ({
                seed,
                role: "acquisition_job" as const,
            })),
        })
    }

    return { families: parsed }
}

/**
 * Classify then apply. When no brand profile is available, skip classification
 * and return families unchanged — never invent roles from thin air.
 */
export async function refineScopeRoles(
    families: ScopeFamily[],
    brandProfile: ScopeBrandProfile | null | undefined,
    targetSeeds: string[] = [],
): Promise<{ families: ScopeFamily[]; issues: ScopeValidationIssue[] }> {
    if (!brandProfile?.product_name?.trim() || !brandProfile.product_identity?.literally?.trim()) {
        return { families: resolveParentScopeFamilyIds(families), issues: [] }
    }
    if (families.length === 0) return { families: [], issues: [] }

    try {
        const decisions = await classifyScopeRoles(families, brandProfile)
        return applyScopeRoleRefinement(families, decisions, targetSeeds)
    } catch (error) {
        console.warn("[ScopeRole] refinement failed open:", error)
        return {
            families: resolveParentScopeFamilyIds(families),
            issues: [
                {
                    message:
                        "Could not double-check product areas against brand delivery vs acquisition jobs. Review areas carefully before continuing.",
                },
            ],
        }
    }
}
