import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { BrandDetails } from "@/lib/schemas/brand"
import { generateContentPlan } from "@/lib/plans/generator"

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
            brandId: string, // Changed to required as per new interface
            existingContent?: string[] // Parent questions from sitemap
        }

        if (!seeds || !Array.isArray(seeds) || seeds.length === 0) {
            return NextResponse.json({ error: "Seeds are required" }, { status: 400 })
        }

        if (!brandData) {
            return NextResponse.json({ error: "Brand data is required" }, { status: 400 })
        }

        // Use the shared generator logic
        const { plan, categoryDistribution } = await generateContentPlan({
            userId: user.id,
            brandId: brandId || "unknown", // Fallback if optional in request but required in lib
            brandData,
            seeds,
            existingContent
        })

        return NextResponse.json({ plan, categoryDistribution })
    } catch (error: any) {
        console.error("Content plan generation error:", error)
        return NextResponse.json(
            { error: error.message || "Failed to generate content plan" },
            { status: 500 }
        )
    }
}
