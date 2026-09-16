/**
 * Answer-engine adapters.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHY THIS RUNS THROUGH SCRAPERS AND NOT THE PROVIDER APIS
 *
 * The first version of this file called the OpenAI Responses API and Gemini
 * with `googleSearch` grounding. That was wrong, and the evidence is
 * unambiguous:
 *
 *   - Petra Labs, 900 trials across paid ChatGPT, free ChatGPT and the API on
 *     the same prompts on the same day: the same brand's visibility swung by
 *     32 percentage points across the three surfaces. One brand appeared in
 *     15-18% of chat trials and *zero* API trials. An API-only tool reports
 *     that brand at 0% — indistinguishable from a brand with no AI presence.
 *
 *   - Ansvisor, whose tracking code this project studied, ships
 *     `allowedModels: []` on Starter, Growth *and* Enterprise. Its own paid
 *     product is scraper-only; API-model tracking is a per-customer DB
 *     override. The people who wrote both paths decided the API path was not
 *     good enough to sell.
 *
 * The API surface is a different product wearing the same name: different
 * system prompt, different model routing, different retrieval stack, no memory
 * or personalisation. Telling a founder "you are invisible on ChatGPT" when
 * they can open ChatGPT and see themselves is the single most expensive way
 * this product can be wrong.
 *
 * Real consumer surfaces are driven via scrapers (Bright Data by default, with
 * Cloro fallback) and return their markdown and sources. It is also roughly
 * 10x cheaper than the API path for the same prompt (~11 credits for the
 * default pair vs ~$0.02+ of search fees and tokens).
 *
 * The API adapters are retained behind `allowApiSurface` for self-hosters with
 * no scraper key. They are labelled `surface: "api"` on every stored answer and
 * must never be averaged into a consumer-surface number — that is exactly the
 * 32-point error, laundered into a single score.
 * ────────────────────────────────────────────────────────────────────────────
 */

import type { AnswerCitation, EngineAnswer } from "./answer-parser"
import {
    brightDataConfigured,
    pollBrightDataTask,
    submitBrightDataTask,
} from "./providers/brightdata"
import {
    cloroConfigured,
    pollCloroTask as _pollCloroTask,
    submitCloroTask as _submitCloroTask,
} from "./providers/cloro"

/**
 * Which surface an answer came from. Stored on every row.
 *
 * `consumer_app` — what a person actually sees in the product.
 * `api`          — the developer API. A weaker proxy, never mixed in.
 */
export type SurfaceKind = "consumer_app" | "api"

export type AiEngine =
    // Consumer surfaces
    | "chatgpt-web"
    | "google-aimode"
    | "google-aio"
    | "perplexity-web"
    | "gemini-web"
    // Provider APIs — fallback only
    | "openai-api"
    | "anthropic-api"

export type VisibilityProvider = "brightdata" | "cloro"

export interface EngineSpec {
    id: AiEngine
    label: string
    surface: SurfaceKind
    /** Cloro task type, absent for API engines. */
    cloroTaskType?: "CHATGPT" | "AIMODE" | "GOOGLE" | "PERPLEXITY" | "GEMINI"
    /**
     * Approximate credits per call, for the run's cost ledger.
     * Approximate on purpose: published per-engine credit counts change,
     * and a number stored per run is auditable against the real invoice.
     */
    credits: number
}

export const ENGINE_SPECS: Record<AiEngine, EngineSpec> = {
    "chatgpt-web": {
        id: "chatgpt-web",
        label: "ChatGPT",
        surface: "consumer_app",
        cloroTaskType: "CHATGPT",
        // Enriched/full response bills at 7 credits. Keeping this exact is what
        // makes the pre-flight meaningful.
        credits: 7,
    },
    "google-aimode": {
        id: "google-aimode",
        label: "Google AI Mode",
        surface: "consumer_app",
        cloroTaskType: "AIMODE",
        credits: 4,
    },
    "google-aio": {
        id: "google-aio",
        label: "Google AI Overview",
        surface: "consumer_app",
        cloroTaskType: "GOOGLE",
        credits: 4,
    },
    "perplexity-web": {
        id: "perplexity-web",
        label: "Perplexity",
        surface: "consumer_app",
        cloroTaskType: "PERPLEXITY",
        credits: 3,
    },
    "gemini-web": {
        id: "gemini-web",
        label: "Gemini app",
        surface: "consumer_app",
        cloroTaskType: "GEMINI",
        credits: 4,
    },
    "openai-api": {
        id: "openai-api",
        label: "ChatGPT (API surface)",
        surface: "api",
        credits: 0,
    },
    "anthropic-api": {
        id: "anthropic-api",
        label: "Claude (API surface)",
        surface: "api",
        credits: 0,
    },
}

/**
 * The default pair.
 *
 * ChatGPT is ~63% of measurable B2B AI referrals; Google AI Mode is the
 * highest-reach Google surface for someone researching a purchase — far wider
 * than the Gemini app, because it sits inside Search. Two surfaces, 11 credits
 * per prompt, both consumer.
 *
 * Claude is deliberately not here despite being ~18% of B2B referrals: neither
 * Bright Data nor Cloro has a Claude scraper, so it is only reachable through
 * the API surface, and a peer-labelled API number would corrupt the comparison.
 */
export const DEFAULT_ENGINES: AiEngine[] = ["chatgpt-web", "google-aimode"]

export const CLORO_ENGINES: AiEngine[] = [
    "chatgpt-web",
    "google-aimode",
    "google-aio",
    "perplexity-web",
    "gemini-web",
]

export const ENGINE_LABELS: Record<AiEngine, string> = Object.fromEntries(
    Object.values(ENGINE_SPECS).map((spec) => [spec.id, spec.label]),
) as Record<AiEngine, string>

// Retained upstream Cloro API endpoint constant for contract compatibility
export const CLORO_API = "https://api.cloro.dev"

export class EngineError extends Error {
    constructor(
        readonly engine: AiEngine,
        message: string,
    ) {
        super(`[${engine}] ${message}`)
        this.name = "EngineError"
    }
}

export {
    brightDataConfigured,
    pollBrightDataTask,
    submitBrightDataTask,
    parseBrightDataResponse,
} from "./providers/brightdata"

export {
    cloroConfigured,
    buildCloroPayload,
    parseCloroResponse,
} from "./providers/cloro"

/** Submits one Cloro task and returns its id. Kept for direct callers and contract tests. */
export async function submitCloroTask(
    prompt: string,
    engine: AiEngine,
    options: { countryCode?: string } = {},
): Promise<string> {
    return _submitCloroTask(prompt, engine, options)
}

/** Polls one Cloro task to completion. Kept for direct callers and contract tests. */
export async function pollCloroTask(
    taskId: string,
    engine: AiEngine,
    options: { maxWaitMs?: number; pollIntervalMs?: number } = {},
): Promise<ScrapedAnswer> {
    return _pollCloroTask(taskId, engine, options)
}

/**
 * Determines which scraper provider is actively chosen.
 * Prioritizes process.env.AI_VISIBILITY_PROVIDER if set,
 * otherwise selects Bright Data when configured, falling back to Cloro.
 */
export function activeVisibilityProvider(): VisibilityProvider {
    const override = String(process.env.AI_VISIBILITY_PROVIDER || "").trim().toLowerCase()
    if (override === "cloro") return "cloro"
    if (override === "brightdata") return "brightdata"

    if (brightDataConfigured()) return "brightdata"
    if (cloroConfigured()) return "cloro"
    return "brightdata"
}

/**
 * Returns true if at least one consumer scraper provider is configured.
 */
export function isScraperConfigured(): boolean {
    const provider = activeVisibilityProvider()
    if (provider === "brightdata") return brightDataConfigured()
    if (provider === "cloro") return cloroConfigured()
    return brightDataConfigured() || cloroConfigured()
}

/**
 * Engines this deployment can actually run.
 *
 * With a scraper key (Bright Data or Cloro): the consumer surfaces. Without one: nothing, unless the
 * caller explicitly opts into the API surface. Returning API engines by
 * default would silently downgrade a customer's report to the measurement the
 * research above disqualified.
 */
export function configuredEngines(
    options: { allowApiSurface?: boolean } = {},
): AiEngine[] {
    if (isScraperConfigured()) return DEFAULT_ENGINES
    if (!options.allowApiSurface) return []

    const api: AiEngine[] = []
    if (process.env.OPENAI_API_KEY) api.push("openai-api")
    if (process.env.ANTHROPIC_API_KEY) api.push("anthropic-api")
    return api
}

export interface ScrapedAnswer extends EngineAnswer {
    /** The model the surface reported using, when it says. */
    reportedModel: string
    /** Sub-queries the engine ran, when the surface exposes them. */
    searchQueries: string[]
}

/**
 * Unified submission function: routes task to the active scraper provider.
 * Returns the task ID and the provider that accepted it.
 */
export async function submitScraperTask(
    prompt: string,
    engine: AiEngine,
    options: { countryCode?: string } = {},
): Promise<{ taskId: string; provider: VisibilityProvider }> {
    const countryCode = options.countryCode || "US"
    const provider = activeVisibilityProvider()

    if (provider === "brightdata") {
        const taskId = await submitBrightDataTask(prompt, engine, { countryCode })
        return { taskId, provider: "brightdata" }
    }

    const taskId = await submitCloroTask(prompt, engine, { countryCode })
    return { taskId, provider: "cloro" }
}

/**
 * Unified polling function: retrieves result from the specified provider (or active provider).
 */
export async function pollScraperTask(
    taskId: string,
    engine: AiEngine,
    provider: VisibilityProvider = activeVisibilityProvider(),
    options: { maxWaitMs?: number; pollIntervalMs?: number } = {},
): Promise<ScrapedAnswer> {
    if (provider === "brightdata") {
        return pollBrightDataTask(taskId, engine, options)
    }
    return pollCloroTask(taskId, engine, options)
}

// ── API-surface fallbacks ───────────────────────────────────────────────────
// Retained for self-hosters with no scraper key. Every answer they produce is
// stored with `surface: "api"` and rendered with that caveat visible.

async function askOpenAiApi(prompt: string, countryCode?: string): Promise<ScrapedAnswer> {
    const tool: Record<string, unknown> = { type: "web_search" }
    if (countryCode) {
        tool.user_location = { type: "approximate", country: (countryCode || "US").toUpperCase() }
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
            authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "content-type": "application/json",
        },
        body: JSON.stringify({
            model: "gpt-5-chat-latest",
            tools: [tool],
            input: prompt,
        }),
    })
    if (!response.ok) {
        throw new EngineError("openai-api", `HTTP ${response.status}`)
    }

    const data = await response.json()
    const citations: AnswerCitation[] = []
    for (const item of data.output || []) {
        if (item.type !== "message") continue
        for (const block of item.content || []) {
            for (const annotation of block.annotations || []) {
                if (annotation.type === "url_citation" && annotation.url) {
                    citations.push({ url: annotation.url, title: annotation.title || "" })
                }
            }
        }
    }

    return {
        text: data.output_text || "",
        citations,
        reportedModel: "gpt-5-chat-latest",
        searchQueries: [],
    }
}

async function askAnthropicApi(prompt: string): Promise<ScrapedAnswer> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "x-api-key": String(process.env.ANTHROPIC_API_KEY),
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        body: JSON.stringify({
            model: "claude-sonnet-5",
            max_tokens: 2048,
            tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
            messages: [{ role: "user", content: prompt }],
        }),
    })
    if (!response.ok) {
        throw new EngineError("anthropic-api", `HTTP ${response.status}`)
    }

    const data = await response.json()
    let text = ""
    const citations: AnswerCitation[] = []
    for (const block of data.content || []) {
        if (block.type !== "text") continue
        text += block.text || ""
        for (const citation of block.citations || []) {
            if (citation.url) {
                citations.push({ url: citation.url, title: citation.title || "" })
            }
        }
    }

    return { text, citations, reportedModel: "claude-sonnet-5", searchQueries: [] }
}

/** Single-shot call for the API surface. */
export async function askApiEngine(
    engine: AiEngine,
    prompt: string,
    options: { countryCode?: string } = {},
): Promise<ScrapedAnswer> {
    if (engine === "openai-api") return askOpenAiApi(prompt, options.countryCode)
    if (engine === "anthropic-api") return askAnthropicApi(prompt)
    throw new EngineError(engine, "not an API engine")
}

/** Total credits one run will consume, for the pre-flight estimate. */
export function estimateCredits(promptCount: number, engines: AiEngine[]): number {
    return engines.reduce(
        (total, engine) => total + ENGINE_SPECS[engine].credits * promptCount,
        0,
    )
}

// Kept so callers that only need "the model string" keep working.
export const ENGINE_MODELS: Record<AiEngine, string> = Object.fromEntries(
    Object.values(ENGINE_SPECS).map((spec) => [spec.id, spec.id]),
) as Record<AiEngine, string>
