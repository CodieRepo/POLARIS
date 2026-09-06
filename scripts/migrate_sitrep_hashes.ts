import fs from 'fs';
if (fs.existsSync('.env.local')) process.loadEnvFile('.env.local');
else if (fs.existsSync('.env.production')) process.loadEnvFile('.env.production');

import { createServerClient } from '../src/infrastructure/db/supabase-server';
import { SitrepRepository } from '../src/core/sitrep/sitrep-repository';
import { generateDocumentIntegrityHash, type SitrepSignablePayload } from '../src/core/sitrep/sitrep-integrity';

const STATION_ID_TO_CODE: Record<string, string> = {
  'b0000000-0000-0000-0000-000000000001': 'BHR',
  'b0000000-0000-0000-0000-000000000002': 'MTR',
  'm0000000-0000-0000-0000-000000000002': 'MTR',
  'b0000000-0000-0000-0000-000000000003': 'HMD',
  'h0000000-0000-0000-0000-000000000003': 'HMD',
};

async function migrate() {
  console.log('================================================================');
  console.log('  MIGRATING HISTORICAL SITREP HASHES TO CANONICAL SHA-256       ');
  console.log('================================================================');

  const supabase = createServerClient();
  const { data: rows, error } = await supabase.from('daily_sitreps').select('*').order('created_at', { ascending: true });

  if (error || !rows) {
    console.error('Failed to load daily_sitreps:', error);
    process.exit(1);
  }

  console.log(`Found ${rows.length} SITREP records in PostgreSQL.`);

  for (const row of rows) {
    const stationCode = STATION_ID_TO_CODE[row.station_id] || 'BHR';
    const signerIdentity = row.signer_identity || `STATION_COMMANDER_${stationCode}`;

    const payload: SitrepSignablePayload = {
      stationCode,
      reportDate: row.report_date,
      commanderName: row.commander_name,
      signerIdentity,
      winterOver: row.winter_over_headcount,
      summerScience: row.summer_science_headcount,
      transientAircrew: row.transient_headcount,
      minTempC: row.min_temp_c !== null && row.min_temp_c !== undefined ? Number(row.min_temp_c) : null,
      maxTempC: row.max_temp_c !== null && row.max_temp_c !== undefined ? Number(row.max_temp_c) : null,
      peakWindKmh: row.peak_wind_kmh !== null && row.peak_wind_kmh !== undefined ? Number(row.peak_wind_kmh) : null,
      pressureHpa: row.pressure_hpa !== null && row.pressure_hpa !== undefined ? Number(row.pressure_hpa) : null,
      pressureTrend6h: row.pressure_trend_6h !== null && row.pressure_trend_6h !== undefined ? Number(row.pressure_trend_6h) : null,
      fuelConsumed24hLiters: Number(row.fuel_consumed_24h_liters),
      generatorRuntimeHours: Number(row.generator_runtime_hours),
      outdoorStatus: row.outdoor_status,
      operationalRemarks: row.operational_remarks || '',
    };

    const canonicalHash = generateDocumentIntegrityHash(payload);

    console.log(`\nSITREP ${row.id} (${stationCode} - ${row.report_date}):`);
    console.log(`  Old Hash: ${row.integrity_hash}`);
    console.log(`  New Hash: ${canonicalHash}`);

    const { error: updateErr } = await supabase
      .from('daily_sitreps')
      .update({
        integrity_hash: canonicalHash,
        signer_identity: signerIdentity,
      })
      .eq('id', row.id);

    if (updateErr) {
      console.error(`  ERROR updating SITREP ${row.id}:`, updateErr);
      process.exit(1);
    }

    const verification = await SitrepRepository.verifySitrep(row.id);
    if (!verification.isValid) {
      console.error(`  FAILED: SITREP ${row.id} verification did not pass!`, verification);
      process.exit(1);
    }

    console.log(`  [PASS] Verified cryptographic integrity against PostgreSQL.`);
  }

  console.log('\n================================================================');
  console.log(`  ALL ${rows.length}/${rows.length} HISTORICAL SITREPS MIGRATED & VERIFIED 100%`);
  console.log('================================================================\n');
}

migrate();
