-- ==============================================================================
-- POLARIS Expedition Domain Database Schema
-- Migration: create_expedition_domain
--
-- Description:
--   Establishes expedition management and personnel entities:
--     1. persons: Operational identity for expedition personnel and researchers
--     2. expedition_status: Lifecycle status enum for polar expeditions
--     3. data_classification: Provenance and data fidelity tier classification enum
--     4. expeditions: Expedition operational lifecycles, route nodes, and schedules
--     5. expedition_members: Person-to-expedition roster and assignment roles
--
-- Architectural Rules:
--   - Operational identity (persons) is distinct from application authorization
--   - persons.auth_user_id is nullable and unique (unlinked field personnel support)
--   - RESTRICT delete behavior on station and person references
--   - CASCADE delete behavior only on expedition_members subordinate to expeditions
--   - No RLS policies in this migration (deferred to auth milestone)
--   - No seed data in this migration (deferred to seed milestone)
-- ==============================================================================

-- 1. PERSONS
-- Operational personnel directory (scientists, logisticians, station operators, contractors).
CREATE TABLE IF NOT EXISTS persons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID,
    display_name TEXT NOT NULL,
    role_title TEXT,
    organization TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT persons_auth_user_id_key UNIQUE (auth_user_id)
);

COMMENT ON TABLE persons IS 'Master registry of operational personnel participating in polar expeditions and station operations.';
COMMENT ON COLUMN persons.auth_user_id IS 'Optional link to Supabase authenticated user account (nullable + unique). Unlinked persons represent field personnel without application logins.';
COMMENT ON COLUMN persons.role_title IS 'Operational/scientific job title (e.g., Chief Scientist, Station Leader, Mechanical Engineer).';
COMMENT ON COLUMN persons.organization IS 'Affiliated institute, agency, or contractor organization (e.g., NCPOR, IMD, Survey of India).';


-- 2. EXPEDITION ENUMS
-- Lifecycle status of an expedition
DO $$ BEGIN
    CREATE TYPE expedition_status AS ENUM (
        'DRAFT',
        'PLANNED',
        'ACTIVE',
        'COMPLETED',
        'CANCELLED',
        'ARCHIVED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Data fidelity classification layer (Authoritative vs External vs Synthetic/Simulated vs Derived)
DO $$ BEGIN
    CREATE TYPE data_classification AS ENUM (
        'AUTHORITATIVE_REAL',
        'EXTERNAL_REAL',
        'SIMULATED',
        'DERIVED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- 3. EXPEDITIONS
-- Polar expedition operational master record, schedule, and destination tracking.
CREATE TABLE IF NOT EXISTS expeditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    status expedition_status NOT NULL DEFAULT 'DRAFT',
    origin_station_id UUID,
    destination_station_id UUID NOT NULL,
    planned_start_at TIMESTAMPTZ NOT NULL,
    planned_end_at TIMESTAMPTZ NOT NULL,
    actual_start_at TIMESTAMPTZ,
    actual_end_at TIMESTAMPTZ,
    description TEXT,
    data_classification data_classification NOT NULL DEFAULT 'SIMULATED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT expeditions_code_key UNIQUE (code),
    CONSTRAINT expeditions_origin_station_id_fkey FOREIGN KEY (origin_station_id) REFERENCES stations(id) ON DELETE RESTRICT,
    CONSTRAINT expeditions_destination_station_id_fkey FOREIGN KEY (destination_station_id) REFERENCES stations(id) ON DELETE RESTRICT,
    CONSTRAINT expeditions_planned_dates_check CHECK (planned_end_at >= planned_start_at),
    CONSTRAINT expeditions_actual_dates_check CHECK (actual_start_at IS NULL OR actual_end_at IS NULL OR actual_end_at >= actual_start_at)
);

COMMENT ON TABLE expeditions IS 'Master operational campaigns, field journeys, and scientific expedition records.';
COMMENT ON COLUMN expeditions.code IS 'Unique alphanumeric expedition identifier (e.g., ISEA-44, ARCTIC-2026-01).';
COMMENT ON COLUMN expeditions.origin_station_id IS 'Optional origin station or departure facility.';
COMMENT ON COLUMN expeditions.destination_station_id IS 'Mandatory target polar station or field installation.';
COMMENT ON COLUMN expeditions.data_classification IS 'Data provenance tier (distinguishes synthetic demo operational records from verified public archives).';

-- Indexes for foreign key lookups
CREATE INDEX IF NOT EXISTS idx_expeditions_origin_station_id ON expeditions(origin_station_id);
CREATE INDEX IF NOT EXISTS idx_expeditions_destination_station_id ON expeditions(destination_station_id);


-- 4. EXPEDITION MEMBERS
-- Assignment junction linking personnel to expeditions with specific operational roles.
CREATE TABLE IF NOT EXISTS expedition_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expedition_id UUID NOT NULL,
    person_id UUID NOT NULL,
    assignment_role TEXT NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL,
    left_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT expedition_members_expedition_person_key UNIQUE (expedition_id, person_id),
    CONSTRAINT expedition_members_expedition_id_fkey FOREIGN KEY (expedition_id) REFERENCES expeditions(id) ON DELETE CASCADE,
    CONSTRAINT expedition_members_person_id_fkey FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE RESTRICT,
    CONSTRAINT expedition_members_dates_check CHECK (left_at IS NULL OR left_at >= joined_at)
);

COMMENT ON TABLE expedition_members IS 'Personnel roster and operational assignments for polar expeditions.';
COMMENT ON COLUMN expedition_members.assignment_role IS 'Designated operational role within this specific expedition (e.g., Expedition Leader, Medical Officer).';
COMMENT ON COLUMN expedition_members.joined_at IS 'Timestamp when the individual officially joined the expedition roster.';
COMMENT ON COLUMN expedition_members.left_at IS 'Optional timestamp when the individual departed the expedition.';

-- Index for foreign key lookup
CREATE INDEX IF NOT EXISTS idx_expedition_members_person_id ON expedition_members(person_id);
