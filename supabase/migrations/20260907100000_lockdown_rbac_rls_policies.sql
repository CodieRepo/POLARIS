-- ==============================================================================
-- POLARIS RBAC Row-Level Security (RLS) Policy Hardening Migration
-- Migration: 20260907100000_lockdown_rbac_rls_policies.sql
-- Description:
--   Hardens and locks down all Phase 1 & Phase 2 operational tables:
--     1. station_fuel_tanks
--     2. daily_sitreps
--     3. cargo_containers
--     4. operational_alerts
--     5. hardware_telemetry_history
--     6. notification_outbox & notification_deliveries
--     7. offline_sync_idempotency
--     8. gateway_credentials
-- ==============================================================================

-- 1. Drop overly permissive open policies on Phase 1 & Phase 2 tables
DROP POLICY IF EXISTS "Allow public read on station_fuel_tanks" ON public.station_fuel_tanks;
DROP POLICY IF EXISTS "Allow update on station_fuel_tanks" ON public.station_fuel_tanks;
DROP POLICY IF EXISTS "Allow public read on daily_sitreps" ON public.daily_sitreps;
DROP POLICY IF EXISTS "Allow insert on daily_sitreps" ON public.daily_sitreps;
DROP POLICY IF EXISTS "Allow update on daily_sitreps" ON public.daily_sitreps;
DROP POLICY IF EXISTS "Allow public read on cargo_containers" ON public.cargo_containers;
DROP POLICY IF EXISTS "Allow update on cargo_containers" ON public.cargo_containers;
DROP POLICY IF EXISTS "Allow public read on operational_alerts" ON public.operational_alerts;
DROP POLICY IF EXISTS "Allow insert on operational_alerts" ON public.operational_alerts;
DROP POLICY IF EXISTS "Allow update on operational_alerts" ON public.operational_alerts;
DROP POLICY IF EXISTS "Allow public read on hardware_devices" ON public.hardware_devices;
DROP POLICY IF EXISTS "Allow public read on hardware_telemetry_history" ON public.hardware_telemetry_history;
DROP POLICY IF EXISTS "Allow insert on hardware_telemetry_history" ON public.hardware_telemetry_history;
DROP POLICY IF EXISTS "Allow public read on gateway_credentials" ON public.gateway_credentials;
DROP POLICY IF EXISTS "Allow update on gateway_credentials" ON public.gateway_credentials;
DROP POLICY IF EXISTS "Allow public read on notification_outbox" ON public.notification_outbox;
DROP POLICY IF EXISTS "Allow insert on notification_outbox" ON public.notification_outbox;
DROP POLICY IF EXISTS "Allow update on notification_outbox" ON public.notification_outbox;
DROP POLICY IF EXISTS "Allow public read on notification_deliveries" ON public.notification_deliveries;
DROP POLICY IF EXISTS "Allow insert on notification_deliveries" ON public.notification_deliveries;
DROP POLICY IF EXISTS "Allow public read on push_subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Allow insert on push_subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Allow update on push_subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Allow public read on offline_sync_idempotency" ON public.offline_sync_idempotency;
DROP POLICY IF EXISTS "Allow insert on offline_sync_idempotency" ON public.offline_sync_idempotency;
DROP POLICY IF EXISTS "Allow update on offline_sync_idempotency" ON public.offline_sync_idempotency;

-- 2. STATION FUEL TANKS (Read for all active roles, Mutation restricted to Admins & Station Operators)
CREATE POLICY "station_fuel_tanks_select"
  ON public.station_fuel_tanks
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "station_fuel_tanks_update"
  ON public.station_fuel_tanks
  FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR public.current_user_role() = 'STATION_OPERATOR')
  WITH CHECK (public.is_admin() OR public.current_user_role() = 'STATION_OPERATOR');

CREATE POLICY "station_fuel_tanks_insert"
  ON public.station_fuel_tanks
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "station_fuel_tanks_delete"
  ON public.station_fuel_tanks
  FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'SUPER_ADMIN');


-- 3. DAILY SITREPS (Read for all active roles, Insertion/Update for Operational roles & Admins, VIEWER forbidden)
CREATE POLICY "daily_sitreps_select"
  ON public.daily_sitreps
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "daily_sitreps_insert"
  ON public.daily_sitreps
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() OR public.current_user_role() IN ('EXPEDITION_MANAGER', 'STATION_OPERATOR'));

CREATE POLICY "daily_sitreps_update"
  ON public.daily_sitreps
  FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR public.current_user_role() IN ('EXPEDITION_MANAGER', 'STATION_OPERATOR'))
  WITH CHECK (public.is_admin() OR public.current_user_role() IN ('EXPEDITION_MANAGER', 'STATION_OPERATOR'));

CREATE POLICY "daily_sitreps_delete"
  ON public.daily_sitreps
  FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'SUPER_ADMIN');


-- 4. CARGO CONTAINERS (Read for all active roles, Stage update for Operational roles & Admins)
CREATE POLICY "cargo_containers_select"
  ON public.cargo_containers
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "cargo_containers_insert"
  ON public.cargo_containers
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "cargo_containers_update"
  ON public.cargo_containers
  FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR public.current_user_role() IN ('EXPEDITION_MANAGER', 'STATION_OPERATOR'))
  WITH CHECK (public.is_admin() OR public.current_user_role() IN ('EXPEDITION_MANAGER', 'STATION_OPERATOR'));

CREATE POLICY "cargo_containers_delete"
  ON public.cargo_containers
  FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'SUPER_ADMIN');


-- 5. OPERATIONAL ALERTS (Read for all active roles, Acknowledge/Resolve for Operational roles & Admins)
CREATE POLICY "operational_alerts_select"
  ON public.operational_alerts
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "operational_alerts_insert"
  ON public.operational_alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() OR public.current_user_role() IN ('EXPEDITION_MANAGER', 'STATION_OPERATOR'));

CREATE POLICY "operational_alerts_update"
  ON public.operational_alerts
  FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR public.current_user_role() IN ('EXPEDITION_MANAGER', 'STATION_OPERATOR'))
  WITH CHECK (public.is_admin() OR public.current_user_role() IN ('EXPEDITION_MANAGER', 'STATION_OPERATOR'));

CREATE POLICY "operational_alerts_delete"
  ON public.operational_alerts
  FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'SUPER_ADMIN');


-- 6. HARDWARE DEVICES & TELEMETRY HISTORY
CREATE POLICY "hardware_devices_select"
  ON public.hardware_devices
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "hardware_devices_insert"
  ON public.hardware_devices
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "hardware_telemetry_history_select"
  ON public.hardware_telemetry_history
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "hardware_telemetry_history_insert"
  ON public.hardware_telemetry_history
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() OR public.current_user_role() = 'STATION_OPERATOR');


-- 7. NOTIFICATION OUTBOX & DELIVERIES (Admin & Service Role Scoped)
CREATE POLICY "notification_outbox_select"
  ON public.notification_outbox
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "notification_outbox_insert"
  ON public.notification_outbox
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "notification_outbox_update"
  ON public.notification_outbox
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "notification_deliveries_select"
  ON public.notification_deliveries
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "notification_deliveries_insert"
  ON public.notification_deliveries
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());


-- 8. PUSH SUBSCRIPTIONS & OFFLINE IDEMPOTENCY
CREATE POLICY "push_subscriptions_select"
  ON public.push_subscriptions
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR auth.uid() = user_id);

CREATE POLICY "push_subscriptions_insert"
  ON public.push_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "push_subscriptions_update"
  ON public.push_subscriptions
  FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR auth.uid() = user_id)
  WITH CHECK (public.is_admin() OR auth.uid() = user_id);

CREATE POLICY "offline_sync_idempotency_select"
  ON public.offline_sync_idempotency
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR auth.uid() = user_id);

CREATE POLICY "offline_sync_idempotency_insert"
  ON public.offline_sync_idempotency
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() IS NOT NULL AND public.current_user_role() != 'VIEWER');

CREATE POLICY "offline_sync_idempotency_update"
  ON public.offline_sync_idempotency
  FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IS NOT NULL AND public.current_user_role() != 'VIEWER')
  WITH CHECK (public.current_user_role() IS NOT NULL AND public.current_user_role() != 'VIEWER');
