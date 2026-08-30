-- ============================================================================
-- POLARIS Expedition Membership Integrity Hardening
-- Migration: 20260830182425_harden_expedition_membership_integrity.sql
-- Sub-Milestone: 6C.1
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Active Leader Uniqueness Partial Unique Index
-- Ensures at most one active EXPEDITION_LEADER per expedition.
-- ----------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_expedition_leader
  ON public.expedition_members (expedition_id)
  WHERE assignment_role = 'EXPEDITION_LEADER'
    AND left_at IS NULL;

-- ----------------------------------------------------------------------------
-- 2. Assignment Role CHECK Constraint
-- Restricts assignment_role to validated domain roles.
-- ----------------------------------------------------------------------------

ALTER TABLE public.expedition_members
  ADD CONSTRAINT expedition_members_assignment_role_check
  CHECK (
    assignment_role IN (
      'EXPEDITION_LEADER',
      'EXPEDITION_MEMBER'
    )
  );
