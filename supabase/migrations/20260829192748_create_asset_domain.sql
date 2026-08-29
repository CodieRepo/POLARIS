-- ==============================================================================
-- POLARIS Asset Domain Database Schema
-- Migration: create_asset_domain
--
-- Description:
--   Establishes physical asset tracking, lifecycle, assignments, and maintenance:
--     1. asset_status: Operational availability enum (AVAILABLE, ASSIGNED, IN_USE, etc.)
--     2. asset_condition: Physical condition evaluation enum (EXCELLENT, GOOD, etc.)
--     3. criticality_level: System-wide operational criticality enum (LOW, MEDIUM, HIGH, CRITICAL)
--     4. maintenance_status: Maintenance workflow state enum (SCHEDULED, IN_PROGRESS, etc.)
--     5. assets: Current state of physical tracked machinery, vehicles, and scientific equipment
--     6. asset_assignments: Historical and active deployment allocations to stations/expeditions
--     7. maintenance_records: Historical work orders, repairs, and scheduled servicing events
--
-- Architectural Rules:
--   - Clear separation between current state (assets) and historical events (assignments, maintenance)
--   - Asset != Inventory (discrete tracked units vs consumable stock)
--   - No overlapping active assignments (enforced via partial unique index where released_at IS NULL)
--   - RESTRICT delete behavior on referenced station, expedition, and asset entities
--   - No database triggers for state synchronization (application layer handles transactions)
--   - No RLS policies in this migration (deferred to auth milestone)
--   - No seed data in this migration (deferred to seed milestone)
-- ==============================================================================

-- 1. ASSET ENUMS
DO $$ BEGIN
    CREATE TYPE asset_status AS ENUM (
        'AVAILABLE',
        'ASSIGNED',
        'IN_USE',
        'MAINTENANCE',
        'DAMAGED',
        'RETIRED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE asset_condition AS ENUM (
        'EXCELLENT',
        'GOOD',
        'ATTENTION_REQUIRED',
        'CRITICAL'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE criticality_level AS ENUM (
        'LOW',
        'MEDIUM',
        'HIGH',
        'CRITICAL'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE maintenance_status AS ENUM (
        'SCHEDULED',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- 2. ASSETS
-- Current operational state, condition, and location of physical tracked assets.
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_code TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    type TEXT,
    station_id UUID,
    status asset_status NOT NULL DEFAULT 'AVAILABLE',
    condition asset_condition NOT NULL DEFAULT 'GOOD',
    criticality criticality_level NOT NULL DEFAULT 'MEDIUM',
    manufacturer TEXT,
    model TEXT,
    commissioned_at TIMESTAMPTZ,
    last_maintenance_at TIMESTAMPTZ,
    next_maintenance_at TIMESTAMPTZ,
    data_classification data_classification NOT NULL DEFAULT 'SIMULATED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT assets_asset_code_key UNIQUE (asset_code),
    CONSTRAINT assets_station_id_fkey FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE RESTRICT,
    CONSTRAINT assets_maintenance_dates_check CHECK (
        last_maintenance_at IS NULL OR
        next_maintenance_at IS NULL OR
        next_maintenance_at >= last_maintenance_at
    )
);

COMMENT ON TABLE assets IS 'Master registry and current operational state of individual tracked physical assets and equipment.';
COMMENT ON COLUMN assets.asset_code IS 'Unique alphanumeric barcode/asset tag (e.g., GEN-01, PISTEN-04).';
COMMENT ON COLUMN assets.station_id IS 'Current physical station location of the asset.';
COMMENT ON COLUMN assets.status IS 'Current operational availability state.';
COMMENT ON COLUMN assets.condition IS 'Current physical health / degradation assessment.';
COMMENT ON COLUMN assets.criticality IS 'Operational impact severity if asset becomes unavailable.';

-- Index for station location lookup
CREATE INDEX IF NOT EXISTS idx_assets_station_id ON assets(station_id);


-- 3. ASSET ASSIGNMENTS
-- Historical and active deployment allocations to stations and expeditions.
CREATE TABLE IF NOT EXISTS asset_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL,
    expedition_id UUID,
    station_id UUID,
    assignment_type TEXT NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL,
    released_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT asset_assignments_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE RESTRICT,
    CONSTRAINT asset_assignments_expedition_id_fkey FOREIGN KEY (expedition_id) REFERENCES expeditions(id) ON DELETE RESTRICT,
    CONSTRAINT asset_assignments_station_id_fkey FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE RESTRICT,
    CONSTRAINT asset_assignments_target_check CHECK (expedition_id IS NOT NULL OR station_id IS NOT NULL),
    CONSTRAINT asset_assignments_dates_check CHECK (released_at IS NULL OR released_at >= assigned_at)
);

COMMENT ON TABLE asset_assignments IS 'Deployment allocation history tracking asset assignments across expeditions and stations.';
COMMENT ON COLUMN asset_assignments.released_at IS 'Timestamp when the assignment was concluded. NULL indicates currently active assignment.';

-- Indexes for foreign key lookups
CREATE INDEX IF NOT EXISTS idx_asset_assignments_asset_id ON asset_assignments(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_assignments_expedition_id ON asset_assignments(expedition_id);
CREATE INDEX IF NOT EXISTS idx_asset_assignments_station_id ON asset_assignments(station_id);

-- Partial Unique Index: Guarantees at most ONE active assignment per physical asset
CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_assignments_active_unique
    ON asset_assignments(asset_id)
    WHERE released_at IS NULL;


-- 4. MAINTENANCE RECORDS
-- Work orders, servicing logs, and repair history for tracked assets.
CREATE TABLE IF NOT EXISTS maintenance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL,
    maintenance_type TEXT NOT NULL,
    status maintenance_status NOT NULL DEFAULT 'SCHEDULED',
    scheduled_at TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    description TEXT,
    performed_by TEXT,
    cost NUMERIC(12,2),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT maintenance_records_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE RESTRICT,
    CONSTRAINT maintenance_records_cost_check CHECK (cost IS NULL OR cost >= 0),
    CONSTRAINT maintenance_records_started_check CHECK (started_at IS NULL OR started_at >= scheduled_at),
    CONSTRAINT maintenance_records_completed_check CHECK (
        started_at IS NULL OR
        completed_at IS NULL OR
        completed_at >= started_at
    )
);

COMMENT ON TABLE maintenance_records IS 'Historical servicing, overhaul, and repair records for physical assets.';
COMMENT ON COLUMN maintenance_records.cost IS 'Optional maintenance expense incurred (currency agnostic, non-negative).';

-- Index for asset maintenance history lookups
CREATE INDEX IF NOT EXISTS idx_maintenance_records_asset_id ON maintenance_records(asset_id);
