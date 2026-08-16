import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { buildBuyerPrompts } from "@/lib/visibility/prompt-builder"
import type { BuyerPromptFamily } from "@/lib/visibility/prompt-template"
import { resolveLanguage } from "@/lib/target-market"

export const maxDuration = 60

interface GeneratePromptsRequest {
    scopeFamilies: Array<{
        id?: string
        name: string
        description: string
        seed_keywords?: string[]
        // Accepted for compatibility with stored scope rows. Buyer-question
        // generation deliberately does not consume the writer contract: it
        // needs confirmed markets and product context, not invented mechanics.
        capability_contract?: unknown
        enabled?: boolean
    }>
    productName?: string
    subjectType?: string
    competitors?: string[]
    /** ISO-639-1. Buyers ask in their own language, so the questions must be in it. */
    language?: string
    /** The confirmed category, in the customer's words. */
    category?: string
    /** Who has the problem. Background on whose situation to write from. */
    audience?: string
    /** What the product actually does, so a prompt can name a real constraint. */
    coreFeatures?: string[]
    maxPrompts?: number
    /** Questions retained outside a regenerated family; never paraphrase them. */
    excludeQuestions?: string[]
    /** Optional: regenerate prompts for a single scope family only */
    familyId?: string
}

function normalizeScopeFamilies(
    rawFamilies: GeneratePromptsRequest["scopeFamilies"],
): BuyerPromptFamily[] {
    return rawFamilies
        .filter((f) => f.enabled !== false && f.name?.trim().length > 0)
        .map((f, index) => ({
            id: f.id || `family-${index + 1}`,
            name: f.name.trim(),
            description: f.description?.trim() || f.name.trim(),
            seedKeywords:
                Array.isArray(f.seed_keywords) && f.seed_keywords.length > 0
                    ? f.seed_keywords
                    : [f.name.trim()],
        }))
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
        }

        const body = (await req.json()) as GeneratePromptsRequest

        if (!Array.isArray(body.scopeFamilies) || body.scopeFamilies.length === 0) {
            return NextResponse.json(
                { error: "At least one scope family is required to generate prompts" },
                { status: 400 },
            )
        }

        let families = normalizeScopeFamilies(body.scopeFamilies)

        if (body.familyId) {
            families = families.filter((f) => f.id === body.familyId)
            if (families.length === 0) {
                return NextResponse.json(
                    { error: `Scope family ${body.familyId} not found` },
                    { status: 404 },
                )
            }
        }

        // Only the customer's own name is contraband. Competitors are material:
        // a buyer asking for a tool frames it against one they already use, and
        // banning every rival name is what produced abstract category questions.
        const subjectTokens: string[] = []
        if (body.productName?.trim()) {
            subjectTokens.push(body.productName.trim())
        }

        const incumbents = (body.competitors || [])
            .map((competitor) => competitor?.trim())
            .filter((competitor): competitor is string => Boolean(competitor))

        const subjectType = body.subjectType?.trim() || "software tool or service"

        const result = await buildBuyerPrompts(families, {
            subjectType,
            language: resolveLanguage(body.language),
            subjectTokens,
            context: {
                category: body.category?.trim() || undefined,
                coreFeatures: body.coreFeatures,
                audience: body.audience?.trim() || undefined,
                incumbents,
            },
            maxPrompts: body.maxPrompts,
            questionsToAvoid: Array.isArray(body.excludeQuestions)
                ? body.excludeQuestions
                      .map((question) => String(question).trim())
                      .filter(Boolean)
                      .slice(0, 60)
                : [],
        })

        return NextResponse.json({
            prompts: result.prompts,
            report: result.report,
        })
    } catch (error) {
        console.error("[generate-prompts] Error:", error)
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Failed to generate prompts",
            },
            { status: 500 },
        )
    }
}
