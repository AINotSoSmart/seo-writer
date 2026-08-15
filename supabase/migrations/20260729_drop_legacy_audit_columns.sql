-- The onboarding and public audit read paths now use the evidence-backed
-- closed-pool tables. Remove the model-invented blueprint result shape so it
-- cannot accidentally become a second source of truth again.

ALTER TABLE public.topical_audits
    DROP COLUMN IF EXISTS niche_blueprint,
    DROP COLUMN IF EXISTS user_coverage,
    DROP COLUMN IF EXISTS competitor_coverages,
    DROP COLUMN IF EXISTS pillar_scores,
    DROP COLUMN IF EXISTS gap_matrix,
    DROP COLUMN IF EXISTS pillar_suggestions,
    DROP COLUMN IF EXISTS projected_score;
