-- ==============================================================================
-- POLARIS Inventory Domain Database Schema
-- Migration: create_inventory_domain
--
-- Description:
--   Establishes station-level consumable supplies, stock balances, and transaction history:
--     1. inventory_transaction_type: Movement classification enum (RECEIPT, CONSUMPTION, etc.)
--     2. inventory_items: Current operational balance per station + SKU
--     3. inventory_transactions: Immutable audit ledger of quantity movements
--
-- Architectural Rules:
--   - Inventory != Asset (consumable/quantity balance vs discrete tracked equipment unit)
--   - Dual-model design: current_quantity on inventory_items + transaction history
--   - One inventory balance per station + SKU (enforced via UNIQUE(station_id, sku))
--   - Quantity precision: NUMERIC(14,3) across all quantity fields
--   - Positive transaction quantities (quantity > 0); transaction_type defines movement direction
--   - RESTRICT delete behavior on referenced station and inventory_items entities
--   - No database triggers for balance updates (application use-cases handle atomic mutations)
--   - No RLS policies in this migration (deferred to auth milestone)
--   - No seed data in this migration (deferred to seed milestone)
-- ==============================================================================

-- 1. INVENTORY TRANSACTION TYPE ENUM
DO $$ BEGIN
    CREATE TYPE inventory_transaction_type AS ENUM (
        'RECEIPT',
        'RESTOCK',
        'CONSUMPTION',
        'TRANSFER_IN',
        'TRANSFER_OUT',
        'ADJUSTMENT',
        'DAMAGE_LOSS',
        'EXPIRY'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- 2. INVENTORY ITEMS
-- Current operational stock balance per station and SKU.
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    current_quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
    minimum_threshold NUMERIC(14,3) NOT NULL DEFAULT 0,
    safety_stock NUMERIC(14,3) NOT NULL DEFAULT 0,
    daily_consumption_rate NUMERIC(14,3) NOT NULL DEFAULT 0,
    criticality criticality_level NOT NULL DEFAULT 'MEDIUM',
    active BOOLEAN NOT NULL DEFAULT true,
    data_classification data_classification NOT NULL DEFAULT 'SIMULATED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT inventory_items_station_sku_key UNIQUE (station_id, sku),
    CONSTRAINT inventory_items_station_id_fkey FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE RESTRICT,
    CONSTRAINT inventory_items_current_quantity_check CHECK (current_quantity >= 0),
    CONSTRAINT inventory_items_minimum_threshold_check CHECK (minimum_threshold >= 0),
    CONSTRAINT inventory_items_safety_stock_check CHECK (safety_stock >= 0),
    CONSTRAINT inventory_items_daily_consumption_rate_check CHECK (daily_consumption_rate >= 0)
);

COMMENT ON TABLE inventory_items IS 'Current stock balances and threshold configurations for consumable supplies at polar stations.';
COMMENT ON COLUMN inventory_items.station_id IS 'Polar station holding this inventory balance.';
COMMENT ON COLUMN inventory_items.sku IS 'Stock Keeping Unit / catalog identifier unique per station.';
COMMENT ON COLUMN inventory_items.current_quantity IS 'Current on-hand quantity balance at the station (NUMERIC(14,3)).';
COMMENT ON COLUMN inventory_items.minimum_threshold IS 'Reorder trigger point below which procurement/restock warning is raised.';
COMMENT ON COLUMN inventory_items.safety_stock IS 'Buffer reserve intended for emergency isolation periods (e.g., polar winter).';
COMMENT ON COLUMN inventory_items.daily_consumption_rate IS 'Estimated or calculated daily burn rate used for days-of-supply modeling.';
COMMENT ON COLUMN inventory_items.criticality IS 'Operational survival impact level (LOW, MEDIUM, HIGH, CRITICAL).';

-- Indexes for station lookup and criticality filtering
CREATE INDEX IF NOT EXISTS idx_inventory_items_station_id ON inventory_items(station_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_criticality ON inventory_items(criticality);


-- 3. INVENTORY TRANSACTIONS
-- Immutable movement log capturing all receipts, consumptions, adjustments, and transfers.
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_item_id UUID NOT NULL,
    transaction_type inventory_transaction_type NOT NULL,
    quantity NUMERIC(14,3) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reference_type TEXT,
    reference_id UUID,
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT inventory_transactions_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT,
    CONSTRAINT inventory_transactions_quantity_check CHECK (quantity > 0)
);

COMMENT ON TABLE inventory_transactions IS 'Historical audit ledger of all inventory movements, receipts, and consumptions.';
COMMENT ON COLUMN inventory_transactions.quantity IS 'Positive movement magnitude (NUMERIC(14,3)). Movement direction is determined by transaction_type.';
COMMENT ON COLUMN inventory_transactions.occurred_at IS 'Timestamp when the physical inventory event took place in the field.';
COMMENT ON COLUMN inventory_transactions.reference_type IS 'Originating business domain or document type (e.g., SHIPMENT, MANUAL_ADJUSTMENT).';
COMMENT ON COLUMN inventory_transactions.reference_id IS 'UUID reference to external/originating business document.';
COMMENT ON COLUMN inventory_transactions.created_by IS 'Identifier of user or system process that logged the transaction.';

-- Index for item transaction history queries in reverse chronological order
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item_occurred
    ON inventory_transactions(inventory_item_id, occurred_at DESC);
