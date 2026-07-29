-- ============================================================================
-- Fix the Dominate tier so every tier divides the six-cluster scope evenly
-- ============================================================================
-- Dominate shipped 4 clusters per 30-day period. Six does not divide by four,
-- so the second billing period delivered only 2 clusters but still charged a
-- full $799. Net effect:
--
--     Close        6 periods x $249 = $1,494
--     Accelerate   3 periods x $449 = $1,347
--     Dominate     2 periods x $799 = $1,598   <- fastest AND most expensive
--
-- That made Close strictly dominated (slower *and* pricier than Accelerate) and
-- made the premium tier the worst value per cluster. Nobody could explain the
-- table, including the people who wrote it.
--
-- Three clusters per period divides six into exactly two whole periods:
--
--     Close        6 x $249 = $1,494   ($249.00/cluster)
--     Accelerate   3 x $449 = $1,347   ($224.50/cluster)
--     Dominate     2 x $599 = $1,198   ($199.67/cluster)
--
-- Per-cluster price now falls monotonically with speed — an ordinary volume
-- discount — and every subscription ends on a period boundary, which is what
-- `cancel_at_next_billing_date` needs to be clean. Dodo has no "limit billing
-- cycles" field on subscription creation, so landing on a whole period is the
-- only way to end a program without a partial-period refund.
--
-- BEFORE RUNNING THIS:
--   1. Create a $599/month product in the Dodo dashboard.
--   2. Replace REPLACE_WITH_DODO_PRODUCT_ID_DOMINATE_599 below with its id.
--   3. Archive the old $799 product in Dodo once no subscription references it.
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM (VALUES ('REPLACE_WITH_DODO_PRODUCT_ID_DOMINATE_599')) AS t(id)
        WHERE t.id LIKE 'REPLACE_WITH_%'
    ) THEN
        RAISE EXCEPTION
            'Create the $599 Dominate product in Dodo first, then set its id in this migration.';
    END IF;
END $$;


-- Retire the 4-cluster / $799 tier. Deactivated rather than deleted so any
-- existing subscription can still resolve its plan name and price.
UPDATE dodo_pricing_plans
SET is_active = false,
    updated_at = now()
WHERE price = 799
   OR metadata->>'clusters_per_month' = '4';


INSERT INTO dodo_pricing_plans (name, description, price, credits, currency, dodo_product_id, is_active, metadata)
VALUES
    (
        'Dominate',
        'Six-cluster program delivered in complete batches, three clusters per 30-day billing period. Two periods total.',
        599,
        45,
        'USD',
        'REPLACE_WITH_DODO_PRODUCT_ID_DOMINATE_599',
        true,
        '{"tier": "dominate", "clusters_per_month": 3, "billing_periods": 2}'::jsonb
    )
ON CONFLICT DO NOTHING;


-- Record the period count on the surviving tiers so the invariant is visible
-- in the data, not only in application code.
UPDATE dodo_pricing_plans
SET metadata = metadata || '{"billing_periods": 6}'::jsonb, updated_at = now()
WHERE is_active AND metadata->>'tier' = 'close';

UPDATE dodo_pricing_plans
SET metadata = metadata || '{"billing_periods": 3}'::jsonb, updated_at = now()
WHERE is_active AND metadata->>'tier' = 'accelerate';


COMMENT ON TABLE dodo_pricing_plans IS
    'Finite six-cluster velocity tiers. clusters_per_month must divide 6 exactly '
    '(1, 2 or 3) so the subscription ends on a whole billing period. Pricing '
    'changes delivery cadence, never scope.';
