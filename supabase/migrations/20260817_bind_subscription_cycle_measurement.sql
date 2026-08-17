-- Bind one paid subscription cycle to one visibility measurement atomically.
-- A payment event may be recorded independently, but it cannot mint capacity.

-- Repair only empty cycles produced by the retired payment-event fallback.
-- The authoritative timestamps are read from each stored renewal event; no
-- generated ids or customer-specific values are embedded in this migration.
DO $$
DECLARE
    renewal RECORD;
    duplicate RECORD;
    v_start TIMESTAMPTZ;
    v_end TIMESTAMPTZ;
BEGIN
    FOR renewal IN
        SELECT cycle_row.id AS cycle_id,
               cycle_row.program_id,
               cycle_row.billing_grant_id,
               grant_row.dodo_subscription_id,
               event_row.data
        FROM public.subscription_cycles cycle_row
        JOIN public.subscription_period_grants grant_row
          ON grant_row.id = cycle_row.billing_grant_id
        JOIN public.dodo_webhook_events event_row
          ON event_row.dodo_event_id = grant_row.source_event_id
         AND event_row.event_type = 'subscription.renewed'
        WHERE cycle_row.state = 'pending'
          AND cycle_row.measurement_run_id IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.cycle_actions action_row
              WHERE action_row.cycle_id = cycle_row.id
          )
          AND NOT EXISTS (
              SELECT 1 FROM public.program_cost_events cost_row
              WHERE cost_row.cycle_id = cycle_row.id
          )
    LOOP
        v_start := NULLIF(renewal.data #>> '{data,previous_billing_date}', '')::TIMESTAMPTZ;
        v_end := NULLIF(renewal.data #>> '{data,next_billing_date}', '')::TIMESTAMPTZ;
        IF v_start IS NULL OR v_end IS NULL OR v_end <= v_start THEN
            CONTINUE;
        END IF;

        FOR duplicate IN
            SELECT other_cycle.id AS cycle_id,
                   other_cycle.billing_grant_id
            FROM public.subscription_cycles other_cycle
            JOIN public.subscription_period_grants other_grant
              ON other_grant.id = other_cycle.billing_grant_id
            JOIN public.dodo_webhook_events other_event
              ON other_event.dodo_event_id = other_grant.source_event_id
             AND other_event.event_type IN ('payment.succeeded', 'invoice.paid')
            WHERE other_cycle.program_id = renewal.program_id
              AND other_cycle.id <> renewal.cycle_id
              AND other_cycle.state = 'pending'
              AND other_cycle.measurement_run_id IS NULL
              AND other_cycle.period_start < v_end
              AND other_cycle.period_end > v_start
              AND NOT EXISTS (
                  SELECT 1 FROM public.cycle_actions action_row
                  WHERE action_row.cycle_id = other_cycle.id
              )
              AND NOT EXISTS (
                  SELECT 1 FROM public.program_cost_events cost_row
                  WHERE cost_row.cycle_id = other_cycle.id
              )
        LOOP
            DELETE FROM public.subscription_cycles WHERE id = duplicate.cycle_id;
            DELETE FROM public.subscription_period_grants grant_row
            WHERE grant_row.id = duplicate.billing_grant_id
              AND NOT EXISTS (
                  SELECT 1 FROM public.subscription_cycles cycle_row
                  WHERE cycle_row.billing_grant_id = grant_row.id
              );
        END LOOP;

        UPDATE public.subscription_period_grants
        SET period_start = v_start,
            period_end = v_end
        WHERE id = renewal.billing_grant_id;

        UPDATE public.subscription_cycles
        SET period_start = v_start,
            period_end = v_end,
            updated_at = now()
        WHERE id = renewal.cycle_id;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.begin_subscription_cycle_measurement(
    p_cycle_id UUID,
    p_user_id UUID,
    p_brand_id UUID,
    p_audit_id UUID,
    p_subject_name TEXT,
    p_subject_domains TEXT[],
    p_competitors JSONB,
    p_engines TEXT[],
    p_country_code TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_cycle public.subscription_cycles%ROWTYPE;
    v_run_id UUID;
    v_prompt_count INTEGER;
BEGIN
    SELECT cycle_row.*
    INTO v_cycle
    FROM public.subscription_cycles cycle_row
    JOIN public.programs program_row
      ON program_row.id = cycle_row.program_id
     AND program_row.user_id = cycle_row.user_id
     AND program_row.brand_id = cycle_row.brand_id
     AND program_row.status = 'active'
    JOIN public.dodo_subscriptions subscription_row
      ON subscription_row.dodo_subscription_id = program_row.dodo_subscription_id
     AND subscription_row.user_id = cycle_row.user_id
     AND subscription_row.status = 'active'
    WHERE cycle_row.id = p_cycle_id
      AND cycle_row.user_id = p_user_id
      AND cycle_row.brand_id = p_brand_id
    FOR UPDATE OF cycle_row;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active paid subscription cycle not found';
    END IF;
    IF v_cycle.billing_grant_id IS NULL THEN
        RAISE EXCEPTION 'Subscription cycle has no authoritative billing grant';
    END IF;
    IF v_cycle.state <> 'pending' OR v_cycle.measurement_run_id IS NOT NULL THEN
        RAISE EXCEPTION 'Subscription cycle measurement is already claimed';
    END IF;
    IF now() < v_cycle.period_start OR now() >= v_cycle.period_end THEN
        RAISE EXCEPTION 'Subscription cycle is outside its authoritative billing period';
    END IF;
    IF NOT EXISTS (
        SELECT 1
        FROM public.topical_audits audit_row
        WHERE audit_row.id = p_audit_id
          AND audit_row.user_id = p_user_id
          AND audit_row.brand_id = p_brand_id
          AND audit_row.run_status = 'running'
    ) THEN
        RAISE EXCEPTION 'Measurement audit is not an open audit for this brand';
    END IF;

    SELECT count(*)
    INTO v_prompt_count
    FROM public.tracked_prompts prompt_row
    WHERE prompt_row.user_id = p_user_id
      AND prompt_row.brand_id = p_brand_id
      AND prompt_row.tracking_status = 'active';

    IF v_prompt_count <> 40 THEN
        RAISE EXCEPTION 'A subscription measurement requires exactly 40 active tracked questions';
    END IF;
    IF cardinality(COALESCE(p_engines, ARRAY[]::TEXT[])) = 0 THEN
        RAISE EXCEPTION 'A subscription measurement requires at least one configured engine';
    END IF;
    IF jsonb_typeof(COALESCE(p_competitors, '[]'::JSONB)) <> 'array' THEN
        RAISE EXCEPTION 'Tracked competitors must be a JSON array';
    END IF;

    INSERT INTO public.ai_probe_runs (
        user_id, brand_id, audit_id, subject_name, subject_domains,
        competitors, engines, country_code, status, phase, public_token
    ) VALUES (
        p_user_id, p_brand_id, p_audit_id, btrim(p_subject_name),
        COALESCE(p_subject_domains, ARRAY[]::TEXT[]),
        COALESCE(p_competitors, '[]'::JSONB), p_engines, p_country_code,
        'running', 'queued', NULL
    )
    RETURNING id INTO v_run_id;

    UPDATE public.subscription_cycles
    SET measurement_run_id = v_run_id,
        state = 'measuring',
        failure_code = NULL,
        updated_at = now()
    WHERE id = v_cycle.id;

    RETURN v_run_id;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_subscription_cycle_measurement(
    UUID, UUID, UUID, UUID, TEXT, TEXT[], JSONB, TEXT[], TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_subscription_cycle_measurement(
    UUID, UUID, UUID, UUID, TEXT, TEXT[], JSONB, TEXT[], TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_subscription_cycle_measurement_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
        RETURN NEW;
    END IF;

    IF NEW.status = 'completed' THEN
        UPDATE public.subscription_cycles
        SET state = 'awaiting_input',
            failure_code = NULL,
            updated_at = now()
        WHERE measurement_run_id = NEW.id
          AND state = 'measuring';
    ELSIF NEW.status = 'failed' THEN
        UPDATE public.subscription_cycles
        SET state = 'pending',
            measurement_run_id = NULL,
            failure_code = 'measurement_failed',
            updated_at = now()
        WHERE measurement_run_id = NEW.id
          AND state = 'measuring';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_subscription_cycle_measurement_state_trigger ON public.ai_probe_runs;
CREATE TRIGGER sync_subscription_cycle_measurement_state_trigger
    AFTER UPDATE OF status ON public.ai_probe_runs
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.sync_subscription_cycle_measurement_state();

REVOKE ALL ON FUNCTION public.sync_subscription_cycle_measurement_state()
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_subscription_cycle_measurement_state()
    TO service_role;
