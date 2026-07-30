import "server-only"

import { getGeminiClient } from "@/utils/gemini/geminiClient"
import type { HarvestedQuery } from "./types"

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

export type ScopeRejectedQuery = {
    query: string
    source: string
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
    decision: "direct" | "adjacent" | "unrelated"
    reason: string
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

    for (let offset = 0; offset < queries.length; offset += BATCH_SIZE) {
        const batch = queries.slice(offset, offset + BATCH_SIZE)
        const prompt = `You are enforcing a customer-confirmed business scope.

Your task is classification, not brainstorming. For every observed search:
- "direct": a person searching it could reasonably be trying to understand,
  compare, choose, or accomplish the exact capability/customer job in ONE
  confirmed family.
- "adjacent": it shares technology or vocabulary but concerns another product,
  industry, job, or use case.
- "unrelated": it does not concern any confirmed family.

Only "direct" searches enter the customer's content program.

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
6. Return exactly one assignment for every numbered query, preserving indexes.

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
                                                enum: ["direct", "adjacent", "unrelated"],
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
                const validDecisions = new Set([
                    "direct",
                    "adjacent",
                    "unrelated",
                ])
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
                    continue
                }
                byIndex = candidate
                callsSucceeded++
                break
            } catch (error) {
                lastError =
                    error instanceof Error ? error.message : "unknown error"
            }
        }

        if (!byIndex) {
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
                    reason:
                        assignment.reason ||
                        "Search intent does not directly belong to a confirmed product area.",
                    suggestedFamilyId: familyId,
                })
            }
        }
    }

    return { kept, dropped, callsAttempted, callsSucceeded }
}
