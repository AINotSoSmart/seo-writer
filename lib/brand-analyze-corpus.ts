/**
 * Checkpoint for the onboarding brand crawl.
 *
 * Refresh cannot resume a fetch stream. Pages are written here as soon as
 * Tavily returns, before the persona LLM, so a later Analyze or scope call
 * skips extract/crawl. Cache hits do not count toward the daily Tavily cap.
 */

export const CORPUS_TTL_MS = 24 * 60 * 60 * 1000
export const RUNNING_STALE_MS = 5 * 60 * 1000
export const MAX_TAVILY_STARTS_PER_DAY = 3
export const CORPUS_PAGE_CHARS = 2_400
export const CORPUS_PAGE_LIMIT = 8

export type CorpusPage = {
    url: string
    title?: string
    content: string
}

export type CorpusClient = {
    from: (table: string) => any
}

type CorpusRow = {
    user_id: string
    host: string
    pages: unknown
    status: "running" | "ready"
    started_at: string
    ready_at: string | null
    tavily_started_at: string | null
}

export type BeginCorpusResult =
    | { kind: "hit"; pages: CorpusPage[] }
    | { kind: "blocked" }
    | { kind: "miss" }

export function normalizeAnalyzeHost(url: string): string | null {
    try {
        const parsed = new URL(url.includes("://") ? url : `https://${url}`)
        const host = parsed.hostname.toLowerCase().replace(/^www\./, "")
        return host || null
    } catch {
        return null
    }
}

export function trimCorpusPages(pages: CorpusPage[]): CorpusPage[] {
    return pages
        .filter((page) => page.url)
        .slice(0, CORPUS_PAGE_LIMIT)
        .map((page) => ({
            url: page.url,
            title: page.title?.trim() || undefined,
            content: String(page.content || "").slice(0, CORPUS_PAGE_CHARS),
        }))
}

export function pagesWithContent(pages: CorpusPage[]): CorpusPage[] {
    return trimCorpusPages(pages).filter((page) => page.content.trim().length > 0)
}

export function persistCrawlPages(
    storageKey: string,
    pages: Array<{ url: string; title?: string; content?: string }>,
): void {
    if (typeof localStorage === "undefined") return
    const usable = pagesWithContent(pages as CorpusPage[])
    if (usable.length === 0) return
    try {
        localStorage.setItem(storageKey, JSON.stringify(usable))
    } catch {
        // Quota or private mode — the server corpus is the real checkpoint.
    }
}

export function restoreCrawlPages(storageKey: string): CorpusPage[] {
    if (typeof localStorage === "undefined") return []
    try {
        const raw = localStorage.getItem(storageKey)
        if (!raw) return []
        const parsed = JSON.parse(raw) as unknown
        if (!Array.isArray(parsed)) return []
        return pagesWithContent(parsed as CorpusPage[])
    } catch {
        return []
    }
}

function parsePages(raw: unknown): CorpusPage[] {
    if (!Array.isArray(raw)) return []
    return trimCorpusPages(
        raw.map((item) => {
            const page = item as Record<string, unknown>
            return {
                url: String(page.url || ""),
                title: page.title ? String(page.title) : undefined,
                content: String(page.content || ""),
            }
        }),
    )
}

function isFreshReady(row: CorpusRow, now: number): boolean {
    if (row.status !== "ready") return false
    const readyAt = row.ready_at ? Date.parse(row.ready_at) : Number.NaN
    if (!Number.isFinite(readyAt)) return false
    return now - readyAt < CORPUS_TTL_MS && parsePages(row.pages).length > 0
}

function isFreshRunning(row: CorpusRow, now: number): boolean {
    if (row.status !== "running") return false
    const started = Date.parse(row.started_at)
    if (!Number.isFinite(started)) return false
    return now - started < RUNNING_STALE_MS
}

export async function readCorpus(
    supabase: CorpusClient,
    userId: string,
    host: string,
): Promise<CorpusPage[] | null> {
    const { data, error } = await supabase
        .from("brand_analyze_corpus")
        .select("user_id, host, pages, status, started_at, ready_at, tavily_started_at")
        .eq("user_id", userId)
        .eq("host", host)
        .maybeSingle()
    if (error || !data) return null
    const row = data as CorpusRow
    if (!isFreshReady(row, Date.now())) return null
    return parsePages(row.pages)
}

export async function countTavilyStartsToday(
    supabase: CorpusClient,
    userId: string,
    now = new Date(),
): Promise<number> {
    const start = new Date(now)
    start.setUTCHours(0, 0, 0, 0)
    const { count, error } = await supabase
        .from("brand_analyze_corpus")
        .select("user_id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("tavily_started_at", start.toISOString())
    if (error) return 0
    return count ?? 0
}

export async function beginCorpusRun(
    supabase: CorpusClient,
    userId: string,
    host: string,
): Promise<BeginCorpusResult> {
    const now = Date.now()
    const { data } = await supabase
        .from("brand_analyze_corpus")
        .select("user_id, host, pages, status, started_at, ready_at, tavily_started_at")
        .eq("user_id", userId)
        .eq("host", host)
        .maybeSingle()

    if (data) {
        const row = data as CorpusRow
        if (isFreshReady(row, now)) {
            return { kind: "hit", pages: parsePages(row.pages) }
        }
        if (isFreshRunning(row, now)) {
            return { kind: "blocked" }
        }
    }

    const { error } = await supabase.from("brand_analyze_corpus").upsert(
        {
            user_id: userId,
            host,
            pages: [],
            status: "running",
            started_at: new Date(now).toISOString(),
            ready_at: null,
        },
        { onConflict: "user_id,host" },
    )
    if (error) {
        console.warn("[Corpus] beginCorpusRun upsert failed:", error.message)
        return { kind: "miss" }
    }
    return { kind: "miss" }
}

export async function markTavilyStart(
    supabase: CorpusClient,
    userId: string,
    host: string,
): Promise<void> {
    await supabase
        .from("brand_analyze_corpus")
        .update({ tavily_started_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("host", host)
}

export async function saveCorpusPages(
    supabase: CorpusClient,
    userId: string,
    host: string,
    pages: CorpusPage[],
): Promise<void> {
    const trimmed = trimCorpusPages(pages)
    await supabase.from("brand_analyze_corpus").upsert(
        {
            user_id: userId,
            host,
            pages: trimmed,
            status: "ready",
            ready_at: new Date().toISOString(),
        },
        { onConflict: "user_id,host" },
    )
}
