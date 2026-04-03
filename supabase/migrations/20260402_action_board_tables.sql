-- Create the GSC JSONB Cache Table
CREATE TABLE IF NOT EXISTS public.gsc_daily_cache (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    site_url text NOT NULL,
    date date NOT NULL,
    data jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(user_id, site_url, date)
);

ALTER TABLE public.gsc_daily_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own gsc cache"
    ON public.gsc_daily_cache FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Create the Action Board Tracking Table
CREATE TABLE IF NOT EXISTS public.seo_plays (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    site_url text NOT NULL,
    query text NOT NULL,
    page text NOT NULL,
    play_type text NOT NULL,
    advice text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    deployed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.seo_plays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own seo plays"
    ON public.seo_plays FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
