/**
 * Answer-engine adapters: ask one engine one buyer prompt, return what it said
 * and what it cited.
 *
 * Design decisions worth defending, because both diverge from Ansvisor:
 *
 * 1. **API only. No scraper vendor.** Upstream routes ChatGPT and Perplexity
 *    through Cloro, a paid third-party that drives the real web UIs. That gets
 *    you the consumer surface — which is genuinely what buyers see — at the
 *    cost of a vendor who can take the product down, a per-answer fee, and a
 *    ToS position nobody wants to defend to a customer. Every engine here is
 *    the provider's own API with the provider's own web-search tool. It is a
 *    weaker proxy for the consumer surface and that limitation is stated in the
 *    report rather than hidden.
 *
 * 2. **No SDKs.** Each adapter is one `fetch`. Adding four provider SDKs to
 *    this repo for four HTTP calls would be four more dependency trees, four
 *    more breaking-change surfaces, and no behaviour we don't write here.
 *
 * An engine with no configured key is *skipped and reported*, never silently
 * treated as "the brand wasn't mentioned". That distinction is the whole
 * reason `EngineReport` exists — see the note on hard failure in
 * `lib/harvest/types.ts`, which this mirrors.
 */

import { getGeminiClient } from "@/utils/gemini/geminiClient"
import type { AnswerCitation, EngineAnswer } from "./answer-parser"

export type AiEngine = "openai" | "anthropic" | "gemini" | "perplexity"

export const AI_ENGINES: AiEngine[] = ["openai", "anthropic", "gemini", "perplexity"]

/** Display names for the report. */
export const ENGINE_LABELS: Record<AiEngine, string> = {
    openai: "ChatGPT",
    anthropic: "Claude",
    gemini: "Google AI",
    perplexity: "Perplexity",
}

/**
 * Model pinned per engine.
 *
 * Pinned, not "latest": a probe compared against a probe from three weeks ago
 * is only a comparison if the thing being asked did not change underneath it.
 * When one of these is bumped, every stored answer keeps the model it was
 * actually produced by (`ai_probe_results.model`), so a trend line that spans a
 * model change can be seen to span it.
 */
export const ENGINE_MODELS: Record<AiEngine, string> = {
    openai: "gpt-5-chat-latest",
    anthropic: "claude-sonnet-5",
    gemini: "gemini-3-flash-preview",
    perplexity: "sonar",
}

const ENGINE_KEY_ENV: Record<AiEngine, string> = {
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    gemini: "GEMINI_API_KEY",
    perplexity: "PERPLEXITY_API_KEY",
}

/** Engines with a key configured, in a stable order. */
export function configuredEngines(): AiEngine[] {
    return AI_ENGINES.filter((engine) => Boolean(process.env[ENGINE_KEY_ENV[engine]]))
}

export function missingEngineKey(engine: AiEngine): string {
    return ENGINE_KEY_ENV[engine]
}

const REQUEST_TIMEOUT_MS = 90_000

export class EngineError extends Error {
    constructor(
        readonly engine: AiEngine,
        message: string,
    ) {
        super(`[${engine}] ${message}`)
        this.name = "EngineError"
    }
}

async function postJson(
    engine: AiEngine,
    url: string,
    headers: Record<string, string>,
    body: unknown,
): Promise<any> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json", ...headers },
            body: JSON.stringify(body),
            signal: controller.signal,
        })
        if (!response.ok) {
            const detail = await response.text().catch(() => "")
            throw new EngineError(
                engine,
                `HTTP ${response.status} ${detail.slice(0, 300)}`,
            )
        }
        return await response.json()
    } catch (error) {
        if (error instanceof EngineError) throw error
        const reason = error instanceof Error ? error.message : String(error)
        throw new EngineError(engine, reason)
    } finally {
        clearTimeout(timer)
    }
}

function dedupeCitations(citations: AnswerCitation[]): AnswerCitation[] {
    const seen = new Set<string>()
    const out: AnswerCitation[] = []
    for (const citation of citations) {
        const url = (citation.url || "").trim()
        if (!url || seen.has(url)) continue
        seen.add(url)
        out.push({ url, title: (citation.title || "").trim() })
    }
    return out
}

/**
 * OpenAI Responses API with the hosted `web_search` tool.
 * Citations arrive as `url_citation` annotations on the output text.
 */
async function askOpenAI(prompt: string, countryCode?: string): Promise<EngineAnswer> {
    const tool: Record<string, unknown> = { type: "web_search" }
    if (countryCode) {
        tool.user_location = { type: "approximate", country: countryCode.toUpperCase() }
    }

    const data = await postJson(
        "openai",
        "https://api.openai.com/v1/responses",
        { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        { model: ENGINE_MODELS.openai, tools: [tool], input: prompt },
    )

    let text: string = data.output_text || ""
    const citations: AnswerCitation[] = []

    for (const item of data.output || []) {
        if (item.type !== "message" || !item.content) continue
        for (const block of item.content) {
            if (block.type !== "output_text") continue
            if (!data.output_text && typeof block.text === "string") text += block.text
            for (const annotation of block.annotations || []) {
                if (annotation.type === "url_citation" && annotation.url) {
                    citations.push({ url: annotation.url, title: annotation.title || "" })
                }
            }
        }
    }

    return { text, citations: dedupeCitations(citations) }
}

/**
 * Anthropic Messages API with the server-side `web_search` tool.
 * Citations hang off `text` blocks as `web_search_result_location` entries.
 */
async function askAnthropic(prompt: string, countryCode?: string): Promise<EngineAnswer> {
    const tool: Record<string, unknown> = {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 5,
    }
    if (countryCode) {
        tool.user_location = { type: "approximate", country: countryCode.toUpperCase() }
    }

    const data = await postJson(
        "anthropic",
        "https://api.anthropic.com/v1/messages",
        {
            "x-api-key": String(process.env.ANTHROPIC_API_KEY),
            "anthropic-version": "2023-06-01",
        },
        {
            model: ENGINE_MODELS.anthropic,
            max_tokens: 2048,
            tools: [tool],
            messages: [{ role: "user", content: prompt }],
        },
    )

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

    return { text, citations: dedupeCitations(citations) }
}

/**
 * Gemini with Google Search grounding.
 *
 * Uses the SDK already in this repo rather than a raw fetch, because grounding
 * metadata lands in a nested shape the SDK types for us. Note the citation URLs
 * here are Google's redirect wrappers, not the publisher host — the report
 * shows them as-is rather than resolving, since following a redirect chain per
 * citation would multiply the probe's request count for cosmetic gain.
 */
async function askGemini(prompt: string): Promise<EngineAnswer> {
    const client = getGeminiClient()
    let response: any
    try {
        response = await client.models.generateContent({
            model: ENGINE_MODELS.gemini,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                temperature: 0,
                tools: [{ googleSearch: {} }],
            },
        })
    } catch (error) {
        throw new EngineError("gemini", error instanceof Error ? error.message : String(error))
    }

    const text: string = response.text || ""
    const citations: AnswerCitation[] = []
    const chunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    for (const chunk of chunks) {
        const web = chunk?.web
        if (web?.uri) citations.push({ url: web.uri, title: web.title || "" })
    }

    return { text, citations: dedupeCitations(citations) }
}

/**
 * Perplexity, which is OpenAI-compatible on the wire and returns its sources
 * as a flat `citations` (or `search_results`) array alongside the message.
 */
async function askPerplexity(prompt: string): Promise<EngineAnswer> {
    const data = await postJson(
        "perplexity",
        "https://api.perplexity.ai/chat/completions",
        { authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}` },
        {
            model: ENGINE_MODELS.perplexity,
            messages: [{ role: "user", content: prompt }],
        },
    )

    const text: string = data.choices?.[0]?.message?.content || ""
    const citations: AnswerCitation[] = []

    for (const result of data.search_results || []) {
        if (result?.url) citations.push({ url: result.url, title: result.title || "" })
    }
    // Older responses expose bare URL strings instead of result objects.
    for (const url of data.citations || []) {
        if (typeof url === "string") citations.push({ url, title: "" })
    }

    return { text, citations: dedupeCitations(citations) }
}

/**
 * Asks one engine one prompt.
 *
 * Throws `EngineError` on any failure. Callers must record the failure against
 * that engine rather than treating the missing answer as an absence of the
 * brand — a broken key would otherwise read as "you are invisible everywhere",
 * which is the most expensive possible way to be wrong.
 */
export async function askEngine(
    engine: AiEngine,
    prompt: string,
    options: { countryCode?: string } = {},
): Promise<EngineAnswer> {
    if (!process.env[ENGINE_KEY_ENV[engine]]) {
        throw new EngineError(engine, `${ENGINE_KEY_ENV[engine]} is not configured`)
    }

    switch (engine) {
        case "openai":
            return askOpenAI(prompt, options.countryCode)
        case "anthropic":
            return askAnthropic(prompt, options.countryCode)
        case "gemini":
            return askGemini(prompt)
        case "perplexity":
            return askPerplexity(prompt)
    }
}
