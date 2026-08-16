/**
 * The AI-visibility report, inside the dashboard.
 *
 * `app/visibility/[runId]` is the shareable link — public, unindexed, addressed
 * by run id, the same posture as `app/audit/[token]`. This is the other half of
 * that pair and the one that was missing: a customer met the report once at the
 * end of onboarding and then had no way back, because nothing in the product
 * pointed at it. It resolves the newest completed run for their brand, so the
 * sidebar entry always lands somewhere real.
 *
 * Header language is deliberately identical to `/audit` — eyebrow, serif title,
 * one-line explanation — because a report that arrives styled like a different
 * product reads as a bolt-on rather than part of what they bought.
 */

import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"

import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"
import { ENGINE_SPECS, type AiEngine } from "@/lib/visibility/engines"
import {
    VisibilityDashboard,
    type DashboardEngine,
    type DashboardPrompt,
} from "@/components/visibility/visibility-dashboard"

export default async function VisibilityPage() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const admin = createAdminClient() as any

    const { data: run } = await admin
        .from("ai_probe_runs")
        .select(
            "id, subject_name, subject_domains, status, engines, prompt_count, answer_count, credits_used, engine_ledger, summary, clusters, started_at, audit_id, public_token",
        )
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle()

    if (!run) return <NoRun />

    const [{ data: promptRows }, { data: resultRows }] = await Promise.all([
        admin
            .from("ai_probe_prompts")
            .select(
                "id, prompt, intent, verdict, answers_total, answers_present, mean_mention_position",
            )
            .eq("run_id", run.id),
        // Only `engine`, `surface` and `mention_count` — the answer text is
        // never loaded here, only when a reader opens a specific question.
        admin
            .from("ai_probe_results")
            .select("engine, surface, mention_count")
            .eq("run_id", run.id),
    ])

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
        <main className="mx-auto w-full max-w-6xl py-6">
            <header className="mb-8 flex flex-col gap-5 border-b border-stone-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-600">
                        <Sparkles className="h-4 w-4" />
                        AI visibility
                    </div>
                    <h1 className="mt-2 font-serif text-3xl text-stone-900">
                        What AI assistants say when buyers ask
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">
                        Your confirmed buyer questions, put to the real ChatGPT and Google
                        AI Mode. Every number below expands to the answer it came from —
                        nothing here is a score you have to take on trust.
                    </p>
                </div>
                <Link
                    href="/content-plan"
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white"
                >
                    Review the delivery plan
                    <ArrowRight className="h-4 w-4" />
                </Link>
            </header>

            <VisibilityDashboard
                runId={run.id}
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
                isAuthenticated
                embedded
            />
        </main>
    )
}

function NoRun() {
    return (
        <main className="mx-auto max-w-3xl py-16 text-center">
            <h1 className="font-serif text-3xl text-stone-900">
                No visibility run yet
            </h1>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-stone-600">
                Once your buyer questions have been put to ChatGPT and Google AI Mode,
                the answers and everything measured from them appear here.
            </p>
            <Link
                href="/onboarding"
                className="mt-5 inline-flex rounded-lg bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white"
            >
                Finish setting up
            </Link>
        </main>
    )
}
