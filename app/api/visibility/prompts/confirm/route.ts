import { NextRequest, NextResponse } from "next/server"

import { normalizeQuery } from "@/lib/harvest/types"
import {
    DEFAULT_PROMPTS_PER_RUN,
    PROMPT_INTENTS,
    type PromptIntentKey,
} from "@/lib/visibility/prompt-config"
import {
    containsCalendarYear,
    incumbentNeedles,
    inferPromptIntent,
    mentionsIncumbent,
    promptsAreNearDuplicates,
} from "@/lib/visibility/prompt-selection"
import { createClient } from "@/utils/supabase/server"
import { bindPromptCapability } from "@/lib/visibility/capability-binding"
import type { CapabilityContract } from "@/lib/writer/article-contract"

interface ConfirmPromptInput {
    text?: string
    scopeFamilyId?: string
    intent?: PromptIntentKey
    sourceSeed?: string
}

const articleTypeByIntent = Object.fromEntries(
    PROMPT_INTENTS.map((intent) => [intent.key, intent.articleType]),
) as Record<PromptIntentKey, "commercial" | "informational" | "howto">

/** Commits the exact launch-size set the customer reviewed. */
export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    let body: { brandId?: string; prompts?: ConfirmPromptInput[] }
    try {
        body = (await req.json()) as typeof body
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    if (!body.brandId) {
        return NextResponse.json({ error: "brandId is required" }, { status: 400 })
    }
    if (!Array.isArray(body.prompts) || body.prompts.length !== DEFAULT_PROMPTS_PER_RUN) {
        return NextResponse.json(
            {
                error: `Confirm exactly ${DEFAULT_PROMPTS_PER_RUN} buyer questions before continuing.`,
                reason: "wrong_prompt_count",
            },
            { status: 400 },
        )
    }

    const { data: brand } = await supabase
        .from("brand_details")
        .select("website_url, brand_data")
        .eq("id", body.brandId)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .maybeSingle()
    if (!brand) {
        return NextResponse.json({ error: "Brand not found" }, { status: 404 })
    }
    const brandData = (brand.brand_data ?? {}) as { product_name?: string }
    const subjectNeedles = incumbentNeedles([
        brandData.product_name ?? "",
        brand.website_url ?? "",
    ])

    const { data: familyRows } = await supabase
        .from("brand_scope_families")
        .select("id, capability_contract")
        .eq("brand_id", body.brandId)
        .eq("user_id", user.id)
        .eq("enabled", true)
    const capabilityByFamily = new Map(
        (familyRows ?? []).map((row: any) => [
            row.id,
            row.capability_contract as CapabilityContract,
        ]),
    )

    const prompts = body.prompts.map((prompt) => {
        const text = (prompt.text ?? "").trim()
        const fallback = prompt.intent ?? "problem"
        const intent = inferPromptIntent(text, fallback)
        const scopeFamilyId = (prompt.scopeFamilyId ?? "").trim()
        const sourceSeed = (prompt.sourceSeed ?? "").trim()
        const bound = bindPromptCapability({
            scopeFamilyId,
            prompt: text,
            sourceSeed,
            contract: capabilityByFamily.get(scopeFamilyId),
        })
        return {
            prompt: text,
            prompt_norm: normalizeQuery(text),
            scope_family_id: scopeFamilyId,
            intent,
            article_type: articleTypeByIntent[intent],
            source_seed: sourceSeed,
            intent_binding: bound.binding,
        }
    })

    if (prompts.some((prompt) => prompt.prompt.length < 15 || prompt.prompt.length > 200)) {
        return NextResponse.json(
            { error: "Every buyer question must contain 15-200 characters." },
            { status: 400 },
        )
    }
    if (prompts.some((prompt) => containsCalendarYear(prompt.prompt))) {
        return NextResponse.json(
            {
                error:
                    "Tracked questions cannot contain a calendar year because the same set is measured every month.",
                reason: "dated_prompt",
            },
            { status: 400 },
        )
    }
    if (prompts.some((prompt) => mentionsIncumbent(prompt.prompt, subjectNeedles))) {
        return NextResponse.json(
            {
                error:
                    "Discovery questions cannot name your own brand. Ask what buyers would type before knowing you exist.",
                reason: "subject_named_in_prompt",
            },
            { status: 400 },
        )
    }

    const norms = new Set(prompts.map((prompt) => prompt.prompt_norm))
    if (norms.size !== prompts.length) {
        return NextResponse.json(
            { error: "Tracked buyer questions must be unique.", reason: "duplicate_prompt" },
            { status: 400 },
        )
    }
    for (let left = 0; left < prompts.length; left++) {
        for (let right = left + 1; right < prompts.length; right++) {
            if (promptsAreNearDuplicates(prompts[left].prompt, prompts[right].prompt)) {
                return NextResponse.json(
                    {
                        error:
                            "Two confirmed questions ask substantially the same thing. Edit or regenerate one before continuing.",
                        reason: "near_duplicate_prompt",
                    },
                    { status: 400 },
                )
            }
        }
    }

    const { data, error } = await supabase.rpc("confirm_tracked_prompts", {
        p_brand_id: body.brandId,
        p_prompts: prompts,
    })
    if (error) {
        console.error("[confirm-prompts] Could not persist tracked prompts:", error)
        return NextResponse.json(
            {
                error:
                    "We couldn't save the confirmed questions. Nothing was measured; review the questions and try again.",
                reason: "prompt_persistence_failed",
            },
            { status: 409 },
        )
    }

    return NextResponse.json({ confirmed: Number(data) })
}
