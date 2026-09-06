import fs from 'fs';
if (fs.existsSync('.env.local')) process.loadEnvFile('.env.local');
else if (fs.existsSync('.env.production')) process.loadEnvFile('.env.production');

import { createServerClient } from '../src/infrastructure/db/supabase-server';
import { SitrepRepository } from '../src/core/sitrep/sitrep-repository';
import {
  generateDocumentIntegrityHash,
  verifyDocumentIntegrity,
  canonicalizeSitrepPayload,
  type SitrepSignablePayload,
} from '../src/core/sitrep/sitrep-integrity';
import { randomUUID } from 'crypto';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  [PASS] ${message}`);
}

async function runRegressionTests() {
  console.log('================================================================');
  console.log('  POLARIS SITREP CRYPTOGRAPHIC INTEGRITY REGRESSION TEST SUITE  ');
  console.log('================================================================\n');

  const supabase = createServerClient();
  const testDate = `2099-01-${String(Math.floor(Math.random() * 25) + 1).padStart(2, '0')}`;
  const testStationCode = 'BHR';
  let createdSitrepId: string = '';

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Create SITREP -> Verify Integrity -> PASS
    // ------------------------------------------------------------------------
    console.log('--- TEST 1: Create SITREP -> Verify Integrity ---');
    const input = {
      stationCode: testStationCode as 'BHR',
      commanderName: 'Cmdr. Regression Test',
      signerIdentity: 'STATION_COMMANDER_BHR',
      winterOver: 24,
      summerScience: 18,
      transientAircrew: 0,
      fuelConsumed24hLiters: 480.5,
      generatorRuntimeHours: 24.0,
      outdoorStatus: 'GREEN_NORMAL' as const,
      operationalRemarks: 'Cryptographic test dispatch.',
    };
    const weather = {
      currentTempC: -13.8,
      minTemp24hC: -16.5,
      maxTemp24hC: -11.0,
      peakWindKmh: 42.0,
      currentPressureHpa: 985.0,
      pressureDelta6h: -1.2,
    };

    const created = await SitrepRepository.createSitrep(input, weather, testDate);
    createdSitrepId = created.id;
    assert(!!created.id, `SITREP created with ID ${created.id}`);
    assert(created.integrityHash.length === 64, `SHA-256 hash generated (Length: ${created.integrityHash.length})`);

    const verify1 = await SitrepRepository.verifySitrep(created.id);
    assert(verify1.isValid === true, `Immediate verification returned isValid === true`);
    assert(verify1.computedHash === created.integrityHash, `Computed hash matches persisted hash (${verify1.computedHash.slice(0, 16)}...)`);

    // ------------------------------------------------------------------------
    // TEST 2: Read Same SITREP Later -> Verify -> PASS
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 2: Read Same SITREP Later -> Verify ---');
    const loaded = await SitrepRepository.getSitrepById(created.id);
    assert(!!loaded, `Loaded SITREP by ID`);
    assert(loaded!.commanderName === 'Cmdr. Regression Test', `Retrieved correct commander name`);

    const verify2 = await SitrepRepository.verifySitrep(created.id);
    assert(verify2.isValid === true, `Subsequent verification is deterministic and valid`);
    assert(verify2.computedHash === loaded!.integrityHash, `Computed hash exactly equals stored hash`);

    // ------------------------------------------------------------------------
    // TEST 3: Change ONE Signed Field -> Verification MUST FAIL (Tamper Detection)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 3: Tamper Signed Field -> Verification MUST FAIL ---');
    // Tamper with fuel_consumed_24h_liters in PostgreSQL
    const { error: tamperErr } = await supabase
      .from('daily_sitreps')
      .update({ fuel_consumed_24h_liters: 9999.0 })
      .eq('id', created.id);
    assert(!tamperErr, `Tampered with fuel_consumed_24h_liters in database`);

    const verifyTampered = await SitrepRepository.verifySitrep(created.id);
    assert(verifyTampered.isValid === false, `Tampered record correctly flagged as INVALID (isValid === false)`);
    assert(verifyTampered.computedHash !== verifyTampered.storedHash, `Tampered computedHash differs from storedHash`);
    console.log(`    Stored (Original):   ${verifyTampered.storedHash}`);
    console.log(`    Computed (Tampered): ${verifyTampered.computedHash}`);

    // Restore original value
    await supabase
      .from('daily_sitreps')
      .update({ fuel_consumed_24h_liters: 480.5 })
      .eq('id', created.id);
    const verifyRestored = await SitrepRepository.verifySitrep(created.id);
    assert(verifyRestored.isValid === true, `Restoring original data restores valid hash state`);

    // ------------------------------------------------------------------------
    // TEST 4: Change Unsigned / Display-Only Field -> Verification Remains Correct
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 4: Change Unsigned Field -> Verification Remains Unaffected ---');
    // signed_off_at is volatile timestamp, not part of canonical content
    const { error: unsignedErr } = await supabase
      .from('daily_sitreps')
      .update({ signed_off_at: '2099-01-01T00:00:00.000Z' })
      .eq('id', created.id);
    assert(!unsignedErr, `Updated volatile field signed_off_at`);

    const verifyUnsigned = await SitrepRepository.verifySitrep(created.id);
    assert(verifyUnsigned.isValid === true, `Verification remains valid when unsigned metadata changes`);

    // ------------------------------------------------------------------------
    // TEST 5: Null vs Empty-String Edge Case
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 5: Null vs Empty-String Deterministic Handling ---');
    const payloadWithNulls: SitrepSignablePayload = {
      stationCode: 'BHR',
      reportDate: '2026-09-06',
      commanderName: 'Cmdr. Test',
      signerIdentity: 'STATION_COMMANDER_BHR',
      winterOver: 20,
      summerScience: 0,
      transientAircrew: 0,
      minTempC: null,
      maxTempC: null,
      peakWindKmh: null,
      pressureHpa: null,
      pressureTrend6h: null,
      fuelConsumed24hLiters: 100,
      generatorRuntimeHours: 24,
      outdoorStatus: 'GREEN_NORMAL',
      operationalRemarks: '',
    };
    const canonicalNull = canonicalizeSitrepPayload(payloadWithNulls);
    assert(canonicalNull.includes('"maxTempC":null'), `Nullable metrics correctly serialize to JSON null`);
    assert(canonicalNull.includes('"operationalRemarks":""'), `Empty remarks serialize to empty string`);
    const hashNull = generateDocumentIntegrityHash(payloadWithNulls);
    assert(hashNull.length === 64, `Hash with nulls is valid 64-char hex`);

    // ------------------------------------------------------------------------
    // TEST 6: Date/Time Serialization Edge Case
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 6: Date/Time Serialization & Trimming ---');
    const payloadUntrimmed: SitrepSignablePayload = {
      ...payloadWithNulls,
      reportDate: ' 2026-09-06  ',
      commanderName: '  Cmdr. Test  ',
      operationalRemarks: '   Remarks with spaces   ',
    };
    const hashTrimmed = generateDocumentIntegrityHash(payloadUntrimmed);
    assert(
      canonicalizeSitrepPayload(payloadUntrimmed) === canonicalNull.replace('""', '"Remarks with spaces"'),
      `Whitespace in date/strings is trimmed deterministically`
    );

    // ------------------------------------------------------------------------
    // TEST 7: Numeric Field Serialization Edge Case
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 7: Numeric Field Precision & Normalization ---');
    const payloadNum1: SitrepSignablePayload = {
      ...payloadWithNulls,
      fuelConsumed24hLiters: 480.0,
      generatorRuntimeHours: 24.0,
      minTempC: -16.50,
      maxTempC: -11.0,
    };
    const payloadNum2: SitrepSignablePayload = {
      ...payloadWithNulls,
      fuelConsumed24hLiters: 480,
      generatorRuntimeHours: 24,
      minTempC: -16.5,
      maxTempC: -11,
    };
    const hashNum1 = generateDocumentIntegrityHash(payloadNum1);
    const hashNum2 = generateDocumentIntegrityHash(payloadNum2);
    assert(hashNum1 === hashNum2, `Equivalent numbers (480.0 vs 480, -16.50 vs -16.5) produce IDENTICAL hashes`);

    // ------------------------------------------------------------------------
    // TEST 8: Replay / Offline-Created SITREP Verification
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 8: Replay & Offline SITREP Unified Verification ---');
    const offlineStationId = 'b0000000-0000-0000-0000-000000000001';
    const offlineReportDate = '2099-01-28';
    const offlinePayload: SitrepSignablePayload = {
      stationCode: 'BHR',
      reportDate: offlineReportDate,
      commanderName: 'Cmdr. Offline Lead',
      signerIdentity: 'STATION_COMMANDER_BHR',
      winterOver: 22,
      summerScience: 10,
      transientAircrew: 2,
      minTempC: -15.5,
      maxTempC: -9.5,
      peakWindKmh: 30.0,
      pressureHpa: 980.0,
      pressureTrend6h: 0.5,
      fuelConsumed24hLiters: 350.0,
      generatorRuntimeHours: 24.0,
      outdoorStatus: 'GREEN_NORMAL',
      operationalRemarks: 'Buffered from offline field client.',
    };

    const offlineHash = generateDocumentIntegrityHash(offlinePayload);
    const { data: offlineInserted, error: offErr } = await supabase
      .from('daily_sitreps')
      .upsert(
        {
          station_id: offlineStationId,
          report_date: offlineReportDate,
          commander_name: offlinePayload.commanderName,
          signer_identity: offlinePayload.signerIdentity,
          integrity_hash: offlineHash,
          winter_over_headcount: offlinePayload.winterOver,
          summer_science_headcount: offlinePayload.summerScience,
          transient_headcount: offlinePayload.transientAircrew,
          min_temp_c: offlinePayload.minTempC,
          max_temp_c: offlinePayload.maxTempC,
          peak_wind_kmh: offlinePayload.peakWindKmh,
          pressure_hpa: offlinePayload.pressureHpa,
          pressure_trend_6h: offlinePayload.pressureTrend6h,
          fuel_consumed_24h_liters: offlinePayload.fuelConsumed24hLiters,
          generator_runtime_hours: offlinePayload.generatorRuntimeHours,
          outdoor_status: offlinePayload.outdoorStatus as 'GREEN_NORMAL' | 'YELLOW_RESTRICTED' | 'RED_LOCKDOWN',
          operational_remarks: offlinePayload.operationalRemarks,
          signed_off_at: new Date().toISOString(),
        },
        { onConflict: 'station_id,report_date' }
      )
      .select()
      .single();

    assert(!offErr && !!offlineInserted, `Offline SITREP saved with canonical hash`);
    const verifyOffline = await SitrepRepository.verifySitrep(offlineInserted!.id);
    assert(verifyOffline.isValid === true, `Offline-created SITREP verifies successfully (isValid === true)`);

    // Clean up test rows
    await supabase.from('daily_sitreps').delete().eq('id', offlineInserted!.id);

    console.log('\n================================================================');
    console.log('  ALL 8/8 SITREP INTEGRITY REGRESSION TESTS PASSED (100%)');
    console.log('================================================================\n');
  } finally {
    if (createdSitrepId) {
      await supabase.from('daily_sitreps').delete().eq('id', createdSitrepId);
    }
  }
}

runRegressionTests();
