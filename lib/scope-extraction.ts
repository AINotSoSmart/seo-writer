import "server-only"

import { jsonrepair } from "jsonrepair"

import { getGeminiClient } from "@/utils/gemini/geminiClient"
import { MAX_SCOPE_FAMILIES, MAX_TOTAL_SCOPE_SEEDS } from "@/lib/brand-scope"
import {
    fallbackCapabilityContract,
    type CapabilityContract,
    type CapabilityFact,
} from "@/lib/writer/article-contract"

/**
 * Commercial scope extraction.
 *
 * This used to be field 10 of an eleven-field brand-persona prompt that also
 * produced emotional identity, "the enemy", audience psychology and a Style DNA
 * paragraph — all in one flash-lite call. The single most consequential decision
 * in the product ("what does this business actually sell?") was competing for
 * attention with prose about tone of voice, and it showed: a text-to-mobile-UI
 * generator came back as one vague family called "Design Handoff and
 * Implementation", anchored to the wrong search intent for the whole audit.
 *
 * It is now its own call, with its own model, reading only the pages that say
 * what the business sells. Sending fewer, better pages makes this cheaper than
 * the 50k-character blob it replaced, not more expensive.
 */

export type ExtractedScopeFamily = {
    name: string
    description: string
    seed_keywords: string[]
    evidence: Array<{ url: string; quote: string }>
    capability_contract: CapabilityContract
    /**
     * Name of the broader domain this one is a sub-intent of, when the model
     * judged it narrower than a peer.
     *
     * Extraction was emitting domains at inconsistent depth — a broad
     * capability beside one of its own sub-cases — and the narrow ones then
     * measured too little demand to sustain a cluster. Under the old pipeline
     * those were silently destroyed. They are now absorbed instead, and this
     * hint tells the absorber which domain they belong under rather than
     * leaving it to embedding proximity alone.
     */
    parent_hint: string | null
    source: "extracted"
}

type CrawledPage = { url: string; content: string }

/** Roughly 6k tokens of page text — enough for scope, far less than the old blob. */
const MAX_CONTENT_CHARS = 24_000
const MAX_PAGES = 12
const PER_PAGE_CHARS = 2_400

/** Path fragments that signal a page describes what is sold. */
const PRODUCT_PATH_SIGNALS = [
    "product", "pricing", "price", "feature", "tool", "solution",
    "use-case", "usecase", "platform", "service", "how-it-works", "what-is",
]
const DEPRIORITIZED_PATH_SIGNALS = [
    "blog", "post", "article", "news", "career", "job", "legal",
    "privacy", "terms", "refund", "login", "signup", "contact",
]

function pageRank(url: string): number {
    let path: string
    try {
        const parsed = new URL(url)
        path = parsed.pathname.toLowerCase()
    } catch {
        return 50
    }
    if (path === "/" || path === "") return 0
    if (DEPRIORITIZED_PATH_SIGNALS.some((signal) => path.includes(signal))) return 90
    if (PRODUCT_PATH_SIGNALS.some((signal) => path.includes(signal))) return 10
    // Shallow pages outrank deep ones; a top-level page is usually a real
    // product surface, a five-segment URL is usually an article.
    return 40 + path.split("/").filter(Boolean).length
}

/**
 * Picks the pages that describe what is sold, cheapest-signal first.
 * Exported so the same ordering can be asserted in tests.
 */
export function selectScopePages(pages: CrawledPage[]): CrawledPage[] {
    return [...pages]
        .filter((page) => page.content?.trim())
        .sort((left, right) => pageRank(left.url) - pageRank(right.url))
        .slice(0, MAX_PAGES)
}

/**
 * Ranked markdown corpus for brand-persona extraction.
 * Homepage / pricing / product pages first so a 50k slice cannot drop plans
 * while keeping blog noise from an unordered crawl.
 */
export function buildRankedBrandCorpus(
    pages: CrawledPage[],
    maxChars = 50_000,
): string {
    const ranked = selectScopePages(pages)
    if (ranked.length === 0) return ""
    let corpus = ""
    for (const page of ranked) {
        const block = `
---
URL: ${page.url}
Content:
${page.content}
---`
        if (corpus.length + block.length > maxChars) {
            const remaining = maxChars - corpus.length
            if (remaining > 200) {
                corpus += `
---
URL: ${page.url}
Content:
${page.content.slice(0, remaining - 80)}
---`
            }
            break
        }
        corpus += block
    }
    return corpus
}

function buildCorpus(pages: CrawledPage[]): string {
    let corpus = ""
    for (const page of selectScopePages(pages)) {
        const block = `\n### ${page.url}\n${page.content.slice(0, PER_PAGE_CHARS)}\n`
        if (corpus.length + block.length > MAX_CONTENT_CHARS) break
        corpus += block
    }
    return corpus
}

export type ScopeExtractionBrandProfile = {
    product_name: string
    product_identity: { literally: string }
    category?: string
}

export async function extractScopeFamilies(
    subjectUrl: string,
    pages: CrawledPage[],
    targetSeeds: string[],
    brandProfile?: ScopeExtractionBrandProfile | null,
): Promise<ExtractedScopeFamily[]> {
    const corpus = buildCorpus(pages)
    if (!corpus.trim()) return []

    const brandPreamble =
        brandProfile?.product_name?.trim() &&
        brandProfile.product_identity?.literally?.trim()
            ? `FOUNDER-CONFIRMED BRAND JOB (context only — still read the PAGES):
- Product: ${brandProfile.product_name}
- What it is: ${brandProfile.product_identity.literally}
- Category: ${brandProfile.category || "(none)"}
Emit families for every distinct customer job visible on the PAGES.
The Category line is context, not the only family — do not collapse the
whole site into that one name.
`
            : ""

    const prompt = `Identify every distinct thing this business sells.

Website: ${subjectUrl}

${brandPreamble}${
    targetSeeds.length
        ? `The founder says their customers search for these. Treat each as ground
truth that MUST appear verbatim in exactly one family's seed_keywords. If none
of your families fits a search, create the family it implies:
${targetSeeds.map((seed) => `- ${seed}`).join("\n")}

Also return every distinct sellable capability visible on the PAGES even when
the founder did not name it. Founder searches protect coverage of what they
typed; they must not collapse or hide other customer jobs the site clearly
offers. Do not merge multiple customer jobs into one family just because the
founder listed fewer searches.`
        : `The founder supplied no target searches. Discover every distinct
sellable capability from the PAGES alone.`
}

PAGES:
${corpus}

A family is a capability a customer would buy or use on its own — the job they
came to get done. Name it the way its customers would name it when searching,
not the way an engineer would describe the mechanism.

PEER-LEVEL RULE (important):
Emit families at CONSISTENT depth. If one candidate is a specific case of
another, do not present them as equals — emit the broader one as the family and
set "parent_hint" on the narrower to the broader one's exact name.
- Broad job and a narrow variant of that same job -> one family
- Two genuinely different customer jobs           -> two families
Getting this wrong is expensive in both directions: split a single job into
marketing sub-features and each fragment measures too little real demand to
stand on its own; merge two different jobs and the audit researches the wrong
one. When unsure, emit both and set parent_hint — it is recoverable, silence is
not.

- "Generative AI Mobile UI" is a family. "Design Handoff and Implementation" is
  a step inside one, and naming it that way points the whole audit at the wrong
  competitors.
- A pricing tier, an integration, a technology, and a blog category are not
  families.
- One product can still have several customer jobs a stranger would search
  separately (finding leads vs verifying emails vs sending cold email). Emit
  one family per job. Do not collapse the whole site into the brand Category.
- Discover omitted site capabilities: if the pages show photo animation and
  the founder only typed restoration searches, animation must still be its
  own family.

For each family provide:
- name: 2-100 characters, customer-facing.
- description: one concrete sentence naming the customer job.
- parent_hint: exact name of the broader family this is a sub-intent of, or null
  when it stands on its own. Never point a family at itself.
- seed_keywords: 1-8 phrases someone would type into Google. No brand names, no
  sentences. Maximum ${MAX_TOTAL_SCOPE_SEEDS} across all families combined.
  Use only words that appear on the PAGES or in the founder-confirmed brand job.
- evidence: 1-3 items, each an EXACT sentence copied character-for-character
  from one of the PAGES above plus that page's EXACT url. Copy, do not
  paraphrase. If you cannot copy a real sentence, return an empty list rather
  than inventing one.

Return at most ${MAX_SCOPE_FAMILIES} families, most important first.`

    const EXTRACT_TIMEOUT_MS = 90_000
    const client = getGeminiClient()
    let responseText = ""
    try {
        const response = await withTimeout(
            generateScopeJson(client, prompt),
            EXTRACT_TIMEOUT_MS,
        )
        responseText = modelJsonText(response)
    } catch (error) {
        console.warn("[Scope] extract failed open:", error)
        return []
    }

    const parsed = parseScopeJson(responseText)
    const families = Array.isArray(parsed.families) ? parsed.families : []
    console.log(`[Scope] extract parsed ${families.length} families, chars=${responseText.length}`)
    const allowedTokens = lexicalTokenSet([
        corpus,
        brandProfile?.product_name || "",
        brandProfile?.product_identity?.literally || "",
        brandProfile?.category || "",
        ...targetSeeds,
    ])

    return families.slice(0, MAX_SCOPE_FAMILIES).map(
        (family: Record<string, unknown>): ExtractedScopeFamily => {
            const name = String(family.name || "").trim()
            const description = String(family.description || "").trim()
            const rawSeeds = Array.isArray(family.seed_keywords)
                ? family.seed_keywords.map(String)
                : []
            const seed_keywords = filterSeedsAgainstCorpus(
                rawSeeds,
                allowedTokens,
                name,
            )
            const evidence = Array.isArray(family.evidence)
                ? (family.evidence as Array<Record<string, unknown>>).map(
                      (item) => ({
                          url: String(item.url || ""),
                          quote: String(item.quote || ""),
                      }),
                  )
                : []
            return {
                name,
                description,
                parent_hint:
                    typeof family.parent_hint === "string" && family.parent_hint.trim()
                        ? family.parent_hint.trim()
                        : null,
                seed_keywords,
                evidence,
                capability_contract: contractFromEvidence(
                    name || "Product area",
                    description || name || "Customer-facing product area.",
                    evidence,
                ),
                source: "extracted",
            }
        },
    )
}

const EXTRACT_STOPWORDS = new Set([
    "a", "an", "and", "for", "from", "in", "of", "on", "or", "the", "to",
    "with", "your", "you", "our", "its", "this", "that", "into",
])

function lexicalTokens(value: string): string[] {
    return value
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .split(" ")
        .filter((token) => token.length > 1 && !EXTRACT_STOPWORDS.has(token))
}

export function lexicalTokenSet(parts: string[]): Set<string> {
    const tokens = new Set<string>()
    for (const part of parts) {
        for (const token of lexicalTokens(part)) tokens.add(token)
    }
    return tokens
}

/**
 * Keep only seeds whose words already appear on the site or brand card.
 * Invented adjacent markets are dropped. A family that loses every seed keeps
 * one phrase built from its name.
 */
export function filterSeedsAgainstCorpus(
    seeds: string[],
    allowedTokens: Set<string>,
    familyName: string,
): string[] {
    const kept: string[] = []
    const seen = new Set<string>()
    for (const raw of seeds) {
        const seed = raw.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim()
        if (seed.length < 2 || seen.has(seed)) continue
        const tokens = lexicalTokens(seed)
        if (tokens.length === 0) continue
        const matched = tokens.filter((token) => allowedTokens.has(token)).length
        if (matched / tokens.length < 0.7) continue
        seen.add(seed)
        kept.push(seed)
    }
    if (kept.length > 0) return kept.slice(0, 8)
    const fromName = familyName
        .normalize("NFKC")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 100)
    return fromName.length >= 2 ? [fromName] : []
}

const SCOPE_RESPONSE_SCHEMA = {
    type: "OBJECT" as const,
    properties: {
        families: {
            type: "ARRAY" as const,
            items: {
                type: "OBJECT" as const,
                properties: {
                    name: { type: "STRING" as const },
                    description: { type: "STRING" as const },
                    parent_hint: {
                        type: "STRING" as const,
                        nullable: true,
                    },
                    seed_keywords: {
                        type: "ARRAY" as const,
                        items: { type: "STRING" as const },
                    },
                    evidence: {
                        type: "ARRAY" as const,
                        items: {
                            type: "OBJECT" as const,
                            properties: {
                                url: { type: "STRING" as const },
                                quote: { type: "STRING" as const },
                            },
                            required: ["url", "quote"],
                        },
                    },
                },
                required: [
                    "name",
                    "description",
                    "seed_keywords",
                    "evidence",
                ],
            },
        },
    },
    required: ["families"],
}

function modelJsonText(response: {
    text?: string
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
}): string {
    if (typeof response.text === "string" && response.text.trim()) return response.text
    const parts = response.candidates?.[0]?.content?.parts
    if (!Array.isArray(parts)) return ""
    return parts.map((part) => part.text || "").join("")
}

function parseScopeJson(raw: string): { families?: unknown } {
    const text = raw.trim()
    if (!text) return {}
    try {
        return JSON.parse(text)
    } catch {
        try {
            return JSON.parse(jsonrepair(text))
        } catch {
            console.warn("[Scope] extract returned non-JSON")
            return {}
        }
    }
}

function contractFromEvidence(
    name: string,
    description: string,
    evidence: Array<{ url: string; quote: string }>,
): CapabilityContract {
    const base = fallbackCapabilityContract({ name, description })
    const facts: CapabilityFact[] = evidence
        .filter((item) => item.url.trim() && item.quote.trim().length >= 8)
        .slice(0, 8)
        .map((item, index) => ({
            id: `fact${index + 1}`,
            url: item.url.trim(),
            quote: item.quote.trim().slice(0, 500),
        }))
    if (facts.length === 0) return base
    return {
        ...base,
        deliveryMode: "Product or service described on the website",
        facts,
        operations: [{
            ...base.operations[0],
            customerJob: description,
            action: description,
            evidenceRefs: facts.map((fact) => fact.id),
        }],
    }
}

async function generateScopeJson(
    client: ReturnType<typeof getGeminiClient>,
    prompt: string,
) {
    const request = {
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
            temperature: 0,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
            responseSchema: SCOPE_RESPONSE_SCHEMA,
        },
    }
    try {
        return await client.models.generateContent({
            ...request,
            config: {
                ...request.config,
                thinkingConfig: { thinkingLevel: "LOW" },
            },
        })
    } catch (error) {
        console.warn("[Scope] thinkingConfig rejected, retrying without it:", error)
        return await client.models.generateContent(request)
    }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
        return await Promise.race([
            promise,
            new Promise<never>((_, reject) => {
                timer = setTimeout(
                    () => reject(new Error("scope extract timeout")),
                    ms,
                )
            }),
        ])
    } finally {
        if (timer) clearTimeout(timer)
    }
}
