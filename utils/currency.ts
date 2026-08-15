/**
 * Currency utility – uses Intl.NumberFormat (backed by CLDR data) so every
 * ISO 4217 code is handled automatically.  No manual mapping needed.
 */

/**
 * Return the narrow currency symbol for an ISO 4217 code.
 * e.g. 'USD' → '$', 'EUR' → '€', 'JPY' → '¥', 'INR' → '₹', 'GBP' → '£'
 *
 * Falls back to the currency code itself (e.g. 'XOF') when no symbol exists.
 */
export function currencySymbol(code?: string | null): string {
    if (!code) return '$'
    try {
        // Format zero with currencyDisplay: 'narrowSymbol' and strip digits/whitespace
        const parts = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: code.toUpperCase(),
            currencyDisplay: 'narrowSymbol',
        }).formatToParts(0)

        const sym = parts.find((p) => p.type === 'currency')?.value
        return sym || code.toUpperCase()
    } catch {
        return code.toUpperCase()
    }
}

/**
 * Format an amount with its full currency representation.
 * e.g. formatCurrency(9.99, 'USD') → '$9.99'
 *      formatCurrency(1200, 'JPY') → '¥1,200'
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency.toUpperCase(),
        }).format(amount)
    } catch {
        return `${currencySymbol(currency)}${(amount || 0).toFixed(2)}`
    }
}

/**
 * Convert from "lowest denomination" (cents, pence, etc.) to the major unit.
 * Currencies like JPY / KRW have 0 fraction digits, so 1 unit = 1 unit.
 */
export function fromMinorUnits(amountMinor: number, currency: string = 'USD'): number {
    try {
        const fractionDigits = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency.toUpperCase(),
        }).resolvedOptions().maximumFractionDigits ?? 2

        return amountMinor / Math.pow(10, fractionDigits)
    } catch {
        return amountMinor / 100
    }
}
