import { NextRequest, NextResponse } from 'next/server'
import { getDodoClient } from '@/lib/dodopayments-server'
import { createClient } from '@/utils/supabase/server'

/**
 * POST /api/dodopayments/checkout
 * Creates a Dodo Payments Checkout Session for a subscription product.
 *
 * References:
 * - Dodo Payments Node SDK: https://github.com/dodopayments/dodopayments-node/blob/main/README.md
 * - Checkout Sessions API: https://github.com/dodopayments/dodopayments-node/blob/main/api.md
 *
 * Expected JSON body:
 * {
 *   "product_cart": [{ "product_id": "prod_xxx", "quantity": 1, "amount"?: number }],
 *   "customer": { "email": string, "name"?: string, "phone_number"?: string },
 *   "billing_address": { "country": string, "city": string, "state"?: string, "street": string, "zipcode": string },
 *   "return_url": string,
 *   "metadata"?: Record<string, string>
 * }
 *
 * Response:
 * { "checkout_url": string, "session_id": string }
 */
export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json().catch(() => ({}))
        const {
            product_cart,
            customer,
            billing_address,
            return_url,
            metadata,
        } = body || {}

        // Basic validation
        if (!Array.isArray(product_cart) || product_cart.length === 0) {
            return NextResponse.json(
                { error: 'product_cart is required and must be a non-empty array' },
                { status: 400 },
            )
        }
        for (const item of product_cart) {
            if (!item?.product_id || typeof item.product_id !== 'string') {
                return NextResponse.json(
                    { error: 'Each product_cart item must include a valid product_id' },
                    { status: 400 },
                )
            }
            if (
                typeof item.quantity !== 'number' ||
                !Number.isInteger(item.quantity) ||
                item.quantity <= 0
            ) {
                return NextResponse.json(
                    { error: 'Each product_cart item must include a positive integer quantity' },
                    { status: 400 },
                )
            }
            if (item.amount !== undefined && (typeof item.amount !== 'number' || item.amount < 0)) {
                return NextResponse.json(
                    { error: 'If provided, amount must be a non-negative number (lowest denomination)' },
                    { status: 400 },
                )
            }
        }

        if (!return_url || typeof return_url !== 'string') {
            return NextResponse.json({ error: 'return_url is required' }, { status: 400 })
        }

        // Build metadata: add user_id only if not already provided
        const finalMetadata: Record<string, any> = { ...(metadata ?? {}) }
        if (!Object.prototype.hasOwnProperty.call(finalMetadata, 'user_id')) {
            finalMetadata.user_id = user.id
        }

        const client = getDodoClient()

        // Build params for Dodo Checkout Session
        const params: any = {
            product_cart,
            return_url,
            metadata: finalMetadata,
        }

        if (customer && typeof customer === 'object') {
            params.customer = customer
        }
        if (billing_address && typeof billing_address === 'object') {
            params.billing_address = billing_address
        }

        const session = await client.checkoutSessions.create(params)

        // Optional: Track a pending subscription change (audit trail)
        // Attempt to map the first product to a local pricing plan
        try {
            const firstProductId: string | undefined = product_cart?.[0]?.product_id
            let to_plan_id: string | null = null

            if (firstProductId) {
                const { data: plan } = await supabase
                    .from('dodo_pricing_plans')
                    .select('id')
                    .eq('dodo_product_id', firstProductId)
                    .maybeSingle()

                to_plan_id = (plan as any)?.id ?? null
            }

            await supabase.from('dodo_subscription_changes').insert({
                user_id: user.id,
                from_plan_id: null,
                to_plan_id,
                checkout_session_id: session.session_id,
                status: 'pending',
                change_type: 'new',
                metadata: {
                    source: 'api.dodopayments.checkout',
                    product_cart,
                },
            })
        } catch (auditErr) {
            console.warn('dodo_subscription_changes insert failed (non-blocking):', auditErr)
        }

        return NextResponse.json(
            {
                checkout_url: session.checkout_url,
                session_id: session.session_id,
            },
            { status: 200 },
        )
    } catch (err: any) {
        console.error('Checkout session error:', err)
        const message =
            (err && (err.message || err.error || err.toString())) ||
            'Failed to create checkout session'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}