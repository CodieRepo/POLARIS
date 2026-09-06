import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// 1. Load environment variables
const envContent = fs.readFileSync(".env.production", "utf-8");
let supabaseUrl = "";
let serviceRoleKey = "";

for (const line of envContent.split(/\r?\n/)) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    if (key === "NEXT_PUBLIC_SUPABASE_URL") supabaseUrl = val;
    if (key === "SUPABASE_SERVICE_ROLE_KEY") serviceRoleKey = val;
  }
}

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase credentials in .env.production");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Canonical SHA-256 hashing for SITREPs
function computeCanonicalHash(payload: Record<string, unknown>): string {
  const sortedKeys = Object.keys(payload).sort();
  const canonicalObj: Record<string, unknown> = {};
  for (const k of sortedKeys) {
    canonicalObj[k] = payload[k];
  }
  const serialized = JSON.stringify(canonicalObj);
  return crypto.createHash("sha256").update(serialized, "utf8").digest("hex");
}

async function runPhase1Verification() {
  console.log("================================================================================");
  console.log("         POLARIS REALITY UPGRADE — PHASE 1 PERSISTENCE VERIFICATION             ");
  console.log("================================================================================");

  let allPassed = true;

  // --------------------------------------------------------------------------
  // DOMAIN 1: Station Fuel Tanks (public.station_fuel_tanks)
  // --------------------------------------------------------------------------
  console.log("\n[1/5] Verifying Fuel Subsystem (public.station_fuel_tanks)...");
  try {
    const { data: tanks, error: tankErr } = await supabase
      .from("station_fuel_tanks")
      .select("*")
      .order("tank_code");

    if (tankErr || !tanks || tanks.length < 8) {
      throw new Error(`Fuel tank query failed or incomplete row count: ${tankErr?.message} (found ${tanks?.length || 0})`);
    }

    console.log(`  ✓ Successfully queried ${tanks.length} fuel tanks across all stations.`);
    const sampleTank = tanks[0];
    console.log(`  ✓ Sample Tank: ${sampleTank.tank_code} (${sampleTank.tank_name}) - Level: ${sampleTank.current_level_liters} L / ${sampleTank.capacity_liters} L`);

    // Test dip reading update on Day Tank (tank 3)
    const testDipLiters = 8150.0;
    const { error: updateErr } = await supabase
      .from("station_fuel_tanks")
      .update({
        current_level_liters: testDipLiters,
        last_dip_reading_at: new Date().toISOString(),
      })
      .eq("tank_code", "BHR-TK-03");

    if (updateErr) throw new Error(`Failed to record dip reading: ${updateErr.message}`);

    const { data: updatedTank } = await supabase
      .from("station_fuel_tanks")
      .select("current_level_liters, last_dip_reading_at")
      .eq("tank_code", "BHR-TK-03")
      .single();

    if (Number(updatedTank?.current_level_liters) !== testDipLiters) {
      throw new Error(`Dip reading level mismatch: expected ${testDipLiters}, got ${updatedTank?.current_level_liters}`);
    }
    console.log(`  ✓ Recorded dip reading on BHR-TK-03: ${updatedTank?.current_level_liters} L persisted at ${updatedTank?.last_dip_reading_at}`);
  } catch (err) {
    console.error(`  ✗ Fuel Subsystem FAILED:`, err);
    allPassed = false;
  }

  // --------------------------------------------------------------------------
  // DOMAIN 2: SITREP & Canonical SHA-256 Hash Integrity (public.daily_sitreps)
  // --------------------------------------------------------------------------
  console.log("\n[2/5] Verifying Daily SITREP Subsystem & SHA-256 Integrity (public.daily_sitreps)...");
  const testReportDate = "2026-09-04"; // past date to avoid colliding with 2026-09-05 seed
  const testStationId = "b0000000-0000-0000-0000-000000000001"; // Bharati
  let testSitrepId: string | null = null;

  try {
    const { data: existingSitreps, error: listErr } = await supabase
      .from("daily_sitreps")
      .select("*");

    if (listErr) throw new Error(`Failed to list sitreps: ${listErr.message}`);
    console.log(`  ✓ Found ${existingSitreps.length} existing SITREPs in PostgreSQL.`);

    // Clean up any stale test report
    await supabase.from("daily_sitreps").delete().eq("station_id", testStationId).eq("report_date", testReportDate);

    // Compute canonical hash
    const sitrepFields = {
      commanderName: "Cmdr. Test Harness",
      fuelConsumed24hLiters: 450,
      generatorRuntimeHours: 24,
      maxTempC: -12.5,
      minTempC: -18.2,
      outdoorStatus: "GREEN_NORMAL",
      peakWindKmh: 35.0,
      pressureHpa: 986.5,
      pressureTrend6h: -1.2,
      reportDate: testReportDate,
      signerIdentity: "STATION_COMMANDER_BHR",
      stationCode: "BHR",
      summerScienceHeadcount: 14,
      transientHeadcount: 0,
      winterOverHeadcount: 24,
    };

    const integrityHash = computeCanonicalHash(sitrepFields);
    console.log(`  ✓ Generated SHA-256 document integrity hash: ${integrityHash}`);

    // Insert SITREP
    const { data: insertedSitrep, error: insertErr } = await supabase
      .from("daily_sitreps")
      .insert({
        station_id: testStationId,
        report_date: testReportDate,
        commander_name: sitrepFields.commanderName,
        signer_identity: sitrepFields.signerIdentity,
        integrity_hash: integrityHash,
        winter_over_headcount: sitrepFields.winterOverHeadcount,
        summer_science_headcount: sitrepFields.summerScienceHeadcount,
        transient_headcount: sitrepFields.transientHeadcount,
        min_temp_c: sitrepFields.minTempC,
        max_temp_c: sitrepFields.maxTempC,
        peak_wind_kmh: sitrepFields.peakWindKmh,
        pressure_hpa: sitrepFields.pressureHpa,
        pressure_trend_6h: sitrepFields.pressureTrend6h,
        fuel_consumed_24h_liters: sitrepFields.fuelConsumed24hLiters,
        generator_runtime_hours: sitrepFields.generatorRuntimeHours,
        outdoor_status: sitrepFields.outdoorStatus as any,
        operational_remarks: "Phase 1 verification automated test record.",
      })
      .select()
      .single();

    if (insertErr || !insertedSitrep) throw new Error(`Failed to insert SITREP: ${insertErr?.message}`);
    testSitrepId = insertedSitrep.id;
    console.log(`  ✓ Inserted SITREP into PostgreSQL: ID ${testSitrepId}`);

    // Verify hash integrity from DB record
    const recomputedHash = computeCanonicalHash({
      commanderName: insertedSitrep.commander_name,
      fuelConsumed24hLiters: Number(insertedSitrep.fuel_consumed_24h_liters),
      generatorRuntimeHours: Number(insertedSitrep.generator_runtime_hours),
      maxTempC: Number(insertedSitrep.max_temp_c),
      minTempC: Number(insertedSitrep.min_temp_c),
      outdoorStatus: insertedSitrep.outdoor_status,
      peakWindKmh: Number(insertedSitrep.peak_wind_kmh),
      pressureHpa: Number(insertedSitrep.pressure_hpa),
      pressureTrend6h: Number(insertedSitrep.pressure_trend_6h),
      reportDate: insertedSitrep.report_date,
      signerIdentity: insertedSitrep.signer_identity,
      stationCode: "BHR",
      summerScienceHeadcount: insertedSitrep.summer_science_headcount,
      transientHeadcount: insertedSitrep.transient_headcount,
      winterOverHeadcount: insertedSitrep.winter_over_headcount,
    });

    const isMatch = recomputedHash === insertedSitrep.integrity_hash;
    if (!isMatch) throw new Error(`Integrity verification failed! DB: ${insertedSitrep.integrity_hash}, Recomputed: ${recomputedHash}`);
    console.log(`  ✓ SHA-256 verification confirmed authentic: ${isMatch}`);

    // Teardown test SITREP
    await supabase.from("daily_sitreps").delete().eq("id", testSitrepId);
    console.log(`  ✓ Teardown complete for test SITREP.`);
  } catch (err) {
    console.error(`  ✗ SITREP Subsystem FAILED:`, err);
    if (testSitrepId) {
      await supabase.from("daily_sitreps").delete().eq("id", testSitrepId);
    }
    allPassed = false;
  }

  // --------------------------------------------------------------------------
  // DOMAIN 3: Weather Telemetry History Archiving (public.weather_telemetry_history)
  // --------------------------------------------------------------------------
  console.log("\n[3/5] Verifying Weather History Archiving (public.weather_telemetry_history)...");
  try {
    // Ingest sample observation
    const testObs = [
      {
        station_code: "BHR",
        temperature_c: -8.5,
        relative_humidity_pct: 65,
        pressure_hpa: 988.2,
        wind_speed_kmh: 24.5,
        apparent_temp_c: -15.8,
        solar_elevation_deg: 12.4,
        provenance_tier: "IN_SITU_AWS",
        observed_at: new Date(Date.now() - 3600 * 1000).toISOString(),
      },
      {
        station_code: "BHR",
        temperature_c: -9.1,
        relative_humidity_pct: 68,
        pressure_hpa: 987.8,
        wind_speed_kmh: 28.0,
        apparent_temp_c: -17.2,
        solar_elevation_deg: 10.1,
        provenance_tier: "IN_SITU_AWS",
        observed_at: new Date().toISOString(),
      },
    ];

    const { error: ingestErr } = await supabase
      .from("weather_telemetry_history")
      .insert(testObs);

    if (ingestErr) throw new Error(`Failed to insert weather telemetry: ${ingestErr.message}`);

    const { data: historyPoints, error: queryErr } = await supabase
      .from("weather_telemetry_history")
      .select("*")
      .eq("station_code", "BHR")
      .order("observed_at", { ascending: false });

    if (queryErr || !historyPoints || historyPoints.length < 2) {
      throw new Error(`Failed to query weather history points: ${queryErr?.message}`);
    }

    console.log(`  ✓ Successfully archived and queried ${historyPoints.length} observations for BHR.`);
    console.log(`  ✓ Latest observation: Temp ${historyPoints[0].temperature_c}°C, Wind ${historyPoints[0].wind_speed_kmh} km/h, Tier: ${historyPoints[0].provenance_tier}`);
  } catch (err) {
    console.error(`  ✗ Weather History Subsystem FAILED:`, err);
    allPassed = false;
  }

  // --------------------------------------------------------------------------
  // DOMAIN 4: Cargo Containers Manifest (public.cargo_containers)
  // --------------------------------------------------------------------------
  console.log("\n[4/5] Verifying Cargo Containers Manifest (public.cargo_containers)...");
  try {
    const { data: containers, error: cErr } = await supabase
      .from("cargo_containers")
      .select("*")
      .order("container_id");

    if (cErr || !containers || containers.length < 5) {
      throw new Error(`Cargo containers query failed: ${cErr?.message} (found ${containers?.length || 0})`);
    }

    console.log(`  ✓ Successfully queried ${containers.length} containers from PostgreSQL.`);
    const sampleCont = containers[0];
    console.log(`  ✓ Sample Container: ${sampleCont.container_id} [${sampleCont.container_type}] - Stage: ${sampleCont.transit_stage}`);

    // Update transit stage test
    const testCode = "IND-POL-2026-04";
    const initialStage = containers.find((c) => c.container_id === testCode)?.transit_stage || "CAPE_TOWN_BUNKERING";
    const targetStage = "SOUTHERN_OCEAN_TRANSIT";

    const { error: patchErr } = await supabase
      .from("cargo_containers")
      .update({ transit_stage: targetStage, updated_at: new Date().toISOString() })
      .eq("container_id", testCode);

    if (patchErr) throw new Error(`Failed to update transit stage: ${patchErr.message}`);

    const { data: updatedCont } = await supabase
      .from("cargo_containers")
      .select("container_id, transit_stage")
      .eq("container_id", testCode)
      .single();

    if (updatedCont?.transit_stage !== targetStage) {
      throw new Error(`Transit stage mismatch: expected ${targetStage}, got ${updatedCont?.transit_stage}`);
    }
    console.log(`  ✓ Updated ${testCode} transit stage to ${updatedCont?.transit_stage}`);

    // Revert back to original stage
    await supabase
      .from("cargo_containers")
      .update({ transit_stage: initialStage, updated_at: new Date().toISOString() })
      .eq("container_id", testCode);
    console.log(`  ✓ Reverted ${testCode} back to ${initialStage}`);
  } catch (err) {
    console.error(`  ✗ Cargo Containers Subsystem FAILED:`, err);
    allPassed = false;
  }

  // --------------------------------------------------------------------------
  // DOMAIN 5: Operational Alerts Lifecycle (public.operational_alerts)
  // --------------------------------------------------------------------------
  console.log("\n[5/5] Verifying Operational Alerts Lifecycle (public.operational_alerts)...");
  let testAlertId: string | null = null;
  try {
    const { data: alerts, error: aErr } = await supabase
      .from("operational_alerts")
      .select("*")
      .order("triggered_at", { ascending: false });

    if (aErr || !alerts || alerts.length < 3) {
      throw new Error(`Operational alerts query failed: ${aErr?.message} (found ${alerts?.length || 0})`);
    }

    console.log(`  ✓ Found ${alerts.length} operational alerts in PostgreSQL.`);

    // Insert ephemeral alert
    const { data: newAlert, error: insertAlertErr } = await supabase
      .from("operational_alerts")
      .insert({
        severity: "WARNING",
        category: "ENVIRONMENTAL",
        title: "Phase 1 Automated Test Alert",
        details: "Ephemeral test alert to verify lifecycle state transitions in PostgreSQL.",
        status: "ACTIVE",
      })
      .select()
      .single();

    if (insertAlertErr || !newAlert) throw new Error(`Failed to insert test alert: ${insertAlertErr?.message}`);
    testAlertId = newAlert.id;
    console.log(`  ✓ Created ACTIVE test alert: ${testAlertId}`);

    // Acknowledge alert
    const { error: ackErr } = await supabase
      .from("operational_alerts")
      .update({
        status: "ACKNOWLEDGED",
        acknowledged_at: new Date().toISOString(),
      })
      .eq("id", testAlertId);

    if (ackErr) throw new Error(`Failed to acknowledge alert: ${ackErr.message}`);

    const { data: ackAlert } = await supabase
      .from("operational_alerts")
      .select("status, acknowledged_at")
      .eq("id", testAlertId)
      .single();

    if (ackAlert?.status !== "ACKNOWLEDGED") {
      throw new Error(`Alert status mismatch: expected ACKNOWLEDGED, got ${ackAlert?.status}`);
    }
    console.log(`  ✓ Acknowledged alert confirmed in DB at ${ackAlert?.acknowledged_at}`);

    // Resolve and cleanup
    await supabase.from("operational_alerts").delete().eq("id", testAlertId);
    console.log(`  ✓ Cleaned up test alert.`);
  } catch (err) {
    console.error(`  ✗ Operational Alerts Subsystem FAILED:`, err);
    if (testAlertId) {
      await supabase.from("operational_alerts").delete().eq("id", testAlertId);
    }
    allPassed = false;
  }

  console.log("\n================================================================================");
  if (allPassed) {
    console.log("  >>> ALL 5 PHASE 1 OPERATIONAL DOMAINS VERIFIED SUCCESSFULLY IN POSTGRESQL <<<  ");
    console.log("================================================================================");
    process.exit(0);
  } else {
    console.error("  >>> SOME TESTS FAILED. REVIEW LOGS ABOVE. <<<  ");
    console.log("================================================================================");
    process.exit(1);
  }
}

runPhase1Verification();
