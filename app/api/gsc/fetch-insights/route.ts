import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { refreshGSCToken } from "@/actions/gsc"
import { GSCInsights, ContentPlanItem } from "@/lib/schemas/content-plan"

interface GSCQueryRow {
    keys: string[]
    clicks: number
    impressions: number
    ctr: number
    position: number
}

interface GSCPageRow {
    keys: string[]
    clicks: number
    impressions: number
    ctr: number
    position: number
}

// Compute opportunity score for a query
function computeOpportunityScore(
    impressions: number,
    position: number,
    ctr: number
): { score: number; badge: "high_impact" | "quick_win" | "low_ctr" | "new_opportunity" } {
    let score = 0
    let badge: "high_impact" | "quick_win" | "low_ctr" | "new_opportunity" = "new_opportunity"

    // High impressions = high potential
    if (impressions > 1000) score += 40
    else if (impressions > 500) score += 30
    else if (impressions > 100) score += 20
    else score += 10

    // Position 7-20 = quick win opportunity (page 1-2)
    if (position >= 7 && position <= 20) {
        score += 35
        badge = "quick_win"
    } else if (position > 20 && position <= 50) {
        score += 20
        badge = "new_opportunity"
    } else if (position <= 6) {
        score += 10 // Already ranking well
    }

    // Low CTR with high impressions = optimization opportunity
    if (ctr < 0.02 && impressions > 500) {
        score += 25
        badge = "low_ctr"
    }

    // Override badge for very high scores
    if (score >= 80) {
        badge = "high_impact"
    }

    return { score, badge }
}

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Get GSC connection
        const { data: connection } = await supabase
            .from("gsc_connections")
            .select("*")
            .eq("user_id", user.id)
            .single()

        if (!connection) {
            return NextResponse.json({ error: "GSC not connected" }, { status: 400 })
        }

        // Check if token is expired and refresh if needed
        let accessToken = connection.access_token
        const expiresAt = new Date(connection.expires_at)

        if (expiresAt < new Date()) {
            const refreshResult = await refreshGSCToken(connection.id)
            if (!refreshResult.success) {
                return NextResponse.json({ error: "Failed to refresh token" }, { status: 401 })
            }
            accessToken = refreshResult.accessToken
        }

        const siteUrl = connection.site_url
        if (!siteUrl) {
            return NextResponse.json({ error: "No site URL configured" }, { status: 400 })
        }

        // Calculate date range (last 30 days)
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(endDate.getDate() - 30)

        const dateRange = {
            startDate: startDate.toISOString().split("T")[0],
            endDate: endDate.toISOString().split("T")[0],
        }

        // Fetch top queries
        const queriesResponse = await fetch(
            `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ...dateRange,
                    dimensions: ["query"],
                    rowLimit: 50,
                }),
            }
        )

        if (!queriesResponse.ok) {
            console.error("GSC queries fetch failed:", await queriesResponse.text())
            return NextResponse.json({ error: "Failed to fetch GSC data" }, { status: 500 })
        }

        const queriesData = await queriesResponse.json()
        const queries: GSCQueryRow[] = queriesData.rows || []

        // DEBUG: Log raw GSC data
        console.log("=== GSC API DEBUG (Server-side) ===")
        console.log("Site URL:", siteUrl)
        console.log("Date Range:", dateRange)
        console.log("Raw Queries Count:", queries.length)
        console.log("First 5 Raw Queries:", queries.slice(0, 5).map(q => ({
            query: q.keys[0],
            impressions: q.impressions,
            clicks: q.clicks,
            position: q.position,
            ctr: q.ctr
        })))

        // Fetch top pages
        const pagesResponse = await fetch(
            `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ...dateRange,
                    dimensions: ["page"],
                    rowLimit: 20,
                }),
            }
        )

        const pagesData = await pagesResponse.json()
        const pages: GSCPageRow[] = pagesData.rows || []

        console.log("Raw Pages Count:", pages.length)

        // Compute insights
        const topOpportunities = queries
            .map(q => {
                const { score, badge } = computeOpportunityScore(q.impressions, q.position, q.ctr)
                return {
                    query: q.keys[0],
                    impressions: q.impressions,
                    position: Math.round(q.position * 10) / 10,
                    ctr: Math.round(q.ctr * 10000) / 100, // Convert to percentage
                    opportunity_score: score,
                    badge,
                }
            })
            .sort((a, b) => b.opportunity_score - a.opportunity_score)
            .slice(0, 20)

        console.log("Computed Top Opportunities:", topOpportunities.slice(0, 5))

        const pagesOnPageTwo = pages
            .filter(p => p.position >= 11 && p.position <= 20)
            .map(p => ({
                page: p.keys[0],
                position: Math.round(p.position * 10) / 10,
                impressions: p.impressions,
            }))

        const lowCtrPages = pages
            .filter(p => p.ctr < 0.02 && p.impressions > 100)
            .map(p => ({
                page: p.keys[0],
                ctr: Math.round(p.ctr * 10000) / 100,
                impressions: p.impressions,
            }))

        const insights: GSCInsights = {
            top_opportunities: topOpportunities,
            pages_on_page_two: pagesOnPageTwo,
            low_ctr_pages: lowCtrPages,
        }

        return NextResponse.json(insights)
    } catch (error: any) {
        console.error("GSC insights error:", error)
        return NextResponse.json(
            { error: error.message || "Failed to fetch GSC insights" },
            { status: 500 }
        )
    }
}

// POST: Enhance an existing content plan with GSC data
export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { planItems } = await req.json() as { planItems: ContentPlanItem[] }

        // Fetch GSC insights first
        const insightsRes = await fetch(new URL("/api/gsc/fetch-insights", req.url), {
            headers: { cookie: req.headers.get("cookie") || "" },
        })

        if (!insightsRes.ok) {
            return NextResponse.json({ error: "Failed to fetch GSC insights" }, { status: 500 })
        }

        const insights: GSCInsights = await insightsRes.json()

        // Enhance plan items with GSC data
        const enhancedItems = planItems.map(item => {
            // Find matching opportunity by keyword
            const match = insights.top_opportunities.find(opp =>
                item.main_keyword.toLowerCase().includes(opp.query.toLowerCase()) ||
                opp.query.toLowerCase().includes(item.main_keyword.toLowerCase())
            )

            if (match) {
                return {
                    ...item,
                    opportunity_score: match.opportunity_score,
                    badge: match.badge,
                    gsc_impressions: match.impressions,
                    gsc_position: match.position,
                    gsc_ctr: match.ctr,
                }
            }

            return item
        })

        // Sort by opportunity score (items with GSC data first)
        enhancedItems.sort((a, b) => {
            if (a.opportunity_score && b.opportunity_score) {
                return b.opportunity_score - a.opportunity_score
            }
            if (a.opportunity_score) return -1
            if (b.opportunity_score) return 1
            return 0
        })

        return NextResponse.json({ enhancedItems })
    } catch (error: any) {
        console.error("Plan enhancement error:", error)
        return NextResponse.json(
            { error: error.message || "Failed to enhance plan" },
            { status: 500 }
        )
    }
}
