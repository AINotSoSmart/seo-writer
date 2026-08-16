/* eslint-disable @typescript-eslint/no-explicit-any -- plan_code is introduced by the forward Phase 8 migration before generated database types refresh. */
import { NextRequest, NextResponse } from "next/server"

import { PRODUCT_TRUTH } from "@/config/product-truth"
import { getDodoClient } from "@/lib/dodopayments-server"
import {
    PublicationPatternError,
    validatePublicationPattern,
} from "@/lib/subscription/publication-pattern"
import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"

export const runtime = "nodejs"

class FoundingCheckoutConfigurationError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "FoundingCheckoutConfigurationError"
    }
}

type DodoProductContract = {
    is_recurring: boolean
    price: {
        type: string
        currency?: string
        discount?: number
        price?: number
        payment_frequency_count?: number
        payment_frequency_interval?: string
        subscription_period_count?: number
        subscription_period_interval?: string
        trial_period_days?: number
    }
}

type DodoDiscountContract = {
    type: string
    restricted_to: string[]
    subscription_cycles?: number | null
    currency_options?: Array<{
        currency: string
        max_amount_possible?: number | null
    }>
}

function configuredValue(name: string): string {
    return String(process.env[name] || "").trim()
}

function subscriptionTermMonths(price: DodoProductContract["price"]): number {
    if (!price.subscription_period_count) return 0
    if (price.subscription_period_interval === "Month") {
        return price.subscription_period_count
    }
    if (price.subscription_period_interval === "Year") {
        return price.subscription_period_count * 12
    }
    return 0
}

function assertFoundingProviderContract(
    product: DodoProductContract,
    discount: DodoDiscountContract,
    productId: string,
) {
    const price = product.price
    const expectedPrice = PRODUCT_TRUTH.continuingPrice * 100
    // Dodo uses PascalCase intervals. `payment_frequency_*` is the actual
    // charge cadence; `subscription_period_*` is the maximum total term, not
    // another expression of monthly billing. The term only needs to extend
    // beyond the three introductory cycles so the $189 continuing phase can
    // actually occur.
    const termMonths = subscriptionTermMonths(price)
    if (
        !product.is_recurring ||
        price.type !== "recurring_price" ||
        price.currency !== PRODUCT_TRUTH.currency ||
        price.price !== expectedPrice ||
        price.discount !== 0 ||
        price.payment_frequency_count !== 1 ||
        price.payment_frequency_interval !== "Month" ||
        termMonths <= PRODUCT_TRUTH.introductoryPeriods ||
        (price.trial_period_days ?? 0) !== 0
    ) {
        throw new FoundingCheckoutConfigurationError(
            "The Dodo founding product must be a no-trial $189 USD monthly subscription.",
        )
    }

    const usdOption = discount.currency_options?.find(
        (option) => option.currency === PRODUCT_TRUTH.currency,
    )
    const expectedDiscount =
        (PRODUCT_TRUTH.continuingPrice - PRODUCT_TRUTH.introductoryPrice) * 100
    if (
        discount.type !== "flat" ||
        discount.subscription_cycles !== PRODUCT_TRUTH.introductoryPeriods ||
        !discount.restricted_to.includes(productId) ||
        usdOption?.max_amount_possible !== expectedDiscount
    ) {
        throw new FoundingCheckoutConfigurationError(
            "The Dodo founding discount must deduct $90 USD for three cycles and be restricted to the founding product.",
        )
    }
}

/**
 * Creates only the one founding-plan cart. Product, discount, customer, brand,
 * price phase and tracked-question allowance are server-owned.
 */
export async function POST(req: NextRequest) {
    if (process.env.FOUNDING_CHECKOUT_ENABLED !== "true") {
        return NextResponse.json(
            {
                error: "Checkout is not open yet.",
                code: "founding_checkout_disabled",
            },
            { status: 503 },
        )
    }

    try {
        const productId = configuredValue("DODO_FOUNDING_PRODUCT_ID")
        const discountCode = configuredValue("DODO_FOUNDING_DISCOUNT_CODE")
        if (!productId || !discountCode) {
            console.error("Founding checkout is enabled without its Dodo product or discount.")
            return NextResponse.json(
                {
                    error: "Checkout configuration is incomplete.",
                    code: "founding_checkout_misconfigured",
                },
                { status: 503 },
            )
        }

        const supabase = await createClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const [{ data: subscriptions }, { data: brands }] = await Promise.all([
            supabase
                .from("dodo_subscriptions")
                .select("id")
                .eq("user_id", user.id)
                .in("status", ["active", "pending"])
                .limit(1),
            supabase
                .from("brand_details")
                .select("id, website_url")
                .eq("user_id", user.id)
                .is("deleted_at", null)
                .limit(2),
        ])

        if (subscriptions?.length) {
            return NextResponse.json(
                { error: "This account already has an active or pending subscription." },
                { status: 409 },
            )
        }
        if (brands?.length !== 1) {
            return NextResponse.json(
                { error: "Checkout requires exactly one configured website." },
                { status: 409 },
            )
        }

        const brand = brands[0]
        const { count: promptCount, error: promptError } = await supabase
            .from("tracked_prompts")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("brand_id", brand.id)
            .eq("tracking_status", "active")
            .is("retired_at", null)
        if (promptError) throw promptError
        if (promptCount !== PRODUCT_TRUTH.trackedPromptAllowance) {
            return NextResponse.json(
                {
                    error: `Confirm exactly ${PRODUCT_TRUTH.trackedPromptAllowance} buyer questions before checkout.`,
                    code: "tracked_prompt_allowance_not_met",
                },
                { status: 409 },
            )
        }

        const body = await req.json().catch(() => ({}))
        const publicationUrlPattern = validatePublicationPattern(
            typeof body.publicationUrlPattern === "string"
                ? body.publicationUrlPattern
                : "",
            brand.website_url,
        )

        const admin = createAdminClient() as any
        const { data: plan, error: planError } = await admin
            .from("dodo_pricing_plans")
            .select("id, price, currency, dodo_product_id, is_active")
            .eq("plan_code", PRODUCT_TRUTH.planId)
            .maybeSingle()
        if (planError) throw planError
        if (
            !plan ||
            !plan.is_active ||
            Number(plan.price) !== PRODUCT_TRUTH.continuingPrice ||
            String(plan.currency).toUpperCase() !== PRODUCT_TRUTH.currency
        ) {
            throw new FoundingCheckoutConfigurationError(
                "The founding pricing plan is not configured correctly.",
            )
        }
        if (plan.dodo_product_id && plan.dodo_product_id !== productId) {
            throw new FoundingCheckoutConfigurationError(
                "The configured Dodo product does not match the founding plan.",
            )
        }


        const client = getDodoClient()
        const [remoteProduct, remoteDiscount] = await Promise.all([
            client.products.retrieve(productId),
            client.discounts.retrieveByCode(discountCode),
        ])
        assertFoundingProviderContract(remoteProduct, remoteDiscount, productId)

        if (!plan.dodo_product_id) {
            const { error: mappingError } = await admin
                .from("dodo_pricing_plans")
                .update({ dodo_product_id: productId, updated_at: new Date().toISOString() })
                .eq("id", plan.id)
                .is("dodo_product_id", null)
            if (mappingError) throw mappingError
        }

        const origin = configuredValue("NEXT_PUBLIC_APP_URL") || req.nextUrl.origin
        const returnUrl = new URL("/subscribe?subscribed=1", origin).toString()
        const cancelUrl = new URL("/subscribe?checkout=cancelled", origin).toString()
        const session = await client.checkoutSessions.create({
            product_cart: [{ product_id: productId, quantity: 1 }],
            discount_codes: [discountCode],
            // Dodo rejects pre-applied `discount_codes` unless the checkout's
            // discount-code feature is enabled. Product restriction and the
            // server-side contract check still limit FOUNDINGBETA to this item.
            feature_flags: { allow_discount_code: true },
            return_url: returnUrl,
            cancel_url: cancelUrl,
            customer: user.email ? { email: user.email } : undefined,
            metadata: {
                user_id: user.id,
                brand_id: brand.id,
                plan_id: PRODUCT_TRUTH.planId,
                publication_url_pattern: publicationUrlPattern,
            },
        }, {
            // One hosted session per account per 30-minute window. This closes
            // the two-tabs/double-click race without making an abandoned
            // checkout impossible to reopen later.
            // Version the key with the request contract so Dodo cannot replay
            // the earlier invalid `allow_discount_code=false` attempt after
            // this deployment within the same 30-minute window.
            idempotencyKey: `founding-v2-${user.id}-${Math.floor(Date.now() / 1_800_000)}`,
        })
        if (!session.checkout_url) {
            throw new Error("Dodo did not return a hosted checkout URL.")
        }

        const { error: changeError } = await admin
            .from("dodo_subscription_changes")
            .insert({
                user_id: user.id,
                from_plan_id: null,
                to_plan_id: plan.id,
                checkout_session_id: session.session_id,
                status: "pending",
                change_type: "new",
                metadata: {
                    source: "founding_plan_checkout",
                    plan_id: PRODUCT_TRUTH.planId,
                    brand_id: brand.id,
                    publication_url_pattern: publicationUrlPattern,
                    introductory_periods: PRODUCT_TRUTH.introductoryPeriods,
                    introductory_price: PRODUCT_TRUTH.introductoryPrice,
                    continuing_price: PRODUCT_TRUTH.continuingPrice,
                },
            })
        if (changeError) {
            console.warn("Checkout created but local checkout audit insert failed:", changeError)
        }

        return NextResponse.json({
            checkout_url: session.checkout_url,
            session_id: session.session_id,
        })
    } catch (error) {
        console.error("Founding checkout session error:", error)
        if (error instanceof PublicationPatternError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        if (error instanceof FoundingCheckoutConfigurationError) {
            return NextResponse.json(
                {
                    error: "Checkout configuration is incomplete.",
                    code: "founding_checkout_misconfigured",
                },
                { status: 503 },
            )
        }
        return NextResponse.json(
            { error: "Checkout could not be opened. Please try again or contact support." },
            { status: 500 },
        )
    }
}
