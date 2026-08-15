import "server-only"

import { jsonrepair } from "jsonrepair"

import { getGeminiClient } from "@/utils/gemini/geminiClient"
import { findThirdPartyBrand, type HarvestedQuery } from "./types"
import type { CapabilityContract } from "../writer/article-contract"
import type {
    CapabilityFit,
    QueryIntentBinding,
    SolutionMode,
} from "../writer/article-contract"

export type AuditScopeFamily = {
    id: string
    name: string
    description: string
    seedKeywords: string[]
    priority: number
    /** Broader confirmed domain this area is a sub-intent of, when declared. */
    parentScopeFamilyId?: string | null
    capabilityContract: CapabilityContract
}

export type ScopedHarvestedQuery = HarvestedQuery & {
    scope_family_id: string
    intent_binding: QueryIntentBinding
}

/**
 * Why a query was let in or kept out.
 *
 * `direct` is the only value that enters a content program, and it means both
 * "belongs to a confirmed family" AND "is deliverable for this customer". The
 * two deliverability rejections are separate values rather than free text so
 * drops stay machine-readable in /verify diagnostics and in tests.
 */
export type ScopeDecision =
    | "direct"
    | "adjacent"
    | "unrelated"
    /** Centres on a third party's product — "Using Adobe Firefly to Restore Photos" */
    | "third_party_branded"
    /** Answerable only by whoever published it — "Our Turnaround Times" */
    | "publisher_specific"
    /**
     * Asks how to do the job inside another platform's built-in feature —
     * "add person to photo google pixel", "sync database in Airtable".
     * Autocomplete is a popularity engine, so mass-market platform questions
     * leak in even when the job itself is exactly what the customer sells.
     */
    | "platform_native"

export type ScopeRejectedQuery = {
    query: string
    source: string
    decision: ScopeDecision
    reason: string
    suggestedFamilyId: string | null
}

export type ScopeClassificationResult = {
    kept: ScopedHarvestedQuery[]
    dropped: ScopeRejectedQuery[]
    callsAttempted: number
    callsSucceeded: number
}

/**
 * Keep batches small. Gemini structured output for 50 rows with five decision
 * classes routinely returned the wrong assignment count or mangled UUID
 * family_ids, which fail-closed the whole audit after harvest spend.
 */
const BATCH_SIZE = 25

/**
 * Classification runs *after* the whole harvest — autocomplete, Tavily, and
 * every competitor page fetch. A batch that exhausts its attempts aborts the
 * audit with the money already spent. Retries keep already-valid rows and ask
 * only for the missing indexes so a 9/25 truncated response cannot discard
 * the 9 and fail-close the run.
 */
const MAX_ATTEMPTS_PER_BATCH = 4
const RETRY_BASE_DELAY_MS = 700

type RawAssignment = {
    index: number
    family_id?: string | null
    decision: ScopeDecision
    reason: string
    operation_key?: string | null
    capability_fit: CapabilityFit
    solution_mode: SolutionMode
}

const VALID_CAPABILITY_FITS = new Set<CapabilityFit>([
    "explicit",
    "mechanically_entailed",
    "educational",
])
const VALID_SOLUTION_MODES = new Set<SolutionMode>([
    "product_led",
    "category_educational",
])

/**
 * Must stay in step with both the ScopeDecision union AND the responseSchema
 * enum below. A value the schema permits but this set omits is treated as a
 * contract violation, which skips that row. After four attempts a still-
 * incomplete batch aborts an audit whose harvest spend is already committed.
 */
const VALID_DECISIONS = new Set<ScopeDecision>([
    "direct",
    "adjacent",
    "unrelated",
    "third_party_branded",
    "publisher_specific",
    "platform_native",
])

function modelJsonText(response: {
    text?: string
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
}): string {
    if (typeof response.text === "string" && response.text.trim()) return response.text
    const parts = response.candidates?.[0]?.content?.parts
    if (!Array.isArray(parts)) return ""
    return parts.map((part) => part.text || "").join("")
}

function parseClassifierJson(raw: string): { assignments?: unknown } {
    const text = raw.trim()
    if (!text) return {}
    try {
        return JSON.parse(text)
    } catch {
        try {
            return JSON.parse(jsonrepair(text))
        } catch {
            return {}
        }
    }
}

// findThirdPartyBrand lives in ./types.ts beside brandTokensFromUrls and
// containsExcludedBrand — this module is server-only and cannot be imported by
// the contract suite, which runs under plain node.

/**
 * Models copy short aliases (`f1`) reliably and invent/mangle UUIDs often.
 * Prompt and schema use aliases; persistence still stores the real family UUID.
 */
function buildFamilyAliasMaps(families: AuditScopeFamily[]): {
    aliasToId: Map<string, string>
    idToAlias: Map<string, string>
    nameToId: Map<string, string>
} {
    const aliasToId = new Map<string, string>()
    const idToAlias = new Map<string, string>()
    const nameToId = new Map<string, string>()
    families.forEach((family, index) => {
        const alias = `f${index + 1}`
        aliasToId.set(alias, family.id)
        idToAlias.set(family.id, alias)
        const nameKey = family.name.trim().toLowerCase()
        if (nameKey && !nameToId.has(nameKey)) {
            nameToId.set(nameKey, family.id)
        }
    })
    return { aliasToId, idToAlias, nameToId }
}

function resolveFamilyRef(
    raw: unknown,
    aliasToId: Map<string, string>,
    nameToId: Map<string, string>,
    familyIds: Set<string>,
): string | null {
    if (typeof raw !== "string") return null
    const trimmed = raw.trim()
    if (!trimmed) return null
    const aliasHit = aliasToId.get(trimmed.toLowerCase())
    if (aliasHit) return aliasHit
    if (familyIds.has(trimmed)) return trimmed
    const nameHit = nameToId.get(trimmed.toLowerCase())
    if (nameHit) return nameHit
    return null
}

function diagnoseContractFailure(
    assignments: RawAssignment[],
    batchLength: number,
    aliasToId: Map<string, string>,
    nameToId: Map<string, string>,
    familyIds: Set<string>,
): Record<string, unknown> {
    let invalidDecision = 0
    let badReason = 0
    let directMissingFamily = 0
    let unknownFamilyId = 0
    const sampleUnknown: string[] = []
    const seen = new Set<number>()
    let duplicate = 0
    let outOfRange = 0

    for (const assignment of assignments) {
        if (!VALID_DECISIONS.has(assignment.decision)) invalidDecision++
        if (typeof assignment.reason !== "string") badReason++
        const resolved = resolveFamilyRef(
            assignment.family_id,
            aliasToId,
            nameToId,
            familyIds,
        )
        const supplied =
            typeof assignment.family_id === "string" &&
            assignment.family_id.trim().length > 0
        if (supplied && !resolved) {
            unknownFamilyId++
            if (sampleUnknown.length < 5) {
                sampleUnknown.push(String(assignment.family_id))
            }
        }
        if (assignment.decision === "direct" && !resolved) {
            directMissingFamily++
        }
        if (!Number.isInteger(assignment.index)) outOfRange++
        else if (assignment.index < 0 || assignment.index >= batchLength) {
            outOfRange++
        } else if (seen.has(assignment.index)) duplicate++
        else seen.add(assignment.index)
    }

    return {
        batchLength,
        assignmentCount: assignments.length,
        coveredIndexes: seen.size,
        invalidDecision,
        badReason,
        directMissingFamily,
        unknownFamilyId,
        sampleUnknown,
        duplicate,
        outOfRange,
    }
}

/**
 * Positive business-scope assignment.
 *
 * This does not ask whether a phrase is "generally relevant" to a blended
 * brand centroid. It asks which customer-confirmed commercial family directly
 * owns the search intent. Adjacent technology and broad industry content are
 * rejected even when they share vocabulary with the product.
 */
export async function classifyQueriesToScope(
    queries: HarvestedQuery[],
    families: AuditScopeFamily[],
    competitorBrandTokens: string[] = [],
): Promise<ScopeClassificationResult> {
    if (families.length === 0) {
        throw new Error("Confirmed audit scope is empty")
    }

    const client = getGeminiClient()
    const familyIds = new Set(families.map((family) => family.id))
    const { aliasToId, idToAlias, nameToId } = buildFamilyAliasMaps(families)
    const kept: ScopedHarvestedQuery[] = []
    const dropped: ScopeRejectedQuery[] = []
    let callsAttempted = 0
    let callsSucceeded = 0

    // Deterministic pass first, so known-branded queries cost no tokens.
    const classifiable: HarvestedQuery[] = []
    for (const query of queries) {
        const brand = findThirdPartyBrand(query.query, competitorBrandTokens)
        if (brand) {
            dropped.push({
                query: query.query,
                source: query.source,
                decision: "third_party_branded",
                reason: `Names "${brand}", which is not this business.`,
                suggestedFamilyId: null,
            })
        } else {
            classifiable.push(query)
        }
    }

    for (let offset = 0; offset < classifiable.length; offset += BATCH_SIZE) {
        const batch = classifiable.slice(offset, offset + BATCH_SIZE)
        const promptHead = `You are enforcing a customer-confirmed business scope.

Your task is classification, not brainstorming. For every observed search:
- "direct": a person searching it could reasonably be trying to understand,
  compare, choose, or accomplish the exact capability/customer job in ONE
  confirmed family.
- "adjacent": it shares technology or vocabulary but concerns another product,
  industry, job, or use case.
- "unrelated": it does not concern any confirmed family.
- "third_party_branded": it centres on a named company, product, app, or tool
  that is not this business. The topic may be perfectly on-subject and still
  belong here — what disqualifies it is the named third party.
- "publisher_specific": answering it requires the private operational facts of
  whichever company published it, so no outside writer could answer it
  correctly. Company policies, turnaround times, accepted formats, shipping,
  pricing terms, refund and cancellation rules, privacy handling, staff, and
  customer testimonials are all publisher-specific.
- "platform_native": asks how to do the job using another platform's own
  built-in feature rather than a product like this one. The job may be exactly
  what this business does and it still belongs here — what disqualifies it is
  that the asker wants to do it somewhere this business does not operate.
  Device and OS qualifiers are the usual tell ("on iphone", "in google sheets",
  "google pixel", "windows built-in"), but the test is the destination, not the
  wording.

Only "direct" searches enter the customer's content program. A search must be
both relevant AND deliverable: something we could write for THIS business
without naming somebody else or inventing their internal facts.

Rules:
1. Assign a direct search to exactly one family_id. family_id MUST be one of
   the short aliases listed below (f1, f2, …) — never invent an id and never
   use the family display name as family_id.
2. For non-direct decisions, set family_id and operation_key to null, with
   capability_fit="educational" and solution_mode="category_educational".
3. Never infer a new product area.
4. A generic technology phrase is not direct merely because every family uses
   that technology.
5. A competitor page title is evidence that text exists, not permission to
   expand beyond the confirmed scope.
6. A search must use the same language as at least one confirmed search phrase
   in its assigned family. A translated phrase in an unconfirmed language is
   adjacent, even when its meaning is otherwise direct.
7. Deliverability outranks relevance. If a search is on-subject but names a
   third party, it is "third_party_branded", not "direct". If it is on-subject
   but only its publisher could answer it, it is "publisher_specific".
8. The publisher-specific test is: "could a competent outside writer answer
   this correctly from public information?" First-person framing ("our", "we
   accept", "items we") is a strong signal, but the test is the dependency on
   private facts, not the wording — "photo restoration turnaround times" is
   still publisher-specific with the pronoun removed.
9. Return exactly one assignment for every numbered query, preserving indexes.
   The assignments array length must equal the number of observed searches.
10. For every direct search, also choose:
   - operation_key: one operation key from its assigned family, or null only for
     category education that does not claim the product performs the job.
   - capability_fit: explicit when the exact use is stated; mechanically_entailed
     only when the confirmed inputs + action + output genuinely support the
     variant; educational when the brand has relevant expertise but should not
     claim the product directly performs it.
   - solution_mode: product_led for explicit/mechanically_entailed operations,
     category_educational for educational coverage.
   Mechanics-bound does not mean family-level guessing. Never infer performance,
   compatibility, accuracy, timing, people, or guarantees.

WORKED EXAMPLES for a business with f1=Photo Restoration, f2=Photo Animation:
- "how to restore a faded photograph"            -> direct, family_id=f1
- "ai photo restoration"                          -> direct, family_id=f1
- "how to animate an old photo"                   -> direct, family_id=f2
- "Using Adobe Firefly to Colorize Any Old Image" -> third_party_branded, family_id=null
- "How to Animate Memories Using Fotor's AI"      -> third_party_branded, family_id=null
- "Easy Steps to Upload Photos to Forever Studios"-> third_party_branded, family_id=null
- "Understanding Our Turnaround Times"            -> publisher_specific, family_id=null
- "Items We Accept: Slides, Negatives, Prints"    -> publisher_specific, family_id=null
- "Our Easy Cancellation Policy and Terms"        -> publisher_specific, family_id=null
- "Real Reviews: What Our Clients Say"            -> publisher_specific, family_id=null
- "How We Protect Your Privacy and Your Images"   -> publisher_specific, family_id=null
- "restore a photo on iphone photos app"          -> platform_native
- "best dslr camera for landscapes"               -> adjacent, family_id=null
- "how to file a tax return"                       -> unrelated, family_id=null

CONFIRMED FAMILIES:
${families
    .map((family) => {
        const alias = idToAlias.get(family.id)!
        const operations = family.capabilityContract.operations.map((operation) =>
            `    operation_key=${operation.key}; job=${operation.customerJob}; inputs=${operation.inputs.join(", ") || "not stated"}; action=${operation.action}; outputs=${operation.outputs.join(", ") || "not stated"}; limits=${operation.limits.join(", ") || "none stated"}`,
        ).join("\n")
        return `- family_id=${alias}\n  name=${family.name}\n  customer job=${family.description}\n  delivery=${family.capabilityContract.deliveryMode}\n  confirmed searches=${family.seedKeywords.join(" | ")}\n  operations:\n${operations}`
    })
    .join("\n")}
`

        const filled = new Map<number, RawAssignment>()
        let lastError = "invalid response"

        for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_BATCH; attempt++) {
            const pending = Array.from(
                { length: batch.length },
                (_, index) => index,
            ).filter((index) => !filled.has(index))
            if (pending.length === 0) break

            const prompt = `${promptHead}
OBSERVED SEARCHES (${pending.length} items — return exactly ${pending.length} assignments using the original index numbers shown):
${pending
    .map((index) => {
        const query = batch[index]
        return `${index}. ${query.query} [source=${query.source}; discovered_from=${query.source_seed || "page"}]\n   source_context=${query.source_context}`
    })
    .join("\n")}`
            callsAttempted++
            if (attempt > 1) {
                // Exponential backoff with jitter, matching suggest-client.ts.
                // A retry fired immediately against a rate-limited or briefly
                // unavailable model just burns the remaining budget.
                const delay =
                    RETRY_BASE_DELAY_MS * 2 ** (attempt - 2) +
                    Math.random() * RETRY_BASE_DELAY_MS
                await new Promise((resolve) => setTimeout(resolve, delay))
            }
            try {
                const response = await client.models.generateContent({
                    model: "gemini-3.1-flash-lite",
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    config: {
                        temperature: 0,
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: "OBJECT" as const,
                            properties: {
                                assignments: {
                                    type: "ARRAY" as const,
                                    items: {
                                        type: "OBJECT" as const,
                                        properties: {
                                            index: { type: "INTEGER" as const },
                                            family_id: {
                                                type: "STRING" as const,
                                                nullable: true,
                                            },
                                            decision: {
                                                type: "STRING" as const,
                                                enum: [
                                                    "direct",
                                                    "adjacent",
                                                    "unrelated",
                                                    "third_party_branded",
                                                    "publisher_specific",
                                                    "platform_native",
                                                ],
                                            },
                                            reason: { type: "STRING" as const },
                                            operation_key: {
                                                type: "STRING" as const,
                                                nullable: true,
                                            },
                                            capability_fit: {
                                                type: "STRING" as const,
                                                enum: ["explicit", "mechanically_entailed", "educational"],
                                            },
                                            solution_mode: {
                                                type: "STRING" as const,
                                                enum: ["product_led", "category_educational"],
                                            },
                                        },
                                        required: [
                                            "index",
                                            "family_id",
                                            "decision",
                                            "reason",
                                            "operation_key",
                                            "capability_fit",
                                            "solution_mode",
                                        ],
                                    },
                                },
                            },
                            required: ["assignments"],
                        },
                    },
                })
                const parsed = parseClassifierJson(modelJsonText(response))
                const assignments: RawAssignment[] = Array.isArray(
                    parsed.assignments,
                )
                    ? parsed.assignments
                    : []

                const pendingSet = new Set(pending)
                for (const assignment of assignments) {
                    if (
                        !Number.isInteger(assignment.index) ||
                        !pendingSet.has(assignment.index) ||
                        filled.has(assignment.index)
                    ) {
                        continue
                    }
                    if (
                        !VALID_DECISIONS.has(assignment.decision) ||
                        typeof assignment.reason !== "string" ||
                        !VALID_CAPABILITY_FITS.has(assignment.capability_fit) ||
                        !VALID_SOLUTION_MODES.has(assignment.solution_mode)
                    ) {
                        continue
                    }

                    const resolved = resolveFamilyRef(
                        assignment.family_id,
                        aliasToId,
                        nameToId,
                        familyIds,
                    )

                    if (assignment.decision === "direct") {
                        if (!resolved) continue
                        const family = families.find((row) => row.id === resolved)
                        const operationKey =
                            typeof assignment.operation_key === "string" && assignment.operation_key.trim()
                                ? assignment.operation_key.trim()
                                : null
                        const operationExists = Boolean(
                            family?.capabilityContract.operations.some(
                                (operation) => operation.key === operationKey,
                            ),
                        )
                        if (
                            (assignment.solution_mode === "product_led" && !operationExists) ||
                            (assignment.capability_fit === "educational" && assignment.solution_mode !== "category_educational") ||
                            (assignment.capability_fit !== "educational" && assignment.solution_mode !== "product_led")
                        ) {
                            continue
                        }
                        filled.set(assignment.index, {
                            ...assignment,
                            family_id: resolved,
                            operation_key: operationExists ? operationKey : null,
                        })
                    } else {
                        // Non-direct: an unknown/mangled family_id must not
                        // fail the whole batch — clear it and keep the decision.
                        filled.set(assignment.index, {
                            ...assignment,
                            family_id: resolved,
                        })
                    }
                }

                if (filled.size === batch.length) {
                    callsSucceeded++
                    break
                }

                lastError = `${filled.size}/${batch.length} decisions`
                console.error(
                    "[scope-classifier] partial batch, keeping valid rows and retrying the rest",
                    JSON.stringify({
                        attempt,
                        offset,
                        lastError,
                        pendingAfter: batch.length - filled.size,
                        ...diagnoseContractFailure(
                            assignments,
                            batch.length,
                            aliasToId,
                            nameToId,
                            familyIds,
                        ),
                    }),
                )
            } catch (error) {
                lastError =
                    error instanceof Error ? error.message : "unknown error"
                console.error(
                    "[scope-classifier] attempt threw",
                    JSON.stringify({
                        attempt,
                        offset,
                        batchLength: batch.length,
                        error: lastError,
                    }),
                )
            }
        }

        if (filled.size !== batch.length) {
            throw new Error(
                `Business-scope classification failed after ${MAX_ATTEMPTS_PER_BATCH} bounded attempts: ${lastError}`,
            )
        }
        const byIndex = filled

        for (let index = 0; index < batch.length; index++) {
            const query = batch[index]
            const assignment = byIndex.get(index)!
            const familyId =
                assignment.family_id && familyIds.has(assignment.family_id)
                    ? assignment.family_id
                    : null

            if (assignment.decision === "direct" && familyId) {
                kept.push({
                    ...query,
                    scope_family_id: familyId,
                    intent_binding: {
                        scopeFamilyId: familyId,
                        operationKey: assignment.operation_key || null,
                        capabilityFit: assignment.capability_fit,
                        solutionMode: assignment.solution_mode,
                        reason: assignment.reason,
                    },
                })
            } else {
                dropped.push({
                    query: query.query,
                    source: query.source,
                    decision: assignment.decision,
                    reason:
                        assignment.reason ||
                        "Search intent does not directly belong to a confirmed product area.",
                    // A deliverability rejection is not a near-miss: suggesting
                    // the family it would have joined invites someone to
                    // reinstate a topic that names a competitor or depends on
                    // another company's internal facts.
                    suggestedFamilyId:
                        assignment.decision === "adjacent" ? familyId : null,
                })
            }
        }
    }

    return { kept, dropped, callsAttempted, callsSucceeded }
}
