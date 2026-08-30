-- ============================================================================
-- POLARIS Atomic Expedition Leader Replacement RPC
-- Migration: 20260830184550_replace_expedition_leader.sql
-- Sub-Milestone: 6C.4
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Create SECURITY DEFINER Function: replace_expedition_leader
-- Executes atomic swap: soft-deactivating current leader and activating new leader
-- in a single PostgreSQL engine transaction with row-level locking.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.replace_expedition_leader(
    target_expedition_id UUID,
    new_leader_person_id UUID
)
RETURNS SETOF public.expedition_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_expedition public.expeditions%ROWTYPE;
    v_old_leader public.expedition_members%ROWTYPE;
    v_new_person public.persons%ROWTYPE;
    v_existing_member public.expedition_members%ROWTYPE;
    v_result public.expedition_members%ROWTYPE;
    v_now TIMESTAMPTZ := now();
BEGIN
    -- 1. Validate inputs
    IF target_expedition_id IS NULL OR new_leader_person_id IS NULL THEN
        RAISE EXCEPTION 'Target expedition ID and new leader person ID cannot be null'
            USING ERRCODE = '22000';
    END IF;

    -- 2. Authorization verification (Caller must be admin)
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: only administrators may replace expedition leaders'
            USING ERRCODE = '42501';
    END IF;

    -- 3. Verify target expedition exists and status allows replacement
    SELECT * INTO v_expedition
    FROM public.expeditions
    WHERE id = target_expedition_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Expedition % not found', target_expedition_id
            USING ERRCODE = '22000';
    END IF;

    IF v_expedition.status NOT IN ('DRAFT', 'PLANNED', 'ACTIVE') THEN
        RAISE EXCEPTION 'Leader replacement is not permitted on % expeditions', v_expedition.status
            USING ERRCODE = '22000';
    END IF;

    -- 4. Verify new person exists and is active
    SELECT * INTO v_new_person
    FROM public.persons
    WHERE id = new_leader_person_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Person % not found', new_leader_person_id
            USING ERRCODE = '22000';
    END IF;

    IF NOT v_new_person.active THEN
        RAISE EXCEPTION 'Person % is inactive', new_leader_person_id
            USING ERRCODE = '22000';
    END IF;

    -- 5. Lock and retrieve current active leader
    SELECT * INTO v_old_leader
    FROM public.expedition_members
    WHERE expedition_id = target_expedition_id
      AND assignment_role = 'EXPEDITION_LEADER'
      AND left_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No active leader found for expedition %', target_expedition_id
            USING ERRCODE = '22000';
    END IF;

    -- 6. Reject if new person is already the current active leader
    IF v_old_leader.person_id = new_leader_person_id THEN
        RAISE EXCEPTION 'Person % is already the active leader of expedition %', new_leader_person_id, target_expedition_id
            USING ERRCODE = '22000';
    END IF;

    -- 7. Soft-remove current active leader
    UPDATE public.expedition_members
    SET left_at = v_now,
        updated_at = v_now
    WHERE id = v_old_leader.id;

    -- 8. Check if new person already has a membership row (departed or active non-leader)
    SELECT * INTO v_existing_member
    FROM public.expedition_members
    WHERE expedition_id = target_expedition_id
      AND person_id = new_leader_person_id
    FOR UPDATE;

    IF FOUND THEN
        -- Rejoin / promote existing row
        UPDATE public.expedition_members
        SET left_at = NULL,
            joined_at = v_now,
            assignment_role = 'EXPEDITION_LEADER',
            updated_at = v_now
        WHERE id = v_existing_member.id
        RETURNING * INTO v_result;
    ELSE
        -- Insert fresh leader row
        INSERT INTO public.expedition_members (
            expedition_id,
            person_id,
            assignment_role,
            joined_at,
            left_at,
            created_at,
            updated_at
        ) VALUES (
            target_expedition_id,
            new_leader_person_id,
            'EXPEDITION_LEADER',
            v_now,
            NULL,
            v_now,
            v_now
        )
        RETURNING * INTO v_result;
    END IF;

    RETURN NEXT v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Privilege Hardening
-- ----------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.replace_expedition_leader(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.replace_expedition_leader(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.replace_expedition_leader(UUID, UUID) TO authenticated, service_role;
