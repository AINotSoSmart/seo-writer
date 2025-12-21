"use server";

import { createClient } from '@/utils/supabase/server';
import type { ServerActionRes } from '@/types/server-action';

/**
 * Fetch user's invoices (payments) — Server Action
 * Mirrors Dodo boilerplate intent, adapted to Supabase (no Drizzle).
 *
 * Schema:
 * - public.dodo_payments: stores per-user payments
 * - Join dodo_pricing_plans for plan name/price
 */
export async function getInvoices(): Promise<ServerActionRes<Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    credits: number;
    created_at: string;
    completed_at?: string | null;
    pricing_plan?: { name: string; price: number } | null;
}>>> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: 'Not authenticated' };
        }

        // Query invoices/payments for the current user
        const { data, error } = await supabase
            .from('dodo_payments')
            .select(`
        id,
        amount,
        currency,
        status,
        credits,
        created_at,
        completed_at,
        pricing_plan:dodo_pricing_plans ( name, price )
      `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            return { success: false, error: 'Failed to get invoices' };
        }

        // Shape rows to a minimal, UI-friendly structure
        const invoices = (data || []).map((row: any) => ({
            id: String(row.id),
            amount: Number(row.amount ?? 0),
            currency: String(row.currency ?? 'USD'),
            status: String(row.status ?? 'pending'),
            credits: Number(row.credits ?? 0),
            created_at: String(row.created_at ?? new Date().toISOString()),
            completed_at: row.completed_at ?? null,
            pricing_plan: row.pricing_plan
                ? {
                    name: String(row.pricing_plan.name ?? 'Plan'),
                    price: Number(row.pricing_plan.price ?? 0),
                }
                : null,
        }));

        return { success: true, data: invoices };
    } catch (error) {
        return { success: false, error: 'Failed to get invoices' };
    }
}