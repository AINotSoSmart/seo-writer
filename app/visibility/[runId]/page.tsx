/**
 * The AI-visibility report page.
 *
 * Loads the frozen run and hands it to the dashboard. Per-surface presence is
 * computed here rather than stored, because it is a cheap aggregate over rows
 * that already exist — and computing it per surface, never across surfaces, is
 * the one aggregation rule that must not drift (a consumer-app answer and an
 * API answer are measurements of different things).
 */

import { notFound } from "next/navigation"
import type { Metadata } from "next"

import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"
import { ENGINE_SPECS, type AiEngine } from "@/lib/visibility/engines"
import {
    VisibilityDashboard,
    type DashboardEngine,
    type DashboardPrompt,
} from "@/components/visibility/visibility-dashboard"

export const metadata: Metadata = {
    // Shareable by link, never indexed — same posture as the audit report.
    robots: { index: false, follow: false },
}

interface PageProps {
    params: Promise<{ runId: string }>
}

export default async function VisibilityReportPage({ params }: PageProps) {
    const { runId } = await params
    const supabase = createAdminClient() as any
    const userClient = await createClient()
    const {
        data: { user },
    } = await userClient.auth.getUser()

    const { data: run } = await supabase
        .from("ai_probe_runs")
        .select(
            "id, subject_name, subject_domains, status, failure_reason, phase, phase_detail, engines, prompt_count, answer_count, credits_used, engine_ledger, summary, clusters, started_at, audit_id, user_id, public_token",
        )
        .eq("id", runId)
        .single()
    if (!run) notFound()

    if (run.status !== "completed") {
        const running = run.status === "running"
        return (
            <main className="mx-auto max-w-2xl px-6 py-20">
                <h1 className="text-2xl font-semibold">
                    {running ? "Asking the answer engines…" : "This probe failed"}
                </h1>
                <p className="mt-3 text-muted-foreground">
                    {running
                        ? "Each question is sent to the real ChatGPT and Google AI Mode, which take a little while to answer. This page will show the results once every question has one."
                        : run.failure_reason ||
                          "The run did not complete, so there is nothing to report."}
                </p>
                {running && run.phase && (
                    <p className="mt-4 text-sm text-muted-foreground">
                        Current step: {run.phase.replace(/_/g, " ")}
                        {run.phase_detail ? ` — ${run.phase_detail}` : ""}
                    </p>
                )}
            </main>
        )
    }

    const { data: promptRows } = await supabase
        .from("ai_probe_prompts")
        .select(
            "id, prompt, intent, verdict, answers_total, answers_present, mean_mention_position",
        )
        .eq("run_id", runId)

    // Per-surface presence. Only `mention_count` and `engine` are read, so this
    // stays cheap even on a 60-prompt run — the answer text is never loaded
    // here, only when a reader opens a specific question.
    const { data: resultRows } = await supabase
        .from("ai_probe_results")
        .select("engine, surface, mention_count")
        .eq("run_id", runId)

    const perEngineMap = new Map<
        string,
        { engine: string; label: string; surface: string; total: number; present: number }
    >()
    for (const row of resultRows || []) {
        const spec = ENGINE_SPECS[row.engine as AiEngine]
        const existing = perEngineMap.get(row.engine)
        if (existing) {
            existing.total++
            if (row.mention_count > 0) existing.present++
        } else {
            perEngineMap.set(row.engine, {
                engine: row.engine,
                label: spec?.label ?? row.engine,
                surface: row.surface ?? spec?.surface ?? "consumer_app",
                total: 1,
                present: row.mention_count > 0 ? 1 : 0,
            })
        }
    }

    const ledger: DashboardEngine[] = (run.engine_ledger || []).map((entry: any) => ({
        engine: entry.engine,
        label: entry.label ?? ENGINE_SPECS[entry.engine as AiEngine]?.label ?? entry.engine,
        surface:
            entry.surface ?? ENGINE_SPECS[entry.engine as AiEngine]?.surface ?? "consumer_app",
        attempted: entry.attempted ?? 0,
        succeeded: entry.succeeded ?? 0,
        failed: entry.failed ?? 0,
        creditsUsed: entry.creditsUsed ?? 0,
        errors: entry.errors ?? [],
    }))

    return (
        <VisibilityDashboard
            runId={runId}
            subjectName={run.subject_name}
            subjectDomains={run.subject_domains || []}
            startedAt={run.started_at}
            creditsUsed={run.credits_used ?? 0}
            summary={run.summary || {}}
            prompts={(promptRows || []) as DashboardPrompt[]}
            engines={ledger}
            clusters={run.clusters || []}
            perEngine={[...perEngineMap.values()]}
            auditId={run.audit_id}
            publicToken={run.public_token}
            isAuthenticated={Boolean(user)}
        />
    )
}
