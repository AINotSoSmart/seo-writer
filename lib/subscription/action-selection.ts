import "server-only"

export const ACTION_SELECTION_POLICY = Object.freeze({
    version: "cycle-action-selection-v1",
    graphVersion: "cycle-selected-graph-v1",
    maxActions: 8,
})

export interface CycleSelectionResult {
    cycleId: string
    selected: number
    eligibleGroups: number
    backlogGroups: number
    replayed: boolean
    state: "producing" | "ready" | "delivered" | "failed"
}

export class CycleSelectionError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "CycleSelectionError"
    }
}

/**
 * Validates the one publication-path input selection needs before it can freeze
 * create URLs. PostgreSQL repeats this authoritatively inside the transaction.
 */
export function validateCyclePublicationPattern(
    pattern: string,
    subjectUrl: string,
): string {
    if (typeof pattern !== "string" || pattern.split("{slug}").length !== 2) {
        throw new CycleSelectionError(
            "The publication URL pattern must contain {slug} exactly once.",
        )
    }
    let target: URL
    let subject: URL
    try {
        target = new URL(pattern.replace("{slug}", "selected-action-preview"))
        subject = new URL(subjectUrl)
    } catch {
        throw new CycleSelectionError("The publication URL pattern is not a valid URL.")
    }
    if (
        target.protocol !== "https:" ||
        target.search ||
        target.hash ||
        target.username ||
        target.password ||
        !target.pathname.includes("selected-action-preview")
    ) {
        throw new CycleSelectionError(
            "The publication URL pattern must be a clean HTTPS path.",
        )
    }
    const normalizeHost = (url: URL) => url.hostname.toLowerCase().replace(/^www\./, "")
    if (normalizeHost(target) !== normalizeHost(subject)) {
        throw new CycleSelectionError(
            "The publication URL pattern must use the measured website host.",
        )
    }
    return pattern.trim()
}

/** Service-role wrapper used by the future cycle orchestrator and founder control. */
export async function selectSubscriptionCycleActions(
    supabase: {
        rpc: (
            name: string,
            args: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: { message?: string } | null }>
    },
    cycleId: string,
    publicationUrlPattern: string,
    subjectUrl: string,
): Promise<CycleSelectionResult> {
    const pattern = validateCyclePublicationPattern(publicationUrlPattern, subjectUrl)
    const { data, error } = await supabase.rpc("select_subscription_cycle_actions", {
        p_cycle_id: cycleId,
        p_publication_url_pattern: pattern,
    })
    if (error) {
        throw new CycleSelectionError(
            `Could not select the cycle action batch: ${error.message ?? "unknown database error"}`,
        )
    }

    const row = data as {
        cycle_id?: string
        selected?: number
        eligible_groups?: number
        backlog_groups?: number
        replayed?: boolean
        state?: "producing" | "ready" | "delivered" | "failed"
    } | null
    const validStates = ["producing", "ready", "delivered", "failed"] as const
    if (
        !row ||
        row.cycle_id !== cycleId ||
        typeof row.selected !== "number" ||
        row.selected < 0 ||
        row.selected > ACTION_SELECTION_POLICY.maxActions ||
        !row.state ||
        !validStates.includes(row.state)
    ) {
        throw new CycleSelectionError("The cycle selector returned an invalid batch summary.")
    }

    return {
        cycleId: row.cycle_id,
        selected: row.selected,
        eligibleGroups: Number(row.eligible_groups ?? row.selected),
        backlogGroups: Number(row.backlog_groups ?? 0),
        replayed: Boolean(row.replayed),
        state: row.state,
    }
}
