-- ============================================================================
-- POLARIS Security Definer Anonymous Execute Hardening
-- Migration: 20260830161834_harden_helper_function_privileges.sql
-- Sub-Milestone: 5C.4C
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Explicitly Revoke Execution Privileges From 'anon' Role on Helper Functions
-- ----------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_person_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_expedition_manager_for(UUID) FROM anon;

-- ----------------------------------------------------------------------------
-- 2. Harden Default Schema Privileges for Functions in 'public' Schema
-- Prevents newly created functions by 'postgres' from automatically granting EXECUTE to 'anon'.
-- ----------------------------------------------------------------------------

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon;
