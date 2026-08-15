-- Enable Row Level Security on credits table
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;

-- ========================================
-- RLS Policies for credits table
-- ========================================

-- Allow authenticated users to read only their own credits
CREATE POLICY "Users can view their own credits"
    ON public.credits
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Allow service role to read all credits (for admin operations)
CREATE POLICY "Service role can read all credits"
    ON public.credits
    FOR SELECT
    TO service_role
    USING (true);

-- Allow authenticated users to insert their own credits record
CREATE POLICY "Users can create their own credits"
    ON public.credits
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Allow service role to insert any credits record (for admin operations)
CREATE POLICY "Service role can insert credits"
    ON public.credits
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- Allow authenticated users to update only their own credits
CREATE POLICY "Users can update their own credits"
    ON public.credits
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Allow service role to update any credits record (for admin operations)
CREATE POLICY "Service role can update credits"
    ON public.credits
    FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Prevent users from deleting their credits record
-- Only service role can delete credits (for admin cleanup)
CREATE POLICY "Service role can delete credits"
    ON public.credits
    FOR DELETE
    TO service_role
    USING (true);