/**
 * One source of truth for what is sold.
 *
 * CLUSTER COUNTS MUST DIVIDE `programClusters` EXACTLY.
 * Dominate previously shipped 4 clusters/month, which does not divide 6 — it
 * left a half-empty final billing period that charged a full month for two
 * clusters, making the "fastest" tier the most expensive overall. 1, 2 and 3
 * all divide 6 into whole periods (6, 3, 2), so every tier is a plain
 * fixed-price subscription that ends on a period boundary.
 *
 * Dodo has no "number of billing cycles" field on subscription creation, so the
 * program ends by calling `cancel_at_next_billing_date` after cluster six —
 * see lib/harvest/billing-lifecycle.ts. Landing on a whole period is what makes
 * that clean rather than a partial refund problem.
 */
export const PRODUCT_TRUTH = {
    programClusters: 6,
    minClusterArticles: 8,
    maxClusterArticles: 15,
    minProgramArticles: 25,
    tiers: {
        close: {
            label: "Close",
            price: 249,
            currency: "USD",
            clustersPerMonth: 1,
            billingPeriods: 6,
            cadence: "One complete cluster every 30 days",
        },
        accelerate: {
            label: "Accelerate",
            price: 449,
            currency: "USD",
            clustersPerMonth: 2,
            billingPeriods: 3,
            cadence: "Two complete clusters, 15 days apart",
        },
        dominate: {
            label: "Dominate",
            price: 599,
            currency: "USD",
            clustersPerMonth: 3,
            billingPeriods: 2,
            cadence: "Three complete clusters, 10 days apart",
        },
    },
    approvedCompletion: "Program scope delivered",
    automaticCancellation:
        "Cancellation is requested for the end of the paid billing period after all six clusters are delivered.",
    checkoutFlag: "CLOSED_POOL_CHECKOUT_ENABLED",
} as const

export type ProductTier = keyof typeof PRODUCT_TRUTH.tiers
