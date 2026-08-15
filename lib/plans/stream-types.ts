// Types for Live Strategy Console SSE events
export type PlanStreamEventType =
    | 'phase_start'
    | 'phase_complete'
    | 'serp_analyzing_seed'
    | 'serp_seed_complete'
    | 'serp_competitor_found'
    | 'gap_analysis_start'
    | 'gap_blue_ocean'
    | 'gap_saturated'
    | 'gap_weakness'
    | 'gap_opportunity'
    | 'hierarchy_building'
    | 'hierarchy_level_complete'
    | 'plan_generating'
    | 'plan_article_added'
    | 'complete'
    | 'error'

export interface PlanStreamEvent {
    type: PlanStreamEventType
    timestamp: number
    data?: any
}

// Phase names for display
export type PlanPhase = 'serp' | 'gap' | 'hierarchy' | 'plan'

export const PHASE_LABELS: Record<PlanPhase, string> = {
    serp: 'SERP Intelligence',
    gap: 'Gap Analysis',
    hierarchy: 'Topic Hierarchy',
    plan: 'Plan Generation'
}

// Event emitter callback type
export type StreamEventCallback = (event: PlanStreamEvent) => void

// Helper to create events
export function createStreamEvent(
    type: PlanStreamEventType,
    data?: any
): PlanStreamEvent {
    return {
        type,
        timestamp: Date.now(),
        data
    }
}
