-- ============================================================================
-- POLARIS Expedition Lifecycle Prerequisites & State Machine Hardening
-- Migration: 20260830180218_harden_expedition_lifecycle_prerequisites.sql
-- Sub-Milestone: 6B.3 Integrity Hardening
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Replace Trigger Function: enforce_expedition_status_transition
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_expedition_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- If status is unchanged, allow normal metadata update
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- 1. Validate allowed forward state transitions
  IF NOT (
    (OLD.status = 'DRAFT' AND NEW.status IN ('PLANNED', 'CANCELLED')) OR
    (OLD.status = 'PLANNED' AND NEW.status IN ('ACTIVE', 'CANCELLED')) OR
    (OLD.status = 'ACTIVE' AND NEW.status IN ('COMPLETED', 'CANCELLED')) OR
    (OLD.status = 'COMPLETED' AND NEW.status = 'ARCHIVED') OR
    (OLD.status = 'CANCELLED' AND NEW.status = 'ARCHIVED')
  ) THEN
    RAISE EXCEPTION 'Invalid expedition status transition from % to %', OLD.status, NEW.status
      USING ERRCODE = '22000';
  END IF;

  -- 2. Validate DRAFT -> PLANNED prerequisites
  IF OLD.status = 'DRAFT' AND NEW.status = 'PLANNED' THEN
    IF NEW.destination_station_id IS NULL OR
       NEW.planned_start_at IS NULL OR
       NEW.planned_end_at IS NULL OR
       NEW.planned_end_at <= NEW.planned_start_at THEN
      RAISE EXCEPTION 'Expedition cannot transition to PLANNED: invalid destination station or planned dates'
        USING ERRCODE = '22000';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.expedition_members
      WHERE expedition_id = NEW.id
        AND assignment_role = 'EXPEDITION_LEADER'
        AND left_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Expedition cannot transition to PLANNED without an active assigned EXPEDITION_LEADER'
        USING ERRCODE = '22000';
    END IF;
  END IF;

  -- 3. Validate PLANNED -> ACTIVE prerequisites
  IF OLD.status = 'PLANNED' AND NEW.status = 'ACTIVE' THEN
    IF NEW.actual_start_at IS NULL THEN
      RAISE EXCEPTION 'Expedition cannot transition to ACTIVE without actual_start_at timestamp'
        USING ERRCODE = '22000';
    END IF;
  END IF;

  -- 4. Validate ACTIVE -> COMPLETED prerequisites
  IF OLD.status = 'ACTIVE' AND NEW.status = 'COMPLETED' THEN
    IF NEW.actual_end_at IS NULL OR NEW.actual_start_at IS NULL OR NEW.actual_end_at < NEW.actual_start_at THEN
      RAISE EXCEPTION 'Expedition cannot transition to COMPLETED: missing timestamps or actual_end_at before actual_start_at'
        USING ERRCODE = '22000';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
