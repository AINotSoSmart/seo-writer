import { NextRequest, NextResponse } from "next/server"

import { getDodoClient } from "@/lib/dodopayments-server"
import {
    createProgramPurchaseIntent,
    PurchaseIntentError,
    type VelocityTier,
} from "@/lib/harvest/purchase-intent"
import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"

const VALID_TIERS = new Set<VelocityTier>(["close", "accelerate", "dominate"])

/**
 * Closed-pool checkout accepts product intent, not an arbitrary Dodo cart.
 * The database intent pins the immutable audit, six clusters, URLs, and graph.
 */
export async function POST(req: NextRequest) {
    if (process.env.CLOSED_POOL_CHECKOUT_ENABLED !== "true") {
        return NextResponse.json(
            { error: "Checkout remains closed while the delivery contract is being verified." },
            { status: 503 },
        )
    }

    try {
        const supabase = await createClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await req.json().catch(() => ({}))
        const auditId = typeof body.auditId === "string" ? body.auditId : ""
        const tier = String(body.tier || "").toLowerCase() as VelocityTier
        const publicationUrlPattern =
            typeof body.publicationUrlPattern === "string"
                ? body.publicationUrlPattern
                : ""
        const returnUrl = typeof body.returnUrl === "string" ? body.returnUrl : ""

        if (!auditId || !VALID_TIERS.has(tier) || !publicationUrlPattern || !returnUrl) {
            return NextResponse.json(
                {
                    error:
                        "auditId, a valid tier, publicationUrlPattern, and returnUrl are required.",
                },
                { status: 400 },
            )
        }

        const intent = await createProgramPurchaseIntent({
            userId: user.id,
            auditId,
            tier,
            publicationUrlPattern,
        })
        const client = getDodoClient()
        const session = await client.checkoutSessions.create({
            product_cart: [{ product_id: intent.dodoProductId, quantity: 1 }],
            return_url: returnUrl,
            customer: user.email ? { email: user.email } : undefined,
            metadata: {
                user_id: user.id,
                purchase_intent_id: intent.id,
                audit_id: auditId,
                tier,
            },
        } as any)

        const db = createAdminClient() as any
        const { error: intentUpdateError } = await db
            .from("program_purchase_intents")
            .update({
                status: "checkout_created",
                checkout_session_id: session.session_id,
            })
            .eq("id", intent.id)
            .eq("user_id", user.id)
        if (intentUpdateError) {
            throw new Error(
                `Checkout was created but its frozen purchase intent could not be activated: ${intentUpdateError.message}`,
            )
        }

        try {
            await db.from("dodo_subscription_changes").insert({
                user_id: user.id,
                from_plan_id: null,
                to_plan_id: intent.pricingPlanId,
                checkout_session_id: session.session_id,
                status: "pending",
                change_type: "new",
                metadata: {
                    source: "closed_pool_purchase_intent",
                    purchase_intent_id: intent.id,
                    audit_id: auditId,
                    tier,
                },
            })
        } catch (error) {
            console.warn("Subscription change audit insert failed:", error)
        }

        return NextResponse.json({
            checkout_url: session.checkout_url,
            session_id: session.session_id,
            purchase_intent_id: intent.id,
        })
    } catch (error) {
        console.error("Checkout session error:", error)
        if (error instanceof PurchaseIntentError) {
            return NextResponse.json(
                { error: error.message, code: error.code },
                { status: error.status },
            )
        }
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to create checkout session",
            },
            { status: 500 },
        )
    }
}
