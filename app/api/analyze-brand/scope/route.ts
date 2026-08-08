import { NextRequest } from "next/server"
import { tavily } from "@tavily/core"

import {
  MAX_TOTAL_SCOPE_SEEDS,
  normalizeSeed,
  trimFamiliesToSearchCap,
  validateGroundedScope,
} from "@/lib/brand-scope"
import { extractScopeFamilies } from "@/lib/scope-extraction"
import { batchExtractTitles, fetchAllSitemapUrls } from "@/lib/audit/site-scanner"
import { selectRepresentativeBrandUrls } from "@/lib/brand/representative-pages"
import {
  encodeAnalyzeEvent,
  type AnalyzeBrandStreamEvent,
  type AnalyzedPage,
} from "@/lib/analyze-brand/stream"

export const maxDuration = 300

/**
 * Step 2 of onboarding: what does this business sell?
 *
 * Split out of /api/analyze-brand so the founder confirms their brand details
 * before this runs, and so each screen waits only on its own data. It re-uses
 * the corpus the first call already crawled, so this is one LLM call rather
 * than another sitemap walk.
 *
 * THE POINT OF THIS FILE: scope must generate itself. The previous behaviour
 * returned zero areas whenever the crawled markdown was empty — which is exactly
 * what a JS-rendered SPA produces — and then handed the founder a blank form to
 * fill in by hand. That is the one thing this endpoint must never do.
 */

/** Below this, the crawled markdown is not a usable corpus. */
const THIN_CORPUS_CHARS = 1_500
/** Titles are short; take more of them than we would full pages. */
const MAX_TITLE_PAGES = 24
const TITLE_CONCURRENCY = 10

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
        const message = error instanceof Error ? error.message : String(error)
        console.error("Scope analysis error:", error)
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

function usableChars(pages: AnalyzedPage[]): number {
  return pages.reduce((sum, page) => sum + (page.content?.trim().length || 0), 0)
}

/**
 * Tier 2 — page titles fetched from raw HTML.
 *
 * `extractPageTitle` requests the page directly rather than going through
 * Tavily, and falls back `<title>` → `og:title` → `meta[name=title]` → `<h1>` →
 * URL slug. A single-page app that returns an empty body to a markdown
 * extractor still almost always serves a real title and og:title in its shell,
 * so this is the tier that rescues the case that was failing.
 */
async function titleCorpus(subjectUrl: string, known: AnalyzedPage[]): Promise<AnalyzedPage[]> {
  const sitemapUrls = await fetchAllSitemapUrls(subjectUrl).catch(() => [] as string[])
  const candidates = Array.from(
    new Set([
      subjectUrl,
      ...known.map((page) => page.url).filter(Boolean),
      // Already ranked by product-surface signals and route-family diversity,
      // so the first N are the pages most likely to describe what is sold.
      ...selectRepresentativeBrandUrls(subjectUrl, sitemapUrls, [], MAX_TITLE_PAGES),
    ]),
  ).slice(0, MAX_TITLE_PAGES)

  const infos = await batchExtractTitles(candidates, TITLE_CONCURRENCY)
  return infos
    .filter((info) => info.title?.trim())
    .map((info) => ({
      url: info.url,
      title: info.title,
      // The title IS the content at this tier. Pairing it with the slug gives
      // the model two independent hints per page.
      content: `${info.title}\n${decodeURIComponent(info.url)}`,
    }))
}

/**
 * Tier 3 — whatever the search index still holds.
 *
 * `tvly.search` is a different endpoint from `extract`/`crawl` and returns the
 * index's cached copy, which frequently survives where a live extraction of a
 * client-rendered page returns nothing. Same pattern as lib/scraper.ts.
 */
async function searchCorpus(subjectUrl: string): Promise<AnalyzedPage[]> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) return []
  try {
    const tvly = tavily({ apiKey })
    const response = await tvly.search(subjectUrl, {
      searchDepth: "advanced",
      includeRawContent: "markdown",
      maxResults: 5,
    })
    return (response.results || [])
      .map((result: Record<string, unknown>) => ({
        url: String(result.url || subjectUrl),
        title: String(result.title || "").trim() || undefined,
        content: String(result.rawContent || result.content || "").slice(0, 2_400),
      }))
      .filter((page: AnalyzedPage) => (page.content || "").trim())
  } catch (error) {
    console.warn("[Scope] Search fallback failed:", error)
    return []
  }
}

export async function POST(req: NextRequest) {
  return streamResponse(async (emit) => {
    const body = await req.json()
    const url: string = body?.url || ""
    if (!url) {
      emit({ phase: "error", error: "Missing URL" })
      return
    }

    const targetSeeds = Array.from(
      new Set(
        (Array.isArray(body?.targetSeeds) ? body.targetSeeds : [])
          .map((seed: unknown) => normalizeSeed(String(seed)))
          .filter(Boolean),
      ),
    ) as string[]
    if (targetSeeds.length > MAX_TOTAL_SCOPE_SEEDS) {
      emit({
        phase: "error",
        error: `Add no more than ${MAX_TOTAL_SCOPE_SEEDS} main customer searches.`,
      })
      return
    }

    const supplied: AnalyzedPage[] = Array.isArray(body?.pages)
      ? body.pages
          .filter((page: AnalyzedPage) => page?.url)
          .map((page: AnalyzedPage) => ({
            url: String(page.url),
            title: page.title ? String(page.title) : undefined,
            content: String(page.content || ""),
          }))
      : []

    emit({ phase: "scope_started", message: "Grouping what you sell…" })

    // Tier 1: the corpus the first call already crawled.
    let pages = supplied
    let corpusTier = "crawl"

    // Tier 2: real page titles, fetched from raw HTML.
    if (usableChars(pages) < THIN_CORPUS_CHARS) {
      emit({
        phase: "scope_started",
        message: "Your pages are mostly JavaScript — reading their titles instead…",
      })
      const titles = await titleCorpus(url, supplied)
      if (titles.length > 0) {
        pages = titles
        corpusTier = "titles"
      }
    }

    // Tier 3: the search index's cached copy.
    if (usableChars(pages) < THIN_CORPUS_CHARS) {
      emit({
        phase: "scope_started",
        message: "Checking what search engines have indexed for you…",
      })
      const searched = await searchCorpus(url)
      if (usableChars(searched) > usableChars(pages)) {
        pages = searched
        corpusTier = "search"
      }
    }

    console.log(
      `[Scope] corpus=${corpusTier} pages=${pages.length} chars=${usableChars(pages)}`,
    )

    const extracted = await extractScopeFamilies(
      url,
      pages.map((page) => ({ url: page.url, content: page.content || "" })),
      targetSeeds,
    )

    emit({ phase: "scope_grounding", message: "Checking each area against your site…" })

    const grounded = validateGroundedScope(
      extracted,
      pages.map((page) => ({ url: page.url, content: page.content || "" })),
      url,
      targetSeeds,
    )

    if (grounded.families.length === 0) {
      // Every automatic route is exhausted. Ask ONE question — never a form.
      emit({
        phase: "error",
        error:
          "We could not work out what you sell from your website, your page titles, or search results. Tell us in one line and we will build from that.",
      })
      return
    }

    const scopedFamilies = trimFamiliesToSearchCap(grounded.families)
    emit({
      phase: "scope_ready",
      message: `Mapped ${scopedFamilies.length} product area${
        scopedFamilies.length === 1 ? "" : "s"
      }…`,
      scope_families: scopedFamilies,
      scope_analysis_issues: grounded.issues,
      unassigned_target_seeds: grounded.unassignedTargetSeeds,
    })

    emit({
      phase: "complete",
      message: "Ready",
      scope_families: scopedFamilies,
      scope_analysis_issues: grounded.issues,
      unassigned_target_seeds: grounded.unassignedTargetSeeds,
    })
  })
}
