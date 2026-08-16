export const COVERAGE_DECISIONS = ["unknown", "no_page", "has_page"] as const

export type CoverageDecision = (typeof COVERAGE_DECISIONS)[number]

export interface TargetPageDecision {
    trackedPromptId: string
    opportunityId: string
    coverageState: CoverageDecision
    targetUrl: string | null
    opportunityState: "open" | "needs_input" | "monitoring" | "resolved" | "dismissed"
    resolutionType: "create" | "refresh" | "report_only" | "unknown"
    priority: number | null
    reason: string | null
    deliveredCreateExists?: boolean
}

export function isCoverageDecision(value: unknown): value is CoverageDecision {
    return COVERAGE_DECISIONS.includes(value as CoverageDecision)
}

/** Mechanical client/API validation; ownership is enforced atomically in SQL. */
export function normalizeHttpsTargetUrl(value: unknown): string | null {
    if (typeof value !== "string" || !value.trim()) return null
    try {
        const url = new URL(value.trim())
        if (url.protocol !== "https:" || !url.hostname) return null
        url.hash = ""
        return url.toString()
    } catch {
        return null
    }
}
