import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { buildBuyerPrompts, type BuyerPrompt } from "@/lib/visibility/prompt-builder"
import type { AuditScopeFamily } from "@/lib/harvest/scope-classifier"
import type { CapabilityContract } from "@/lib/writer/article-contract"
import { CAPABILITY_CONTRACT_VERSION } from "@/lib/writer/article-contract"
import { resolveLanguage } from "@/lib/target-market"

export const maxDuration = 60

interface GeneratePromptsRequest {
    scopeFamilies: Array<{
        id?: string
        name: string
        description: string
        seed_keywords?: string[]
        priority?: number
        parent_scope_family_id?: string | null
        capability_contract?: CapabilityContract | null
        enabled?: boolean
    }>
    productName?: string
    subjectType?: string
    competitors?: string[]
    /** ISO-639-1. Buyers ask in their own language, so the questions must be in it. */
    language?: string
    maxPrompts?: number
    /** Optional: regenerate prompts for a single scope family only */
    familyId?: string
}

function normalizeScopeFamilies(
    rawFamilies: GeneratePromptsRequest["scopeFamilies"],
): AuditScopeFamily[] {
    return rawFamilies
        .filter((f) => f.enabled !== false && f.name?.trim().length > 0)
        .map((f, index) => {
            const fallbackContract: CapabilityContract = {
                version: CAPABILITY_CONTRACT_VERSION,
                deliveryMode: "web application or service",
                operations: [
                    {
                        key: "core_service",
                        customerJob: f.name.trim(),
                        inputs: ["user requirements"],
                        action: f.description?.trim() || f.name.trim(),
                        outputs: ["completed result"],
                        limits: [],
                        evidenceRefs: [],
                    },
                ],
                facts: [],
            }

            return {
                id: f.id || `family-${index + 1}`,
                name: f.name.trim(),
                description: f.description?.trim() || f.name.trim(),
                seedKeywords: Array.isArray(f.seed_keywords) && f.seed_keywords.length > 0
                    ? f.seed_keywords
                    : [f.name.trim()],
                priority: f.priority ?? index,
                parentScopeFamilyId: f.parent_scope_family_id ?? null,
                capabilityContract: f.capability_contract && f.capability_contract.operations?.length
                    ? f.capability_contract
                    : fallbackContract,
            }
        })
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

        // Entity tokens to reject: product name and competitors
        const entityTokens: string[] = []
        if (body.productName?.trim()) {
            entityTokens.push(body.productName.trim())
        }
        if (Array.isArray(body.competitors)) {
            for (const comp of body.competitors) {
                if (comp?.trim()) entityTokens.push(comp.trim())
            }
        }

        const subjectType = body.subjectType?.trim() || "software tool or service"

        const result = await buildBuyerPrompts(families, {
            subjectType,
            language: resolveLanguage(body.language),
            entityTokens,
            maxPrompts: body.maxPrompts,
        })

        return NextResponse.json({
            prompts: result.prompts,
            report: result.report,
        })
    } catch (error) {
        console.error("[generate-prompts] Error:", error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to generate prompts" },
            { status: 500 },
        )
    }
}
