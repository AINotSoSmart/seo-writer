import { task } from "@trigger.dev/sdk/v3"

import { assembleHarvest } from "@/lib/harvest/assembly"
import { persistHarvestOutput } from "@/lib/harvest/run-harvest"
import type { AuditScopeFamily } from "@/lib/harvest/scope-classifier"
import { createAdminClient } from "@/utils/supabase/admin"

interface ProspectAuditPayload {
    auditId: string
    founderUserId: string
    subjectUrl: string
    competitors: string[]
}

export const runProspectAuditTask = task({
    id: "run-prospect-audit",
    maxDuration: 900,
    retry: {
        maxAttempts: 2,
        minTimeoutInMs: 10_000,
        maxTimeoutInMs: 30_000,
    },
    onFailure: async ({
        payload,
        error,
    }: {
        payload: ProspectAuditPayload
        error: unknown
    }) => {
        const supabase = createAdminClient() as any
        const message =
            error instanceof Error ? error.message : "Prospect audit failed"
        const { data: failedRun } = await supabase
            .from("topical_audits")
            .update({
                run_status: "failed",
                generation_status: "failed",
                generation_phase: null,
                generation_error: message.slice(0, 1000),
                failure_code: "prospect_audit_failed",
                failed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("id", payload.auditId)
            .eq("run_status", "running")
            .select("id")
            .maybeSingle()
        if (failedRun) {
            await supabase
                .from("audit_claims")
                .update({ revoked_at: new Date().toISOString() })
                .eq("audit_id", payload.auditId)
        }
    },
    run: async (payload: ProspectAuditPayload) => {
        const supabase = createAdminClient() as any
        const update = async (values: Record<string, unknown>) => {
            await supabase
                .from("topical_audits")
                .update({ ...values, updated_at: new Date().toISOString() })
                .eq("id", payload.auditId)
                .eq("created_by_user_id", payload.founderUserId)
        }

        try {
            const { data: scopeRows, error: scopeError } = await supabase
                .from("audit_scope_families")
                .select("id, name, description, seed_keywords, priority")
                .eq("audit_id", payload.auditId)
                .eq("user_id", payload.founderUserId)
                .order("priority", { ascending: true })
            if (scopeError || !scopeRows?.length) {
                throw new Error(
                    "Prospect audit has no confirmed business scope snapshot.",
                )
            }
            const scopeFamilies: AuditScopeFamily[] = scopeRows.map(
                (row: any) => ({
                    id: row.id,
                    name: row.name,
                    description: row.description,
                    seedKeywords: Array.isArray(row.seed_keywords)
                        ? row.seed_keywords
                        : [],
                    priority: Number(row.priority || 0),
                }),
            )
            await update({ generation_phase: "harvesting" })
            const output = await assembleHarvest(
                {
                    subjectUrl: payload.subjectUrl,
                    subjectName: new URL(payload.subjectUrl).hostname,
                    scopeFamilies,
                    competitors: payload.competitors,
                },
                {
                    onProgress: async (progress) => {
                        await update({
                            generation_phase: progress.phase,
                            source_call_ledger: progress.sourceCallLedger,
                        })
                    },
                },
            )
            await update({ generation_phase: "persisting" })
            await persistHarvestOutput(payload.auditId, output)
            return {
                auditId: payload.auditId,
                policyVersion: output.policyVersion,
                resultHash: output.resultHash,
                sourceCalls: output.sourceCallLedger,
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Prospect audit failed"
            await update({
                generation_error: message,
                failure_code:
                    typeof error === "object" && error && "code" in error
                        ? String(error.code)
                        : "prospect_audit_failed",
                generation_phase: "retrying",
            })
            throw error
        }
    },
})
