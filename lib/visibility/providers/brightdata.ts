/**
 * Bright Data scraper adapter for AI visibility consumer surfaces:
 * - ChatGPT Web (`chatgpt-web` -> dataset `gd_m7aof0k82r803d5bjm`)
 * - Google AI Mode (`google-aimode` -> dataset `gd_mcswdt6z2elth3zqr2`)
 *
 * Implements the asynchronous trigger-poll-snapshot pipeline against Bright Data's
 * Web Scraper APIs.
 */

import type { AnswerCitation } from "../answer-parser"
import type { AiEngine, ScrapedAnswer } from "../engines"
import { EngineError } from "../engines"

const BRIGHT_DATA_API = "https://api.brightdata.com"
export const BRIGHT_DATA_DATASETS = {
    "chatgpt-web": "gd_m7aof0k82r803d5bjm",
    "google-aimode": "gd_mcswdt6z2elth3zqr2",
} as const

const DEFAULT_MAX_WAIT_MS = 20 * 60 * 1000
const DEFAULT_POLL_INTERVAL_MS = 8_000
const SUBMIT_TIMEOUT_MS = 30_000

export function brightDataConfigured(): boolean {
    return Boolean(process.env.BRIGHT_DATA_API_KEY)
}

function apiKey(): string {
    const key = process.env.BRIGHT_DATA_API_KEY
    if (!key) throw new Error("BRIGHT_DATA_API_KEY is not configured")
    return key
}

export function getBrightDataDatasetId(engine: AiEngine): string {
    if (engine === "chatgpt-web") return BRIGHT_DATA_DATASETS["chatgpt-web"]
    if (engine === "google-aimode") return BRIGHT_DATA_DATASETS["google-aimode"]
    throw new EngineError(engine, `No Bright Data scraper dataset configured for engine: ${engine}`)
}

/**
 * Builds the array of input records expected by Bright Data datasets.
 * - ChatGPT Scraper accepts `url: "https://chatgpt.com/"`, `prompt`, and optional `geolocation` (uppercase ISO-3166-1 alpha-2 e.g. "US").
 * - Google AI Mode Scraper accepts `url: "https://google.com/aimode"`, `prompt`, `hl: "en"`, and optional `country` (uppercase ISO-3166-1 alpha-2 e.g. "US").
 */
export function buildBrightDataPayload(
    prompt: string,
    engine: AiEngine,
    countryCode?: string,
): Array<Record<string, unknown>> {
    const country = countryCode ? countryCode.toUpperCase().trim() : undefined

    if (engine === "chatgpt-web") {
        // Bright Data ChatGPT Scraper accepts url and prompt.
        // Upstream crawler has a schema conflict on the geolocation field (input validation accepts
        // text but the internal crawler library expects numeric coordinates), so we omit it to let
        // Bright Data route through standard US scraping proxies.
        return [
            {
                url: "https://chatgpt.com/",
                prompt,
            },
        ]
    }

    if (engine === "google-aimode") {
        // Bright Data Google AI Mode scraper accepts uppercase ISO country code and hl.
        const item: Record<string, unknown> = {
            url: "https://google.com/aimode",
            prompt,
            hl: "en",
        }
        if (country) {
            item.country = country
        }
        return [item]
    }

    throw new EngineError(engine, `Bright Data does not support engine: ${engine}`)
}

/**
 * Submits an asynchronous extraction task to Bright Data and returns the snapshot ID (`sd_...`).
 */
export async function submitBrightDataTask(
    prompt: string,
    engine: AiEngine,
    options: { countryCode?: string } = {},
): Promise<string> {
    const datasetId = getBrightDataDatasetId(engine)
    const payload = buildBrightDataPayload(prompt, engine, options.countryCode)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS)

    try {
        const url = `${BRIGHT_DATA_API}/datasets/v3/trigger?dataset_id=${encodeURIComponent(datasetId)}&include_errors=true`
        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey()}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
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
        const snapshotId = data?.snapshot_id
        if (!snapshotId) {
            throw new EngineError(
                engine,
                `submit returned no snapshot id: ${JSON.stringify(data).slice(0, 200)}`,
            )
        }
        return snapshotId as string
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

/**
 * Polls Bright Data for task progress until ready, then fetches and normalizes the snapshot.
 */
export async function pollBrightDataTask(
    snapshotId: string,
    engine: AiEngine,
    options: { maxWaitMs?: number; pollIntervalMs?: number } = {},
): Promise<ScrapedAnswer> {
    const deadline = Date.now() + (options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS)
    const interval = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS

    while (Date.now() < deadline) {
        const progressRes = await fetch(
            `${BRIGHT_DATA_API}/datasets/v3/progress/${encodeURIComponent(snapshotId)}`,
            {
                headers: { Authorization: `Bearer ${apiKey()}` },
            },
        )

        if (!progressRes.ok) {
            const detail = await progressRes.text().catch(() => "")
            throw new EngineError(
                engine,
                `poll HTTP ${progressRes.status} ${detail.slice(0, 200)}`,
            )
        }

        const progress = await progressRes.json()
        const status = progress?.status

        if (status === "ready") {
            const snapshotRes = await fetch(
                `${BRIGHT_DATA_API}/datasets/v3/snapshot/${encodeURIComponent(snapshotId)}?format=json`,
                {
                    headers: { Authorization: `Bearer ${apiKey()}` },
                },
            )

            if (!snapshotRes.ok) {
                const detail = await snapshotRes.text().catch(() => "")
                throw new EngineError(
                    engine,
                    `snapshot download HTTP ${snapshotRes.status} ${detail.slice(0, 200)}`,
                )
            }

            const rawData = await snapshotRes.json()
            const records = Array.isArray(rawData) ? rawData : [rawData]
            if (records.length === 0 || !records[0]) {
                throw new EngineError(engine, `snapshot ${snapshotId} returned no records`)
            }

            const record = records[0]
            if (record.error && !record.answer_text && !record.answer_text_markdown && !record.answer_text_raw) {
                throw new EngineError(
                    engine,
                    `scraper error: ${String(record.error || "failed")}`,
                )
            }

            return parseBrightDataResponse(record, engine)
        }

        if (status === "failed" || status === "canceled") {
            const reason = progress?.error_message || progress?.message || `snapshot ${status}`
            throw new EngineError(engine, `snapshot ${snapshotId} ${status}: ${reason}`)
        }

        await new Promise((resolve) => setTimeout(resolve, interval))
    }

    throw new EngineError(engine, `snapshot ${snapshotId} timed out`)
}

/**
 * Deduplicates and extracts citations from Bright Data records.
 */
function mapBrightDataCitations(record: Record<string, unknown>): AnswerCitation[] {
    const seen = new Set<string>()
    const out: AnswerCitation[] = []

    const addCitation = (rawUrl: unknown, rawTitle: unknown) => {
        const url = String(rawUrl || "").trim()
        if (!url || seen.has(url)) return
        seen.add(url)
        const title = String(rawTitle || "").trim()
        out.push({
            url,
            title,
        })
    }

    // 1. Primary citations array
    if (Array.isArray(record?.citations)) {
        for (const item of record.citations as Array<Record<string, unknown>>) {
            addCitation(item?.url, item?.title || item?.description || item?.domain)
        }
    }

    // 2. Search sources (ChatGPT)
    if (Array.isArray(record?.search_sources)) {
        for (const item of record.search_sources as Array<Record<string, unknown>>) {
            addCitation(item?.url, item?.title || item?.snippet)
        }
    }

    // 3. Attached links (Google AI Mode fallback)
    if (out.length === 0 && Array.isArray(record?.links_attached)) {
        for (const item of record.links_attached as Array<Record<string, unknown>>) {
            addCitation(item?.url, item?.text)
        }
    }

    return out
}

/**
 * Extracts sub-queries observed by the engine, if present.
 */
function normaliseBrightDataSearchQueries(record: Record<string, unknown>): string[] {
    const raw = record?.web_search_query ?? record?.search_queries ?? record?.searchQueries
    if (!raw) return []
    if (typeof raw === "string") {
        const trimmed = raw.trim()
        return trimmed ? [trimmed] : []
    }
    if (Array.isArray(raw)) {
        return raw
            .map((item: unknown) => (typeof item === "string" ? item.trim() : String((item as Record<string, unknown>)?.query ?? "").trim()))
            .filter((q: string) => q.length > 0)
    }
    return []
}

/**
 * Extracts clean answer text from Bright Data records.
 * For Google AI Mode, strips any embedded base64 data URIs from markdown if present,
 * preferring answer_text_raw or answer_text.
 */
function extractAnswerText(record: Record<string, unknown>, engine: AiEngine): string {
    if (engine === "google-aimode") {
        if (record?.answer_text_raw && typeof record.answer_text_raw === "string") {
            return record.answer_text_raw.trim()
        }
        if (record?.answer_text && typeof record.answer_text === "string") {
            return record.answer_text.trim()
        }
        if (record?.answer_text_markdown && typeof record.answer_text_markdown === "string") {
            // Strip data URIs so we don't store 50KB+ base64 image strings in database
            return record.answer_text_markdown.replace(/!\[.*?\]\(data:image\/[^)]+\)/g, "").trim()
        }
    }

    // For ChatGPT and default:
    return String(
        record?.answer_text_markdown ||
        record?.answer_text ||
        record?.answer_text_raw ||
        "",
    ).trim()
}

/**
 * Normalizes one Bright Data response into the standard ScrapedAnswer shape consumed downstream.
 */
export function parseBrightDataResponse(record: Record<string, unknown>, engine: AiEngine): ScrapedAnswer {
    const text = extractAnswerText(record, engine)
    const citations = mapBrightDataCitations(record)
    const searchQueries = normaliseBrightDataSearchQueries(record)
    const reportedModel = (record?.model as string) || engine

    return {
        text,
        citations,
        reportedModel,
        searchQueries,
    }
}
