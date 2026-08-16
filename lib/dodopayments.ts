/**
 * Client-side wrapper for calling our Dodo Payments API routes.
 * NOTE: Do not import the server SDK here. These functions run in the browser.
 */

/**
 * Create a hosted checkout from a server-validated frozen program intent.
 * The browser is never allowed to choose a Dodo product or arbitrary cart.
 */
export async function checkout(
    input: {
        publicationUrlPattern: string
    },
): Promise<{ checkout_url: string; session_id: string }> {
    const res = await fetch('/api/dodopayments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    })

    const data = await res.json()
    if (!res.ok) {
        throw new Error(data?.error || 'Failed to create checkout session')
    }
    return { checkout_url: data.checkout_url, session_id: data.session_id }
}

/**
 * Trigger cancellation at next billing date for the user's subscription.
 * subscription_id is optional; if omitted, the API resolves the user's active subscription.
 */
export async function cancelSubscription(
    subscription_id?: string,
): Promise<{ ok: boolean; subscription_id: string; remote: any }> {
    const res = await fetch('/api/dodopayments/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription_id }),
    })
    const data = await res.json()
    if (!res.ok) {
        throw new Error(data?.error || 'Failed to schedule subscription cancellation')
    }
    return data
}

/**
 * Create a customer portal session so the user can update their default payment method.
 * subscription_id is optional; if omitted, the API resolves the user's active subscription.
 * return_url is optional; defaults to /account.
 */
export async function updatePaymentMethod(
    subscription_id?: string,
    return_url?: string,
): Promise<{ url?: string; emailed?: boolean; message?: string }> {
    const res = await fetch('/api/dodopayments/subscription/update-payment-method', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription_id, return_url }),
    })
    const data = await res.json()
    if (!res.ok) {
        throw new Error(data?.error || 'Failed to create customer portal session')
    }
    // API may return { url } OR { emailed: true, message }
    return {
        url: data?.url || data?.link,
        emailed: Boolean(data?.emailed),
        message: typeof data?.message === 'string' ? data.message : undefined,
    }
}

/**
 * Placeholders for future server endpoints. These are imported by hooks/useBilling.ts.
 * They will throw informative errors until implemented.
 */

export async function getProducts(): Promise<never> {
    throw new Error('getProducts is not implemented yet. Please implement a server route and wire it here.')
}

export async function getProduct(_product_id: string): Promise<never> {
    throw new Error('getProduct is not implemented yet. Please implement a server route and wire it here.')
}

export async function getCustomer(_customer_id: string): Promise<never> {
    throw new Error('getCustomer is not implemented yet. Please implement a server route and wire it here.')
}

export async function getCustomerSubscriptions(_customer_id: string): Promise<never> {
    throw new Error('getCustomerSubscriptions is not implemented yet. Please implement a server route and wire it here.')
}

export async function getCustomerPayments(_customer_id: string): Promise<never> {
    throw new Error('getCustomerPayments is not implemented yet. Please implement a server route and wire it here.')
}

export async function createCustomer(_customer: any): Promise<never> {
    throw new Error('createCustomer is not implemented yet. Please implement a server route and wire it here.')
}

export async function updateCustomer(_customer_id: string, _customer: any): Promise<never> {
    throw new Error('updateCustomer is not implemented yet. Please implement a server route and wire it here.')
}
// ---- Additional helpers for Subscription management via API routes ----

/**
 * Restore a subscription (unset cancel_at_next_billing_date) using our API route.
 */
export async function restoreSubscription(
    subscription_id?: string
): Promise<{ ok: boolean; subscription_id: string }> {
    const res = await fetch('/api/dodopayments/subscription/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription_id }),
    })
    const data = await res.json()
    if (!res.ok) {
        throw new Error(data?.error || 'Failed to restore subscription')
    }
    return data
}

/**
 * Change plan for a subscription using our API route.
 */
export async function changeSubscriptionPlan(
    subscription_id: string | undefined,
    product_id: string,
    proration_billing_mode: 'prorated_immediately' | 'none' = 'prorated_immediately',
    quantity: number = 1
): Promise<{ ok: boolean; subscription_id: string }> {
    const res = await fetch('/api/dodopayments/subscription/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            subscription_id,
            product_id,
            proration_billing_mode,
            quantity,
        }),
    })
    const data = await res.json()
    if (!res.ok) {
        throw new Error(data?.error || 'Failed to change subscription plan')
    }
    return data
}
