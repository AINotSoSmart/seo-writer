import { NextRequest, NextResponse } from "next/server"

import {
    isCoverageDecision,
    normalizeHttpsTargetUrl,
    type CoverageDecision,
} from "@/lib/visibility/target-page"
import { createClient } from "@/utils/supabase/server"

interface TargetPageBody {
    trackedPromptId?: string
    coverageState?: CoverageDecision
    targetUrl?: string | null
}

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function customerError(message: string): string {
    if (message.includes("measured website")) {
        return "Use a page on the website measured in this report."
    }
    if (message.includes("currently losing")) {
        return "This question is no longer waiting for a target-page decision."
    }
    if (message.includes("before choosing")) {
        return "Measure this question before choosing its target page."
    }
    if (message.includes("not found")) return "This tracked question was not found."
    return "We couldn't save this target-page decision. Nothing was selected for production."
}

export async function POST(request: NextRequest) {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    let body: TargetPageBody
    try {
        body = (await request.json()) as TargetPageBody
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    if (!body.trackedPromptId || !UUID_PATTERN.test(body.trackedPromptId)) {
        return NextResponse.json(
            { error: "A valid tracked question is required.", reason: "invalid_tracked_prompt" },
            { status: 400 },
        )
    }
    if (!isCoverageDecision(body.coverageState)) {
        return NextResponse.json(
            { error: "Choose existing page, no suitable page, or not sure.", reason: "invalid_coverage_state" },
            { status: 400 },
        )
    }

    const targetUrl = normalizeHttpsTargetUrl(body.targetUrl)
    if (body.coverageState === "has_page" && !targetUrl) {
        return NextResponse.json(
            { error: "Enter the full HTTPS URL of the existing page.", reason: "target_url_required" },
            { status: 400 },
        )
    }
    if (body.coverageState !== "has_page" && body.targetUrl) {
        return NextResponse.json(
            { error: "Only an existing-page decision can include a URL.", reason: "unexpected_target_url" },
            { status: 400 },
        )
    }

    const { data, error } = await supabase.rpc("triage_content_opportunity_target", {
        p_tracked_prompt_id: body.trackedPromptId,
        p_coverage_state: body.coverageState,
        p_target_url: targetUrl,
    })

    if (error) {
        console.error("[target-page-triage] Could not save decision:", error.message)
        return NextResponse.json(
            { error: customerError(error.message), reason: "target_page_triage_failed" },
            { status: 409 },
        )
    }

    const result = data as {
        tracked_prompt_id: string
        opportunity_id: string
        coverage_state: CoverageDecision
        target_url: string | null
        state: "open" | "needs_input" | "monitoring"
        resolution_type: "create" | "refresh" | "unknown"
        delivered_create_exists: boolean
    }

    return NextResponse.json({
        decision: {
            trackedPromptId: result.tracked_prompt_id,
            opportunityId: result.opportunity_id,
            coverageState: result.coverage_state,
            targetUrl: result.target_url,
            opportunityState: result.state,
            resolutionType: result.resolution_type,
            deliveredCreateExists: result.delivered_create_exists,
        },
    })
}
