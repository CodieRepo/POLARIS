-- ============================================================================
-- POLARIS PostgreSQL Row-Level Security & Helper Functions Migration
-- Migration: 20260830154453_enable_rls_and_policies.sql
-- Sub-Milestone: 5C.4A
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Performance Indexes Supporting RLS Policy Lookups
-- ----------------------------------------------------------------------------

-- Supports active expedition-scoped asset & maintenance policy traversal.
-- Filters out historical closed allocations to optimize policy evaluation.
CREATE INDEX IF NOT EXISTS idx_asset_assignments_active_exp
  ON public.asset_assignments (asset_id, expedition_id)
  WHERE released_at IS NULL;

-- ----------------------------------------------------------------------------
-- 2. SECURITY DEFINER Helper Functions
-- ----------------------------------------------------------------------------

-- 2.1 Current User Role Helper
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
    AND active = true;
$$;

-- 2.2 Admin Check Helper (SUPER_ADMIN or COMMAND_ADMIN)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT public.current_user_role() IN ('SUPER_ADMIN', 'COMMAND_ADMIN');
$$;

-- 2.3 Current User Field Person ID Helper
CREATE OR REPLACE FUNCTION public.current_user_person_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT id
  FROM public.persons
  WHERE auth_user_id = auth.uid()
    AND active = true;
$$;

-- 2.4 Active Expedition Manager Authorization Helper
CREATE OR REPLACE FUNCTION public.is_expedition_manager_for(target_expedition_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT (public.current_user_role() = 'EXPEDITION_MANAGER') AND EXISTS (
    SELECT 1
    FROM public.expedition_members em
    JOIN public.persons p ON p.id = em.person_id
    WHERE em.expedition_id = target_expedition_id
      AND p.auth_user_id = auth.uid()
      AND p.active = true
      AND em.left_at IS NULL
  );
$$;

-- ----------------------------------------------------------------------------
-- 3. Function Privilege Hardening (Revoke Public, Grant Authenticated & Service Role)
-- ----------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.current_user_person_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_person_id() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_expedition_manager_for(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_expedition_manager_for(UUID) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. Enable Row-Level Security on All 11 Public Tables
-- ----------------------------------------------------------------------------

ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expeditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expedition_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 5. Row-Level Security Policies
-- ----------------------------------------------------------------------------

-- ============================================================================
-- 5.1 public.profiles
-- Rule: Single non-recursive self-read. No direct INSERT, UPDATE, or DELETE.
-- ============================================================================

CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- ============================================================================
-- 5.2 public.data_sources
-- Rule: Reference provider registry. Active users read; Admins mutate; Super Admin deletes.
-- ============================================================================

CREATE POLICY "data_sources_select"
  ON public.data_sources
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() IS NOT NULL);

CREATE POLICY "data_sources_insert"
  ON public.data_sources
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "data_sources_update"
  ON public.data_sources
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "data_sources_delete"
  ON public.data_sources
  FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'SUPER_ADMIN');

-- ============================================================================
-- 5.3 public.stations
-- Rule: Reference station catalog. Active users read; Admins mutate; Super Admin deletes.
-- ============================================================================

CREATE POLICY "stations_select"
  ON public.stations
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() IS NOT NULL);

CREATE POLICY "stations_insert"
  ON public.stations
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "stations_update"
  ON public.stations
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "stations_delete"
  ON public.stations
  FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'SUPER_ADMIN');

-- ============================================================================
-- 5.4 public.persons
-- Rule: Directory of field personnel. Active users read; Admins mutate; Super Admin deletes.
-- Option A: Direct self-update is DENIED to protect auth_user_id, active, and operational titles.
-- ============================================================================

CREATE POLICY "persons_select"
  ON public.persons
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() IS NOT NULL);

CREATE POLICY "persons_insert"
  ON public.persons
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "persons_update"
  ON public.persons
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "persons_delete"
  ON public.persons
  FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'SUPER_ADMIN');

-- ============================================================================
-- 5.5 public.expeditions
-- Rule: Field operations. Active users read; Admins create; Admins & assigned managers update; Super Admin deletes DRAFT.
-- ============================================================================

CREATE POLICY "expeditions_select"
  ON public.expeditions
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() IS NOT NULL);

CREATE POLICY "expeditions_insert"
  ON public.expeditions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "expeditions_update"
  ON public.expeditions
  FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR public.is_expedition_manager_for(id))
  WITH CHECK (public.is_admin() OR public.is_expedition_manager_for(id));

CREATE POLICY "expeditions_delete"
  ON public.expeditions
  FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'SUPER_ADMIN' AND status = 'DRAFT');

-- ============================================================================
-- 5.6 public.expedition_members
-- Rule: Expedition personnel rosters. Active users read; Admins & assigned managers manage.
-- ============================================================================

CREATE POLICY "expedition_members_select"
  ON public.expedition_members
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() IS NOT NULL);

CREATE POLICY "expedition_members_insert"
  ON public.expedition_members
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() OR public.is_expedition_manager_for(expedition_id));

CREATE POLICY "expedition_members_update"
  ON public.expedition_members
  FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR public.is_expedition_manager_for(expedition_id))
  WITH CHECK (public.is_admin() OR public.is_expedition_manager_for(expedition_id));

CREATE POLICY "expedition_members_delete"
  ON public.expedition_members
  FOR DELETE
  TO authenticated
  USING (public.is_admin() OR public.is_expedition_manager_for(expedition_id));

-- ============================================================================
-- 5.7 public.assets
-- Rule: Equipment tracking. Active users read; Admins create; Admins & managers with active assignment update.
-- ============================================================================

CREATE POLICY "assets_select"
  ON public.assets
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() IS NOT NULL);

CREATE POLICY "assets_insert"
  ON public.assets
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "assets_update"
  ON public.assets
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1
      FROM public.asset_assignments aa
      WHERE aa.asset_id = public.assets.id
        AND aa.released_at IS NULL
        AND aa.expedition_id IS NOT NULL
        AND public.is_expedition_manager_for(aa.expedition_id)
    )
  )
  WITH CHECK (
    public.is_admin() OR EXISTS (
      SELECT 1
      FROM public.asset_assignments aa
      WHERE aa.asset_id = public.assets.id
        AND aa.released_at IS NULL
        AND aa.expedition_id IS NOT NULL
        AND public.is_expedition_manager_for(aa.expedition_id)
    )
  );

CREATE POLICY "assets_delete"
  ON public.assets
  FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'SUPER_ADMIN');

-- ============================================================================
-- 5.8 public.asset_assignments
-- Rule: Allocation ledger. Active users read; Admins & managers allocate/release in managed expeditions.
-- ============================================================================

CREATE POLICY "asset_assignments_select"
  ON public.asset_assignments
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() IS NOT NULL);

CREATE POLICY "asset_assignments_insert"
  ON public.asset_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin() OR (
      expedition_id IS NOT NULL AND public.is_expedition_manager_for(expedition_id)
    )
  );

CREATE POLICY "asset_assignments_update"
  ON public.asset_assignments
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin() OR (
      expedition_id IS NOT NULL AND public.is_expedition_manager_for(expedition_id)
    )
  )
  WITH CHECK (
    public.is_admin() OR (
      expedition_id IS NOT NULL AND public.is_expedition_manager_for(expedition_id)
    )
  );

CREATE POLICY "asset_assignments_delete"
  ON public.asset_assignments
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- 5.9 public.maintenance_records
-- Rule: Equipment servicing logs. Active users read; Admins & assigned managers log work orders.
-- ============================================================================

CREATE POLICY "maintenance_records_select"
  ON public.maintenance_records
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() IS NOT NULL);

CREATE POLICY "maintenance_records_insert"
  ON public.maintenance_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin() OR EXISTS (
      SELECT 1
      FROM public.asset_assignments aa
      WHERE aa.asset_id = public.maintenance_records.asset_id
        AND aa.released_at IS NULL
        AND aa.expedition_id IS NOT NULL
        AND public.is_expedition_manager_for(aa.expedition_id)
    )
  );

CREATE POLICY "maintenance_records_update"
  ON public.maintenance_records
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1
      FROM public.asset_assignments aa
      WHERE aa.asset_id = public.maintenance_records.asset_id
        AND aa.released_at IS NULL
        AND aa.expedition_id IS NOT NULL
        AND public.is_expedition_manager_for(aa.expedition_id)
    )
  )
  WITH CHECK (
    public.is_admin() OR EXISTS (
      SELECT 1
      FROM public.asset_assignments aa
      WHERE aa.asset_id = public.maintenance_records.asset_id
        AND aa.released_at IS NULL
        AND aa.expedition_id IS NOT NULL
        AND public.is_expedition_manager_for(aa.expedition_id)
    )
  );

CREATE POLICY "maintenance_records_delete"
  ON public.maintenance_records
  FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'SUPER_ADMIN');

-- ============================================================================
-- 5.10 public.inventory_items
-- Rule: Consumable inventory catalog. Active users read; Admins create, update, delete.
-- ============================================================================

CREATE POLICY "inventory_items_select"
  ON public.inventory_items
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() IS NOT NULL);

CREATE POLICY "inventory_items_insert"
  ON public.inventory_items
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "inventory_items_update"
  ON public.inventory_items
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "inventory_items_delete"
  ON public.inventory_items
  FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'SUPER_ADMIN');

-- ============================================================================
-- 5.11 public.inventory_transactions (Immutable Audit Ledger)
-- Rule: Stock movement audit log. Active users read; Admins insert; Zero UPDATE and Zero DELETE.
-- ============================================================================

CREATE POLICY "inventory_transactions_select"
  ON public.inventory_transactions
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() IS NOT NULL);

CREATE POLICY "inventory_transactions_insert"
  ON public.inventory_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Zero FOR UPDATE policies created (Denies all updates)
-- Zero FOR DELETE policies created (Denies all deletes)
