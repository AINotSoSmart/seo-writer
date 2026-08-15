-- Enable Row Level Security on DodoPayments tables
ALTER TABLE public.dodo_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dodo_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dodo_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dodo_pricing_plans ENABLE ROW LEVEL SECURITY;

-- ========================================
-- RLS Policies for dodo_payments table
-- ========================================

-- Allow authenticated users to read only their own payments
CREATE POLICY "Users can view their own payments"
    ON public.dodo_payments
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Allow service role to read all payments (for webhook processing)
CREATE POLICY "Service role can read all payments"
    ON public.dodo_payments
    FOR SELECT
    TO service_role
    USING (true);

-- Allow authenticated users to insert their own payments
CREATE POLICY "Users can create their own payments"
    ON public.dodo_payments
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Allow service role to insert any payment (for webhook processing)
CREATE POLICY "Service role can insert payments"
    ON public.dodo_payments
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- Allow service role to update any payment (for webhook processing)
CREATE POLICY "Service role can update payments"
    ON public.dodo_payments
    FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ========================================
-- RLS Policies for dodo_subscriptions table
-- ========================================

-- Allow authenticated users to read only their own subscriptions
CREATE POLICY "Users can view their own subscriptions"
    ON public.dodo_subscriptions
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Allow service role to read all subscriptions (for webhook processing)
CREATE POLICY "Service role can read all subscriptions"
    ON public.dodo_subscriptions
    FOR SELECT
    TO service_role
    USING (true);

-- Allow service role to insert any subscription (for webhook processing)
CREATE POLICY "Service role can insert subscriptions"
    ON public.dodo_subscriptions
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- Allow service role to update any subscription (for webhook processing)
CREATE POLICY "Service role can update subscriptions"
    ON public.dodo_subscriptions
    FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ========================================
-- RLS Policies for dodo_webhook_events table
-- ========================================

-- Allow service role full access to webhook events (for webhook processing)
CREATE POLICY "Service role can manage webhook events"
    ON public.dodo_webhook_events
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Optionally allow authenticated users to read webhook events (for debugging)
-- Uncomment if you want users to see webhook events related to their payments
-- CREATE POLICY "Users can view webhook events for their payments"
--     ON public.dodo_webhook_events
--     FOR SELECT
--     TO authenticated
--     USING (
--         EXISTS (
--             SELECT 1 FROM public.dodo_payments p
--             WHERE p.user_id = auth.uid()
--             AND (p.dodo_payment_id = (data->>'payment_id') OR p.dodo_checkout_session_id = (data->>'checkout_session_id'))
--         )
--     );

-- ========================================
-- RLS Policies for dodo_pricing_plans table
-- ========================================

-- Allow anonymous users to read active pricing plans (for public pricing page)
CREATE POLICY "Anonymous users can view active pricing plans"
    ON public.dodo_pricing_plans
    FOR SELECT
    TO anon
    USING (is_active = true);

-- Allow authenticated users to read active pricing plans
CREATE POLICY "Authenticated users can view active pricing plans"
    ON public.dodo_pricing_plans
    FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Allow service role full access to pricing plans (for management)
CREATE POLICY "Service role can manage pricing plans"
    ON public.dodo_pricing_plans
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Optionally allow admin users to manage pricing plans
-- Uncomment and modify if you have admin role management
-- CREATE POLICY "Admin users can manage pricing plans"
--     ON public.dodo_pricing_plans
--     FOR ALL
--     TO authenticated
--     USING (
--         EXISTS (
--             SELECT 1 FROM auth.users
--             WHERE id = auth.uid()
--             AND raw_user_meta_data->>'role' = 'admin'
--         )
--     )
--     WITH CHECK (
--         EXISTS (
--             SELECT 1 FROM auth.users
--             WHERE id = auth.uid()
--             AND raw_user_meta_data->>'role' = 'admin'
--         )
--     );