import { NextRequest, NextResponse } from "next/server"

import {
  MAX_TOTAL_SCOPE_SEEDS,
  normalizeSeed,
  trimFamiliesToSearchCap,
  validateGroundedScope,
} from "@/lib/brand-scope"
import { extractScopeFamilies } from "@/lib/scope-extraction"
import {
  refineScopeRoles,
  type ScopeBrandProfile,
} from "@/lib/scope-role-refine"
import { batchExtractTitles } from "@/lib/audit/site-scanner"
import { normalizeAnalyzeHost, readCorpus } from "@/lib/brand-analyze-corpus"
import { createClient } from "@/utils/supabase/server"
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
 * Titles from raw HTML of URLs we already have.
 *
 * `extractPageTitle` is unpaid HTTP. A JS-rendered SPA that returns empty
 * markdown still almost always serves a real <title>/og:title. Do not walk the
 * sitemap again when the crawl cache or supplied pages already exist.
 */
async function titleCorpus(subjectUrl: string, known: AnalyzedPage[]): Promise<AnalyzedPage[]> {
  const candidates = Array.from(
    new Set([
      subjectUrl,
      ...known.map((page) => page.url).filter(Boolean),
    ]),
  ).slice(0, MAX_TITLE_PAGES)

  const infos = await batchExtractTitles(candidates, TITLE_CONCURRENCY)
  return infos
    .filter((info) => info.title?.trim())
    .map((info) => ({
      url: info.url,
      title: info.title,
      content: `${info.title}\n${decodeURIComponent(info.url)}`,
    }))
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

    const rawProfile = body?.brandProfile
    const brandProfile: ScopeBrandProfile | null =
      rawProfile &&
      typeof rawProfile === "object" &&
      String(rawProfile.product_name || "").trim() &&
      String(rawProfile.product_identity?.literally || "").trim()
        ? {
            product_name: String(rawProfile.product_name).trim(),
            product_identity: {
              literally: String(rawProfile.product_identity.literally).trim(),
            },
            category: rawProfile.category
              ? String(rawProfile.category).trim()
              : "",
            core_features: Array.isArray(rawProfile.core_features)
              ? rawProfile.core_features.map(String)
              : [],
            how_it_works: Array.isArray(rawProfile.how_it_works)
              ? rawProfile.how_it_works.map(String)
              : [],
            uvp: Array.isArray(rawProfile.uvp) ? rawProfile.uvp.map(String) : [],
          }
        : null

    const supplied: AnalyzedPage[] = Array.isArray(body?.pages)
      ? body.pages
          .filter((page: AnalyzedPage) => page?.url)
          .map((page: AnalyzedPage) => ({
            url: String(page.url),
            title: page.title ? String(page.title) : undefined,
            content: String(page.content || ""),
          }))
      : []

    const heartbeat = (
      phase: AnalyzeBrandStreamEvent["phase"],
      message: string,
    ) => {
      const id = setInterval(() => emit({ phase, message }), 15_000)
      return () => clearInterval(id)
    }

    emit({ phase: "scope_started", message: "Grouping what you sell…" })

    // The corpus the first call already crawled, then the 24h checkpoint if
    // the client lost pages on refresh.
    let pages = supplied
    let corpusTier = "crawl"

    if (usableChars(pages) < THIN_CORPUS_CHARS) {
      const host = normalizeAnalyzeHost(url)
      const cached = host ? await readCorpus(supabase, user.id, host) : null
      if (cached && usableChars(cached) > usableChars(pages)) {
        pages = cached
        corpusTier = "cache"
      }
    }

    // Empty-markdown fallback: titles only (unpaid HTTP). Do not spend a
    // Tavily search credit on a result this free funnel may never return.
    if (usableChars(pages) < THIN_CORPUS_CHARS) {
      emit({
        phase: "scope_started",
        message: "Your pages are mostly JavaScript — reading their titles instead…",
      })
      const titles = await titleCorpus(url, pages.length > 0 ? pages : supplied)
      if (titles.length > 0) {
        pages = titles
        corpusTier = "titles"
      }
    }

    console.log(
      `[Scope] corpus=${corpusTier} pages=${pages.length} chars=${usableChars(pages)}`,
    )

    const stopExtractBeat = heartbeat(
      "scope_started",
      "Grouping what you sell…",
    )
    let extracted
    try {
      extracted = await extractScopeFamilies(
        url,
        pages.map((page) => ({ url: page.url, content: page.content || "" })),
        targetSeeds,
        brandProfile
          ? {
              product_name: brandProfile.product_name,
              product_identity: brandProfile.product_identity,
              category: brandProfile.category,
            }
          : null,
      )
    } finally {
      stopExtractBeat()
    }

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
          "We could not work out what you sell from your website or your page titles. Tell us in one line and we will build from that.",
      })
      return
    }

    // Unlock confirm as soon as grounding has families. Refine can still
    // replace this list; if the function is killed during refine the client
    // already has something real instead of an empty "found nothing" card.
    const groundedFamilies = trimFamiliesToSearchCap(grounded.families)
    emit({
      phase: "scope_ready",
      message: `Mapped ${groundedFamilies.length} product area${
        groundedFamilies.length === 1 ? "" : "s"
      }…`,
      scope_families: groundedFamilies,
      scope_analysis_issues: grounded.issues,
      unassigned_target_seeds: grounded.unassignedTargetSeeds,
    })

    emit({
      phase: "scope_refining",
      message: "Separating what buyers search for from how you deliver…",
    })
    const stopRefineBeat = heartbeat(
      "scope_refining",
      "Separating what buyers search for from how you deliver…",
    )
    let refined
    try {
      refined = await refineScopeRoles(
        grounded.families,
        brandProfile,
        targetSeeds,
      )
    } finally {
      stopRefineBeat()
    }
    const issues = [...grounded.issues, ...refined.issues]
    const scopedFamilies =
      refined.families.length > 0
        ? trimFamiliesToSearchCap(refined.families)
        : groundedFamilies

    emit({
      phase: "complete",
      message: "Ready",
      scope_families: scopedFamilies,
      scope_analysis_issues: issues,
      unassigned_target_seeds: grounded.unassignedTargetSeeds,
    })
  })
}
