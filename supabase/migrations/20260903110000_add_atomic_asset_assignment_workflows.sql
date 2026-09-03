-- ============================================================================
-- POLARIS Atomic Asset Assignment & Release Workflows
-- Migration: 20260903110000_add_atomic_asset_assignment_workflows.sql
-- Milestone: 7D — Atomic Asset Assignment & Release
--
-- Description:
--   Implements two SECURITY DEFINER PostgreSQL functions for atomic asset
--   lifecycle transitions:
--     1. assign_asset: Atomically assigns an AVAILABLE asset to a station
--        or expedition, creating an assignment record and transitioning
--        the asset to ASSIGNED status.
--     2. release_asset_assignment: Atomically releases an active assignment,
--        closing the assignment record and transitioning the asset back to
--        AVAILABLE status.
--
-- Architectural Rules:
--   - Both functions use SELECT ... FOR UPDATE row locking to prevent races.
--   - Both functions use SET LOCAL polaris.trusted_asset_workflow = 'true'
--     to signal the enforce_asset_immutability_and_lifecycle trigger.
--   - SET LOCAL is transaction-scoped — automatically reverts on COMMIT/ROLLBACK.
--   - All validation, authorization, and state transitions happen inside
--     the PostgreSQL engine transaction — no partial state is possible.
--   - EXECUTE revoked from PUBLIC and anon; granted to authenticated and
--     service_role only.
--   - Precedent: public.replace_expedition_leader() (Migration 20260830184550)
-- ============================================================================


-- ============================================================================
-- 1. ASSIGN ASSET
-- ============================================================================

CREATE OR REPLACE FUNCTION public.assign_asset(
    p_asset_id UUID,
    p_assignment_type TEXT,
    p_station_id UUID DEFAULT NULL,
    p_expedition_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS SETOF public.asset_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_asset public.assets%ROWTYPE;
    v_station public.stations%ROWTYPE;
    v_expedition public.expeditions%ROWTYPE;
    v_assignment public.asset_assignments%ROWTYPE;
    v_now TIMESTAMPTZ := now();
BEGIN
    -- 1. Input validation
    IF p_asset_id IS NULL THEN
        RAISE EXCEPTION 'Asset ID is required'
            USING ERRCODE = '22000';
    END IF;

    IF p_assignment_type IS NULL OR p_assignment_type NOT IN ('STATION_DEPLOYMENT', 'EXPEDITION_FIELD_OPERATION') THEN
        RAISE EXCEPTION 'Assignment type must be STATION_DEPLOYMENT or EXPEDITION_FIELD_OPERATION'
            USING ERRCODE = '22000';
    END IF;

    IF p_assignment_type = 'STATION_DEPLOYMENT' AND p_station_id IS NULL THEN
        RAISE EXCEPTION 'STATION_DEPLOYMENT requires a valid station_id'
            USING ERRCODE = '22000';
    END IF;

    IF p_assignment_type = 'EXPEDITION_FIELD_OPERATION' AND p_expedition_id IS NULL THEN
        RAISE EXCEPTION 'EXPEDITION_FIELD_OPERATION requires a valid expedition_id'
            USING ERRCODE = '22000';
    END IF;

    -- 2. Authorization: caller must be admin or expedition manager for the target expedition
    IF NOT public.is_admin() THEN
        IF p_assignment_type = 'EXPEDITION_FIELD_OPERATION' AND p_expedition_id IS NOT NULL THEN
            IF NOT public.is_expedition_manager_for(p_expedition_id) THEN
                RAISE EXCEPTION 'Unauthorized: only administrators or expedition managers may assign assets'
                    USING ERRCODE = '42501';
            END IF;
        ELSE
            RAISE EXCEPTION 'Unauthorized: only administrators may assign assets to stations'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 3. Lock and verify asset exists and is AVAILABLE
    SELECT * INTO v_asset
    FROM public.assets
    WHERE id = p_asset_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Asset % not found', p_asset_id
            USING ERRCODE = '22000';
    END IF;

    IF v_asset.status = 'RETIRED' THEN
        RAISE EXCEPTION 'Cannot assign a permanently RETIRED asset'
            USING ERRCODE = '22000';
    END IF;

    IF v_asset.status <> 'AVAILABLE' THEN
        RAISE EXCEPTION 'Asset is not available for assignment (current status: %)', v_asset.status
            USING ERRCODE = '22000';
    END IF;

    -- 4. Verify target exists
    IF p_station_id IS NOT NULL THEN
        SELECT * INTO v_station
        FROM public.stations
        WHERE id = p_station_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Station % not found', p_station_id
                USING ERRCODE = '22000';
        END IF;

        IF v_station.status <> 'ACTIVE' THEN
            RAISE EXCEPTION 'Station % is not active (status: %)', p_station_id, v_station.status
                USING ERRCODE = '22000';
        END IF;
    END IF;

    IF p_expedition_id IS NOT NULL THEN
        SELECT * INTO v_expedition
        FROM public.expeditions
        WHERE id = p_expedition_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Expedition % not found', p_expedition_id
                USING ERRCODE = '22000';
        END IF;

        IF v_expedition.status NOT IN ('PLANNED', 'ACTIVE') THEN
            RAISE EXCEPTION 'Expedition % is not in a state that accepts asset assignments (status: %)', p_expedition_id, v_expedition.status
                USING ERRCODE = '22000';
        END IF;
    END IF;

    -- 5. Enable trusted workflow signal (transaction-local, auto-reverts)
    PERFORM set_config('polaris.trusted_asset_workflow', 'true', true);

    -- 6. Update asset status to ASSIGNED and station_id if station deployment
    UPDATE public.assets
    SET status = 'ASSIGNED',
        station_id = CASE
            WHEN p_assignment_type = 'STATION_DEPLOYMENT' THEN p_station_id
            ELSE station_id
        END,
        updated_at = v_now
    WHERE id = p_asset_id;

    -- 7. Create the assignment record
    INSERT INTO public.asset_assignments (
        asset_id,
        expedition_id,
        station_id,
        assignment_type,
        assigned_at,
        released_at,
        notes,
        created_at,
        updated_at
    ) VALUES (
        p_asset_id,
        p_expedition_id,
        p_station_id,
        p_assignment_type,
        v_now,
        NULL,
        p_notes,
        v_now,
        v_now
    )
    RETURNING * INTO v_assignment;

    -- 8. Return the created assignment
    RETURN NEXT v_assignment;
END;
$$;

COMMENT ON FUNCTION public.assign_asset(UUID, TEXT, UUID, UUID, TEXT) IS
    'Atomically assigns an AVAILABLE asset to a station or expedition with full row locking, trusted workflow signaling, and invariant enforcement.';


-- ============================================================================
-- 2. RELEASE ASSET ASSIGNMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.release_asset_assignment(
    p_assignment_id UUID
)
RETURNS SETOF public.asset_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_assignment public.asset_assignments%ROWTYPE;
    v_asset public.assets%ROWTYPE;
    v_now TIMESTAMPTZ := now();
BEGIN
    -- 1. Input validation
    IF p_assignment_id IS NULL THEN
        RAISE EXCEPTION 'Assignment ID is required'
            USING ERRCODE = '22000';
    END IF;

    -- 2. Lock and verify assignment exists and is active
    SELECT * INTO v_assignment
    FROM public.asset_assignments
    WHERE id = p_assignment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assignment % not found', p_assignment_id
            USING ERRCODE = '22000';
    END IF;

    IF v_assignment.released_at IS NOT NULL THEN
        RAISE EXCEPTION 'Assignment % has already been released', p_assignment_id
            USING ERRCODE = '22000';
    END IF;

    -- 3. Authorization: caller must be admin or expedition manager for the assignment's expedition
    IF NOT public.is_admin() THEN
        IF v_assignment.expedition_id IS NOT NULL THEN
            IF NOT public.is_expedition_manager_for(v_assignment.expedition_id) THEN
                RAISE EXCEPTION 'Unauthorized: only administrators or the expedition manager may release this assignment'
                    USING ERRCODE = '42501';
            END IF;
        ELSE
            RAISE EXCEPTION 'Unauthorized: only administrators may release station assignments'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 4. Lock the associated asset
    SELECT * INTO v_asset
    FROM public.assets
    WHERE id = v_assignment.asset_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Associated asset % not found', v_assignment.asset_id
            USING ERRCODE = '22000';
    END IF;

    -- 5. Enable trusted workflow signal (transaction-local, auto-reverts)
    PERFORM set_config('polaris.trusted_asset_workflow', 'true', true);

    -- 6. Close the assignment
    UPDATE public.asset_assignments
    SET released_at = v_now,
        updated_at = v_now
    WHERE id = p_assignment_id
    RETURNING * INTO v_assignment;

    -- 7. Transition asset back to AVAILABLE
    --    Station policy: asset retains its current station_id on release.
    --    The station_id represents the physical location where the asset
    --    currently resides, not ownership. If the asset was deployed to a
    --    new station via STATION_DEPLOYMENT, it stays at that station.
    UPDATE public.assets
    SET status = 'AVAILABLE',
        updated_at = v_now
    WHERE id = v_assignment.asset_id;

    -- 8. Return the closed assignment
    RETURN NEXT v_assignment;
END;
$$;

COMMENT ON FUNCTION public.release_asset_assignment(UUID) IS
    'Atomically releases an active asset assignment, closing the assignment record and transitioning the asset back to AVAILABLE status with full row locking and trusted workflow signaling.';


-- ============================================================================
-- 3. PRIVILEGE HARDENING
-- ============================================================================

-- assign_asset
REVOKE ALL ON FUNCTION public.assign_asset(UUID, TEXT, UUID, UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_asset(UUID, TEXT, UUID, UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.assign_asset(UUID, TEXT, UUID, UUID, TEXT) TO authenticated, service_role;

-- release_asset_assignment
REVOKE ALL ON FUNCTION public.release_asset_assignment(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_asset_assignment(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.release_asset_assignment(UUID) TO authenticated, service_role;
