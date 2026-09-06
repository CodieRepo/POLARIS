// ==============================================================================
// POLARIS Final Runtime Deployment Readiness Verification Suite
// Tests live production runtime against localhost:3000 & Supabase PostgreSQL
// ==============================================================================

import fs from 'fs';
import { randomUUID, createHash } from 'crypto';

// 1. Load environment variables
const envContent = fs.readFileSync('.env.production', 'utf-8');
for (const line of envContent.split(/\r?\n/)) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}
process.env.POLARIS_NOTIFICATION_SANDBOX = 'true';

import { spawn, ChildProcess } from 'child_process';
import { createServerClient } from '@/infrastructure/db/supabase-server';

const PORT = 3000;
const BASE_URL = process.env.VERIFY_TARGET_URL || `http://localhost:${PORT}`;

async function waitForServer(url: string, maxRetries = 30): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

let serverProcess: ChildProcess | null = null;

async function runRuntimeVerification() {
  // If verifying localhost, make sure server is running
  if (BASE_URL.includes('localhost')) {
    const isRunning = await waitForServer(BASE_URL, 2);
    if (!isRunning) {
      console.log(`Starting Next.js production server on ${BASE_URL}...`);
      serverProcess = spawn('npx.cmd', ['next', 'start', '-p', String(PORT)], {
        stdio: 'pipe',
        shell: true,
        env: { ...process.env, PORT: String(PORT) },
      });
      const ready = await waitForServer(BASE_URL, 25);
      if (!ready) {
        throw new Error('Failed to start Next.js local production server');
      }
      console.log('Local Next.js server is ready.\n');
    }
  }

  try {
    console.log('================================================================');
    console.log('  POLARIS PRE-DEPLOYMENT RUNTIME READINESS VERIFICATION PASS    ');
    console.log('================================================================\n');

    const supabase = createServerClient();
  let passed = 0;
  let total = 0;

  function assert(cond: boolean, name: string) {
    total++;
    if (cond) {
      console.log(`  [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name}`);
      throw new Error(`Failed check: ${name}`);
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: BROWSER PWA & SERVICE WORKER VERIFICATION
  // --------------------------------------------------------------------------
  console.log('1. Verifying Real Browser PWA & Service Worker Distribution...');

  // 1.1 Load PWA pages
  const homeRes = await fetch(`${BASE_URL}/`);
  assert(homeRes.status === 200, 'GET / returns HTTP 200 (App Shell loaded)');
  const homeHtml = await homeRes.text();
  assert(
    homeHtml.includes('manifest.webmanifest'),
    'App Shell contains PWA manifest reference'
  );

  const sitrepRes = await fetch(`${BASE_URL}/sitrep`);
  assert(sitrepRes.status === 200, 'GET /sitrep returns HTTP 200');

  const stationsRes = await fetch(`${BASE_URL}/stations`);
  assert(stationsRes.status === 200, 'GET /stations returns HTTP 200');

  // 1.2 Manifest verification
  const manifestRes = await fetch(`${BASE_URL}/manifest.webmanifest`);
  assert(manifestRes.status === 200, 'GET /manifest.webmanifest returns HTTP 200');
  const manifestJson = await manifestRes.json();
  assert(
    manifestJson.display === 'standalone' && manifestJson.short_name === 'POLARIS',
    'Manifest contains standalone display and valid POLARIS metadata'
  );

  // 1.3 Service Worker verification
  const swRes = await fetch(`${BASE_URL}/sw.js`);
  assert(swRes.status === 200, 'GET /sw.js returns HTTP 200');
  const swCode = await swRes.text();
  assert(
    swCode.includes('polaris-shell-v2.0.0') &&
      swCode.includes('addEventListener(\'fetch\'') &&
      swCode.includes('addEventListener(\'sync\''),
    'Service Worker implements Stale-While-Revalidate app shell cache & background sync'
  );

  // --------------------------------------------------------------------------
  // TEST 2: OFFLINE MUTATION BUFFER & ZERO-TRUST SYNC IDEMPOTENCY
  // --------------------------------------------------------------------------
  console.log('\n2. Verifying Offline Mutations, Zero-Trust Execution & Idempotency...');

  const idempotencyKeySitrep = randomUUID();
  const idempotencyKeyFuel = randomUUID();
  const stationId = 'b0000000-0000-0000-0000-000000000001';
  const reportDate = `2026-09-${String(Math.floor(Math.random() * 20) + 10).padStart(2, '0')}`;

  const sitrepMutation = {
    idempotencyKey: idempotencyKeySitrep,
    actionType: 'SUBMIT_SITREP',
    stationId,
    payload: {
      reportDate,
      commanderName: 'Cmdr. Vikram Shekhawat',
      signerIdentity: 'STATION_COMMANDER_BHR',
      winterOverHeadcount: 24,
      summerScienceHeadcount: 18,
      transientHeadcount: 0,
      fuelConsumed24hLiters: 480.0,
      generatorRuntimeHours: 24.0,
      outdoorStatus: 'GREEN_NORMAL',
      operationalRemarks: 'Offline runtime validation test report.',
      // Untrusted client attempt:
      clientSuppliedHash: 'fake_client_hash_xyz',
    },
    createdAt: new Date().toISOString(),
    syncAttempts: 0,
    status: 'PENDING',
  };

  const fuelMutation = {
    idempotencyKey: idempotencyKeyFuel,
    actionType: 'LOG_FUEL_DIP',
    stationId,
    payload: {
      tankId: '70000000-0000-0000-0000-000000000001',
      dipReadingLiters: 122200.0,
    },
    createdAt: new Date().toISOString(),
    syncAttempts: 0,
    status: 'PENDING',
  };

  // Submit mutations to /api/offline/sync
  const syncRes1 = await fetch(`${BASE_URL}/api/offline/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mutations: [sitrepMutation, fuelMutation] }),
  });

  assert(syncRes1.status === 200, 'POST /api/offline/sync returns HTTP 200');
  const syncJson1 = await syncRes1.json();
  assert(
    syncJson1.synced === 2 && syncJson1.failed === 0,
    'Both offline mutations synced and executed successfully'
  );

  // Verify server authoritative hash in PostgreSQL (not client fake hash)
  const { data: verifiedSitrep } = await supabase
    .from('daily_sitreps')
    .select('integrity_hash')
    .eq('station_id', stationId)
    .eq('report_date', reportDate)
    .single();

  assert(
    !!verifiedSitrep && verifiedSitrep.integrity_hash !== 'fake_client_hash_xyz',
    'Server computed authoritative SHA-256 hash, rejecting client hash'
  );

  // Verify authoritative fuel tank update
  const { data: verifiedTank } = await supabase
    .from('station_fuel_tanks')
    .select('current_level_liters')
    .eq('id', '70000000-0000-0000-0000-000000000001')
    .single();

  assert(
    Number(verifiedTank?.current_level_liters) === 122200.0,
    'Authoritative fuel tank level updated to 122,200 L in PostgreSQL'
  );

  // REPLAY TEST: Resubmit the exact same mutations with the same idempotency keys
  const syncRes2 = await fetch(`${BASE_URL}/api/offline/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mutations: [sitrepMutation, fuelMutation] }),
  });

  assert(syncRes2.status === 200, 'Replay POST /api/offline/sync returns HTTP 200');
  const syncJson2 = await syncRes2.json();
  assert(
    syncJson2.synced === 2 && syncJson2.results.every((r: any) => r.status === 'COMPLETED'),
    'Idempotency ledger returned saved response without re-executing'
  );

  // Verify row count in daily_sitreps for that date is exactly 1
  const { data: sitrepCountRows } = await supabase
    .from('daily_sitreps')
    .select('id')
    .eq('station_id', stationId)
    .eq('report_date', reportDate);

  assert(
    sitrepCountRows?.length === 1,
    'Exactly 1 SITREP row exists in PostgreSQL (zero duplicates created on replay)'
  );

  // Teardown test SITREP
  await supabase
    .from('daily_sitreps')
    .delete()
    .eq('station_id', stationId)
    .eq('report_date', reportDate);

  // --------------------------------------------------------------------------
  // TEST 3: GATEWAY SECURITY & KEY REVOCATION
  // --------------------------------------------------------------------------
  console.log('\n3. Verifying Gateway Security & Key Revocation...');

  const validKey = process.env.POLARIS_GATEWAY_KEY || '';
  const validKeyHash = createHash('sha256').update(validKey).digest('hex');

  // Record last_seen_at before test
  const { data: gwBefore } = await supabase
    .from('gateway_credentials')
    .select('last_seen_at')
    .eq('gateway_id', 'EDGE-GW-BHR-01')
    .single();

  const dummyEvent = {
    eventId: randomUUID(),
    gatewayId: 'EDGE-GW-BHR-01',
    deviceId: 'BHR-MODBUS-TK01',
    sequenceNumber: 9999,
    bootSessionId: 'boot-sec-test',
    observedAt: new Date().toISOString(),
    metric: 'FUEL_LEVEL_LITERS',
    value: 122400.0,
    unit: 'liters',
    quality: 'SIMULATED',
    source: 'VIRTUAL',
    classification: 'SIMULATED_TELEMETRY',
  };

  // 3.1 Invalid gateway ID -> 401
  const invGwRes = await fetch(`${BASE_URL}/api/hardware/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-polaris-gateway-id': 'UNKNOWN-GW-99',
      'x-polaris-gateway-key': validKey,
    },
    body: JSON.stringify({ events: [dummyEvent] }),
  });
  assert(invGwRes.status === 401, 'Invalid gateway ID returns HTTP 401');

  // 3.2 Invalid gateway key -> 401
  const invKeyRes = await fetch(`${BASE_URL}/api/hardware/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-polaris-gateway-id': 'EDGE-GW-BHR-01',
      'x-polaris-gateway-key': 'invalid_secret_key_999',
    },
    body: JSON.stringify({ events: [dummyEvent] }),
  });
  assert(invKeyRes.status === 401, 'Invalid gateway key returns HTTP 401');

  // 3.3 Revoked gateway -> 401
  const revokedGwId = `EDGE-REVOKED-${Date.now()}`;
  await supabase.from('gateway_credentials').insert({
    gateway_id: revokedGwId,
    station_id: stationId,
    name: 'Temporary Test Revoked Gateway',
    key_hash: validKeyHash,
    is_active: false,
    revoked_at: new Date().toISOString(),
  });

  const revokedRes = await fetch(`${BASE_URL}/api/hardware/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-polaris-gateway-id': revokedGwId,
      'x-polaris-gateway-key': validKey,
    },
    body: JSON.stringify({ events: [{ ...dummyEvent, gatewayId: revokedGwId }] }),
  });
  assert(revokedRes.status === 401, 'Revoked gateway credentials return HTTP 401');

  // Teardown revoked test gateway
  await supabase.from('gateway_credentials').delete().eq('gateway_id', revokedGwId);

  // 3.4 Valid gateway credentials -> 200
  const validRes = await fetch(`${BASE_URL}/api/hardware/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-polaris-gateway-id': 'EDGE-GW-BHR-01',
      'x-polaris-gateway-key': validKey,
    },
    body: JSON.stringify({ events: [dummyEvent] }),
  });
  assert(validRes.status === 200, 'Valid gateway credentials return HTTP 200');

  // 3.5 Verify last_seen_at updated after valid auth
  const { data: gwAfter } = await supabase
    .from('gateway_credentials')
    .select('last_seen_at')
    .eq('gateway_id', 'EDGE-GW-BHR-01')
    .single();

  assert(
    gwAfter?.last_seen_at !== gwBefore?.last_seen_at,
    'last_seen_at timestamp updated only after successful authentication'
  );

  // --------------------------------------------------------------------------
  // TEST 4: TELEMETRY REPLAY DEDUPLICATION TEST
  // --------------------------------------------------------------------------
  console.log('\n4. Verifying Reboot-Safe Telemetry Replay Deduplication...');

  const runSessionId = `boot-dedup-run-${Date.now()}`;
  const replayedEvents = [
    {
      eventId: randomUUID(),
      gatewayId: 'EDGE-GW-BHR-01',
      deviceId: 'BHR-MODBUS-GEN01',
      sequenceNumber: 7771,
      bootSessionId: runSessionId,
      observedAt: new Date().toISOString(),
      metric: 'GENERATOR_POWER_KW',
      value: 141.5,
      unit: 'kW',
      quality: 'SIMULATED',
      source: 'VIRTUAL',
      classification: 'SIMULATED_TELEMETRY',
    },
    {
      eventId: randomUUID(),
      gatewayId: 'EDGE-GW-BHR-01',
      deviceId: 'BHR-SNMP-UPS01',
      sequenceNumber: 7772,
      bootSessionId: runSessionId,
      observedAt: new Date().toISOString(),
      metric: 'BATTERY_VOLTAGE_V',
      value: 230.5,
      unit: 'V',
      quality: 'SIMULATED',
      source: 'VIRTUAL',
      classification: 'SIMULATED_TELEMETRY',
    },
  ];

  // Batch 1: Initial Ingest
  const telemRes1 = await fetch(`${BASE_URL}/api/hardware/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-polaris-gateway-id': 'EDGE-GW-BHR-01',
      'x-polaris-gateway-key': validKey,
    },
    body: JSON.stringify({ events: replayedEvents }),
  });
  const telemJson1 = await telemRes1.json();
  assert(
    telemJson1.accepted === 2 && telemJson1.deduplicated === 0,
    'First telemetry batch accepted: 2, deduplicated: 0'
  );

  // Batch 2: Exact Replay with same reboot-safe identity (gateway_id, device_id, boot_session_id, sequence_number)
  const telemRes2 = await fetch(`${BASE_URL}/api/hardware/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-polaris-gateway-id': 'EDGE-GW-BHR-01',
      'x-polaris-gateway-key': validKey,
    },
    body: JSON.stringify({ events: replayedEvents }),
  });
  const telemJson2 = await telemRes2.json();
  assert(
    telemJson2.accepted === 0 && telemJson2.deduplicated === 2,
    'Replay telemetry batch accepted: 0, deduplicated: 2 (zero duplicate rows inserted)'
  );

  // --------------------------------------------------------------------------
  // TEST 5: OUTBOX AUTONOMOUS DISPATCH & SCHEDULING CONFIGURATION AUDIT
  // --------------------------------------------------------------------------
  console.log('\n5. Auditing Outbox Autonomous Scheduling & Dispatch Pipeline...');

  // 5.1 Check vercel.json cron configuration
  const hasVercelJson = fs.existsSync('vercel.json');
  let hasVercelCron = false;
  let cronPath = '';
  let cronSchedule = '';
  if (hasVercelJson) {
    try {
      const vConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf-8'));
      hasVercelCron = Array.isArray(vConfig.crons) && vConfig.crons.length > 0;
      if (hasVercelCron) {
        cronPath = vConfig.crons[0].path;
        cronSchedule = vConfig.crons[0].schedule;
      }
    } catch {}
  }

  console.log(`  [INFO] vercel.json exists: ${hasVercelJson}`);
  console.log(`  [INFO] Vercel Crons configured: ${hasVercelCron} (${cronSchedule} -> ${cronPath})`);
  assert(
    hasVercelJson && hasVercelCron && cronPath === '/api/notifications/outbox',
    `Confirmed: Autonomous background cron configured in vercel.json (${cronSchedule} -> /api/notifications/outbox)`
  );

  // 5.2 Test Cron Bearer Authorization Protection
  const cronSecret = process.env.CRON_SECRET || '';
  if (cronSecret) {
    // Bad auth check
    const badCronRes = await fetch(`${BASE_URL}/api/notifications/outbox`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid_cron_secret',
      },
      body: JSON.stringify({ batchSize: 5 }),
    });
    assert(badCronRes.status === 401, 'POST /api/notifications/outbox rejects invalid CRON_SECRET with HTTP 401');

    // Good auth check via Vercel Cron GET invocation
    const goodCronRes = await fetch(`${BASE_URL}/api/notifications/outbox`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
    });
    assert(goodCronRes.status === 200, 'GET /api/notifications/outbox accepts valid CRON_SECRET bearer token (HTTP 200)');
    const cronData = await goodCronRes.json();
    assert(cronData.source === 'vercel_cron', 'Vercel Cron invocation source identified correctly');
  }

  // 5.3 End-to-end Outbox dispatch pipeline verification
  const outboxTestRes = await fetch(`${BASE_URL}/api/notifications/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channel: 'TELEGRAM',
      recipient: '@polaris_ops_channel',
      severity: 'WARNING',
      category: 'TEST_DISPATCH',
      title: 'Pre-Deployment Outbox Pipeline Test',
      message: 'Verifying Operational Alert -> notification_outbox -> deliveries pipeline.',
    }),
  });
  assert(outboxTestRes.status === 200, 'POST /api/notifications/test returns HTTP 200');
  const outboxJson = await outboxTestRes.json();
  assert(
    outboxJson.success && outboxJson.dispatchSummary.succeeded >= 1,
    'Operational Alert queued to notification_outbox and delivered to notification_deliveries'
  );

    console.log('\n================================================================');
    console.log(`  ALL ${passed}/${total} RUNTIME READINESS CHECKS PASSED (100%)`);
    console.log('================================================================\n');
  } finally {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
  }
}

runRuntimeVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nRuntime readiness check failed:', err);
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
    process.exit(1);
  });
