/** The launch contract. Pricing phases remain a hypothesis until checkout Phase 8. */
export const PRODUCT_TRUTH = {
    planId: "founding_beta",
    label: "Founding beta",
    currency: "USD",
    introductoryPrice: 99,
    introductoryPeriods: 3,
    continuingPrice: 189,
    trackedPromptAllowance: 40,
    actionAllowance: 8,
    sites: 1,
    engines: ["ChatGPT", "Google AI Mode"] as const,
    delivery:
        "Up to eight prioritised create or refresh actions in one complete draft batch per billing cycle.",
    cancellation:
        "Cancel anytime. Cancellation prevents future billing cycles and never erases completed reports or delivered drafts.",
} as const

export type ProductPlanId = typeof PRODUCT_TRUTH.planId
