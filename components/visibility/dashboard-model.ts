export type DashboardActionKind = "create" | "refresh" | "report_only"

export interface DashboardQuestionAction {
    id: string
    kind: DashboardActionKind
    title: string
    targetUrl?: string | null
    status: "suggested" | "confirmed" | "rejected"
}

export interface DashboardPrompt {
    id: string
    prompt: string
    intent: string
    scopeFamilyName: string
    verdict: "absent" | "outranked" | "present"
    answers_total: number
    answers_present: number
    mean_mention_position: number | null
    citationCount: number
    citedHosts?: string[]
    rivalIds?: string[]
    action?: DashboardQuestionAction
}

export interface DashboardActionItem extends DashboardQuestionAction {
    questionCount: number
    productionState?: string | null
}

/**
 * Persisted action state for the measurement run.
 *
 * This is intentionally separate from the visibility verdicts. A losing
 * question is evidence; only the site-aware proposal and cycle records can say
 * that a create or refresh action is selected for production.
 */
export interface DashboardActionSummary {
    phase: "none" | "review" | "producing" | "ready" | "delivered" | "failed"
    allowance: number
    eligibleCount: number
    selectedCount: number
    backlogCount: number
    reportOnlyCount: number
    items: DashboardActionItem[]
}
