/**
 * Client-side wrapper for calling our Dodo Payments API routes.
 * NOTE: Do not import the server SDK here. These functions run in the browser.
 */

type ProductCartItem = { product_id: string; quantity: number; amount?: number }

type CustomerRequest = {
    email: string
    name?: string
    phone_number?: string
}

type BillingAddress = {
    country: string
    city: string
    state?: string
    street: string
    zipcode: string
}

/**
 * Create hosted Checkout Session and return the checkout_url and session_id
 */
export async function checkout(
    product_cart: ProductCartItem[],
    customer?: CustomerRequest,
    billing_address?: BillingAddress,
    return_url?: string,
    metadata?: Record<string, string>,
): Promise<{ checkout_url: string; session_id: string }> {
    if (!return_url) {
        throw new Error('return_url is required')
    }
    const payload: any = {
        product_cart,
        return_url,
        metadata,
    }
    if (customer) payload.customer = customer
    if (billing_address) payload.billing_address = billing_address

    const res = await fetch('/api/dodopayments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
): Promise<{ url: string }> {
    const res = await fetch('/api/dodopayments/subscription/update-payment-method', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription_id, return_url }),
    })
    const data = await res.json()
    if (!res.ok) {
        throw new Error(data?.error || 'Failed to create customer portal session')
    }
    return data
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