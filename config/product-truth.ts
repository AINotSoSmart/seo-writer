export const PRODUCT_TRUTH = {
    programClusters: 6,
    minClusterArticles: 3,
    maxClusterArticles: 15,
    minProgramArticles: 25,
    tiers: {
        close: {
            label: "Close",
            price: 249,
            currency: "USD",
            clustersPerMonth: 1,
            cadence: "One complete cluster every 30 days",
        },
        accelerate: {
            label: "Accelerate",
            price: 449,
            currency: "USD",
            clustersPerMonth: 2,
            cadence: "Two complete clusters, 15 days apart",
        },
        dominate: {
            label: "Dominate",
            price: 799,
            currency: "USD",
            clustersPerMonth: 4,
            cadence: "Four complete clusters, 7–8 days apart",
        },
    },
    approvedCompletion: "Program scope delivered",
    automaticCancellation:
        "Cancellation is requested for the end of the paid billing period after all six clusters are delivered.",
    checkoutFlag: "CLOSED_POOL_CHECKOUT_ENABLED",
} as const

export type ProductTier = keyof typeof PRODUCT_TRUTH.tiers
