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
    mentionsIncumbent,
} from "@/lib/visibility/prompt-selection"
import { createClient } from "@/utils/supabase/server"
import {
    bindPromptCapability,
    mergeCapabilityContracts,
} from "@/lib/visibility/capability-binding"
import type { CapabilityContract } from "@/lib/writer/article-contract"
import {
    isSelectionClass,
    UNKNOWN_SELECTION_CLASS,
    type SelectionClass,
} from "@/lib/visibility/selection-class"

interface ConfirmPromptInput {
    text?: string
    scopeFamilyId?: string
    intent?: PromptIntentKey
    sourceSeed?: string
    selectionClass?: SelectionClass
}

const articleTypeByIntent = Object.fromEntries(
    PROMPT_INTENTS.map((intent) => [intent.key, intent.articleType]),
) as Record<PromptIntentKey, "commercial" | "informational" | "howto">

/** Commits the exact variable-size set the customer reviewed. */
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
    if (
        !Array.isArray(body.prompts) ||
        body.prompts.length === 0 ||
        body.prompts.length > DEFAULT_PROMPTS_PER_RUN
    ) {
        return NextResponse.json(
            {
                error: `Confirm between 1 and ${DEFAULT_PROMPTS_PER_RUN} buyer questions before continuing.`,
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
    // One pool of confirmed operations for the brand. Binding used to go
    // question -> area -> that area's contract, so a question could only match
    // an operation belonging to whichever keyword bucket the generator tagged
    // it with. Questions no longer carry a meaningful area.
    const brandContract = mergeCapabilityContracts(
        (familyRows ?? []).map((row: any) => row.capability_contract as CapabilityContract),
    )

    const prompts = body.prompts.map((prompt) => {
        const text = (prompt.text ?? "").trim()
        // The label travels with the question instead of being re-derived from
        // its wording. Generated questions carry the intent the generator chose
        // while it had the brand in front of it; a question the founder typed
        // carries whatever the form set. Re-inferring here used to silently
        // overwrite both with a regex guess.
        const intent = PROMPT_INTENTS.some((entry) => entry.key === prompt.intent)
            ? (prompt.intent as PromptIntentKey)
            : "problem"
        const scopeFamilyId = (prompt.scopeFamilyId ?? "").trim()
        const sourceSeed = (prompt.sourceSeed ?? "").trim()
        const selectionClass = isSelectionClass(prompt.selectionClass)
            ? prompt.selectionClass
            : UNKNOWN_SELECTION_CLASS
        const bound = bindPromptCapability({
            scopeFamilyId,
            prompt: text,
            sourceSeed,
            contract: brandContract,
        })
        return {
            prompt: text,
            prompt_norm: normalizeQuery(text),
            scope_family_id: scopeFamilyId,
            intent,
            article_type: articleTypeByIntent[intent],
            source_seed: sourceSeed,
            selection_class: selectionClass,
            intent_binding: bound.binding,
        }
    })

    /**
     * NAME THE QUESTION, ALWAYS.
     *
     * Every gate below refuses the whole submission, and they used to do it
     * without saying which of twenty-five questions was at fault — leaving the
     * founder staring at a blocking error with nothing to act on. The client
     * renders `error` verbatim, so the offending text goes in the message.
     */
    const quote = (text: string) =>
        `"${text.length > 90 ? `${text.slice(0, 90)}…` : text}"`

    const wrongLength = prompts.find(
        (prompt) => prompt.prompt.length < 15 || prompt.prompt.length > 400,
    )
    if (wrongLength) {
        return NextResponse.json(
            {
                error: `Every buyer question must contain 15-400 characters. This one has ${wrongLength.prompt.length}: ${quote(wrongLength.prompt)}`,
                prompt: wrongLength.prompt,
            },
            { status: 400 },
        )
    }
    const dated = prompts.find((prompt) => containsCalendarYear(prompt.prompt))
    if (dated) {
        return NextResponse.json(
            {
                error: `Tracked questions cannot contain a calendar year, because the same set is measured every month. Edit this one: ${quote(dated.prompt)}`,
                reason: "dated_prompt",
                prompt: dated.prompt,
            },
            { status: 400 },
        )
    }
    const namesBrand = prompts.find((prompt) =>
        mentionsIncumbent(prompt.prompt, subjectNeedles),
    )
    if (namesBrand) {
        return NextResponse.json(
            {
                error: `Buyer questions cannot name your own brand — the measurement needs an unprompted recommendation. Edit this one: ${quote(namesBrand.prompt)}`,
                reason: "subject_named_in_prompt",
                prompt: namesBrand.prompt,
            },
            { status: 400 },
        )
    }

    const seenNorms = new Map<string, string>()
    for (const prompt of prompts) {
        const first = seenNorms.get(prompt.prompt_norm)
        if (first) {
            return NextResponse.json(
                {
                    error: `Two questions are the same: ${quote(first)}. Edit or remove one before continuing.`,
                    reason: "duplicate_prompt",
                    prompt: first,
                },
                { status: 400 },
            )
        }
        seenNorms.set(prompt.prompt_norm, prompt.prompt)
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
