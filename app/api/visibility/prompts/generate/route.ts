import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { buildBuyerPrompts } from "@/lib/visibility/prompt-builder"
import type { BuyerPromptFamily } from "@/lib/visibility/prompt-template"
import { resolveLanguage } from "@/lib/target-market"

/**
 * Matches every other LLM stage in onboarding — analyze-brand, scope and
 * analyze-competitors all run at 300.
 *
 * It was 60, set when generation was a single Gemini call. It is now a bounded
 * loop: up to three generation passes, a capability-coverage pass when one is
 * needed, and a critic that retries once if its response comes back short. Four
 * to five sequential calls on `gemini-3-flash-preview`, each returning up to 25
 * structured questions, does not fit in sixty seconds — the gateway returned
 * 504 and onboarding showed the founder a JSON parse error.
 */
export const maxDuration = 300

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

        const families = normalizeScopeFamilies(body.scopeFamilies)

        // The customer's own name is rejected separately because supplying it
        // would turn an unprompted recommendation measurement into a recall test.
        const subjectTokens: string[] = []
        if (body.productName?.trim()) {
            subjectTokens.push(body.productName.trim())
        }

        // Rivals are a rejection list, not context. They are never shown to the
        // model; they exist so a question that names one can be discarded.
        const rivalBrands = (body.competitors || [])
            .map((competitor) => competitor?.trim())
            .filter((competitor): competitor is string => Boolean(competitor))

        const subjectType = body.subjectType?.trim() || "software tool or service"

        const result = await buildBuyerPrompts(families, {
            subjectType,
            language: resolveLanguage(body.language),
            subjectTokens,
            rivalBrands,
            context: {
                category: body.category?.trim() || undefined,
                coreFeatures: body.coreFeatures,
                audience: body.audience?.trim() || undefined,
            },
            maxPrompts: body.maxPrompts,
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
