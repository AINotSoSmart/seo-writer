/**
 * Cloro scraper adapter for AI visibility consumer surfaces.
 * Retained for backward-compatibility, parity benchmarking, and fallback.
 */

import type { AnswerCitation } from "../answer-parser"
import type { AiEngine, ScrapedAnswer } from "../engines"
import { ENGINE_SPECS, EngineError } from "../engines"

export const CLORO_API = "https://api.cloro.dev"

const DEFAULT_MAX_WAIT_MS = 20 * 60 * 1000
const DEFAULT_POLL_INTERVAL_MS = 8_000
const SUBMIT_TIMEOUT_MS = 30_000

export function cloroConfigured(): boolean {
    return Boolean(process.env.CLORO_API_KEY)
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
export function mapSources(sources: Array<Record<string, unknown>>): AnswerCitation[] {
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

/** Observed sub-queries only. Never synthesised. */
export function normaliseSearchQueries(result: Record<string, unknown>): string[] {
    const raw = result?.search_model_queries ?? result?.searchQueries
    if (!Array.isArray(raw)) return []
    return raw
        .map((entry: unknown) =>
            typeof entry === "string" ? entry.trim() : String((entry as Record<string, unknown>)?.query ?? "").trim(),
        )
        .filter((query: string) => query.length > 0)
}

/**
 * Normalises one Cloro response.
 */
export function parseCloroResponse(result: Record<string, unknown>, engine: AiEngine): ScrapedAnswer {
    if (engine === "google-aio") {
        const overview = result?.aioverview as Record<string, unknown> | undefined
        if (!overview) {
            throw new EngineError(
                engine,
                "Google returned no AI Overview for this query",
            )
        }
        return {
            text: (overview.markdown as string) || (overview.text as string) || "",
            citations: mapSources((overview.sources as Array<Record<string, unknown>>) || []),
            reportedModel: "google-aio",
            searchQueries: [],
        }
    }

    if (engine === "google-aimode") {
        const aiMode = (result?.result || result) as Record<string, unknown>
        return {
            text: (aiMode.markdown as string) || (aiMode.text as string) || "",
            citations: mapSources((aiMode.sources as Array<Record<string, unknown>>) || []),
            reportedModel: "google-aimode",
            searchQueries: normaliseSearchQueries(aiMode),
        }
    }

    return {
        text: (result?.markdown as string) || (result?.text as string) || "",
        citations: mapSources((result?.sources as Array<Record<string, unknown>>) || []),
        reportedModel: (result?.model as string) || engine,
        searchQueries: normaliseSearchQueries(result),
    }
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
