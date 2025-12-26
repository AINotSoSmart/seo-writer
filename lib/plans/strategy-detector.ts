import { createClient } from "@/utils/supabase/server"

export type ContentStage = "foundation" | "growth" | "maturity"

export interface StageDetectionResult {
    stage: ContentStage
    totalImpressions: number
    hasGSC: boolean
}

/**
 * Detect user's content maturity stage based on GSC data.
 * 
 * IMPORTANT: This only activates when GSC is connected.
 * If no GSC connection, returns hasGSC: false and stage detection is skipped.
 * 
 * Stage Thresholds:
 * - Foundation: < 1,000 impressions (or no GSC)
 * - Growth: 1,000 - 50,000 impressions
 * - Maturity: > 50,000 impressions
 */
export async function detectContentStage(userId: string): Promise<StageDetectionResult> {
    const supabase = await createClient()

    // Check if user has GSC connected
    const { data: gscConnection } = await supabase
        .from("gsc_connections")
        .select("id, site_url")
        .eq("user_id", userId)
        .single()

    if (!gscConnection) {
        // No GSC connected - return foundation stage but mark hasGSC as false
        return {
            stage: "foundation",
            totalImpressions: 0,
            hasGSC: false
        }
    }

    // GSC is connected - try to get impression data from most recent plan
    // We use the plan's GSC metrics as a proxy for site maturity
    const { data: plan } = await supabase
        .from("content_plans")
        .select("plan_data, gsc_enhanced")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

    if (!plan || !plan.gsc_enhanced || !plan.plan_data) {
        // GSC connected but no enhanced plan yet - treat as foundation with GSC
        return {
            stage: "foundation",
            totalImpressions: 0,
            hasGSC: true
        }
    }

    // Calculate total impressions from plan items
    const planData = plan.plan_data as any[]
    const totalImpressions = planData.reduce((sum, item) => {
        return sum + (item.gsc_impressions || 0)
    }, 0)

    // Determine stage based on total impressions
    let stage: ContentStage
    if (totalImpressions < 1000) {
        stage = "foundation"
    } else if (totalImpressions < 50000) {
        stage = "growth"
    } else {
        stage = "maturity"
    }

    console.log(`[Strategy Detector] User ${userId}: ${stage} stage (${totalImpressions} impressions)`)

    return {
        stage,
        totalImpressions,
        hasGSC: true
    }
}

/**
 * Get stage-specific strategy prompt section.
 * 
 * This guides the LLM on how to balance Idea Universe vs GSC data
 * based on where the user is in their content journey.
 * 
 * ONLY used when GSC is connected. Without GSC, this returns empty string.
 */
export function getStrategyPrompt(stage: ContentStage, hasGSC: boolean): string {
    // If no GSC, don't inject any strategy prompt
    // The system works with Phase A/B only (Idea Universe + competitor validation)
    if (!hasGSC) {
        return ""
    }

    const strategies: Record<ContentStage, string> = {
        foundation: `
## STRATEGIC MODE: FOUNDATION BUILDING 🌱
Your user has LIMITED search visibility. This is a new/early-stage site.

**Your Mission:**
- PRIORITIZE the IDEA UNIVERSE broadly (plant seeds everywhere)
- Cover DIVERSE problem domains - establish topical breadth
- Do NOT over-optimize for any single keyword
- Create VARIETY across categories

**Content Mix:**
- 70% from Idea Universe (untapped adjacent topics)
- 30% from validated demand signals

**Goal:** Establish topical authority footprint across the entire niche.
`,
        growth: `
## STRATEGIC MODE: GROWTH OPTIMIZATION 📈
Your user has GROWING search visibility. Some content is ranking.

**Your Mission:**
- BALANCE exploration with exploitation
- EXPAND topics where they already show traction
- Create SUPPORTING content for emerging winners
- Explore adjacent IDEA UNIVERSE domains strategically

**Content Mix:**
- 50% from Idea Universe (strategic expansion)
- 50% from GSC-validated topics (double down on winners)

**Goal:** Accelerate growth by reinforcing what works while exploring new opportunities.
`,
        maturity: `
## STRATEGIC MODE: AUTHORITY DEFENSE 🏰
Your user has STRONG search visibility. They are an established player.

**Your Mission:**
- DEFEND top-ranking topics with depth content
- Target "striking distance" keywords (position 5-15)
- Create strategic CLUSTERS around winning topics
- Only NEW topics if Idea Universe shows clear untapped gaps

**Content Mix:**
- 30% from Idea Universe (strategic bets only)
- 70% from GSC-optimized topics (maximize existing authority)

**Goal:** Maximize returns from existing authority while making targeted expansions.
`
    }

    return strategies[stage]
}
