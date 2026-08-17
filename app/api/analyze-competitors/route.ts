/**
 * Competitor discovery for onboarding.
 *
 * There is ONE competitor finder in this repo — `lib/audit/competitor-scanner.ts`
 * — and this route is a thin authenticated wrapper around it. It is not allowed
 * to grow logic of its own again.
 *
 * WHAT WAS HERE BEFORE, AND WHY IT IS GONE. This route used to implement a
 * second, separate finder. It asked a model to guess a "primary product
 * category" from about twenty words (`product_name — literally — category`,
 * never the site itself), searched that guess, and read the results. Every step
 * pushed away from the business being measured:
 *
 *   - The prompt instructed the model to generalise: "focus on the MAIN PRODUCT
 *     CATEGORY", "secondary features are NOT the category", "not niche
 *     features". Its worked example turned "an AI photo restoration and
 *     animation tool" into the category "AI photo editing".
 *   - It asked for 6-9 queries and then used `slice(0, 3)`, at 5 results each.
 *     Fifteen URLs, cut again to five pages.
 *   - It told the model to leave a competitor's URL empty when it did not know
 *     one, then silently dropped every candidate without a resolvable domain.
 *     That deletes precisely the small, specific rivals — the ones a
 *     flash-weight model cannot recall a domain for — and keeps the famous
 *     generalists it can.
 *
 * Measured against bringback.pro (AI photo restoration, reunion portraits, hug
 * videos) it returned exactly one competitor: PicWish. A general-purpose photo
 * editor. The real rivals live at the long tail this design was written to
 * discard, and the confirmed scope families already name them — "ai family
 * portrait generator", "add deceased loved one to photo", "old family person
 * hug video generator" — while this route ignored them entirely.
 *
 * `discoverCompetitors` searches those confirmed seeds directly, one query per
 * product area, and filters the real search results rather than a category
 * guess. It was already in the repo, already better, and only ever ran later to
 * top up whatever slots this route had left empty.
 */

import { NextRequest, NextResponse } from "next/server"

import { discoverCompetitors } from "@/lib/audit/competitor-scanner"
import { HARVEST_POLICY } from "@/lib/harvest/policy"
import { ScopeFamilySchema, type ScopeFamily } from "@/lib/schemas/brand"
import type { TavilySearchPrefs } from "@/lib/tavily-search"
import { createClient } from "@/utils/supabase/server"

export const maxDuration = 300

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = (await req.json()) as {
            url?: string
            productName?: string
            subjectType?: string
            category?: string
            brandKeywords?: string[]
            scopeFamilies?: unknown[]
            searchPrefs?: TavilySearchPrefs
        }

        const productName = String(body.productName || "").trim()
        if (!productName) {
            return NextResponse.json(
                { error: "productName is required" },
                { status: 400 },
            )
        }

        /**
         * The confirmed product areas are the whole point of this call, so they
         * are validated rather than trusted: a malformed family would otherwise
         * reach the search query builder as `undefined` and quietly degrade the
         * run to the brand-keyword fallback — the same silent generalisation
         * this route was rewritten to stop. A family that will not parse is
         * skipped, not fatal; discovery is a convenience and must not block
         * onboarding.
         */
        const scopeFamilies: ScopeFamily[] = (
            Array.isArray(body.scopeFamilies) ? body.scopeFamilies : []
        )
            .map((candidate) => ScopeFamilySchema.safeParse(candidate))
            .filter((result) => result.success)
            .map((result) => (result as { data: ScopeFamily }).data)
            .filter((family) => family.enabled !== false)

        const competitorBrands = await discoverCompetitors(
            {
                product_name: productName,
                product_identity: body.subjectType
                    ? { literally: body.subjectType, emotionally: "", not: "" }
                    : undefined,
                category: String(body.category || ""),
                brand_keywords: Array.isArray(body.brandKeywords)
                    ? body.brandKeywords.filter(
                          (keyword): keyword is string => typeof keyword === "string",
                      )
                    : [],
                scope_families: scopeFamilies,
            },
            HARVEST_POLICY.maxCompetitors,
            body.searchPrefs,
            undefined,
            body.url,
        )

        return NextResponse.json({ competitorBrands })
    } catch (error: unknown) {
        console.error("[Competitor discovery] Failed:", error)
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to discover competitors",
            },
            { status: 500 },
        )
    }
}
