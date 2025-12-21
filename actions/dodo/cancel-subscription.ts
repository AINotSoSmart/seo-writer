"use server";

import { getDodoClient } from '@/lib/dodopayments-server';
import { createClient } from '@/utils/supabase/server';
import type { ServerActionRes } from '@/types/server-action';

export async function cancelSubscription(props: {
    subscriptionId: string;
}): Promise<ServerActionRes> {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: 'Not authenticated' };
        }

        if (!props?.subscriptionId) {
            return { success: false, error: 'subscriptionId is required' };
        }

        const client = getDodoClient();

        // Remote: schedule cancellation at next billing date
        await client.subscriptions.update(props.subscriptionId, {
            cancel_at_next_billing_date: true,
        });

        // Local: reflect flag in metadata so UI reacts immediately
        const { data: existing } = await supabase
            .from('dodo_subscriptions')
            .select('metadata')
            .eq('dodo_subscription_id', props.subscriptionId)
            .maybeSingle();

        const newMetadata = {
            ...(existing?.metadata ?? {}),
            cancel_at_next_billing_date: true,
        };

        await supabase
            .from('dodo_subscriptions')
            .update({ metadata: newMetadata })
            .eq('dodo_subscription_id', props.subscriptionId);

        return { success: true };
    } catch (error: any) {
        return {
            success: false,
            error:
                error instanceof Error ? error.message : 'An unknown error occurred',
        };
    }
}