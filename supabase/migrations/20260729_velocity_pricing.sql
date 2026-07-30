-- ============================================================================
-- Velocity pricing
-- ============================================================================
-- Replaces the single $79 "Authority Engine" plan with three tiers priced on
-- delivery rate rather than article count.
--
-- WHY THE PRICE MOVES UP, NOT DOWN:
-- AI-native SaaS retention splits sharply on price. Tools under $50/mo show
-- ~23% gross revenue retention (roughly a 9-month lifetime); tools above
-- $250/mo show ~70% (roughly 34 months). $79 sat in the tourist band, and
-- FlipAEO got tourist retention — 2 paying customers, all churned by month 5.
-- The premium price is a customer filter, not a feature claim.
--
-- WHY VELOCITY AND NOT SCOPE:
-- A flat price against a variable-size niche breaks in both directions: a
-- 60-gap niche is a 5-month customer, a 550-gap niche is 46 months of delivery
-- owed at a fixed fee. Selling clusters-per-month makes a large niche an
-- upsell instead of a liability, and margin stays flat because COGS scales
-- with articles shipped.
--
-- BEFORE RUNNING THIS:
--    1. Confirm these three Dodo product IDs still belong to the intended
--       sandbox/production account and map to Close, Accelerate, and Dominate.
--    2. Confirm `credits` against measured COGS per article — see the Step 0
--       note in docs/PIVOT.md. If an article costs more than ~$10 all-in, the
--       tier prices move up rather than the margins down.
--    The guard remains so a future copy cannot silently reintroduce placeholders.
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM (VALUES
            ('pdt_0NV99DNFmUKedWmvYBY6o'),
            ('pdt_0NkDNwESspunBR7xh0JCL'),
            ('pdt_0NkDO0sMN9Lu8VQKdhM7I')
        ) AS t(id)
        WHERE t.id LIKE 'REPLACE_WITH_%'
    ) THEN
        RAISE EXCEPTION
            'Dodo product IDs are still placeholders. Create the products first, then edit this migration.';
    END IF;
END $$;


-- Retire the old plan. Deactivated rather than deleted so existing
-- subscriptions keep resolving their plan name and price in the billing UI.
UPDATE dodo_pricing_plans
SET is_active = false,
    updated_at = now()
WHERE price = 79 OR name ILIKE '%authority engine%';


INSERT INTO dodo_pricing_plans (name, description, price, credits, currency, dodo_product_id, is_active, metadata)
VALUES
    (
        'Close',
        'Six-cluster program delivered one complete cluster per 30-day billing period.',
        249,
        15,
        'USD',
        'pdt_0NV99DNFmUKedWmvYBY6o',
        true,
        '{"tier": "close", "clusters_per_month": 1}'::jsonb
    ),
    (
        'Accelerate',
        'Six-cluster program delivered in complete batches, two clusters per 30-day billing period.',
        449,
        30,
        'USD',
        'pdt_0NkDNwESspunBR7xh0JCL',
        true,
        '{"tier": "accelerate", "clusters_per_month": 2}'::jsonb
    ),
    (
        'Dominate',
        'Six-cluster program delivered in complete batches, three clusters per 30-day billing period.',
        599,
        45,
        'USD',
        'pdt_0NkDO0sMN9Lu8VQKdhM7I',
        true,
        '{"tier": "dominate", "clusters_per_month": 3}'::jsonb
    )
ON CONFLICT DO NOTHING;


-- Guarded so a replay cannot abort here: COMMENT has no IF EXISTS, and a
-- comment is documentation, not schema. See the header of
-- `20260728_harvest_pool.sql` for the failure this pattern prevents.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'dodo_pricing_plans'
    ) THEN
        COMMENT ON TABLE dodo_pricing_plans IS
            'Finite six-cluster velocity tiers. Pricing changes delivery cadence, not scope.';
    END IF;
END $$;
