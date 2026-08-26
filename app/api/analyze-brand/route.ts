import { NextRequest, NextResponse } from "next/server"
import { tavily } from "@tavily/core"
import { jsonrepair } from "jsonrepair"
import { MAX_TOTAL_SCOPE_SEEDS, normalizeSeed } from "@/lib/brand-scope"
import { BrandDetailsSchema } from "@/lib/schemas/brand"
// Scope extraction moved to ./scope/route.ts — this call now only reads the
// brand's persona, and hands its crawl over so the next one need not repeat it.
import { buildRankedBrandCorpus } from "@/lib/scope-extraction"
import { requestBrandProfile } from "@/lib/brand-profile"
import { selectRepresentativeBrandUrls } from "@/lib/brand/representative-pages"
import { fetchAllSitemapUrls } from "@/lib/audit/site-scanner"
import {
  ANALYZE_PHASE_COPY,
  encodeAnalyzeEvent,
  type AnalyzeBrandStreamEvent,
} from "@/lib/analyze-brand/stream"
import {
  MAX_TAVILY_STARTS_PER_DAY,
  beginCorpusRun,
  countTavilyStartsToday,
  markTavilyStart,
  normalizeAnalyzeHost,
  readCorpus,
  saveCorpusPages,
  trimCorpusPages,
  type CorpusPage,
} from "@/lib/brand-analyze-corpus"
import { createClient } from "@/utils/supabase/server"

export const maxDuration = 300 // 5 minute timeout

/** Enough for homepage + pricing + a few product surfaces; 20 burned ~80s. */
const BRAND_CRAWL_LIMIT = 8
/** Use one crawler fallback only when direct representative extraction is thin. */
const THIN_CORPUS_CHARS = 1_500

const CRAWL_INSTRUCTIONS =
  "Prioritize the homepage (/), /pricing or /price, and product/feature/use-case/service pages. Deprioritize blog, news, careers, legal, login, and signup. Product scope and pricing matter more than writing-style samples."

type CrawledPage = { url: string; title?: string; content: string }

function pagesFromCrawl(crawlResponse: unknown): CrawledPage[] {
  const raw = crawlResponse as { results?: unknown[]; data?: unknown[] }
  const results = raw.results || raw.data
  if (!results || !Array.isArray(results)) return []
  return results.map((page) => {
    const rawPage = page as Record<string, unknown>
    return {
      url: String(rawPage.url || ""),
      // Kept, finally. A JS-rendered site returns empty markdown but usually
      // still has a real <title>/og:title, which is the only signal left to
      // build scope from. This used to be discarded here and again in the
      // crawl_done payload.
      title: String(rawPage.title || "").trim() || undefined,
      content: String(
        rawPage.rawContent ||
          rawPage.markdown ||
          rawPage.content ||
          "",
      ),
    }
  })
}

function totalContentChars(pages: CrawledPage[]): number {
  return pages.reduce((sum, page) => sum + (page.content?.trim().length || 0), 0)
}

function streamResponse(
  run: (emit: (event: AnalyzeBrandStreamEvent) => void) => Promise<void>,
): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AnalyzeBrandStreamEvent) => {
        controller.enqueue(encoder.encode(encodeAnalyzeEvent(event)))
      }
      try {
        await run(emit)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error)
        console.error("Brand analysis error:", error)
        emit({ phase: "error", error: message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  })
}

function emitCrawlDone(
  emit: (event: AnalyzeBrandStreamEvent) => void,
  pages: CrawledPage[],
) {
  emit({
    phase: "crawl_done",
    message: ANALYZE_PHASE_COPY.crawl_done,
    pages: trimCorpusPages(pages),
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to analyze your website." },
      { status: 401 },
    )
  }

  const { url, targetSeeds: rawTargetSeeds = [] } = await req.json()
  if (!url) {
    return NextResponse.json({ error: "Missing URL" }, { status: 400 })
  }

  const host = normalizeAnalyzeHost(url)
  if (!host) {
    return NextResponse.json({ error: "That website URL is not valid." }, { status: 400 })
  }

  const targetSeeds = Array.from(
    new Set(
      (Array.isArray(rawTargetSeeds) ? rawTargetSeeds : [])
        .map((seed: unknown) => normalizeSeed(String(seed)))
        .filter(Boolean),
    ),
  )
  if (targetSeeds.length > MAX_TOTAL_SCOPE_SEEDS) {
    return NextResponse.json(
      {
        error: `Add no more than ${MAX_TOTAL_SCOPE_SEEDS} main customer searches.`,
      },
      { status: 400 },
    )
  }

  const cachedPages = await readCorpus(supabase, user.id, host)
  if (!cachedPages) {
    const tavilyStarts = await countTavilyStartsToday(supabase, user.id)
    if (tavilyStarts >= MAX_TAVILY_STARTS_PER_DAY) {
      return NextResponse.json(
        {
          error:
            "You've analyzed 3 websites today. Try again tomorrow, or refresh if you already analyzed this one — we keep those pages.",
        },
        { status: 429 },
      )
    }
  }

  return streamResponse(async (emit) => {
    emit({
      phase: "crawl_started",
      message: ANALYZE_PHASE_COPY.crawl_started,
    })

    let crawledPages: CrawledPage[] = []
    let crawlResponse: unknown
    let usedCache = Boolean(cachedPages)

    if (cachedPages) {
      crawledPages = cachedPages
      emit({
        phase: "crawl_started",
        message: "Reusing pages we already read…",
      })
      emitCrawlDone(emit, crawledPages)
    } else {
      const begun = await beginCorpusRun(supabase, user.id, host)
      if (begun.kind === "blocked") {
        emit({
          phase: "error",
          error:
            "We're still reading this site. Wait a minute, then refresh — we will reuse the pages, not crawl again.",
        })
        return
      }
      if (begun.kind === "hit") {
        usedCache = true
        crawledPages = begun.pages
        emit({
          phase: "crawl_started",
          message: "Reusing pages we already read…",
        })
        emitCrawlDone(emit, crawledPages)
      } else {
        const apiKey = process.env.TAVILY_API_KEY
        if (!apiKey) {
          emit({ phase: "error", error: "Tavily API key not configured" })
          return
        }
        const tvly = tavily({ apiKey })
        await markTavilyStart(supabase, user.id, host)

        // Select before extracting so one sitemap branch cannot consume the page
        // budget. The bounded crawl below is the only fallback.
        const sitemapUrls = await fetchAllSitemapUrls(url)
        emit({
          phase: "crawl_started",
          message: sitemapUrls.length > 0
            ? `Found ${sitemapUrls.length} page${sitemapUrls.length === 1 ? "" : "s"} in your sitemap…`
            : "No sitemap found — reading your site directly…",
        })
        const representativeUrls = selectRepresentativeBrandUrls(
          url,
          sitemapUrls,
          targetSeeds,
          BRAND_CRAWL_LIMIT,
        )
        if (representativeUrls.length > 0) {
          crawlResponse = await tvly.extract(representativeUrls, {
            extractDepth: "basic",
            format: "markdown",
          })
          crawledPages = pagesFromCrawl(crawlResponse)
          const failedResults = (crawlResponse as {
            failedResults?: Array<{ url?: string; error?: string }>
          }).failedResults || []
          if (failedResults.length > 0) {
            console.warn("[Brand Analysis] Representative extraction failures", failedResults)
          }
        }

        if (crawledPages.length < 3 || totalContentChars(crawledPages) < THIN_CORPUS_CHARS) {
          emit({
            phase: "crawl_started",
            message: "Your sitemap was thin — reading the site directly…",
          })
          crawlResponse = await tvly.crawl(url, {
            limit: BRAND_CRAWL_LIMIT,
            extractDepth: "basic",
            format: "markdown",
            instructions: CRAWL_INSTRUCTIONS,
          })
          const fallbackPages = pagesFromCrawl(crawlResponse)
          crawledPages = Array.from(
            new Map([...crawledPages, ...fallbackPages].map((page) => [page.url, page])).values(),
          ).slice(0, BRAND_CRAWL_LIMIT)
        }

        await saveCorpusPages(supabase, user.id, host, crawledPages as CorpusPage[])
        emitCrawlDone(emit, crawledPages)
      }
    }

    const combinedContent =
      buildRankedBrandCorpus(crawledPages) ||
      (usedCache ? "" : JSON.stringify(crawlResponse || {}).slice(0, 20000))

    if (!combinedContent || combinedContent.length < 50) {
      emit({ phase: "error", error: "No content extracted from website" })
      return
    }

    // crawl_done already emitted with full { url, title, content } so a
    // refresh can checkpoint pages before the persona LLM finishes.

    // Scope extraction is NOT run here — it is its own call, POST
    // /api/analyze-brand/scope, made after the founder has confirmed these brand
    // details. Onboarding is sequential so each screen waits only on its own
    // data; running both here is what produced a confirm screen where half the
    // content arrived a persona-call later than the rest.
    //
    // The second call re-uses this crawl (returned below), so it costs one LLM
    // call rather than another 20-60s of sitemap walking and extraction.
    const brandPromise = (async () => {
      // The instruction and schema live in lib/brand-profile.ts so they can be
      // exercised without a session, a crawl and a stream. See the note there.
      const text = await requestBrandProfile(url, combinedContent, targetSeeds)
      let brandData: Record<string, unknown> = {}
      try {
        brandData = JSON.parse(text || "{}")
      } catch (e) {
        console.warn("Brand analysis JSON parse failed, trying repair:", e)
        try {
          brandData = JSON.parse(jsonrepair(text || "{}"))
        } catch (e2) {
          console.error("Critical Brand Analysis JSON parse failure:", e2)
          throw new Error("Failed to parse brand analysis results")
        }
      }

      return brandData
    })()

    let brandData: Record<string, unknown>
    try {
      brandData = await brandPromise
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "We could not read what your website sells. Please retry."
      console.error("[Brand Analysis] Persona extract failed:", error)
      emit({ phase: "error", error: message })
      return
    }

    // Scope is empty at this point by design — the next call fills it. Parsed
    // here anyway so an unusable persona fails now rather than two screens later.
    const validated = BrandDetailsSchema.safeParse({
      ...brandData,
      scope_families: [],
      target_seed_keywords: targetSeeds,
    })
    if (!validated.success) {
      console.error(
        "[Brand Analysis] Invalid response:",
        validated.error.flatten(),
      )
      emit({
        phase: "error",
        error:
          "The website analysis returned an invalid business profile. Please retry.",
      })
      return
    }

    emit({
      phase: "brand_ready",
      message: ANALYZE_PHASE_COPY.brand_ready,
      brand: validated.data,
    })

    // Demand-checking seed keywords against Google Suggest is advisory only and
    // must never sit in this request's critical path — see the incident note
    // on seed demand validation in lib/harvest/query-validation.ts. The client
    // fetches it separately, after this response has already rendered, from
    // POST /api/analyze-brand/demand-check.
    emit({
      phase: "complete",
      message: ANALYZE_PHASE_COPY.complete,
      data: validated.data,
      // The corpus, handed to the scope call so it need not crawl again.
      // Trimmed to the same budget lib/scope-extraction.ts already applies, so
      // nothing extra is carried over the wire.
      pages: trimCorpusPages(crawledPages),
    })
  })
}
