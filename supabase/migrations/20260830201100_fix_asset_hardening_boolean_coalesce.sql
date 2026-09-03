-- Migration: 20260830201100_fix_asset_hardening_boolean_coalesce.sql
-- Description: Updates enforce_asset_immutability_and_lifecycle trigger function
--              to defend against three-valued logic (NULL) on trusted workflow setting.

CREATE OR REPLACE FUNCTION public.enforce_asset_immutability_and_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role public.app_role;
  v_is_trusted_workflow boolean;
BEGIN
  -- Read-only evaluation of transaction-local trusted workflow signal (defend against NULL three-valued logic)
  v_is_trusted_workflow := (COALESCE(current_setting('polaris.trusted_asset_workflow', true), 'false') = 'true');

  -- 1. IMMUTABLE SYSTEM & BUSINESS IDENTIFIERS
  IF NEW.id <> OLD.id THEN
    RAISE EXCEPTION 'Asset id is immutable'
      USING ERRCODE = '22000';
  END IF;

  IF NEW.asset_code <> OLD.asset_code THEN
    RAISE EXCEPTION 'Asset code is immutable and cannot be modified'
      USING ERRCODE = '22000';
  END IF;

  -- 2. IMMUTABLE DATA CLASSIFICATION
  IF NEW.data_classification <> OLD.data_classification THEN
    RAISE EXCEPTION 'Asset data_classification is immutable and cannot be modified'
      USING ERRCODE = '22000';
  END IF;

  -- 3. IMMUTABLE PHYSICAL STATION LOCATION (outside authorized assignment/relocation workflows)
  IF NEW.station_id IS DISTINCT FROM OLD.station_id AND NOT v_is_trusted_workflow THEN
    RAISE EXCEPTION 'Asset station_id is immutable outside authorized assignment workflows'
      USING ERRCODE = '22000';
  END IF;

  -- 4. TERMINAL RETIRED PROTECTION
  -- Once an asset is RETIRED, no column may be modified and no status reactivation is permitted.
  IF OLD.status = 'RETIRED' THEN
    RAISE EXCEPTION 'Cannot modify or reactivate a permanently RETIRED asset'
      USING ERRCODE = '22000';
  END IF;

  -- 5. STATUS TRANSITION LIFECYCLE & RETIREMENT AUTHORIZATION
  IF NEW.status <> OLD.status THEN
    IF NEW.status = 'RETIRED' THEN
      -- Only SUPER_ADMIN is authorized to retire assets
      v_role := public.current_user_role();
      IF v_role IS NULL OR v_role <> 'SUPER_ADMIN' THEN
        RAISE EXCEPTION 'Only SUPER_ADMIN is authorized to transition an asset to RETIRED'
          USING ERRCODE = '42501';
      END IF;
    ELSIF NOT v_is_trusted_workflow THEN
      -- Direct status transitions to ASSIGNED, IN_USE, or MAINTENANCE are forbidden outside trusted workflows
      RAISE EXCEPTION 'Direct status transition from % to % is not permitted outside authorized workflows',
        OLD.status, NEW.status
        USING ERRCODE = '22000';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_asset_immutability_and_lifecycle() FROM PUBLIC, anon, authenticated;
