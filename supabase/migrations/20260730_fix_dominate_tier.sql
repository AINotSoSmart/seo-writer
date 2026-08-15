-- ============================================================================
-- SUPERSEDED — this migration is intentionally a no-op
-- ============================================================================
-- It was written to correct the Dominate tier from 4 clusters/month at $799 to
-- 3 at $599. That correction was instead applied directly to the seed in
-- `20260729_velocity_pricing.sql` before it was run, so the live table already
-- holds the intended rows:
--
--     Close        1 cluster/month  x 6 periods x $249 = $1,494  ($249.00/cluster)
--     Accelerate   2 clusters/month x 3 periods x $449 = $1,347  ($224.50/cluster)
--     Dominate     3 clusters/month x 2 periods x $599 = $1,198  ($199.67/cluster)
--
-- Executing the original body now would be actively harmful. Its retirement
-- clause (`WHERE price = 799 OR clusters_per_month = '4'`) matches nothing, so
-- the INSERT would add a SECOND active Dominate row and make plan lookup
-- ambiguous at checkout.
--
-- Kept rather than deleted because the reasoning below is the justification for
-- the current price table, and because deleting a migration other databases may
-- have recorded creates its own drift.
--
-- ----------------------------------------------------------------------------
-- WHY THESE NUMBERS (retained)
-- ----------------------------------------------------------------------------
-- Six does not divide by four. At 4 clusters/month the second billing period
-- delivered only 2 clusters but still charged a full $799:
--
--     Close        6 x $249 = $1,494
--     Accelerate   3 x $449 = $1,347
--     Dominate     2 x $799 = $1,598   <- fastest AND most expensive
--
-- That made Close strictly dominated — slower *and* pricier than Accelerate —
-- and made the premium tier the worst value per cluster. Nobody could explain
-- the table, including the people who wrote it.
--
-- Three clusters per period divides six into exactly two whole periods, so
-- per-cluster price now falls monotonically with speed (an ordinary volume
-- discount) and every subscription ends on a period boundary. Dodo has no
-- "limit billing cycles" field on subscription creation, so landing on a whole
-- period is the only way to end a program without a partial-period refund —
-- see `lib/harvest/billing-lifecycle.ts` and `cancel_at_next_billing_date`.
--
-- The invariant is enforced by `npm run test:pivot-contract`, which asserts
-- clustersPerMonth x billingPeriods == programClusters for every tier in
-- `config/product-truth.ts`.
-- ============================================================================


-- The only surviving statement: record the invariant on the table itself, so it
-- is visible to anyone reading the schema rather than only in application code.
-- Guarded because COMMENT has no IF EXISTS and must never abort a replay.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'dodo_pricing_plans'
    ) THEN
        COMMENT ON TABLE dodo_pricing_plans IS
            'Finite six-cluster velocity tiers. clusters_per_month must divide 6 exactly '
            '(1, 2 or 3) so the subscription ends on a whole billing period. Pricing '
            'changes delivery cadence, never scope.';
    END IF;
END $$;
