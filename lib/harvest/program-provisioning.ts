import "server-only"

type ProvisioningResult =
    | { ok: true; programId: string; brandId: string; tier: string }
    | { ok: false; skipped: string }

/**
 * Provision exactly the scope frozen before checkout. Replays return the
 * existing program through the idempotent SQL function.
 */
export async function provisionProgramForSubscription(
    supabase: any,
    userId: string,
    purchaseIntentId: string | null,
    dodoSubscriptionId: string | null,
): Promise<ProvisioningResult> {
    if (!purchaseIntentId) return { ok: false, skipped: "missing purchase intent" }
    if (!dodoSubscriptionId) return { ok: false, skipped: "missing subscription id" }

    const { data: intent } = await supabase
        .from("program_purchase_intents")
        .select("id, user_id, brand_id, tier, status")
        .eq("id", purchaseIntentId)
        .eq("user_id", userId)
        .maybeSingle()
    if (!intent) return { ok: false, skipped: "purchase intent not found" }

    const { data: programId, error } = await supabase.rpc(
        "provision_program_from_intent",
        {
            p_purchase_intent_id: purchaseIntentId,
            p_dodo_subscription_id: dodoSubscriptionId,
        },
    )
    if (error) {
        throw new Error(`Program provisioning failed: ${error.message}`)
    }
    if (!programId) return { ok: false, skipped: "provisioning returned no program" }

    return {
        ok: true,
        programId,
        brandId: intent.brand_id,
        tier: intent.tier,
    }
}
