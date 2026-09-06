// ==============================================================================
// POLARIS Telemetry Processor
// Description: Secure edge gateway authentication, reboot-safe deduplication,
//              time-series telemetry persistence, and operational side-effects.
// ==============================================================================

import { createHash } from 'crypto';
import { createServerClient } from '@/infrastructure/db/supabase-server';
import type { Json } from '@/infrastructure/db/database.types';
import {
  HardwareDevice,
  HardwareProtocol,
  HardwareTelemetryEvent,
  TelemetryClassification,
  TelemetryIngestResult,
  TelemetryQuality,
} from './types';

export class TelemetryProcessor {
  /**
   * Computes SHA-256 hash of raw API key.
   */
  static hashKey(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }

  /**
   * Validates gateway credentials against public.gateway_credentials.
   */
  static async authenticateGateway(
    gatewayId: string,
    rawKey: string
  ): Promise<{ authenticated: boolean; stationId?: string; error?: string }> {
    const supabase = createServerClient();
    const keyHash = this.hashKey(rawKey);

    const { data: gw, error } = await supabase
      .from('gateway_credentials')
      .select('id, station_id, is_active, revoked_at')
      .eq('gateway_id', gatewayId)
      .eq('key_hash', keyHash)
      .maybeSingle();

    if (error || !gw) {
      return { authenticated: false, error: 'Invalid gateway ID or credentials' };
    }

    if (!gw.is_active || gw.revoked_at) {
      return {
        authenticated: false,
        error: `Gateway credentials have been revoked at ${gw.revoked_at || 'earlier'}`,
      };
    }

    // Touch last_seen_at
    await supabase
      .from('gateway_credentials')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', gw.id);

    return { authenticated: true, stationId: gw.station_id };
  }

  /**
   * Ingests a batch of telemetry events with reboot-safe deduplication.
   */
  static async processBatch(
    gatewayId: string,
    rawKey: string,
    events: HardwareTelemetryEvent[]
  ): Promise<TelemetryIngestResult> {
    const auth = await this.authenticateGateway(gatewayId, rawKey);
    if (!auth.authenticated) {
      throw new Error(`Authentication failed: ${auth.error}`);
    }

    const supabase = createServerClient();
    let accepted = 0;
    let deduplicated = 0;
    const errors: Array<{ eventId: string; error: string }> = [];

    // Cache device metadata for fast lookup
    const { data: devices } = await supabase
      .from('hardware_devices')
      .select('device_code, target_tank_id, target_asset_id, station_id')
      .eq('gateway_id', gatewayId);

    const deviceMap = new Map<string, { target_tank_id: string | null; target_asset_id: string | null; station_id: string }>();
    if (devices) {
      for (const d of devices) {
        deviceMap.set(d.device_code, d);
      }
    }

    for (const evt of events) {
      try {
        if (!evt.eventId || !evt.deviceId || !evt.metric || evt.value === undefined) {
          errors.push({ eventId: evt.eventId || 'unknown', error: 'Missing required event fields' });
          continue;
        }

        // Reboot-safe check: check for matching event_id OR (gateway_id, device_id, boot_session_id, sequence_number)
        const { data: existing } = await supabase
          .from('hardware_telemetry_history')
          .select('id')
          .or(
            `event_id.eq.${evt.eventId},and(gateway_id.eq.${gatewayId},device_id.eq.${evt.deviceId},boot_session_id.eq.${evt.bootSessionId || 'boot-0'},sequence_number.eq.${evt.sequenceNumber})`
          )
          .maybeSingle();

        if (existing) {
          deduplicated++;
          continue;
        }

        // Insert new telemetry observation
        const { error: insertErr } = await supabase
          .from('hardware_telemetry_history')
          .insert({
            event_id: evt.eventId,
            gateway_id: gatewayId,
            device_id: evt.deviceId,
            sequence_number: evt.sequenceNumber,
            boot_session_id: evt.bootSessionId || 'boot-0',
            observed_at: evt.observedAt,
            received_at: new Date().toISOString(),
            metric: evt.metric,
            value: evt.value,
            unit: evt.unit,
            quality: evt.quality || 'GOOD',
            source: evt.source || 'VIRTUAL',
            classification: evt.classification || 'SIMULATED_TELEMETRY',
            raw_payload: (evt.rawPayload as unknown as Json) || {},
          });

        if (insertErr) {
          // If collision occurred during race condition
          if (insertErr.code === '23505') {
            deduplicated++;
            continue;
          }
          errors.push({ eventId: evt.eventId, error: insertErr.message });
          continue;
        }

        accepted++;

        // Operational side-effect: Reconcile fuel tank level if linked
        const devMeta = deviceMap.get(evt.deviceId);
        if (devMeta?.target_tank_id && evt.metric === 'FUEL_LEVEL_LITERS') {
          // Update tank current level and last dip timestamp
          const { data: tank } = await supabase
            .from('station_fuel_tanks')
            .select('capacity_liters')
            .eq('id', devMeta.target_tank_id)
            .single();

          await supabase
            .from('station_fuel_tanks')
            .update({
              current_level_liters: evt.value,
              last_dip_reading_at: evt.observedAt,
            })
            .eq('id', devMeta.target_tank_id);

          // If level is critical (< 20% capacity), raise operational alert
          if (tank && evt.value < Number(tank.capacity_liters) * 0.2) {
            await supabase.from('operational_alerts').insert({
              station_id: devMeta.station_id,
              severity: 'CRITICAL',
              category: 'FUEL_SYSTEMS',
              title: `Telemetry Alert: Low Fuel in Tank (${evt.deviceId})`,
              details: `Automated hardware sensor ${evt.deviceId} reported level ${evt.value} L, below 20% threshold of capacity (${tank.capacity_liters} L).`,
              status: 'ACTIVE',
            });
          }
        }
      } catch (err) {
        const e = err as Error;
        errors.push({ eventId: evt.eventId, error: e.message || 'Unknown processing error' });
      }
    }

    return {
      accepted,
      deduplicated,
      errors,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Retrieves registered hardware devices with their latest telemetry reading.
   */
  static async getDevices(stationId?: string): Promise<HardwareDevice[]> {
    const supabase = createServerClient();
    let query = supabase.from('hardware_devices').select('*').order('device_code');
    if (stationId) {
      query = query.eq('station_id', stationId);
    }

    const { data: devices, error } = await query;
    if (error || !devices) {
      return [];
    }

    // Fetch latest telemetry reading for each device
    const result: HardwareDevice[] = [];
    for (const d of devices) {
      const { data: lastReading } = await supabase
        .from('hardware_telemetry_history')
        .select('observed_at, metric, value, unit, quality, classification')
        .eq('device_id', d.device_code)
        .order('observed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      result.push({
        id: d.id,
        deviceCode: d.device_code,
        stationId: d.station_id,
        gatewayId: d.gateway_id,
        protocol: d.protocol as HardwareProtocol,
        targetTankId: d.target_tank_id,
        targetAssetId: d.target_asset_id,
        name: d.name,
        description: d.description,
        pollingIntervalSec: d.polling_interval_sec,
        isActive: d.is_active,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
        lastReading: lastReading
          ? {
              observedAt: lastReading.observed_at,
              metric: lastReading.metric,
              value: Number(lastReading.value),
              unit: lastReading.unit,
              quality: lastReading.quality as TelemetryQuality,
              classification: lastReading.classification as TelemetryClassification,
            }
          : undefined,
      });
    }

    return result;
  }
}
