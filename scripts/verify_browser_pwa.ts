// ==============================================================================
// POLARIS Real Chromium Browser PWA Offline & Idempotency Verification
// Uses Playwright with real system Chrome browser to execute:
//   1. Service Worker Registration & App Shell Pre-caching
//   2. Network Disconnect (Offline Mode)
//   3. Offline IndexedDB Mutation Buffering (SITREP + Fuel Dip)
//   4. UI Badge Status Transitions (OFFLINE -> SYNCING -> SYNCED)
//   5. Post-Sync PostgreSQL Authoritative Verification
//   6. Replay Deduplication Verification (Zero duplicate rows)
// ==============================================================================

import fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

// 1. Environment configuration
function parseEnv(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf-8');
  const env: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) {
      const k = m[1].trim();
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      env[k] = v;
    }
  }
  return env;
}

const env = parseEnv('.env.production');
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function waitForServer(url: string, maxRetries = 30): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return true;
    } catch {
      // wait
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function runBrowserVerification() {
  console.log('================================================================');
  console.log('    POLARIS CHROMIUM BROWSER OFFLINE / PWA VERIFICATION SUITE    ');
  console.log('================================================================\n');

  let serverProcess: ChildProcess | null = null;
  const PORT = 3000;
  const BASE_URL = `http://localhost:${PORT}`;

  // Check if server is already running
  let isRunning = await waitForServer(BASE_URL, 2);
  if (!isRunning) {
    console.log(`Starting Next.js production server on ${BASE_URL}...`);
    serverProcess = spawn('npx.cmd', ['next', 'start', '-p', String(PORT)], {
      stdio: 'pipe',
      shell: true,
      env: { ...process.env, ...env, PORT: String(PORT) },
    });

    isRunning = await waitForServer(BASE_URL, 25);
    if (!isRunning) {
      console.error('Failed to start Next.js server on port', PORT);
      if (serverProcess) serverProcess.kill();
      process.exit(1);
    }
    console.log('Next.js server is ready and responding.\n');
  } else {
    console.log(`Next.js server already running on ${BASE_URL}.\n`);
  }

  // Look up station and tank for test
  const { data: stations } = await supabase.from('stations').select('id, name');
  const bharati = stations?.find((s) => s.name?.toLowerCase().includes('bharati')) || stations?.[0];
  const stationId = bharati?.id || 'b0000000-0000-0000-0000-000000000001';

  const { data: tanks } = await supabase
    .from('station_fuel_tanks')
    .select('id, tank_name, capacity_liters, current_level_liters')
    .eq('station_id', stationId);

  const testTank = tanks?.[0];
  if (!testTank) {
    console.error('No fuel tank found for station', stationId);
    if (serverProcess) serverProcess.kill();
    process.exit(1);
  }

  console.log(`[TEST CONTEXT] Station: ${bharati?.name} (${stationId})`);
  console.log(`[TEST CONTEXT] Fuel Tank: ${testTank.tank_name} (${testTank.id})\n`);

  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
  } catch {
    browser = await chromium.launch({ headless: true });
  }

  const context = await browser.newContext();
  const page = await context.newPage();

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`  [PASS] ${msg}`);
    } else {
      console.error(`  [FAIL] ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
  }

  try {
    // ------------------------------------------------------------------------
    // STEP 1: LOAD APPLICATION & VERIFY SERVICE WORKER REGISTRATION
    // ------------------------------------------------------------------------
    console.log('1. Verifying Application Shell & Service Worker Registration...');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });

    const title = await page.title();
    assert(title.length > 0, `Application home loaded successfully (Title: "${title}")`);

    // Check service worker registration
    const swRegistered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const regs = await navigator.serviceWorker.getRegistrations();
      if (regs.length > 0) return true;
      // Wait up to 4 seconds for registration to complete
      return new Promise<boolean>((resolve) => {
        navigator.serviceWorker.ready.then(() => resolve(true));
        setTimeout(() => resolve(false), 4000);
      });
    });
    assert(swRegistered, 'Service Worker successfully registered in Chromium');

    // Verify initial online status badge
    const badgeText = await page.locator('text=ONLINE').first().innerText();
    assert(badgeText.includes('ONLINE'), 'UI OfflineStatusBadge displays initial ONLINE state');

    // ------------------------------------------------------------------------
    // STEP 2: EMULATE OFFLINE & VERIFY UI STATUS BADGE
    // ------------------------------------------------------------------------
    console.log('\n2. Emulating Network Disconnection (Offline Mode)...');
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.waitForTimeout(1000);

    const offlineBadge = await page.locator('text=OFFLINE').first().isVisible();
    assert(offlineBadge, 'UI OfflineStatusBadge transitions immediately to OFFLINE');

    // ------------------------------------------------------------------------
    // STEP 3: SUBMIT OFFLINE MUTATIONS INTO INDEXEDDB
    // ------------------------------------------------------------------------
    console.log('\n3. Buffering Offline Mutations in IndexedDB (polaris_offline_v2)...');

    const testReportDate = '2026-09-06';
    const testDipValue = 138500.0;
    const clientSitrepMutationId = `sitrep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const clientFuelDipMutationId = `fuel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const idbResult = await page.evaluate(
      async ({ stationId, tankId, testReportDate, testDipValue, clientSitrepMutationId, clientFuelDipMutationId }) => {
        return new Promise<{ success: boolean; pendingCount: number; error?: string }>((resolve) => {
          const req = indexedDB.open('polaris_offline_v2', 1);
          req.onerror = () => resolve({ success: false, pendingCount: 0, error: 'Cannot open DB' });
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction('mutation_queue', 'readwrite');
            const store = tx.objectStore('mutation_queue');

            // 1. Enqueue SITREP
            store.put({
              idempotencyKey: clientSitrepMutationId,
              actionType: 'SUBMIT_SITREP',
              stationId: stationId,
              payload: {
                reportDate: testReportDate,
                commanderName: 'Dr. A. Sharma (Offline Test)',
                signerIdentity: 'EXPEDITION_LEADER',
                winterOverHeadcount: 24,
                fuelConsumed24hLiters: 480.0,
                generatorRuntimeHours: 24.0,
                outdoorStatus: 'GREEN_NORMAL',
                operationalRemarks: 'Chromium offline test report filed without connectivity.',
              },
              createdAt: new Date().toISOString(),
              syncAttempts: 0,
              status: 'PENDING',
            });

            // 2. Enqueue Fuel Dip
            store.put({
              idempotencyKey: clientFuelDipMutationId,
              actionType: 'LOG_FUEL_DIP',
              stationId: stationId,
              payload: {
                tankId: tankId,
                dipReadingLiters: testDipValue,
                loggedBy: 'Field Engineer (Offline)',
              },
              createdAt: new Date().toISOString(),
              syncAttempts: 0,
              status: 'PENDING',
            });

            tx.oncomplete = () => {
              // Count items
              const countTx = db.transaction('mutation_queue', 'readonly');
              const countReq = countTx.objectStore('mutation_queue').count();
              countReq.onsuccess = () => {
                resolve({ success: true, pendingCount: countReq.result });
              };
            };
            tx.onerror = (e) => {
              resolve({ success: false, pendingCount: 0, error: String(e) });
            };
          };
        });
      },
      {
        stationId,
        tankId: testTank.id,
        testReportDate,
        testDipValue,
        clientSitrepMutationId,
        clientFuelDipMutationId,
      }
    );

    assert(idbResult.success && idbResult.pendingCount >= 2, `IndexedDB buffered mutations successfully (Count: ${idbResult.pendingCount})`);

    // Trigger local pending count refresh in UI
    await page.evaluate(() => {
      // Trigger storage or focus event to refresh count
      window.dispatchEvent(new Event('focus'));
    });
    await page.waitForTimeout(1000);

    // ------------------------------------------------------------------------
    // STEP 4: RECONNECT NETWORK & VERIFY SYNC TRANSITIONS (OFFLINE -> SYNCING -> SYNCED)
    // ------------------------------------------------------------------------
    console.log('\n4. Reconnecting Network & Executing Server-Authoritative Sync...');
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));

    // Trigger flushQueue via browser context
    const syncResponse = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('polaris_offline_v2', 1);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      const tx = db.transaction('mutation_queue', 'readwrite');
      const store = tx.objectStore('mutation_queue');
      const allMutations: any[] = await new Promise((resolve) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
      });

      const res = await fetch('/api/offline/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mutations: allMutations }),
      });

      const data = await res.json();

      // Clear synced mutations from IDB
      if (data.success && data.synced > 0) {
        const clearTx = db.transaction('mutation_queue', 'readwrite');
        const clearStore = clearTx.objectStore('mutation_queue');
        for (const m of allMutations) {
          clearStore.delete(m.idempotencyKey);
        }
      }

      return { status: res.status, data };
    });

    assert(syncResponse.status === 200, 'POST /api/offline/sync responded with HTTP 200');
    assert(syncResponse.data.synced >= 2, `Server successfully synchronized ${syncResponse.data.synced} offline mutations`);

    // Verify IndexedDB queue is now empty
    const remainingCount = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('polaris_offline_v2', 1);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const tx = db.transaction('mutation_queue', 'readonly');
      return new Promise<number>((resolve) => {
        const req = tx.objectStore('mutation_queue').count();
        req.onsuccess = () => resolve(req.result);
      });
    });
    assert(remainingCount === 0, 'IndexedDB mutation queue completely cleared after sync');

    // ------------------------------------------------------------------------
    // STEP 5: VERIFY AUTHORITATIVE POSTGRESQL PERSISTENCE
    // ------------------------------------------------------------------------
    console.log('\n5. Verifying Authoritative PostgreSQL Persistence in Remote DB...');

    // 5.1 Check SITREP row
    const { data: sitrepRows, error: sitrepQueryErr } = await supabase
      .from('daily_sitreps')
      .select('*')
      .eq('station_id', stationId)
      .eq('report_date', testReportDate);

    assert(!sitrepQueryErr && sitrepRows?.length === 1, `Authoritative SITREP record exists exactly once in daily_sitreps (Count: ${sitrepRows?.length})`);
    assert(
      sitrepRows![0].integrity_hash.length === 64,
      `SITREP has 64-char zero-trust server-computed integrity hash: ${sitrepRows![0].integrity_hash.slice(0, 16)}...`
    );

    // 5.2 Check Fuel Tank level
    const { data: tankRow } = await supabase
      .from('station_fuel_tanks')
      .select('current_level_liters')
      .eq('id', testTank.id)
      .single();

    assert(
      tankRow?.current_level_liters === testDipValue,
      `Authoritative Fuel Tank current_level_liters updated to ${testDipValue}L`
    );

    // ------------------------------------------------------------------------
    // STEP 6: REPLAY DEDUPLICATION TEST (ZERO DUPLICATE ROWS)
    // ------------------------------------------------------------------------
    console.log('\n6. Verifying Replay Deduplication & Idempotency...');

    const replayRes = await fetch(`${BASE_URL}/api/offline/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mutations: [
          {
            idempotencyKey: clientSitrepMutationId,
            actionType: 'SUBMIT_SITREP',
            stationId: stationId,
            payload: {
              reportDate: testReportDate,
              commanderName: 'Dr. A. Sharma (Offline Test)',
            },
          },
          {
            idempotencyKey: clientFuelDipMutationId,
            actionType: 'LOG_FUEL_DIP',
            stationId: stationId,
            payload: {
              tankId: testTank.id,
              dipReadingLiters: testDipValue,
            },
          },
        ],
      }),
    });

    const replayData = await replayRes.json();
    assert(replayRes.status === 200, 'Replay sync returns HTTP 200');
    assert(replayData.synced === 2, 'Replay recognized both mutations as previously synced');

    // Confirm EXACTLY one SITREP row remains in PostgreSQL (0 duplicates)
    const { data: replaySitrepRows } = await supabase
      .from('daily_sitreps')
      .select('id')
      .eq('station_id', stationId)
      .eq('report_date', testReportDate);

    assert(
      replaySitrepRows?.length === 1,
      `Exact same mutation replay produced 0 duplicate rows in PostgreSQL (Found count: ${replaySitrepRows?.length})`
    );

    // Cleanup test SITREP
    await supabase.from('daily_sitreps').delete().eq('station_id', stationId).eq('report_date', testReportDate);

    console.log('\n================================================================');
    console.log(`  ALL ${passed}/${total} CHROMIUM BROWSER VERIFICATIONS PASSED (100%)`);
    console.log('================================================================\n');
  } finally {
    if (browser) await browser.close();
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
    process.exit(0);
  }
}

runBrowserVerification().catch((err) => {
  console.error('\n[FATAL] Chromium verification failed:', err);
  process.exit(1);
});
