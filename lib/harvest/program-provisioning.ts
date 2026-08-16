/* eslint-disable @typescript-eslint/no-explicit-any -- forward Phase 3 RPCs are absent from generated database types until migration. */
import "server-only"

type ProvisioningResult =
    | { ok: true; programId: string; brandId: string }
    | { ok: false; skipped: string }

/**
 * Idempotently attaches one long-lived recurring program to a subscription.
 * The program owns a brand, not one immutable audit or a frozen cluster list.
 */
export async function ensureProgramForSubscription(
    supabase: any,
    userId: string,
    brandId: string | null,
    dodoSubscriptionId: string | null,
): Promise<ProvisioningResult> {
    if (!dodoSubscriptionId) return { ok: false, skipped: "missing subscription id" }

    let resolvedBrandId = brandId
    if (!resolvedBrandId) {
        const { data: brands, error } = await supabase
            .from("brand_details")
            .select("id")
            .eq("user_id", userId)
            .is("deleted_at", null)
            .limit(2)
        if (error) throw new Error(`Program brand lookup failed: ${error.message}`)
        if (brands?.length !== 1) {
            return { ok: false, skipped: "subscription does not identify one brand" }
        }
        resolvedBrandId = brands[0].id
    }

    if (!resolvedBrandId) return { ok: false, skipped: "brand could not be resolved" }

    const { data: programId, error } = await supabase.rpc(
        "ensure_recurring_program",
        {
            p_user_id: userId,
            p_brand_id: resolvedBrandId,
            p_dodo_subscription_id: dodoSubscriptionId,
        },
    )
    if (error) throw new Error(`Recurring program provisioning failed: ${error.message}`)
    if (!programId) return { ok: false, skipped: "provisioning returned no program" }

    return { ok: true, programId, brandId: resolvedBrandId }
}
