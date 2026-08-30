-- ==============================================================================
-- POLARIS Identity Database Foundation
-- Migration: create_identity_foundation
--
-- Description:
--   Establishes core application identity and user context objects:
--     1. app_role: Capability profile enum for POLARIS operational authorization
--     2. profiles: 1:1 application login account profile table linked to auth.users
--     3. persons: Adds foreign key from persons.auth_user_id to auth.users(id) (ON DELETE SET NULL)
--     4. handle_new_user: SECURITY DEFINER trigger function auto-provisioning default VIEWER profiles
--     5. on_auth_user_created: Trigger executing handle_new_user on auth.users INSERT
--
-- Architectural Rules:
--   - Single root identity: auth.users.id (no redundant persons -> profiles FK)
--   - Default role is strictly hardcoded to 'VIEWER' (zero client metadata privilege escalation)
--   - Operational identity (persons) preserved when auth account is deleted (ON DELETE SET NULL)
--   - Application login profile deleted when auth account is deleted (ON DELETE CASCADE)
--   - No RLS policies in this migration (deferred to Milestone 5C.4)
-- ==============================================================================

-- 1. APP ROLE ENUM
-- Defines the capability profiles for application users.
DO $$ BEGIN
    CREATE TYPE app_role AS ENUM (
        'SUPER_ADMIN',
        'COMMAND_ADMIN',
        'EXPEDITION_MANAGER',
        'STATION_OPERATOR',
        'VIEWER'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- 2. PROFILES TABLE
-- 1:1 application user profile linked directly to the Supabase auth.users root identity.
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    role app_role NOT NULL DEFAULT 'VIEWER',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.profiles IS 'Application user identity and capability profiles linked 1:1 to auth.users.';
COMMENT ON COLUMN public.profiles.id IS 'Primary key referencing auth.users.id (ON DELETE CASCADE).';
COMMENT ON COLUMN public.profiles.role IS 'Application capability profile determining authorized operational actions.';
COMMENT ON COLUMN public.profiles.active IS 'Administrative activation flag. Inactive profiles are immediately denied access.';


-- 3. PERSONS AUTH LINK
-- Foreign key linking operational field personnel to their optional authenticated user account.
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'persons_auth_user_id_fkey'
    ) THEN
        ALTER TABLE public.persons
            ADD CONSTRAINT persons_auth_user_id_fkey
            FOREIGN KEY (auth_user_id) REFERENCES auth.users(id)
            ON DELETE SET NULL;
    END IF;
END $$;


-- 4. PROFILE AUTO-PROVISIONING FUNCTION
-- Trigger function that automatically creates a baseline VIEWER profile upon new auth user creation.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    -- Hardcode role to 'VIEWER' and active to true.
    -- Explicitly ignores any raw_user_meta_data or client-supplied payload to prevent privilege escalation.
    INSERT INTO public.profiles (id, role, active, created_at, updated_at)
    VALUES (NEW.id, 'VIEWER'::public.app_role, true, now(), now())
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS 'Auto-provisions a default VIEWER profile upon new auth.users insertion. Ignores client metadata for security.';


-- 5. AUTH.USERS TRIGGER
-- Automatically executes handle_new_user after each auth.users insertion.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
