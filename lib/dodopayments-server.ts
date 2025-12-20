import DodoPayments from 'dodopayments'

type DodoEnvironment = 'test_mode' | 'live_mode'

let cachedClient: any = null

export function getDodoEnvironment(): DodoEnvironment {
    return process.env.DODO_ENVIRONMENT === 'live_mode' ? 'live_mode' : 'test_mode'
}

/**
 * Server-only singleton Dodo Payments SDK client.
 * Reads:
 * - DODO_PAYMENTS_API_KEY (required)
 * - DODO_ENVIRONMENT = 'test_mode' | 'live_mode' (defaults to test_mode)
 */
export function getDodoClient() {
    const apiKey = process.env.DODO_PAYMENTS_API_KEY
    if (!apiKey) {
        throw new Error('DODO_PAYMENTS_API_KEY is not set. Add it to your environment.')
    }

    const environment: DodoEnvironment = getDodoEnvironment()

    if (!cachedClient) {
        // The official SDK accepts bearerToken and environment
        cachedClient = new (DodoPayments as any)({
            bearerToken: apiKey,
            environment,
        })
    }

    return cachedClient
}