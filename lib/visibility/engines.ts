/**
 * Answer-engine adapters.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHY THIS RUNS THROUGH CLORO AND NOT THE PROVIDER APIS
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
 * Cloro drives the real consumer surfaces and returns their markdown and
 * sources. It is also roughly 10x cheaper than the API path for the same
 * prompt (~11 credits for the default pair vs ~$0.02+ of search fees and
 * tokens).
 *
 * The API adapters are retained behind `allowApiSurface` for self-hosters with
 * no Cloro key. They are labelled `surface: "api"` on every stored answer and
 * must never be averaged into a consumer-surface number — that is exactly the
 * 32-point error, laundered into a single score.
 * ────────────────────────────────────────────────────────────────────────────
 */

import type { AnswerCitation, EngineAnswer } from "./answer-parser"

/**
 * Which surface an answer came from. Stored on every row.
 *
 * `consumer_app` — what a person actually sees in the product.
 * `api`          — the developer API. A weaker proxy, never mixed in.
 */
export type SurfaceKind = "consumer_app" | "api"

export type AiEngine =
    // Cloro consumer surfaces
    | "chatgpt-web"
    | "google-aimode"
    | "google-aio"
    | "perplexity-web"
    | "gemini-web"
    // Provider APIs — fallback only
    | "openai-api"
    | "anthropic-api"

export interface EngineSpec {
    id: AiEngine
    label: string
    surface: SurfaceKind
    /** Cloro task type, absent for API engines. */
    cloroTaskType?: "CHATGPT" | "AIMODE" | "GOOGLE" | "PERPLEXITY" | "GEMINI"
    /**
     * Approximate Cloro credits per call, for the run's cost ledger.
     * Approximate on purpose: Cloro publishes per-engine credit counts that
     * change, and a number stored per run is auditable against the real
     * invoice. Verify against the current pricing page before quoting it.
     */
    credits: number
}

export const ENGINE_SPECS: Record<AiEngine, EngineSpec> = {
    "chatgpt-web": {
        id: "chatgpt-web",
        label: "ChatGPT",
        surface: "consumer_app",
        cloroTaskType: "CHATGPT",
        // `buildCloroPayload` requests the observed search queries. Cloro bills
        // that enriched/full response at 7 credits, not the 5-credit base web
        // response. Keeping this exact is what makes the pre-flight meaningful.
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
 * Claude is deliberately not here despite being ~18% of B2B referrals: Cloro
 * has no Claude scraper, so it is only reachable through the API surface, and
 * a peer-labelled API number would corrupt the comparison. Revisit if a
 * consumer-surface Claude scraper ships.
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

const CLORO_API = "https://api.cloro.dev"

/** Cloro tasks are queued work; upstream allows 30 minutes. */
const DEFAULT_MAX_WAIT_MS = 20 * 60 * 1000
const DEFAULT_POLL_INTERVAL_MS = 8_000
const SUBMIT_TIMEOUT_MS = 30_000

export class EngineError extends Error {
    constructor(
        readonly engine: AiEngine,
        message: string,
    ) {
        super(`[${engine}] ${message}`)
        this.name = "EngineError"
    }
}

export function cloroConfigured(): boolean {
    return Boolean(process.env.CLORO_API_KEY)
}

/**
 * Engines this deployment can actually run.
 *
 * With a Cloro key: the consumer surfaces. Without one: nothing, unless the
 * caller explicitly opts into the API surface. Returning API engines by
 * default would silently downgrade a customer's report to the measurement the
 * research above disqualified.
 */
export function configuredEngines(
    options: { allowApiSurface?: boolean } = {},
): AiEngine[] {
    if (cloroConfigured()) return DEFAULT_ENGINES
    if (!options.allowApiSurface) return []

    const api: AiEngine[] = []
    if (process.env.OPENAI_API_KEY) api.push("openai-api")
    if (process.env.ANTHROPIC_API_KEY) api.push("anthropic-api")
    return api
}

function apiKey(): string {
    const key = process.env.CLORO_API_KEY
    if (!key) throw new Error("CLORO_API_KEY is not configured")
    return key
}

/**
 * Cloro request body. Shapes differ per surface and are not interchangeable —
 * AI Overview keys on `query` and asks for `aioverview`, everything else keys
 * on `prompt`.
 */
export function buildCloroPayload(
    prompt: string,
    engine: AiEngine,
    countryCode?: string,
): Record<string, unknown> {
    const country = (countryCode || "US").toUpperCase()

    if (engine === "google-aio") {
        return {
            query: prompt,
            country,
            include: { html: false, aioverview: { markdown: true } },
        }
    }

    if (engine === "google-aimode") {
        return { prompt, country, include: { html: false, markdown: true } }
    }

    return {
        prompt,
        country,
        include: {
            html: false,
            markdown: true,
            rawResponse: false,
            // The engine's own observed sub-queries. Free to request, and the
            // most direct evidence of how a surface decomposed the question.
            searchQueries: true,
        },
    }
}

/** Cloro sources are `{ url, label }`; ours are `{ url, title }`. */
function mapSources(sources: any[]): AnswerCitation[] {
    const seen = new Set<string>()
    const out: AnswerCitation[] = []
    for (const source of sources || []) {
        const url = String(source?.url || "").trim()
        if (!url || seen.has(url)) continue
        seen.add(url)
        out.push({ url, title: String(source?.label || source?.title || "").trim() })
    }
    return out
}

export interface ScrapedAnswer extends EngineAnswer {
    /** The model the surface reported using, when it says. */
    reportedModel: string
    /** Sub-queries the engine ran, when the surface exposes them. */
    searchQueries: string[]
}

/**
 * Normalises one Cloro response.
 *
 * AI Overview is the one surface that can legitimately return nothing: Google
 * does not generate an overview for every query. That is a real observation
 * about the query, not a transport failure, but it produces no answer text to
 * measure — so it throws and lands in the ledger as a failure rather than
 * being counted as "the brand was absent".
 */
export function parseCloroResponse(result: any, engine: AiEngine): ScrapedAnswer {
    if (engine === "google-aio") {
        const overview = result?.aioverview
        if (!overview) {
            throw new EngineError(
                engine,
                "Google returned no AI Overview for this query",
            )
        }
        return {
            text: overview.markdown || overview.text || "",
            citations: mapSources(overview.sources),
            reportedModel: "google-aio",
            searchQueries: [],
        }
    }

    if (engine === "google-aimode") {
        const aiMode = result?.result || result
        return {
            text: aiMode.markdown || aiMode.text || "",
            citations: mapSources(aiMode.sources),
            reportedModel: "google-aimode",
            searchQueries: normaliseSearchQueries(aiMode),
        }
    }

    return {
        text: result?.markdown || result?.text || "",
        citations: mapSources(result?.sources),
        reportedModel: result?.model || engine,
        searchQueries: normaliseSearchQueries(result),
    }
}

/** Observed sub-queries only. Never synthesised. */
function normaliseSearchQueries(result: any): string[] {
    const raw = result?.search_model_queries ?? result?.searchQueries
    if (!Array.isArray(raw)) return []
    return raw
        .map((entry: any) =>
            typeof entry === "string" ? entry.trim() : String(entry?.query ?? "").trim(),
        )
        .filter((query: string) => query.length > 0)
}

/** Submits one task and returns its id. Fast — the wait happens in the poll. */
export async function submitCloroTask(
    prompt: string,
    engine: AiEngine,
    options: { countryCode?: string } = {},
): Promise<string> {
    const spec = ENGINE_SPECS[engine]
    if (!spec.cloroTaskType) throw new EngineError(engine, "not a Cloro engine")

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS)
    try {
        const response = await fetch(`${CLORO_API}/v1/async/task`, {
            method: "POST",
            headers: {
                authorization: `Bearer ${apiKey()}`,
                "content-type": "application/json",
            },
            body: JSON.stringify({
                taskType: spec.cloroTaskType,
                payload: buildCloroPayload(prompt, engine, options.countryCode),
            }),
            signal: controller.signal,
        })

        if (!response.ok) {
            const detail = await response.text().catch(() => "")
            throw new EngineError(
                engine,
                `submit HTTP ${response.status} ${detail.slice(0, 200)}`,
            )
        }

        const data = await response.json()
        if (!data?.success || !data?.task?.id) {
            throw new EngineError(
                engine,
                `submit returned no task id: ${String(data?.error || "unknown")}`,
            )
        }
        return data.task.id as string
    } catch (error) {
        if (error instanceof EngineError) throw error
        throw new EngineError(
            engine,
            error instanceof Error ? error.message : String(error),
        )
    } finally {
        clearTimeout(timer)
    }
}

/** Polls one task to completion. */
export async function pollCloroTask(
    taskId: string,
    engine: AiEngine,
    options: { maxWaitMs?: number; pollIntervalMs?: number } = {},
): Promise<ScrapedAnswer> {
    const deadline = Date.now() + (options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS)
    const interval = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS

    while (Date.now() < deadline) {
        const response = await fetch(`${CLORO_API}/v1/async/task/${taskId}`, {
            headers: { authorization: `Bearer ${apiKey()}` },
        })

        if (!response.ok) {
            const detail = await response.text().catch(() => "")
            throw new EngineError(
                engine,
                `poll HTTP ${response.status} ${detail.slice(0, 200)}`,
            )
        }

        const data = await response.json()
        const status = data?.task?.status

        if (status === "COMPLETED") {
            if (!data.response) {
                throw new EngineError(engine, `task ${taskId} completed with no response`)
            }
            return parseCloroResponse(data.response, engine)
        }

        if (status === "FAILED") {
            const reason =
                data?.response?.error || data?.task?.failedReason || "unknown failure"
            throw new EngineError(engine, `task ${taskId} failed: ${reason}`)
        }

        await new Promise((resolve) => setTimeout(resolve, interval))
    }

    throw new EngineError(engine, `task ${taskId} timed out`)
}

// ── API-surface fallbacks ───────────────────────────────────────────────────
// Retained for self-hosters with no Cloro key. Every answer they produce is
// stored with `surface: "api"` and rendered with that caveat visible.

async function askOpenAiApi(prompt: string, countryCode?: string): Promise<ScrapedAnswer> {
    const tool: Record<string, unknown> = { type: "web_search" }
    if (countryCode) {
        tool.user_location = { type: "approximate", country: countryCode.toUpperCase() }
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

/** Total Cloro credits one run will consume, for the pre-flight estimate. */
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
