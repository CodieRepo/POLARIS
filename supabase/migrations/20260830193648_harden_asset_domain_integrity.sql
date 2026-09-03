-- ============================================================================
-- POLARIS Asset Domain Integrity Hardening
-- Migration: 20260830193648_harden_asset_domain_integrity.sql
-- Sub-Milestone: 7A Database Hardening
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enforce Allowed Assignment Types on asset_assignments
-- ----------------------------------------------------------------------------

ALTER TABLE public.asset_assignments
  ADD CONSTRAINT asset_assignments_assignment_type_check
  CHECK (
    assignment_type IN (
      'STATION_DEPLOYMENT',
      'EXPEDITION_FIELD_OPERATION'
    )
  );

-- ----------------------------------------------------------------------------
-- 2. Enforce Allowed Maintenance Types on maintenance_records
-- ----------------------------------------------------------------------------

ALTER TABLE public.maintenance_records
  ADD CONSTRAINT maintenance_records_maintenance_type_check
  CHECK (
    maintenance_type IN (
      'PREVENTIVE',
      'CORRECTIVE',
      'INSPECTION'
    )
  );
