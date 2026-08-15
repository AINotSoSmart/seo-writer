-- Retire the pre-pivot "free article credits" entitlement.
--
-- Why:
-- The closed-pool product does not sell or deliver individual credit-based
-- articles. Keeping a two-credit signup balance makes the public promise look
-- usable even though the ad-hoc generation APIs are intentionally retired.
--
-- How paid generation still works:
-- `subscription_period_grants` is the authoritative entitlement ledger.
-- `credits` remains only as a compatibility mirror for existing generation
-- code. `grant_subscription_period()` creates the durable grant before it
-- writes the mirror, so the guard below allows paid updates and rejects
-- unbacked signup/referral credits.

DO $$
BEGIN
    IF to_regclass('public.profiles') IS NOT NULL THEN
        ALTER TABLE public.profiles
            ALTER COLUMN credits_remaining SET DEFAULT 0;

        UPDATE public.profiles
        SET credits_remaining = 0
        WHERE COALESCE(subscription_tier, 'free') = 'free'
          AND COALESCE(credits_remaining, 0) <> 0;

        COMMENT ON COLUMN public.profiles.credits_remaining IS
            'Retired compatibility field. New free accounts receive no article credits.';
    END IF;

    IF to_regclass('public.credits') IS NOT NULL THEN
        ALTER TABLE public.credits
            ALTER COLUMN credits SET DEFAULT 0;

        -- The historical signup grant was two credits. Do not touch a balance
        -- backed by a paid billing-period grant.
        UPDATE public.credits AS c
        SET credits = 0
        WHERE c.credits > 0
          AND c.credits <= 2
          AND NOT EXISTS (
              SELECT 1
              FROM public.subscription_period_grants AS g
              WHERE g.user_id = c.user_id
          );

        COMMENT ON COLUMN public.credits.credits IS
            'Compatibility mirror of a paid subscription-period grant; not a customer-facing wallet.';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_legacy_credit_mirror()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF COALESCE(NEW.credits, 0) > 0
       AND NOT EXISTS (
           SELECT 1
           FROM public.subscription_period_grants AS g
           WHERE g.user_id = NEW.user_id
       )
    THEN
        NEW.credits := 0;
    END IF;

    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF to_regclass('public.credits') IS NOT NULL THEN
        DROP TRIGGER IF EXISTS guard_legacy_credit_mirror
            ON public.credits;

        CREATE TRIGGER guard_legacy_credit_mirror
        BEFORE INSERT OR UPDATE OF credits, user_id
        ON public.credits
        FOR EACH ROW
        EXECUTE FUNCTION public.guard_legacy_credit_mirror();
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_legacy_credit_mirror()
    FROM PUBLIC, anon, authenticated;
