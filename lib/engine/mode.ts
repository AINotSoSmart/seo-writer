/**
 * FlipAEO runs as the owner's internal engine: no payment, subscription-cycle
 * or allowance gate applies. Set FLIPAEO_INTERNAL_MODE=false to restore the
 * paid-product paths, which are left in place and untouched.
 */
export function internalMode(): boolean {
    return String(process.env.FLIPAEO_INTERNAL_MODE ?? "true").trim().toLowerCase() !== "false"
}
