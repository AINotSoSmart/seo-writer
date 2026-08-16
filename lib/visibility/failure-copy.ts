/**
 * What a customer is told when a probe fails, and where the real reason goes.
 *
 * ## The rule
 *
 * `ai_probe_runs.failure_reason` is rendered verbatim on the waiting screen, so
 * it is **customer copy** and nothing else. Operator detail — exception text,
 * Postgres messages, environment variable names, vendor error bodies — belongs
 * in `phase_detail` and the server log, which no customer reads.
 *
 * This existed the wrong way round on the first live run: a founder testing the
 * flow was shown `CLORO_API_KEY is not configured, so the consumer surfaces
 * cannot be measured.` That sentence names an internal secret, tells the reader
 * nothing they can act on, and would have been the first thing a paying
 * customer saw. Every failure path funnels through here now, so the next
 * unexpected error cannot leak the same way.
 *
 * ## Why the code travels in `phase_detail`
 *
 * `ai_probe_runs` has no `failure_code` column, and adding one is a migration
 * this did not need: the code is written and read in this one module, so the
 * encoding cannot drift between writer and reader. If a column is added later,
 * these two functions are the only thing to change.
 */

export type ProbeFailureCode =
    | "no_engines"
    | "no_scope"
    | "no_prompts"
    | "all_engines_failed"
    | "no_answers"
    | "queue_failed"
    | "worker_never_ran"
    | "brand_unreadable"
    | "opportunity_reconciliation_failed"
    | "unknown"

interface ProbeFailureCopy {
    /** Shown to the customer. Never names a variable, vendor, or table. */
    message: string
    /**
     * Whether trying again could plausibly succeed. A configuration failure is
     * not retryable, and offering a button that will fail identically one
     * second later is worse than offering nothing.
     */
    retryable: boolean
}

export const PROBE_FAILURE_COPY: Record<ProbeFailureCode, ProbeFailureCopy> = {
    no_engines: {
        message:
            "The AI answer engines aren't connected on this account yet, so none of your questions could be asked. Nothing was charged. Our team has been alerted — this is on us, not something you can fix from here.",
        retryable: false,
    },
    no_scope: {
        message:
            "This audit has no confirmed topics, so there was nothing to build questions from. Go back to the topics screen and confirm at least one.",
        retryable: false,
    },
    no_prompts: {
        message:
            "We couldn't turn your confirmed topics into buyer questions. Try adding a little more detail to what each topic helps with, then run it again.",
        retryable: true,
    },
    all_engines_failed: {
        message:
            "Every request to the answer engines failed, so we stopped rather than report you as missing from answers nobody actually collected. Nothing was charged. This is a problem on our side.",
        retryable: true,
    },
    no_answers: {
        message:
            "The answer engines accepted the questions but returned nothing usable, so there is nothing honest to report. Nothing was charged.",
        retryable: true,
    },
    queue_failed: {
        message:
            "We couldn't start the background job that asks the questions. Nothing was charged.",
        retryable: true,
    },
    worker_never_ran: {
        message:
            "This run was queued but never started, so no questions were asked and nothing was charged.",
        retryable: true,
    },
    brand_unreadable: {
        message:
            "We couldn't read your saved brand details, so the run was stopped before anything was asked.",
        retryable: true,
    },
    opportunity_reconciliation_failed: {
        message:
            "The answers were collected and saved, but the recurring action backlog could not be updated. No content action was selected. Our team has been alerted.",
        // Re-running the probe would buy the same answers twice. The saved run
        // can be reconciled by an operator after the storage issue is fixed.
        retryable: false,
    },
    unknown: {
        message:
            "The probe stopped before it finished. Nothing was charged and your confirmed questions are saved.",
        retryable: true,
    },
}

export function probeFailureCopy(
    code: string | null | undefined,
): ProbeFailureCopy {
    const key = (code ?? "") as ProbeFailureCode
    return PROBE_FAILURE_COPY[key] ?? PROBE_FAILURE_COPY.unknown
}

/** Operator detail, tagged with its code. Written to `phase_detail` only. */
export function encodeProbeFailureDetail(
    code: ProbeFailureCode,
    detail: string,
): string {
    return `${code}: ${detail}`.slice(0, 1000)
}

/** Recovers the code a failure was tagged with. Null when it is untagged. */
export function decodeProbeFailureCode(
    phaseDetail: string | null | undefined,
): ProbeFailureCode | null {
    if (!phaseDetail) return null
    const code = phaseDetail.split(":", 1)[0]?.trim()
    return code && code in PROBE_FAILURE_COPY ? (code as ProbeFailureCode) : null
}
