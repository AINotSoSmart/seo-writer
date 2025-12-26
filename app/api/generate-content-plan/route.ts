import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { BrandDetails } from "@/lib/schemas/brand"
import { generateContentPlan } from "@/lib/plans/generator"
import { expandIdeaUniverse, validateWithCompetitors } from "@/lib/plans/idea-expansion"

export const maxDuration = 300 // 5 minute timeout

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { seeds, brandData, brandId, existingContent } = await req.json() as {
            seeds: string[],
            brandData: BrandDetails,
            brandId: string,
            existingContent?: string[]
        }

        if (!seeds || !Array.isArray(seeds) || seeds.length === 0) {
            return NextResponse.json({ error: "Seeds are required" }, { status: 400 })
        }

        if (!brandData) {
            return NextResponse.json({ error: "Brand data is required" }, { status: 400 })
        }

        // --- PHASE A: Expand Idea Universe ---
        console.log("[Content Plan API] Starting Phase A: Idea Expansion...")
        const ideaUniverse = await expandIdeaUniverse(brandData)
        console.log(`[Content Plan API] Phase A complete: ${ideaUniverse.length} domains`)

        // --- PHASE B: Validate with Competitor Coverage ---
        console.log("[Content Plan API] Starting Phase B: Competitor Validation...")
        const competitorContent = seeds.join("\n") // Use seeds as proxy for competitor content
        const ideaCoverageMap = await validateWithCompetitors(ideaUniverse, competitorContent)
        console.log("[Content Plan API] Phase B complete")

        // --- PHASE C: Generate Plan (existing, now enhanced) ---
        const { plan, categoryDistribution } = await generateContentPlan({
            userId: user.id,
            brandId: brandId || "unknown",
            brandData,
            seeds,
            ideaUniverse,
            ideaCoverageMap,
            existingContent
        })

        return NextResponse.json({ plan, categoryDistribution, ideaUniverse })
    } catch (error: any) {
        console.error("Content plan generation error:", error)
        return NextResponse.json(
            { error: error.message || "Failed to generate content plan" },
            { status: 500 }
        )
    }
}
