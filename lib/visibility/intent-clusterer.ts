import { getGeminiClient } from "@/utils/gemini/geminiClient"
import { normalizeQuery } from "@/lib/harvest/types"
import type { QueryIntentBinding } from "@/lib/writer/article-contract"
import { meaningfulTokens, tokenJaccard } from "./site-coverage-match"

/** Maximum buyer questions mapped to a single article proposal. */
export const MAX_PROMPTS_PER_ARTICLE = 4

export interface PlanningPrompt {
    opportunityId: string
    trackedPromptId: string
    scopeFamilyId: string
    prompt: string
    sourceSeed: string
    priority: number
    reason: string
    binding: QueryIntentBinding
    customerJob: string
    capabilityFactIds: string[]
}

export interface IntentCluster {
    title: string
    intentSummary: string
    prompts: PlanningPrompt[]
}

export function formatArticleTitle(prompt: string): string {
    const cleaned = prompt.trim().replace(/[?.!]+$/, "")
    const rewritten = cleaned
        .replace(/^how (?:do|can|should) (?:i|you)\s+/i, "How to ")
        .replace(/^what is the best way to\s+/i, "How to ")
    return rewritten.charAt(0).toUpperCase() + rewritten.slice(1)
}

const INTENT_CLUSTER_SCHEMA = {
    type: "OBJECT" as const,
    properties: {
        clusters: {
            type: "ARRAY" as const,
            items: {
                type: "OBJECT" as const,
                properties: {
                    title: { type: "STRING" as const },
                    intentSummary: { type: "STRING" as const },
                    promptIndices: {
                        type: "ARRAY" as const,
                        items: { type: "INTEGER" as const },
                    },
                },
                required: ["title", "intentSummary", "promptIndices"],
            },
        },
    },
    required: ["clusters"],
}

export function buildIntentClusterPrompt(prompts: PlanningPrompt[]): string {
    return `You are an expert editorial strategist and SEO architect for AI search visibility.

You are given a list of buyer search questions that our brand was absent from in AI answer engines (ChatGPT, Google AI, Perplexity).
Your task is to cluster these questions into discrete, highly focused editorial content opportunities (each representing ONE blog article or page refresh).

CRITICAL CLUSTERING PRINCIPLES:
1. ONLY MERGE IDENTICAL / SYNONYMOUS BUYER INTENTS:
   Two questions belong in the same cluster ONLY if they share the exact same underlying question and a single focused article can directly and satisfyingly answer both without becoming a bloated, generic catch-all.
   - Example of SAME intent (MERGE):
     "What tool turns screenshots into editable mobile UI?" AND
     "Best AI tool for recreating mobile screenshots as editable layouts"
     -> Group together in one cluster.
   - Example of DIFFERENT intents (DO NOT MERGE):
     "What tool turns screenshots into editable mobile UI?" AND
     "How to export mobile UI design tokens for Cursor"
     -> Separate clusters! Merging them creates an unfocused mess.
   - Example of DIFFERENT intents:
     "AI tool to design mobile app screens from scratch" AND
     "Can AI generate full multi-screen checkout flow from one prompt"
     -> Separate clusters!

2. HARD ANTI-OVERMERGE INVARIANT:
   - Each cluster MUST contain at most ${MAX_PROMPTS_PER_ARTICLE} questions.
   - Standalone clusters (clusters with exactly 1 question) are completely normal and encouraged whenever an intent is distinct.
   - NEVER create a catch-all "mega-cluster" absorbing many diverse prompts.

3. COMPELLING, NATURAL ARTICLE TITLES:
   Each cluster title must be a clear, attractive, high-converting article headline (e.g., "Best AI Tools for Designing Mobile App MVPs in 2026", "How to Convert Mobile App Screenshots into Editable UI Layouts", "The Complete Guide to Exporting AI Mobile Designs for Cursor and Copilot").

INPUT QUESTIONS (by 0-indexed position):
${prompts.map((p, idx) => `[${idx}] ${p.prompt} (Context: ${p.sourceSeed})`).join("\n")}

Return EVERY input index in exactly one cluster. Do not omit any question.`
}

/**
 * Deterministic fallback clustering using lexical Jaccard overlap on meaningful tokens.
 * Enforces MAX_PROMPTS_PER_ARTICLE so prompts are never lumped into 1 mega-bucket.
 */
export function fallbackIntentClustering(prompts: PlanningPrompt[]): IntentCluster[] {
    const unassigned = new Set(prompts.map((_, idx) => idx))
    const clusters: IntentCluster[] = []

    for (let i = 0; i < prompts.length; i++) {
        if (!unassigned.has(i)) continue
        unassigned.delete(i)

        const basePrompt = prompts[i]
        const baseTokens = meaningfulTokens(basePrompt.prompt)
        const group: PlanningPrompt[] = [basePrompt]

        // Find close lexical variants up to MAX_PROMPTS_PER_ARTICLE
        for (let j = i + 1; j < prompts.length; j++) {
            if (!unassigned.has(j)) continue
            if (group.length >= MAX_PROMPTS_PER_ARTICLE) break

            const candTokens = meaningfulTokens(prompts[j].prompt)
            const similarity = tokenJaccard(baseTokens, candTokens)

            // High threshold: only genuine paraphrases merge
            if (similarity >= 0.55) {
                group.push(prompts[j])
                unassigned.delete(j)
            }
        }

        clusters.push({
            title: formatArticleTitle(basePrompt.prompt),
            intentSummary: `Addressed by ${group.length} closely aligned buyer question${group.length === 1 ? "" : "s"}.`,
            prompts: group,
        })
    }

    return clusters
}

/**
 * Clusters losing buyer prompts into discrete, intent-aligned content proposals.
 * Guarantees that no proposal absorbs more than MAX_PROMPTS_PER_ARTICLE questions.
 */
export async function clusterPromptsByBuyerIntent(
    prompts: PlanningPrompt[],
): Promise<IntentCluster[]> {
    if (prompts.length === 0) return []
    if (prompts.length === 1) {
        return [
            {
                title: formatArticleTitle(prompts[0].prompt),
                intentSummary: `Targeting: ${prompts[0].prompt}`,
                prompts: [prompts[0]],
            },
        ]
    }

    try {
        const client = getGeminiClient()
        const response = await client.models.generateContent({
            model: "gemini-3.7-flash",
            contents: [
                {
                    role: "user",
                    parts: [{ text: buildIntentClusterPrompt(prompts) }],
                },
            ],
            config: {
                temperature: 0.2,
                responseMimeType: "application/json",
                responseSchema: INTENT_CLUSTER_SCHEMA,
            },
        })

        const parsed = JSON.parse(response.text || "{}") as {
            clusters?: Array<{
                title?: unknown
                intentSummary?: unknown
                promptIndices?: unknown
            }>
        }

        const rawClusters = Array.isArray(parsed.clusters) ? parsed.clusters : []
        const assignedIndices = new Set<number>()
        const validClusters: IntentCluster[] = []

        for (const raw of rawClusters) {
            const rawIndices = Array.isArray(raw.promptIndices) ? raw.promptIndices : []
            const validIndices = rawIndices
                .map((idx) => Number(idx))
                .filter(
                    (idx) =>
                        Number.isInteger(idx) &&
                        idx >= 0 &&
                        idx < prompts.length &&
                        !assignedIndices.has(idx),
                )

            if (validIndices.length === 0) continue

            for (const idx of validIndices) {
                assignedIndices.add(idx)
            }

            const rawTitle = typeof raw.title === "string" ? raw.title.trim() : ""
            const intentSummary =
                typeof raw.intentSummary === "string" && raw.intentSummary.trim()
                    ? raw.intentSummary.trim()
                    : `Intent covering ${validIndices.length} buyer questions`

            const clusterPrompts = validIndices.map((idx) => prompts[idx])
            const title = rawTitle.length >= 8 ? rawTitle : formatArticleTitle(clusterPrompts[0].prompt)

            // Hard invariant: sub-divide any cluster exceeding MAX_PROMPTS_PER_ARTICLE
            for (let start = 0; start < clusterPrompts.length; start += MAX_PROMPTS_PER_ARTICLE) {
                const chunk = clusterPrompts.slice(start, start + MAX_PROMPTS_PER_ARTICLE)
                const chunkTitle = start === 0 ? title : `${title} (Part ${Math.floor(start / MAX_PROMPTS_PER_ARTICLE) + 1})`
                validClusters.push({
                    title: chunkTitle,
                    intentSummary,
                    prompts: chunk,
                })
            }
        }

        // Catch any missed prompts and wrap them in standalone clusters
        for (let i = 0; i < prompts.length; i++) {
            if (!assignedIndices.has(i)) {
                validClusters.push({
                    title: formatArticleTitle(prompts[i].prompt),
                    intentSummary: `Standalone buyer question: ${prompts[i].prompt}`,
                    prompts: [prompts[i]],
                })
            }
        }

        if (validClusters.length > 0) {
            return validClusters
        }

        return fallbackIntentClustering(prompts)
    } catch (error) {
        console.warn(
            "[IntentClusterer] Gemini clustering failed, using fallback clustering:",
            error instanceof Error ? error.message : error,
        )
        return fallbackIntentClustering(prompts)
    }
}
