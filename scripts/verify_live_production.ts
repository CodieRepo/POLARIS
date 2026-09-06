import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://polaris-five-eta.vercel.app";

// Supabase client for cleanup only
const envContent = fs.readFileSync(".env.production", "utf-8");
let supabaseUrl = "";
let serviceRoleKey = "";

for (const line of envContent.split(/\r?\n/)) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (key === "NEXT_PUBLIC_SUPABASE_URL") supabaseUrl = val;
    if (key === "SUPABASE_SERVICE_ROLE_KEY") serviceRoleKey = val;
  }
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function runLiveProductionAudit() {
  console.log("================================================================================");
  console.log("       POLARIS LIVE PRODUCTION AUDIT & PERSISTENCE VERIFICATION                 ");
  console.log(`       Target: ${BASE_URL}                                                    `);
  console.log("================================================================================\n");

  let allPassed = true;

  // --------------------------------------------------------------------------
  // 1. PUBLIC ROUTE ACCESSIBILITY (HTTP 200 & Content Checks)
  // --------------------------------------------------------------------------
  console.log("--- 1. VERIFYING PUBLIC PRODUCTION ROUTES ---");
  const routesToTest = [
    { path: "/", expectedString: "POLARIS Reality Upgrade — Phase 1" },
    { path: "/sitrep", expectedString: "Daily Situation Report" },
    { path: "/logistics", expectedString: "Polar Freight Manifests" },
    { path: "/stations", expectedString: "Bharati" },
    { path: "/assets", expectedString: "POLARIS" },
    { path: "/expeditions", expectedString: "ISEA-44" },
    { path: "/provenance", expectedString: "Provenance" },
  ];

  for (const route of routesToTest) {
    try {
      const url = `${BASE_URL}${route.path}`;
      const res = await fetch(url, { cache: "no-store" });
      const text = await res.text();
      const hasContent = text.includes(route.expectedString);
      if (res.status === 200 && hasContent) {
        console.log(`  ✓ [200 OK] ${route.path.padEnd(15)} (Verified: "${route.expectedString}")`);
      } else {
        throw new Error(`Status ${res.status}, contains "${route.expectedString}": ${hasContent}`);
      }
    } catch (err) {
      console.error(`  ✗ Route ${route.path} FAILED:`, err instanceof Error ? err.message : err);
      allPassed = false;
    }
  }

  // --------------------------------------------------------------------------
  // 2. LIVE PERSISTENCE: FUEL SUBSYSTEM
  // --------------------------------------------------------------------------
  console.log("\n--- 2. VERIFYING LIVE PERSISTENCE: FUEL SUBSYSTEM ---");
  try {
    // 2.1 GET current fuel profiles
    const getRes = await fetch(`${BASE_URL}/api/fuel`, { cache: "no-store" });
    const getJson = await getRes.json();
    if (!getJson.success || !getJson.profiles?.BHR) {
      throw new Error(`Failed to GET /api/fuel: ${JSON.stringify(getJson)}`);
    }
    const initialAutonomy = getJson.profiles.BHR.daysOfAutonomy;
    console.log(`  ✓ GET /api/fuel: Bharati initial autonomy = ${initialAutonomy} days, tanks = ${getJson.profiles.BHR.tanks.length}`);

    // 2.2 POST a dip reading to Day Tank
    const testDipValue = 7850.0;
    const postRes = await fetch(`${BASE_URL}/api/fuel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tankCode: "BHR-TK-03",
        newLevelLiters: testDipValue,
      }),
    });
    const postJson = await postRes.json();
    if (!postJson.success) throw new Error(`POST /api/fuel failed: ${JSON.stringify(postJson)}`);
    console.log(`  ✓ POST /api/fuel: Recorded dip reading ${testDipValue} L on BHR-TK-03 (HTTP ${postRes.status})`);

    // 2.3 RE-FETCH and verify persistent change
    const verifyRes = await fetch(`${BASE_URL}/api/fuel`, { cache: "no-store" });
    const verifyJson = await verifyRes.json();
    const updatedTank = verifyJson.profiles.BHR.tanks.find((t: any) => t.tankCode === "BHR-TK-03");
    if (updatedTank.currentLevelLiters !== testDipValue) {
      throw new Error(`Persisted level mismatch! Expected ${testDipValue}, got ${updatedTank.currentLevelLiters}`);
    }
    console.log(`  ✓ LIVE PERSISTENCE CONFIRMED: BHR-TK-03 level = ${updatedTank.currentLevelLiters} L after remote refetch`);

    // 2.4 Revert to original baseline
    await fetch(`${BASE_URL}/api/fuel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tankCode: "BHR-TK-03",
        newLevelLiters: 8200.0,
      }),
    });
    console.log(`  ✓ Reverted BHR-TK-03 back to baseline 8,200 L`);
  } catch (err) {
    console.error(`  ✗ Live Fuel Persistence FAILED:`, err);
    allPassed = false;
  }

  // --------------------------------------------------------------------------
  // 3. LIVE PERSISTENCE: SITREP & CRYPTOGRAPHIC SHA-256 INTEGRITY
  // --------------------------------------------------------------------------
  console.log("\n--- 3. VERIFYING LIVE PERSISTENCE: SITREP & SHA-256 INTEGRITY ---");
  let createdSitrepId: string | null = null;
  try {
    // 3.1 Fetch current SITREPs
    const listRes = await fetch(`${BASE_URL}/api/sitrep`, { cache: "no-store" });
    const listJson = await listRes.json();
    if (!listJson.success) throw new Error(`GET /api/sitrep failed: ${JSON.stringify(listJson)}`);
    console.log(`  ✓ GET /api/sitrep: Found ${listJson.data.length} existing SITREPs in PostgreSQL`);

    // 3.2 Clean up any stale test report from previous runs
    await supabase.from("daily_sitreps").delete().eq("report_date", "2026-09-04");

    // 3.3 POST a new SITREP with structured body { input, weatherSummary, reportDate }
    const createPayload = {
      input: {
        stationCode: "HMD",
        commanderName: "Dr. Himadri Verifier",
        winterOver: 6,
        summerScience: 12,
        transientAircrew: 0,
        fuelConsumed24hLiters: 95.0,
        generatorRuntimeHours: 24.0,
        outdoorStatus: "GREEN_NORMAL",
        operationalRemarks: "Live production deployment automated persistence verification check.",
      },
      weatherSummary: {
        currentTempC: 2.2,
        minTemp24hC: 0.5,
        maxTemp24hC: 3.8,
        peakWindKmh: 18.0,
        currentPressureHpa: 1004.5,
        pressureDelta6h: -0.8,
      },
      reportDate: "2026-09-04",
    };

    const createRes = await fetch(`${BASE_URL}/api/sitrep`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createPayload),
    });
    const createJson = await createRes.json();
    if (!createJson.success || !createJson.data?.id) {
      throw new Error(`POST /api/sitrep failed: ${JSON.stringify(createJson)}`);
    }
    createdSitrepId = createJson.data.id;
    const generatedHash = createJson.data.integrityHash;
    console.log(`  ✓ POST /api/sitrep: Created SITREP ${createdSitrepId}`);
    console.log(`    Generated Canonical SHA-256 Hash: ${generatedHash}`);

    // 3.4 Verify SITREP Integrity via /api/sitrep/verify
    const verifyRes = await fetch(`${BASE_URL}/api/sitrep/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: createdSitrepId }),
    });
    const verifyJson = await verifyRes.json();
    if (!verifyJson.success || !verifyJson.verification?.isValid) {
      throw new Error(`Integrity verification failed! Response: ${JSON.stringify(verifyJson)}`);
    }
    console.log(`  ✓ POST /api/sitrep/verify: Cryptographic SHA-256 verification SUCCESSFUL (isValid: true)`);

    // 3.5 Cleanup test SITREP
    if (createdSitrepId) {
      await supabase.from("daily_sitreps").delete().eq("id", createdSitrepId);
      console.log(`  ✓ Teardown complete: Cleaned up test SITREP ${createdSitrepId}`);
    }
  } catch (err) {
    console.error(`  ✗ Live SITREP Persistence FAILED:`, err);
    if (createdSitrepId) {
      await supabase.from("daily_sitreps").delete().eq("id", createdSitrepId);
    }
    allPassed = false;
  }

  // --------------------------------------------------------------------------
  // 4. LIVE PERSISTENCE: WEATHER HISTORY ARCHIVING & TREND API
  // --------------------------------------------------------------------------
  console.log("\n--- 4. VERIFYING LIVE PERSISTENCE: WEATHER TELEMETRY ARCHIVING ---");
  try {
    // 4.1 Trigger ingestion endpoint
    const ingestRes = await fetch(`${BASE_URL}/api/weather/ingest`, {
      method: "POST",
      cache: "no-store",
    });
    const ingestJson = await ingestRes.json();
    if (!ingestJson.success) throw new Error(`POST /api/weather/ingest failed: ${JSON.stringify(ingestJson)}`);
    console.log(`  ✓ POST /api/weather/ingest: Live observations scraped & archived to PostgreSQL`);

    // 4.2 Query 24h history endpoint
    const historyRes = await fetch(`${BASE_URL}/api/weather/history?station=BHR&hours=24`, { cache: "no-store" });
    const historyJson = await historyRes.json();
    if (!historyJson.success || !historyJson.trend) {
      throw new Error(`GET /api/weather/history failed: ${JSON.stringify(historyJson)}`);
    }
    console.log(`  ✓ GET /api/weather/history: Station BHR points = ${historyJson.trend.totalPersistedPoints}, hasSufficientData = ${historyJson.trend.hasSufficientData}`);
    console.log(`    Status: "${historyJson.trend.statusMessage}"`);
  } catch (err) {
    console.error(`  ✗ Live Weather Ingestion FAILED:`, err);
    allPassed = false;
  }

  // --------------------------------------------------------------------------
  // 5. LIVE PERSISTENCE: OPERATIONAL ALERTS LIFECYCLE
  // --------------------------------------------------------------------------
  console.log("\n--- 5. VERIFYING LIVE PERSISTENCE: OPERATIONAL ALERTS ---");
  let testAlertId: string | null = null;
  try {
    // 5.1 Query active alerts
    const alertsRes = await fetch(`${BASE_URL}/api/alerts`, { cache: "no-store" });
    const alertsJson = await alertsRes.json();
    if (!alertsJson.success || !alertsJson.alerts) {
      throw new Error(`GET /api/alerts failed: ${JSON.stringify(alertsJson)}`);
    }
    console.log(`  ✓ GET /api/alerts: Found ${alertsJson.alerts.length} active alerts in PostgreSQL`);

    // 5.2 Insert ephemeral alert via Supabase client to test lifecycle on production API
    const { data: insertedAlert, error: insErr } = await supabase
      .from("operational_alerts")
      .insert({
        severity: "WATCH",
        category: "ENVIRONMENTAL",
        title: "Live Production Audit Watch",
        details: "Verifying transition ACK -> RESOLVED on live Vercel API.",
        status: "ACTIVE",
      })
      .select()
      .single();

    if (insErr || !insertedAlert) throw new Error(`Failed to create test alert: ${insErr?.message}`);
    testAlertId = insertedAlert.id;
    console.log(`  ✓ Created test alert in DB: ${testAlertId}`);

    // 5.3 ACKNOWLEDGE alert via live API
    const ackRes = await fetch(`${BASE_URL}/api/alerts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: testAlertId,
        action: "ACKNOWLEDGE",
      }),
    });
    const ackJson = await ackRes.json();
    if (!ackJson.success) throw new Error(`POST /api/alerts ACK failed: ${JSON.stringify(ackJson)}`);
    console.log(`  ✓ POST /api/alerts: Acknowledged alert ${testAlertId} via production API`);

    // 5.4 Confirm DB state is ACKNOWLEDGED
    const { data: dbCheck } = await supabase
      .from("operational_alerts")
      .select("status, acknowledged_at")
      .eq("id", testAlertId)
      .single();
    if (dbCheck?.status !== "ACKNOWLEDGED") {
      throw new Error(`Expected ACKNOWLEDGED, got ${dbCheck?.status}`);
    }
    console.log(`  ✓ DB State Confirmed: status = ${dbCheck.status}, acknowledged_at = ${dbCheck.acknowledged_at}`);

    // 5.5 Cleanup test alert
    await supabase.from("operational_alerts").delete().eq("id", testAlertId);
    console.log(`  ✓ Teardown complete: Cleaned up test alert ${testAlertId}`);
  } catch (err) {
    console.error(`  ✗ Live Alerts Persistence FAILED:`, err);
    if (testAlertId) {
      await supabase.from("operational_alerts").delete().eq("id", testAlertId);
    }
    allPassed = false;
  }

  // --------------------------------------------------------------------------
  // 6. LIVE PERSISTENCE: LOGISTICS CONTAINERS TRANSIT STAGES
  // --------------------------------------------------------------------------
  console.log("\n--- 6. VERIFYING LIVE PERSISTENCE: LOGISTICS MANIFESTS ---");
  try {
    // 6.1 GET containers
    const getRes = await fetch(`${BASE_URL}/api/logistics/containers`, { cache: "no-store" });
    const getJson = await getRes.json();
    if (!getJson.success || !getJson.data?.containers) {
      throw new Error(`GET /api/logistics/containers failed: ${JSON.stringify(getJson)}`);
    }
    console.log(`  ✓ GET /api/logistics/containers: Loaded ${getJson.data.containers.length} containers (System of Record: ${getJson.data.meta.systemOfRecord})`);

    // 6.2 PATCH container stage
    const testCode = "IND-POL-2026-04";
    const patchRes = await fetch(`${BASE_URL}/api/logistics/containers`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        containerCode: testCode,
        newStage: "SOUTHERN_OCEAN_TRANSIT",
      }),
    });
    const patchJson = await patchRes.json();
    if (!patchJson.success) throw new Error(`PATCH /api/logistics/containers failed: ${JSON.stringify(patchJson)}`);
    console.log(`  ✓ PATCH /api/logistics/containers: Updated ${testCode} to SOUTHERN_OCEAN_TRANSIT`);

    // 6.3 Verify persistent state on live GET
    const reGetRes = await fetch(`${BASE_URL}/api/logistics/containers`, { cache: "no-store" });
    const reGetJson = await reGetRes.json();
    const updated = reGetJson.data.containers.find((c: any) => c.containerCode === testCode);
    if (updated.transitStage !== "SOUTHERN_OCEAN_TRANSIT") {
      throw new Error(`Stage mismatch after remote fetch: expected SOUTHERN_OCEAN_TRANSIT, got ${updated.transitStage}`);
    }
    console.log(`  ✓ LIVE PERSISTENCE CONFIRMED: ${testCode} stage = ${updated.transitStage} on live GET`);

    // 6.4 Revert to original baseline
    await fetch(`${BASE_URL}/api/logistics/containers`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        containerCode: testCode,
        newStage: "CAPE_TOWN_BUNKERING",
      }),
    });
    console.log(`  ✓ Reverted ${testCode} back to CAPE_TOWN_BUNKERING`);
  } catch (err) {
    console.error(`  ✗ Live Logistics Manifest Persistence FAILED:`, err);
    allPassed = false;
  }

  console.log("\n================================================================================");
  if (allPassed) {
    console.log("  >>> ALL LIVE PRODUCTION VERIFICATIONS & PERSISTENCE CHECKS PASSED <<<  ");
  } else {
    console.error("  >>> SOME LIVE PRODUCTION CHECKS FAILED. REVIEW LOGS ABOVE. <<<  ");
  }
  console.log("================================================================================");
  process.exit(allPassed ? 0 : 1);
}

runLiveProductionAudit();
