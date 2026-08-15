-- ============================================================================
-- Repair confirmed capability-contract synchronization
-- ============================================================================
-- 20260807's first production form patched confirm_brand_scope by replacing
-- fragments of pg_get_functiondef(). On one valid function format it inserted
-- the new validation but missed the INSERT columns/values. The brand JSON was
-- therefore correct while brand_scope_families.capability_contract stayed NULL.
--
-- Keep this as a separate migration because production may already have marked
-- 20260807 as applied. The definitions are intentionally idempotent and match
-- the safe definitions retained in 20260807 for clean installations.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.hydrate_brand_scope_capability_contract()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_contract JSONB;
BEGIN
    IF NEW.capability_contract IS NOT NULL THEN
        RETURN NEW;
    END IF;

    SELECT family->'capability_contract'
    INTO v_contract
    FROM public.brand_details bd
    CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(bd.brand_data->'scope_families', '[]'::jsonb)
    ) AS family
    WHERE bd.id = NEW.brand_id
      AND (
          COALESCE(family->>'id', '') = NEW.id::text
          OR lower(btrim(COALESCE(family->>'name', ''))) = lower(btrim(NEW.name))
      )
      AND jsonb_typeof(family->'capability_contract') = 'object'
      AND family->'capability_contract'->>'version' = 'capability-v1'
    LIMIT 1;

    NEW.capability_contract := v_contract;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hydrate_brand_scope_capability_contract ON public.brand_scope_families;
CREATE TRIGGER trg_hydrate_brand_scope_capability_contract
BEFORE INSERT ON public.brand_scope_families
FOR EACH ROW EXECUTE FUNCTION public.hydrate_brand_scope_capability_contract();

CREATE OR REPLACE FUNCTION public.sync_brand_scope_capability_contracts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.brand_data IS NOT DISTINCT FROM OLD.brand_data THEN
        RETURN NEW;
    END IF;

    UPDATE public.brand_scope_families sf
    SET capability_contract = family->'capability_contract',
        updated_at = now()
    FROM jsonb_array_elements(
        COALESCE(NEW.brand_data->'scope_families', '[]'::jsonb)
    ) AS family
    WHERE sf.brand_id = NEW.id
      AND (
          COALESCE(family->>'id', '') = sf.id::text
          OR lower(btrim(COALESCE(family->>'name', ''))) = lower(btrim(sf.name))
      )
      AND jsonb_typeof(family->'capability_contract') = 'object'
      AND family->'capability_contract'->>'version' = 'capability-v1'
      AND sf.capability_contract IS DISTINCT FROM family->'capability_contract';

    IF NEW.scope_contract_version = 'confirmed-business-scope-v2'
       AND EXISTS (
           SELECT 1
           FROM public.brand_scope_families sf
           WHERE sf.brand_id = NEW.id
             AND sf.enabled = TRUE
             AND (
                 jsonb_typeof(sf.capability_contract) IS DISTINCT FROM 'object'
                 OR sf.capability_contract->>'version' <> 'capability-v1'
             )
       )
    THEN
        RAISE EXCEPTION 'Every confirmed product area requires capability-v1 mechanics';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_brand_scope_capability_contracts ON public.brand_details;
CREATE TRIGGER trg_sync_brand_scope_capability_contracts
AFTER INSERT OR UPDATE OF brand_data ON public.brand_details
FOR EACH ROW EXECUTE FUNCTION public.sync_brand_scope_capability_contracts();

-- Repair every existing split-brain row from its exact confirmed snapshot.
UPDATE public.brand_scope_families sf
SET capability_contract = family->'capability_contract',
    updated_at = now()
FROM public.brand_details bd
CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(bd.brand_data->'scope_families', '[]'::jsonb)
) AS family
WHERE sf.brand_id = bd.id
  AND (
      COALESCE(family->>'id', '') = sf.id::text
      OR lower(btrim(COALESCE(family->>'name', ''))) = lower(btrim(sf.name))
  )
  AND jsonb_typeof(family->'capability_contract') = 'object'
  AND family->'capability_contract'->>'version' = 'capability-v1'
  AND sf.capability_contract IS DISTINCT FROM family->'capability_contract';



