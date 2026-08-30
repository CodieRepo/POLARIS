-- ============================================================================
-- POLARIS Expedition Status State Machine Integrity Trigger
-- Migration: 20260830174054_enforce_expedition_status_transitions.sql
-- Sub-Milestone: 6B.1
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Trigger Function: enforce_expedition_status_transition
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_expedition_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- If status is unchanged, allow the update
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Validate allowed forward state transitions
  IF (OLD.status = 'DRAFT' AND NEW.status IN ('PLANNED', 'CANCELLED')) OR
     (OLD.status = 'PLANNED' AND NEW.status IN ('ACTIVE', 'CANCELLED')) OR
     (OLD.status = 'ACTIVE' AND NEW.status IN ('COMPLETED', 'CANCELLED')) OR
     (OLD.status = 'COMPLETED' AND NEW.status = 'ARCHIVED') OR
     (OLD.status = 'CANCELLED' AND NEW.status = 'ARCHIVED') THEN
    RETURN NEW;
  END IF;

  -- Reject all other unapproved, backward, or skipped transitions
  RAISE EXCEPTION 'Invalid expedition status transition from % to %', OLD.status, NEW.status
    USING ERRCODE = '22000';
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Trigger: trg_enforce_expedition_status_transition
-- ----------------------------------------------------------------------------

CREATE TRIGGER trg_enforce_expedition_status_transition
  BEFORE UPDATE ON public.expeditions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_expedition_status_transition();
