-- ============================================================================
-- Pre-launch security pass: kill anonymous privilege, retire customer share
-- tokens, and pin every function's search_path.
-- ============================================================================
--
-- APPLY THIS LAST. It sweeps every function in `public`, so running it after
-- the other 20260816 migrations means it also covers the functions those
-- create. It is written to be re-runnable and is safe to apply again later;
-- re-applying after adding new functions is in fact the intended way to keep
-- the guarantees below true.
--
-- Apply through the Supabase SQL editor, never `supabase db push` — the CLI's
-- migration history for this project stops at 20260404014829 and would replay
-- every pivot migration.
--
-- Four findings are addressed here. Two more are NOT, because they cannot be:
--
--   * **Leaked-password protection** is a GoTrue setting, not schema. Turn it
--     on at Authentication -> Providers -> Email -> "Prevent use of leaked
--     passwords" in the Supabase dashboard. No SQL can do it.
--   * The **page-level authorization leaks** (`/evidence/ai-answer/*`,
--     `/visibility/[runId]`, `/audit/[token]`) were application bugs, fixed in
--     the app. RLS was never the problem there: those pages read through the
--     service client, which is *supposed* to bypass RLS, and then failed to
--     perform the ownership check that the service client makes their
--     responsibility. Section 3 below only cleans up the data those pages
--     exposed.
--
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. The two legacy editor-AI RPCs
-- ----------------------------------------------------------------------------
-- `consume_ai_tokens(p_user_id)` and `record_ai_usage(p_user_id, p_tokens_used)`
-- took the user id as a *parameter*, ran as SECURITY DEFINER, and carried the
-- default PUBLIC execute grant. An anonymous caller could therefore read any
-- user's subscription and quota state, and — worse — write to any user's usage
-- counter, including with a negative number, which grants unlimited free AI
-- generation to whoever asks.
--
-- The redesign removes the parameter that was the vulnerability. Identity comes
-- from `auth.uid()`, which a caller cannot forge, so the functions can only
-- ever act on the caller's own row. That is why this is a signature change and
-- not a permission patch: a privileged function that accepts "which user am I"
-- as an argument is broken by construction, and any grant on it is a guess
-- about who will be honest.
--
-- Deploy order: apply this migration, then deploy the application. Between the
-- two, the editor's AI actions (rewrite/improve/expand) return an error and
-- recover on deploy. Nothing else calls these.

DROP FUNCTION IF EXISTS public.consume_ai_tokens(uuid);
DROP FUNCTION IF EXISTS public.record_ai_usage(uuid, bigint);

CREATE OR REPLACE FUNCTION public.consume_ai_tokens()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_subscription RECORD;
    v_usage RECORD;
    v_is_subscribed BOOLEAN := FALSE;
    v_tokens_remaining BIGINT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication is required';
    END IF;

    SELECT * INTO v_subscription
    FROM public.dodo_subscriptions
    WHERE user_id = v_user_id
      AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1;

    v_is_subscribed := (v_subscription.id IS NOT NULL);

    IF NOT v_is_subscribed THEN
        RETURN jsonb_build_object(
            'allowed', FALSE,
            'reason', 'subscription_required',
            'tokens_remaining', 0,
            'is_subscribed', FALSE
        );
    END IF;

    SELECT * INTO v_usage
    FROM public.ai_token_usage
    WHERE user_id = v_user_id;

    IF v_usage.user_id IS NULL THEN
        INSERT INTO public.ai_token_usage (user_id, tokens_used, cycle_start_date)
        VALUES (
            v_user_id,
            0,
            COALESCE(v_subscription.current_period_end - interval '1 month', now())
        )
        RETURNING * INTO v_usage;
    END IF;

    -- Lazy billing-cycle reset, unchanged from the original.
    IF v_subscription.current_period_end IS NOT NULL
       AND v_usage.cycle_start_date < (v_subscription.current_period_end - interval '1 month')
    THEN
        UPDATE public.ai_token_usage
        SET tokens_used = 0,
            cycle_start_date = v_subscription.current_period_end - interval '1 month',
            updated_at = now()
        WHERE user_id = v_user_id
        RETURNING * INTO v_usage;
    END IF;

    v_tokens_remaining := v_usage.tokens_limit - v_usage.tokens_used;

    IF v_tokens_remaining <= 0 THEN
        RETURN jsonb_build_object(
            'allowed', FALSE,
            'reason', 'quota_exceeded',
            'tokens_remaining', 0,
            'tokens_used', v_usage.tokens_used,
            'tokens_limit', v_usage.tokens_limit,
            'is_subscribed', TRUE,
            'cycle_resets_at', v_subscription.current_period_end
        );
    END IF;

    RETURN jsonb_build_object(
        'allowed', TRUE,
        'tokens_remaining', v_tokens_remaining,
        'tokens_used', v_usage.tokens_used,
        'tokens_limit', v_usage.tokens_limit,
        'is_subscribed', TRUE,
        'cycle_resets_at', v_subscription.current_period_end
    );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_tokens() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_tokens() TO authenticated, service_role;

DO $$
BEGIN
    IF to_regprocedure('public.consume_ai_tokens()') IS NOT NULL THEN
        COMMENT ON FUNCTION public.consume_ai_tokens() IS
            'Pre-flight AI token quota check for the caller (auth.uid()). Handles subscription check, lazy billing-cycle reset, and quota validation. Takes no user id by design: the previous signature let any caller name any user.';
    END IF;
END;
$$;


CREATE OR REPLACE FUNCTION public.record_ai_usage(p_tokens_used BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_new_total BIGINT;
    v_limit BIGINT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication is required';
    END IF;

    -- A negative count refunds quota. The old function accepted one, which
    -- turned a usage recorder into a quota dispenser. Zero is allowed because a
    -- provider can legitimately report no billable tokens.
    IF p_tokens_used IS NULL OR p_tokens_used < 0 THEN
        RAISE EXCEPTION 'Recorded token usage must be zero or positive';
    END IF;

    UPDATE public.ai_token_usage
    SET tokens_used = tokens_used + p_tokens_used,
        last_request_at = now(),
        updated_at = now()
    WHERE user_id = v_user_id
    RETURNING tokens_used, tokens_limit INTO v_new_total, v_limit;

    IF v_new_total IS NULL THEN
        INSERT INTO public.ai_token_usage (user_id, tokens_used)
        VALUES (v_user_id, p_tokens_used)
        RETURNING tokens_used, tokens_limit INTO v_new_total, v_limit;
    END IF;

    RETURN jsonb_build_object(
        'tokens_used', v_new_total,
        'tokens_remaining', greatest(0, v_limit - v_new_total),
        'tokens_limit', v_limit
    );
END;
$$;

REVOKE ALL ON FUNCTION public.record_ai_usage(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_ai_usage(BIGINT) TO authenticated, service_role;

DO $$
BEGIN
    IF to_regprocedure('public.record_ai_usage(bigint)') IS NOT NULL THEN
        COMMENT ON FUNCTION public.record_ai_usage(BIGINT) IS
            'Records AI token consumption against the caller (auth.uid()). Refuses negative counts; the previous signature accepted both an arbitrary user id and a negative amount.';
    END IF;
END;
$$;


-- ----------------------------------------------------------------------------
-- 2. ai_token_usage row-level security
-- ----------------------------------------------------------------------------
-- The table's "service role full access" policy was written without a `TO`
-- clause, which in Postgres means PUBLIC — every role, including `anon`. RLS
-- was enabled and the owner policy existed, and the blanket policy underneath
-- made both irrelevant: anyone could read, insert, update or delete any row in
-- the quota table directly through PostgREST, without going near the RPCs
-- fixed above.
--
-- Both RPCs are SECURITY DEFINER and run as the function owner, so they are
-- unaffected by tightening this.

DROP POLICY IF EXISTS "Service role full access to AI usage" ON public.ai_token_usage;
CREATE POLICY "Service role full access to AI usage"
    ON public.ai_token_usage
    FOR ALL
    TO service_role
    USING (TRUE)
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Users can view their own AI usage" ON public.ai_token_usage;
CREATE POLICY "Users can view their own AI usage"
    ON public.ai_token_usage
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);


-- ----------------------------------------------------------------------------
-- 3. Retire share tokens on customer data
-- ----------------------------------------------------------------------------
-- A share token is an unauthenticated read path. One was minted for every
-- customer audit at creation and for every probe run by column default, whether
-- or not anyone asked to share anything. `/audit/[token]` now serves founder
-- prospect outreach only, and there is no token-addressed visibility report at
-- all, so these values address nothing — but a live token in a table is a live
-- credential until it is removed, so remove them.
--
-- `public_token_revoked_at` is set as well as the token being cleared. Clearing
-- alone would leave no record that the link had existed and been withdrawn.

UPDATE public.topical_audits
SET public_token = NULL,
    public_token_revoked_at = COALESCE(public_token_revoked_at, now())
WHERE audit_kind = 'customer'
  AND public_token IS NOT NULL;

-- Prospect reports whose claim is finished are customer data now:
-- `claim_prospect_audit` reassigns the audit's owner but leaves `audit_kind` as
-- 'prospect'. The application refuses to serve these; this removes the token
-- too, so there is nothing left to serve.
UPDATE public.topical_audits ta
SET public_token = NULL,
    public_token_revoked_at = COALESCE(ta.public_token_revoked_at, now())
WHERE ta.audit_kind = 'prospect'
  AND ta.public_token IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM public.audit_claims ac
      WHERE ac.audit_id = ta.id
        AND ac.claimed_at IS NULL
        AND ac.revoked_at IS NULL
        AND ac.expires_at > now()
  );

-- The invariant, so a future writer cannot quietly reintroduce the leak. The
-- UPDATEs above run first precisely so this can be added already valid.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'topical_audits_no_customer_public_token'
          AND conrelid = 'public.topical_audits'::regclass
    ) THEN
        ALTER TABLE public.topical_audits
            ADD CONSTRAINT topical_audits_no_customer_public_token
            CHECK (audit_kind <> 'customer' OR public_token IS NULL);
    END IF;
END;
$$;

-- Probe runs: the column defaulted to a fresh random token on every insert, so
-- every customer run carried a share credential nobody created on purpose.
ALTER TABLE public.ai_probe_runs ALTER COLUMN public_token DROP DEFAULT;

UPDATE public.ai_probe_runs
SET public_token = NULL
WHERE public_token IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ai_probe_runs_public_token_retired'
          AND conrelid = 'public.ai_probe_runs'::regclass
    ) THEN
        ALTER TABLE public.ai_probe_runs
            ADD CONSTRAINT ai_probe_runs_public_token_retired
            CHECK (public_token IS NULL);
    END IF;

    IF to_regclass('public.ai_probe_runs') IS NOT NULL THEN
        COMMENT ON COLUMN public.ai_probe_runs.public_token IS
            'Retired. The visibility report has no unauthenticated URL; the column is kept only so the applied 20260815 migration is not edited. Drop the CHECK deliberately if run sharing is ever designed.';
    END IF;
END;
$$;


-- ----------------------------------------------------------------------------
-- 4. Anonymous execute, everywhere
-- ----------------------------------------------------------------------------
-- Postgres grants EXECUTE on a new function to PUBLIC by default. The pivot
-- migrations revoke it explicitly; everything written before them did not, so
-- the older helpers and every trigger function were callable by `anon`.
--
-- Two rules, both applied by inspecting the live catalog rather than a list
-- kept by hand — a hand-kept list is exactly how the first six were missed:
--
--   a. A function returning `trigger` never needs EXECUTE. Postgres checks the
--      privilege when the trigger is *created*, not when it fires, so revoking
--      from every role cannot break a trigger. Revoke all of them.
--   b. Any other function that `anon` can currently execute has its signed-in
--      access made explicit first, then loses the blanket PUBLIC grant. Granting
--      `authenticated` before revoking PUBLIC is what makes this non-breaking:
--      those roles could already call it through PUBLIC, so nothing gains
--      capability and only `anon` loses it.
--
-- Rule (b) deliberately does not narrow `authenticated`. Deciding that a
-- signed-in user should also lose a function is a per-function judgement, and
-- guessing it wrong breaks a paying customer's feature. The vector-search
-- helpers below are handled by name instead, because their callers are known.

DO $$
DECLARE
    fn RECORD;
    trigger_count INTEGER := 0;
    public_count INTEGER := 0;
BEGIN
    FOR fn IN
        SELECT p.oid,
               p.oid::regprocedure AS signature,
               p.prorettype = 'pg_catalog.trigger'::regtype AS is_trigger
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prokind IN ('f', 'p')
          -- Never touch functions owned by an extension: pgvector installs into
          -- `extensions` here, but installs into `public` on some projects, and
          -- revoking its operators would break every embedding query.
          AND NOT EXISTS (
              SELECT 1 FROM pg_depend d
              WHERE d.objid = p.oid
                AND d.classid = 'pg_proc'::regclass
                AND d.deptype = 'e'
          )
    LOOP
        IF fn.is_trigger THEN
            EXECUTE format(
                'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',
                fn.signature
            );
            trigger_count := trigger_count + 1;
        ELSIF has_function_privilege('anon', fn.oid, 'EXECUTE') THEN
            EXECUTE format(
                'GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role',
                fn.signature
            );
            EXECUTE format(
                'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon',
                fn.signature
            );
            public_count := public_count + 1;
        END IF;
    END LOOP;

    RAISE NOTICE 'Revoked execute on % trigger function(s); removed anonymous execute from % other function(s).',
        trigger_count, public_count;
END;
$$;

-- The vector-search helpers predate the pivot's grant discipline. Every caller
-- uses the service client (lib/internal-linking.ts, lib/topic-memory.ts,
-- trigger/generate-blog.ts, and finalize_audit_run internally), so no signed-in
-- feature loses anything by narrowing these the rest of the way. They take a
-- raw embedding and return other rows' content, which is not a shape any
-- browser-held token should be able to call.
DO $$
DECLARE
    fn RECORD;
BEGIN
    FOR fn IN
        SELECT p.oid::regprocedure AS signature
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
              'match_query_pool',
              'match_internal_links',
              'match_articles',
              'match_articles_topic',
              'find_covered_answer',
              'find_live_url_from_article'
          )
    LOOP
        EXECUTE format(
            'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',
            fn.signature
        );
        EXECUTE format(
            'GRANT EXECUTE ON FUNCTION %s TO service_role',
            fn.signature
        );
    END LOOP;
END;
$$;


-- ----------------------------------------------------------------------------
-- 5. Mutable search_path
-- ----------------------------------------------------------------------------
-- A SECURITY DEFINER function with no pinned `search_path` resolves unqualified
-- names against the *caller's* path. A caller who can create a schema can
-- therefore decide which `dodo_subscriptions` the function reads. Pin every
-- function that has no `proconfig` at all.
--
-- The vector schema is discovered rather than assumed, and included, because
-- `match_*` and `finalize_audit_run` need to resolve the `vector` type. Pinning
-- to bare `public` is what caused "type vector does not exist" in production
-- once already — see 20260730_fix_finalize_vector_search_path.sql.

DO $$
DECLARE
    fn RECORD;
    vector_schema TEXT;
    pinned INTEGER := 0;
BEGIN
    SELECT n.nspname
    INTO vector_schema
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'vector';

    IF vector_schema IS NULL THEN
        RAISE EXCEPTION 'pgvector is not installed; refusing to pin search_path without knowing where the vector type lives';
    END IF;

    FOR fn IN
        SELECT p.oid::regprocedure AS signature
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prokind IN ('f', 'p')
          AND p.proconfig IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM pg_depend d
              WHERE d.objid = p.oid
                AND d.classid = 'pg_proc'::regclass
                AND d.deptype = 'e'
          )
    LOOP
        IF vector_schema = 'public' THEN
            EXECUTE format(
                'ALTER FUNCTION %s SET search_path = public, pg_catalog',
                fn.signature
            );
        ELSE
            EXECUTE format(
                'ALTER FUNCTION %s SET search_path = public, %I, pg_catalog',
                fn.signature, vector_schema
            );
        END IF;
        pinned := pinned + 1;
    END LOOP;

    RAISE NOTICE 'Pinned search_path on % function(s).', pinned;
END;
$$;


-- ----------------------------------------------------------------------------
-- 6. Report what is left
-- ----------------------------------------------------------------------------
-- Fails loudly rather than reporting success on a database where the sweeps did
-- not take. Run the migration again if this raises; it is idempotent.

DO $$
DECLARE
    anon_callable TEXT;
    unpinned TEXT;
    leaked_tokens INTEGER;
BEGIN
    SELECT string_agg(p.oid::regprocedure::text, ', ')
    INTO anon_callable
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind IN ('f', 'p')
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
      AND NOT EXISTS (
          SELECT 1 FROM pg_depend d
          WHERE d.objid = p.oid AND d.classid = 'pg_proc'::regclass AND d.deptype = 'e'
      );

    SELECT string_agg(p.oid::regprocedure::text, ', ')
    INTO unpinned
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind IN ('f', 'p')
      AND p.proconfig IS NULL
      AND NOT EXISTS (
          SELECT 1 FROM pg_depend d
          WHERE d.objid = p.oid AND d.classid = 'pg_proc'::regclass AND d.deptype = 'e'
      );

    SELECT count(*) INTO leaked_tokens
    FROM public.topical_audits
    WHERE audit_kind = 'customer' AND public_token IS NOT NULL;

    IF anon_callable IS NOT NULL THEN
        RAISE EXCEPTION 'Anonymous execute still granted on: %', anon_callable;
    END IF;
    IF unpinned IS NOT NULL THEN
        RAISE EXCEPTION 'search_path still mutable on: %', unpinned;
    END IF;
    IF leaked_tokens > 0 THEN
        RAISE EXCEPTION '% customer audit(s) still carry a public token', leaked_tokens;
    END IF;

    RAISE NOTICE 'Security pass complete. Remaining manual step: enable leaked-password protection in the Supabase Auth dashboard.';
END;
$$;
