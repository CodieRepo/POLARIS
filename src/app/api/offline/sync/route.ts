import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createServerClient } from '@/infrastructure/db/supabase-server';
import type { Json } from '@/infrastructure/db/database.types';
import {
  MutationSyncResult,
  OfflineMutation,
  OfflineSyncResponse,
} from '@/core/offline/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mutations: OfflineMutation[] = Array.isArray(body?.mutations)
      ? body.mutations
      : [];

    if (mutations.length === 0) {
      return NextResponse.json(
        { error: 'No mutations provided in payload' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const results: MutationSyncResult[] = [];
    let synced = 0;
    let failed = 0;

    for (const mutation of mutations) {
      const { idempotencyKey, actionType, stationId, payload } = mutation;

      if (!idempotencyKey || !actionType) {
        failed++;
        results.push({
          idempotencyKey: idempotencyKey || 'unknown',
          status: 'FAILED',
          error: 'Missing idempotencyKey or actionType',
        });
        continue;
      }

      // 1. Idempotency Check: Has this client UUID already been executed?
      const { data: existing } = await supabase
        .from('offline_sync_idempotency')
        .select('idempotency_key, status, response_payload')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (existing) {
        // Idempotent replay: return cached server response
        synced++;
        results.push({
          idempotencyKey,
          status: 'COMPLETED',
          data: existing.response_payload,
        });
        continue;
      }

      // 2. Server-Authoritative Zero-Trust Execution
      const reqHash = createHash('sha256')
        .update(JSON.stringify(payload))
        .digest('hex');

      try {
        let executionResult: Record<string, unknown> | null = null;

        if (actionType === 'SUBMIT_SITREP') {
          // Zero-Trust: Server recomputes canonical SHA-256 hash.
          // Never accept client-provided hash.
          const reportDate = String(payload.reportDate || new Date().toISOString().split('T')[0]);
          const commanderName = String(payload.commanderName || 'Officer-in-Charge');
          const signerIdentity = String(payload.signerIdentity || 'FIELD_OFFICER');
          const headcount = Number(payload.winterOverHeadcount) || 20;
          const fuelConsumed = Number(payload.fuelConsumed24hLiters) || 0;

          const canonicalDataString = `${stationId}:${reportDate}:${commanderName}:${signerIdentity}:${headcount}:${fuelConsumed}`;
          const serverAuthoritativeHash = createHash('sha256')
            .update(canonicalDataString)
            .digest('hex');

          const { data: sitrep, error: sitrepErr } = await supabase
            .from('daily_sitreps')
            .upsert(
              {
                station_id: stationId,
                report_date: reportDate,
                commander_name: commanderName,
                signer_identity: signerIdentity,
                integrity_hash: serverAuthoritativeHash,
                winter_over_headcount: headcount,
                summer_science_headcount: Number(payload.summerScienceHeadcount) || 0,
                transient_headcount: Number(payload.transientHeadcount) || 0,
                min_temp_c: Number(payload.minTempC) || -15.0,
                max_temp_c: Number(payload.maxTempC) || -10.0,
                peak_wind_kmh: Number(payload.peakWindKmh) || 25.0,
                pressure_hpa: Number(payload.pressureHpa) || 985.0,
                pressure_trend_6h: Number(payload.pressureTrend6h) || 0.0,
                fuel_consumed_24h_liters: fuelConsumed,
                generator_runtime_hours: Number(payload.generatorRuntimeHours) || 24.0,
                outdoor_status: (payload.outdoorStatus as 'GREEN_NORMAL' | 'YELLOW_RESTRICTED' | 'RED_LOCKDOWN') || 'GREEN_NORMAL',
                operational_remarks: String(payload.operationalRemarks || 'Routine offline field report synchronized.'),
                signed_off_at: new Date().toISOString(),
              },
              { onConflict: 'station_id,report_date' }
            )
            .select()
            .single();

          if (sitrepErr) throw new Error(`SITREP persistence failed: ${sitrepErr.message}`);
          executionResult = { sitrepId: sitrep.id, hash: serverAuthoritativeHash };
        } else if (actionType === 'LOG_FUEL_DIP') {
          const tankId = String(payload.tankId);
          const dipReading = Number(payload.dipReadingLiters);

          if (!tankId || isNaN(dipReading)) {
            throw new Error('Invalid tankId or dipReadingLiters');
          }

          const { data: tank, error: tankErr } = await supabase
            .from('station_fuel_tanks')
            .update({
              current_level_liters: dipReading,
              last_dip_reading_at: new Date().toISOString(),
            })
            .eq('id', tankId)
            .select()
            .single();

          if (tankErr) throw new Error(`Fuel dip update failed: ${tankErr.message}`);
          executionResult = { tankId: tank.id, currentLevel: tank.current_level_liters };
        } else if (actionType === 'LOG_MAINTENANCE') {
          const assetId = String(payload.assetId);
          const maintenanceType = String(payload.maintenanceType || 'SCHEDULED');
          const description = String(payload.description || 'Offline routine servicing');

          const { data: rec, error: maintErr } = await supabase
            .from('maintenance_records')
            .insert({
              asset_id: assetId,
              maintenance_type: maintenanceType,
              description,
              performed_by: String(payload.performedBy || 'Station Field Engineer'),
              scheduled_at: String(payload.scheduledAt || new Date().toISOString()),
              completed_at: new Date().toISOString(),
              status: 'COMPLETED',
            })
            .select()
            .single();

          if (maintErr) throw new Error(`Maintenance record failed: ${maintErr.message}`);
          executionResult = { maintenanceId: rec.id };
        } else if (actionType === 'UPDATE_CONTAINER') {
          const containerId = String(payload.containerId);
          const transitStage = payload.transitStage as
            | 'GOA_MOBILIZATION'
            | 'CAPE_TOWN_BUNKERING'
            | 'SOUTHERN_OCEAN_TRANSIT'
            | 'ICE_SHELF_BARRIER'
            | 'STATION_DELIVERED';

          const { data: container, error: cntErr } = await supabase
            .from('cargo_containers')
            .update({
              transit_stage: transitStage,
              updated_at: new Date().toISOString(),
            })
            .eq('container_id', containerId)
            .select()
            .single();

          if (cntErr) throw new Error(`Container update failed: ${cntErr.message}`);
          executionResult = { containerId: container.id, stage: container.transit_stage };
        } else {
          throw new Error(`Unsupported offline action type: ${actionType}`);
        }

        // 3. Record in Idempotency Ledger
        await supabase.from('offline_sync_idempotency').insert({
          idempotency_key: idempotencyKey,
          action_type: actionType,
          request_hash: reqHash,
          response_payload: (executionResult as unknown as Json),
          status: 'COMPLETED',
        });

        synced++;
        results.push({
          idempotencyKey,
          status: 'COMPLETED',
          data: executionResult,
        });
      } catch (err) {
        const e = err as Error;
        failed++;
        results.push({
          idempotencyKey,
          status: 'FAILED',
          error: e.message || 'Mutation execution failed',
        });
      }
    }

    const response: OfflineSyncResponse = {
      success: failed === 0,
      synced,
      failed,
      results,
      processedAt: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const err = error as Error;
    console.error('Error in /api/offline/sync:', err);
    return NextResponse.json(
      { error: err.message || 'Offline sync ingestion failed' },
      { status: 500 }
    );
  }
}
