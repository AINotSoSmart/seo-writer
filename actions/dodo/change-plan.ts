"use server";

import { getDodoClient } from '@/lib/dodopayments-server';
import { createClient } from '@/utils/supabase/server';
import type { ServerActionRes } from '@/types/server-action';

/**
 * Change an existing subscription's plan (server action).
 * Mirrors the Dodo boilerplate pattern, without Drizzle.
 *
 * References:
 * - Subscriptions.changePlan: https://github.com/dodopayments/dodopayments-node/blob/main/api.md
 * - Context7 snippet confirms: client.subscriptions.changePlan(subscriptionId, params)
 */
export async function changePlan(props: {
    subscriptionId: string;
    productId: string;
    prorationBillingMode?: 'prorated_immediately' | 'none';
    quantity?: number;
}): Promise<ServerActionRes> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return { success: false, error: 'Not authenticated' };
        if (!props?.subscriptionId) return { success: false, error: 'subscriptionId is required' };
        if (!props?.productId) return { success: false, error: 'productId is required' };

        const client = getDodoClient();

        // Standard params: prefer product_id + proration mode as in boilerplate.
        // Some SDK examples reference new_product_id; product_id is supported in current SDKs.
        const body: any = {
            product_id: props.productId,
            proration_billing_mode: props.prorationBillingMode ?? 'prorated_immediately',
            quantity: props.quantity ?? 1,
        };

        await client.subscriptions.changePlan(props.subscriptionId, body);

        // Do NOT mutate local DB here; webhook will upsert the new mapping and credits as per our webhook handler.
        // This mirrors the boilerplate approach and avoids race conditions.

        return { success: true };
    } catch (error: any) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'An unknown error occurred',
        };
    }
}