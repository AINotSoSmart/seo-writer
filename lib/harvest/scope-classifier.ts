import "server-only"

import { getGeminiClient } from "@/utils/gemini/geminiClient"
import { findThirdPartyBrand, type HarvestedQuery } from "./types"

export type AuditScopeFamily = {
    id: string
    name: string
    description: string
    seedKeywords: string[]
    priority: number
}

export type ScopedHarvestedQuery = HarvestedQuery & {
    scope_family_id: string
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

const BATCH_SIZE = 50

/**
 * Classification runs *after* the whole harvest — autocomplete, Tavily, and
 * every competitor page fetch. A batch that exhausts its attempts aborts the
 * audit with the money already spent, so the retry budget here is worth more
 * than it looks. Two bare attempts made one transient 503 fatal.
 */
const MAX_ATTEMPTS_PER_BATCH = 4
const RETRY_BASE_DELAY_MS = 700

type RawAssignment = {
    index: number
    family_id?: string | null
    decision: ScopeDecision
    reason: string
}

// findThirdPartyBrand lives in ./types.ts beside brandTokensFromUrls and
// containsExcludedBrand — this module is server-only and cannot be imported by
// the contract suite, which runs under plain node.

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
        const prompt = `You are enforcing a customer-confirmed business scope.

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

Only "direct" searches enter the customer's content program. A search must be
both relevant AND deliverable: something we could write for THIS business
without naming somebody else or inventing their internal facts.

Rules:
1. Assign a direct search to exactly one family_id.
2. Never infer a new product area.
3. A generic technology phrase is not direct merely because every family uses
   that technology.
4. A competitor page title is evidence that text exists, not permission to
   expand beyond the confirmed scope.
5. A search must use the same language as at least one confirmed search phrase
   in its assigned family. A translated phrase in an unconfirmed language is
   adjacent, even when its meaning is otherwise direct.
6. Deliverability outranks relevance. If a search is on-subject but names a
   third party, it is "third_party_branded", not "direct". If it is on-subject
   but only its publisher could answer it, it is "publisher_specific".
7. The publisher-specific test is: "could a competent outside writer answer
   this correctly from public information?" First-person framing ("our", "we
   accept", "items we") is a strong signal, but the test is the dependency on
   private facts, not the wording — "photo restoration turnaround times" is
   still publisher-specific with the pronoun removed.
8. Return exactly one assignment for every numbered query, preserving indexes.

WORKED EXAMPLES for a business that restores and animates old family photos:
- "how to restore a faded photograph"            -> direct
- "ai photo restoration"                          -> direct
- "Using Adobe Firefly to Colorize Any Old Image" -> third_party_branded
- "How to Animate Memories Using Fotor's AI"      -> third_party_branded
- "Easy Steps to Upload Photos to Forever Studios"-> third_party_branded
- "Understanding Our Turnaround Times"            -> publisher_specific
- "Items We Accept: Slides, Negatives, Prints"    -> publisher_specific
- "Our Easy Cancellation Policy and Terms"        -> publisher_specific
- "Real Reviews: What Our Clients Say"            -> publisher_specific
- "How We Protect Your Privacy and Your Images"   -> publisher_specific
- "best dslr camera for landscapes"               -> adjacent
- "how to file a tax return"                       -> unrelated

CONFIRMED FAMILIES:
${families
    .map(
        (family) =>
            `- id=${family.id}\n  name=${family.name}\n  customer job=${family.description}\n  confirmed searches=${family.seedKeywords.join(" | ")}`,
    )
    .join("\n")}

OBSERVED SEARCHES:
${batch
    .map(
        (query, index) =>
            `${index}. ${query.query} [source=${query.source}; discovered_from=${query.source_seed || "page"}]`,
    )
    .join("\n")}`

        let byIndex: Map<number, RawAssignment> | null = null
        let lastError = "invalid response"

        for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_BATCH; attempt++) {
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
                                                ],
                                            },
                                            reason: { type: "STRING" as const },
                                        },
                                        required: [
                                            "index",
                                            "family_id",
                                            "decision",
                                            "reason",
                                        ],
                                    },
                                },
                            },
                            required: ["assignments"],
                        },
                    },
                })
                const parsed = JSON.parse(response.text || "{}")
                const assignments: RawAssignment[] = Array.isArray(
                    parsed.assignments,
                )
                    ? parsed.assignments
                    : []
                const validDecisions = new Set<ScopeDecision>([
                    "direct",
                    "adjacent",
                    "unrelated",
                    "third_party_branded",
                    "publisher_specific",
                ])
                // #region agent log
                const diag = {
                    invalidDecision: 0,
                    badReason: 0,
                    unknownFamilyId: 0,
                    directMissingFamily: 0,
                    sampleUnknownFamilies: [] as string[],
                    sampleInvalidDecisions: [] as string[],
                    sampleDirectMissing: [] as number[],
                    decisionCounts: {} as Record<string, number>,
                    indexIssues: {
                        nonInteger: 0,
                        outOfRange: 0,
                        duplicate: 0,
                    },
                }
                const seenIndexes = new Set<number>()
                for (const assignment of assignments) {
                    const d = String(assignment?.decision ?? "undefined")
                    diag.decisionCounts[d] = (diag.decisionCounts[d] || 0) + 1
                    if (!validDecisions.has(assignment.decision)) {
                        diag.invalidDecision++
                        if (diag.sampleInvalidDecisions.length < 5) {
                            diag.sampleInvalidDecisions.push(d)
                        }
                    }
                    if (typeof assignment.reason !== "string") diag.badReason++
                    const suppliedFamily =
                        typeof assignment.family_id === "string" &&
                        assignment.family_id.length > 0
                    if (
                        suppliedFamily &&
                        !familyIds.has(assignment.family_id as string)
                    ) {
                        diag.unknownFamilyId++
                        if (diag.sampleUnknownFamilies.length < 5) {
                            diag.sampleUnknownFamilies.push(
                                String(assignment.family_id),
                            )
                        }
                    }
                    if (assignment.decision === "direct" && !suppliedFamily) {
                        diag.directMissingFamily++
                        if (diag.sampleDirectMissing.length < 5) {
                            diag.sampleDirectMissing.push(assignment.index)
                        }
                    }
                    if (!Number.isInteger(assignment.index)) {
                        diag.indexIssues.nonInteger++
                    } else if (
                        assignment.index < 0 ||
                        assignment.index >= batch.length
                    ) {
                        diag.indexIssues.outOfRange++
                    } else if (seenIndexes.has(assignment.index)) {
                        diag.indexIssues.duplicate++
                    } else {
                        seenIndexes.add(assignment.index)
                    }
                }
                // #endregion
                const malformed = assignments.some((assignment) => {
                    const suppliedFamily =
                        typeof assignment.family_id === "string" &&
                        assignment.family_id.length > 0
                    return (
                        !validDecisions.has(assignment.decision) ||
                        typeof assignment.reason !== "string" ||
                        (suppliedFamily &&
                            !familyIds.has(assignment.family_id as string)) ||
                        (assignment.decision === "direct" &&
                            !suppliedFamily)
                    )
                })
                if (malformed || assignments.length !== batch.length) {
                    lastError = "assignments violated the scope response contract"
                    // #region agent log
                    const payload = {
                        sessionId: "56d2b8",
                        runId: "pre-fix",
                        hypothesisId: "A-E",
                        location: "scope-classifier.ts:contract",
                        message: "scope response contract violated",
                        data: {
                            attempt,
                            offset,
                            batchLength: batch.length,
                            assignmentCount: assignments.length,
                            lengthMismatch:
                                assignments.length !== batch.length,
                            malformed,
                            familyCount: families.length,
                            knownFamilyIds: families.map((f) => f.id),
                            knownFamilyNames: families.map((f) => f.name),
                            textLen: (response.text || "").length,
                            ...diag,
                        },
                        timestamp: Date.now(),
                    }
                    console.error(
                        "[debug-56d2b8] scope contract violation",
                        JSON.stringify(payload.data),
                    )
                    fetch(
                        "http://127.0.0.1:7402/ingest/9eb5bbba-9e17-4d17-941f-d7f2c5a309b7",
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "X-Debug-Session-Id": "56d2b8",
                            },
                            body: JSON.stringify(payload),
                        },
                    ).catch(() => {})
                    // #endregion
                    continue
                }
                const candidate = new Map<number, RawAssignment>()
                for (const assignment of assignments) {
                    if (
                        Number.isInteger(assignment.index) &&
                        assignment.index >= 0 &&
                        assignment.index < batch.length &&
                        !candidate.has(assignment.index)
                    ) {
                        candidate.set(assignment.index, assignment)
                    }
                }
                if (candidate.size !== batch.length) {
                    lastError = `${candidate.size}/${batch.length} decisions`
                    // #region agent log
                    const payload = {
                        sessionId: "56d2b8",
                        runId: "pre-fix",
                        hypothesisId: "A",
                        location: "scope-classifier.ts:index-coverage",
                        message: "assignment index coverage incomplete",
                        data: {
                            attempt,
                            offset,
                            batchLength: batch.length,
                            assignmentCount: assignments.length,
                            candidateSize: candidate.size,
                            ...diag,
                        },
                        timestamp: Date.now(),
                    }
                    console.error(
                        "[debug-56d2b8] index coverage fail",
                        JSON.stringify(payload.data),
                    )
                    fetch(
                        "http://127.0.0.1:7402/ingest/9eb5bbba-9e17-4d17-941f-d7f2c5a309b7",
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "X-Debug-Session-Id": "56d2b8",
                            },
                            body: JSON.stringify(payload),
                        },
                    ).catch(() => {})
                    // #endregion
                    continue
                }
                byIndex = candidate
                callsSucceeded++
                // #region agent log
                fetch(
                    "http://127.0.0.1:7402/ingest/9eb5bbba-9e17-4d17-941f-d7f2c5a309b7",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "X-Debug-Session-Id": "56d2b8",
                        },
                        body: JSON.stringify({
                            sessionId: "56d2b8",
                            runId: "pre-fix",
                            hypothesisId: "ok",
                            location: "scope-classifier.ts:batch-ok",
                            message: "scope batch accepted",
                            data: {
                                attempt,
                                offset,
                                batchLength: batch.length,
                                decisionCounts: diag.decisionCounts,
                            },
                            timestamp: Date.now(),
                        }),
                    },
                ).catch(() => {})
                // #endregion
                break
            } catch (error) {
                lastError =
                    error instanceof Error ? error.message : "unknown error"
                // #region agent log
                const payload = {
                    sessionId: "56d2b8",
                    runId: "pre-fix",
                    hypothesisId: "E",
                    location: "scope-classifier.ts:catch",
                    message: "scope classification attempt threw",
                    data: {
                        attempt,
                        offset,
                        batchLength: batch.length,
                        error: lastError,
                    },
                    timestamp: Date.now(),
                }
                console.error(
                    "[debug-56d2b8] classification throw",
                    JSON.stringify(payload.data),
                )
                fetch(
                    "http://127.0.0.1:7402/ingest/9eb5bbba-9e17-4d17-941f-d7f2c5a309b7",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "X-Debug-Session-Id": "56d2b8",
                        },
                        body: JSON.stringify(payload),
                    },
                ).catch(() => {})
                // #endregion
            }
        }

        if (!byIndex) {
            // #region agent log
            fetch(
                "http://127.0.0.1:7402/ingest/9eb5bbba-9e17-4d17-941f-d7f2c5a309b7",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Debug-Session-Id": "56d2b8",
                    },
                    body: JSON.stringify({
                        sessionId: "56d2b8",
                        runId: "pre-fix",
                        hypothesisId: "fatal",
                        location: "scope-classifier.ts:fatal",
                        message: "scope classification exhausted attempts",
                        data: {
                            offset,
                            batchLength: batch.length,
                            lastError,
                            classifiableTotal: classifiable.length,
                            familyCount: families.length,
                        },
                        timestamp: Date.now(),
                    }),
                },
            ).catch(() => {})
            // #endregion
            throw new Error(
                `Business-scope classification failed after ${MAX_ATTEMPTS_PER_BATCH} bounded attempts: ${lastError}`,
            )
        }

        for (let index = 0; index < batch.length; index++) {
            const query = batch[index]
            const assignment = byIndex.get(index)!
            const familyId =
                assignment.family_id && familyIds.has(assignment.family_id)
                    ? assignment.family_id
                    : null

            if (assignment.decision === "direct" && familyId) {
                kept.push({ ...query, scope_family_id: familyId })
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
