/**
 * One source of truth for what is sold.
 *
 * SCOPE IS DYNAMIC. A program contains however many qualified clusters the
 * audit measured — a hyper-focused tool may have 3 problem pillars and a broad
 * platform 12. The old fixed six turned the narrow one away at checkout, and
 * required cluster counts to divide 6 exactly so the subscription ended on a
 * whole period.
 *
 * That invariant is retired, and nothing breaks, because the three velocity
 * tiers already price per cluster correctly:
 *
 *   Close       $249 / 1 per period = $249.00 per cluster
 *   Accelerate  $449 / 2 per period = $224.50 per cluster
 *   Dominate    $599 / 3 per period = $199.67 per cluster
 *
 * Per-cluster price falls with speed as an ordinary volume discount, so ANY
 * cluster count is priced coherently by varying the number of billing periods
 * instead of the price. See `programPricing()`. No new Dodo product is needed.
 *
 * Dodo has no "number of billing cycles" field on subscription creation, so a
 * program still ends by calling `cancel_at_next_billing_date` after its final
 * cluster — see lib/harvest/billing-lifecycle.ts. `programPricing` always
 * returns a whole number of periods, which is what keeps that clean rather than
 * a partial-refund problem.
 */
export const PRODUCT_TRUTH = {
    /** Legacy display default only. Never a gate — see programPricing(). */
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
        "Cancellation is requested for the end of the paid billing period once every cluster in the program is delivered.",
    checkoutFlag: "CLOSED_POOL_CHECKOUT_ENABLED",
} as const

export type ProductTier = keyof typeof PRODUCT_TRUTH.tiers

/**
 * Prices a program of any cluster count against a velocity tier.
 *
 * The tier fixes the price per billing period and how many clusters land in
 * one. The audit fixes how many clusters there are. Everything else follows:
 *
 *   4 clusters on Close      -> 4 periods -> $996
 *   9 clusters on Dominate   -> 3 periods -> $1,797
 *
 * `billingPeriods` is always a whole number, so the subscription still ends on
 * a period boundary and `cancel_at_next_billing_date` stays clean. A final
 * period may be partial in clusters — never in price, which is why the
 * per-cluster node floor is what protects the value.
 */
export function programPricing(clusterCount: number, tier: ProductTier) {
    const { price, clustersPerMonth } = PRODUCT_TRUTH.tiers[tier]
    const clusters = Math.max(0, Math.floor(clusterCount))
    const billingPeriods = Math.ceil(clusters / clustersPerMonth)
    const total = billingPeriods * price
    return {
        clusters,
        clustersPerMonth,
        pricePerPeriod: price,
        billingPeriods,
        total,
        perCluster: clusters > 0 ? total / clusters : 0,
        /** See availableTiers — a tier is only shown when it is honest value. */
        available: availableTiers(clusters).includes(tier),
    }
}

/** Slowest to fastest. Order is load-bearing for the monotonic check below. */
const TIER_ORDER: ProductTier[] = ["close", "accelerate", "dominate"]

/**
 * Tiers a given scope can honestly be sold at.
 *
 * Billing periods are whole, so a scope that does not divide evenly by a tier's
 * cadence leaves a half-empty final period the customer still pays in full. At
 * 3 clusters that makes Accelerate $299.33/cluster against Close's $249 — the
 * FASTEST tier becoming the WORST value, which is exactly the inversion that
 * made the old 4-clusters-per-month Dominate indefensible.
 *
 * So a faster tier is offered only when it beats every slower offered tier on
 * price per cluster. Walking slowest to fastest and keeping a running best
 * makes "paying more to go faster" unrepresentable, at any cluster count, with
 * no tuned constant — the arithmetic of the scope decides. Close (1 per period)
 * always qualifies and is always exactly its period price per cluster.
 */
export function availableTiers(clusterCount: number): ProductTier[] {
    const clusters = Math.max(0, Math.floor(clusterCount))
    if (clusters === 0) return []

    const offered: ProductTier[] = []
    let bestPerCluster = Infinity

    for (const tier of TIER_ORDER) {
        const { price, clustersPerMonth } = PRODUCT_TRUTH.tiers[tier]
        // A cadence the scope cannot fill is not a real option.
        if (clusters < clustersPerMonth) continue
        const perCluster = (Math.ceil(clusters / clustersPerMonth) * price) / clusters
        if (perCluster <= bestPerCluster) {
            offered.push(tier)
            bestPerCluster = perCluster
        }
    }
    return offered
}
