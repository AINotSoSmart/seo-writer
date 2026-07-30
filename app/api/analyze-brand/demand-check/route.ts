import { NextRequest, NextResponse } from "next/server"

import {
  findSeedsWithoutDemand,
  MAX_SEEDS_PER_DEMAND_CHECK,
} from "@/lib/harvest/query-validation"

export const maxDuration = 30

/**
 * Advisory-only: which of these confirmed search phrases has no Google
 * Autocomplete demand? Badges them "rarely searched" on the scope-confirmation
 * screen so a mispositioned product area is visible before research spends
 * anything on it.
 *
 * Deliberately a separate endpoint from POST /api/analyze-brand rather than a
 * field on its response. That response used to await this same check inline —
 * unbounded, over every seed across every extracted family — which meant a
 * burst of concurrent requests to an undocumented, rate-limit-prone Google
 * endpoint sat directly in the critical path of the most important screen in
 * onboarding. Google throttled the burst, the retry/backoff correctly waited
 * it out, and "Analyzing..." hung for three minutes in production. This must
 * never again be awaited before the brand-analysis response is returned; the
 * client calls this only after that screen has already rendered, and simply
 * shows no badges if it is slow or fails.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const seeds = Array.isArray(body?.seeds)
      ? body.seeds.filter((seed: unknown): seed is string => typeof seed === "string")
      : []

    if (seeds.length === 0) {
      return NextResponse.json({ seedsWithoutDemand: [] })
    }

    const seedsWithoutDemand = await findSeedsWithoutDemand(
      seeds.slice(0, MAX_SEEDS_PER_DEMAND_CHECK),
    )
    return NextResponse.json({ seedsWithoutDemand })
  } catch (error) {
    // Advisory only — a failure here must never surface as an error to the
    // user, only as the absence of a badge.
    console.error("[Demand Check] failed:", error)
    return NextResponse.json({ seedsWithoutDemand: [] })
  }
}
