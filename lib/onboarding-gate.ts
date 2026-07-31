/**
 * Brand-required onboarding gate.
 *
 * Authenticated customers without a non-deleted brand_details row must finish
 * setup on /onboarding. Dashboard shells and login bounce them there rather
 * than rendering an empty /content-plan. Founder tools are exempt at the call
 * site; API routes are never gated here (analyze-brand runs before save).
 */

export type BrandGateClient = {
    from: (table: string) => {
        select: (columns: string) => {
            eq: (
                column: string,
                value: string,
            ) => {
                is: (
                    column: string,
                    value: null,
                ) => {
                    limit: (count: number) => {
                        maybeSingle: () => Promise<{
                            data: { id: string } | null
                            error: unknown
                        }>
                    }
                }
            }
        }
    }
}

export async function userHasActiveBrand(
    supabase: BrandGateClient,
    userId: string,
): Promise<boolean> {
    const { data } = await supabase
        .from("brand_details")
        .select("id")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle()
    return Boolean(data?.id)
}

/** Dashboard page prefixes that require a saved brand. */
export const BRAND_GATED_PATH_PREFIXES = [
    "/content-plan",
    "/audit",
    "/articles",
    "/settings",
    "/account",
    "/integrations",
    "/subscribe",
    "/reports",
    "/seo-health",
] as const

export function pathRequiresBrand(pathname: string): boolean {
    return BRAND_GATED_PATH_PREFIXES.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
}
