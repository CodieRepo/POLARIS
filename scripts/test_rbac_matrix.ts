import fs from 'fs';
import { spawn, ChildProcess } from 'child_process';

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
const TARGET_URL = process.argv[2] || process.env.VERIFY_TARGET_URL || 'http://localhost:3000';
const IS_LOCAL = TARGET_URL.includes('localhost') || TARGET_URL.includes('127.0.0.1');

interface TestUser {
  role: string;
  email: string;
  password: string;
}

const TEST_USERS: TestUser[] = [
  { role: 'SUPER_ADMIN', email: 'super_admin_6c6_027160@polaris.test', password: 'Polaris@2026' },
  { role: 'COMMAND_ADMIN', email: 'cmd_admin_6c6_027160@polaris.test', password: 'Polaris@2026' },
  { role: 'EXPEDITION_MANAGER', email: 'manager_a_6c6_027160@polaris.test', password: 'Polaris@2026' },
  { role: 'STATION_OPERATOR', email: 'operator_6c6_027160@polaris.test', password: 'Polaris@2026' },
  { role: 'VIEWER', email: 'viewer_6c6_027160@polaris.test', password: 'Polaris@2026' },
];

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

async function loginUser(user: TestUser): Promise<string> {
  const res = await fetch(`${TARGET_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: user.password }),
  });

  if (!res.ok) {
    throw new Error(`Failed to login as ${user.role} (${user.email}): HTTP ${res.status}`);
  }

  // Extract set-cookie header
  const cookieHeaders = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  const rawCookie = res.headers.get('set-cookie');
  if (cookieHeaders.length > 0) {
    return cookieHeaders.map((c) => c.split(';')[0]).join('; ');
  } else if (rawCookie) {
    return rawCookie.split(';')[0];
  }
  return '';
}

async function executeMutation(
  endpoint: string,
  method: string,
  body: Record<string, unknown>,
  cookie?: string
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (cookie) {
    headers['Cookie'] = cookie;
  }

  const res = await fetch(`${TARGET_URL}${endpoint}`, {
    method,
    headers,
    body: JSON.stringify(body),
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  return { status: res.status, data };
}

let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedAssertions++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failedAssertions++;
  }
}

async function runRbacTests() {
  console.log('================================================================');
  console.log(`   POLARIS COMPREHENSIVE RBAC API AUTHORIZATION TEST SUITE      `);
  console.log(`   Target: ${TARGET_URL}                                        `);
  console.log('================================================================\n');

  if (IS_LOCAL) {
    const isRunning = await waitForServer(TARGET_URL, 2);
    if (!isRunning) {
      console.log(`Starting local Next.js server on ${TARGET_URL}...`);
      serverProcess = spawn('npx.cmd', ['next', 'start', '-p', '3000'], {
        stdio: 'pipe',
        shell: true,
        env: { ...process.env, ...env, PORT: '3000' },
      });
      const ready = await waitForServer(TARGET_URL, 25);
      if (!ready) throw new Error('Failed to start local server');
      console.log('Local server ready.\n');
    }
  }

  try {
    // -------------------------------------------------------------------------
    // TEST SECTION 1: UNAUTHENTICATED REQUESTS MUST RECEIVE HTTP 401
    // -------------------------------------------------------------------------
    console.log('--- SECTION 1: UNAUTHENTICATED MUTATION ACCESS (Zero Credentials) ---');

    const unauthFuel = await executeMutation('/api/fuel', 'POST', { tankCode: 'BHR-TK-01', newLevelLiters: 120000 });
    assert(unauthFuel.status === 401, `POST /api/fuel unauthenticated -> HTTP 401 (Got: ${unauthFuel.status})`);

    const unauthSitrep = await executeMutation('/api/sitrep', 'POST', {
      input: { stationCode: 'BHR', commanderName: 'Test Unauth', headcount: 20, fuelConsumedLiters: 400 },
    });
    assert(unauthSitrep.status === 401, `POST /api/sitrep unauthenticated -> HTTP 401 (Got: ${unauthSitrep.status})`);

    const unauthLogistics = await executeMutation('/api/logistics/containers', 'PATCH', {
      containerCode: 'IND-POL-2026-01',
      newStage: 'STATION_DELIVERED',
    });
    assert(unauthLogistics.status === 401, `PATCH /api/logistics/containers unauthenticated -> HTTP 401 (Got: ${unauthLogistics.status})`);

    const unauthAlerts = await executeMutation('/api/alerts', 'POST', {
      id: '90000000-0000-0000-0000-000000000001',
      action: 'ACKNOWLEDGE',
    });
    assert(unauthAlerts.status === 401, `POST /api/alerts unauthenticated -> HTTP 401 (Got: ${unauthAlerts.status})`);

    const unauthHw = await executeMutation('/api/hardware/devices', 'POST', { gatewayId: 'EDGE-GW-BHR-01' });
    assert(unauthHw.status === 401, `POST /api/hardware/devices unauthenticated -> HTTP 401 (Got: ${unauthHw.status})`);

    const unauthNotif = await executeMutation('/api/notifications/test', 'POST', { channel: 'TELEGRAM' });
    assert(unauthNotif.status === 401, `POST /api/notifications/test unauthenticated -> HTTP 401 (Got: ${unauthNotif.status})`);

    const unauthMaint = await executeMutation('/api/maintenance', 'POST', {
      asset_id: 'f0000000-0000-0000-0000-000000000001',
      maintenance_type: 'PREVENTIVE',
      scheduled_at: new Date().toISOString(),
    });
    assert(unauthMaint.status === 401, `POST /api/maintenance unauthenticated -> HTTP 401 (Got: ${unauthMaint.status})`);

    const unauthOffline = await executeMutation('/api/offline/sync', 'POST', {
      mutations: [{ idempotencyKey: '00000000-0000-0000-0000-000000000001', actionType: 'LOG_FUEL_DIP', stationId: 'b0000000-0000-0000-0000-000000000001', payload: {} }],
    });
    assert(unauthOffline.status === 401, `POST /api/offline/sync unauthenticated -> HTTP 401 (Got: ${unauthOffline.status})`);

    // -------------------------------------------------------------------------
    // TEST SECTION 2: VIEWER ROLE (Strictly Read-Only, 0 Successful Mutations)
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 2: VIEWER ROLE ACCESS (Strict Read-Only Guarantee) ---');
    const viewerUser = TEST_USERS.find((u) => u.role === 'VIEWER')!;
    const viewerCookie = await loginUser(viewerUser);

    const vFuel = await executeMutation('/api/fuel', 'POST', { tankCode: 'BHR-TK-01', newLevelLiters: 120000 }, viewerCookie);
    assert(vFuel.status === 403, `VIEWER: POST /api/fuel -> HTTP 403 (Got: ${vFuel.status})`);

    const vSitrep = await executeMutation('/api/sitrep', 'POST', {
      input: { stationCode: 'BHR', commanderName: 'Viewer Mutation Attempt', headcount: 20, fuelConsumedLiters: 400 },
    }, viewerCookie);
    assert(vSitrep.status === 403, `VIEWER: POST /api/sitrep -> HTTP 403 (Got: ${vSitrep.status})`);

    const vLogistics = await executeMutation('/api/logistics/containers', 'PATCH', {
      containerCode: 'IND-POL-2026-01',
      newStage: 'STATION_DELIVERED',
    }, viewerCookie);
    assert(vLogistics.status === 403, `VIEWER: PATCH /api/logistics/containers -> HTTP 403 (Got: ${vLogistics.status})`);

    const vAlerts = await executeMutation('/api/alerts', 'POST', {
      id: '90000000-0000-0000-0000-000000000001',
      action: 'ACKNOWLEDGE',
    }, viewerCookie);
    assert(vAlerts.status === 403, `VIEWER: POST /api/alerts -> HTTP 403 (Got: ${vAlerts.status})`);

    const vHw = await executeMutation('/api/hardware/devices', 'POST', { gatewayId: 'EDGE-GW-BHR-01' }, viewerCookie);
    assert(vHw.status === 403, `VIEWER: POST /api/hardware/devices -> HTTP 403 (Got: ${vHw.status})`);

    const vNotif = await executeMutation('/api/notifications/test', 'POST', { channel: 'TELEGRAM' }, viewerCookie);
    assert(vNotif.status === 403, `VIEWER: POST /api/notifications/test -> HTTP 403 (Got: ${vNotif.status})`);

    const vMaint = await executeMutation('/api/maintenance', 'POST', {
      asset_id: 'f0000000-0000-0000-0000-000000000001',
      maintenance_type: 'PREVENTIVE',
      scheduled_at: new Date().toISOString(),
    }, viewerCookie);
    assert(vMaint.status === 403, `VIEWER: POST /api/maintenance -> HTTP 403 (Got: ${vMaint.status})`);

    const vRetire = await executeMutation('/api/assets/VEH-PB-01', 'PATCH', { status: 'RETIRED' }, viewerCookie);
    assert(vRetire.status === 403, `VIEWER: PATCH /api/assets/[code] (Retire) -> HTTP 403 (Got: ${vRetire.status})`);

    const vOffline = await executeMutation('/api/offline/sync', 'POST', {
      mutations: [{ idempotencyKey: '00000000-0000-0000-0000-000000000002', actionType: 'LOG_FUEL_DIP', stationId: 'b0000000-0000-0000-0000-000000000001', payload: {} }],
    }, viewerCookie);
    assert(vOffline.status === 403, `VIEWER: POST /api/offline/sync -> HTTP 403 (Got: ${vOffline.status})`);

    // Cryptographic verification IS allowed for VIEWER (read-only verification)
    const vVerify = await executeMutation('/api/sitrep/verify', 'POST', { id: 'a1000000-0000-0000-0000-000000000001' }, viewerCookie);
    assert(vVerify.status === 200, `VIEWER: POST /api/sitrep/verify (Read-only verification) -> HTTP 200 (Got: ${vVerify.status})`);

    // -------------------------------------------------------------------------
    // TEST SECTION 3: STATION_OPERATOR ROLE
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 3: STATION_OPERATOR ROLE (Station Operational Duties) ---');
    const opUser = TEST_USERS.find((u) => u.role === 'STATION_OPERATOR')!;
    const opCookie = await loginUser(opUser);

    // Permitted: Fuel dip
    const opFuel = await executeMutation('/api/fuel', 'POST', { tankCode: 'BHR-TK-01', newLevelLiters: 122400 }, opCookie);
    assert(opFuel.status === 200, `STATION_OPERATOR: POST /api/fuel -> HTTP 200 (Got: ${opFuel.status})`);

    // Permitted: SITREP filing
    const opSitrep = await executeMutation('/api/sitrep', 'POST', {
      input: {
        stationCode: 'BHR',
        commanderName: 'Cmdr. Vikram Shekhawat',
        winterOverHeadcount: 24,
        summerScienceHeadcount: 18,
        fuelConsumed24hLiters: 480,
        generatorRuntimeHours: 24,
        outdoorStatus: 'GREEN_NORMAL',
        operationalRemarks: 'STATION_OPERATOR automated verification dispatch.',
      },
      weatherSummary: { minTemp24hC: -16.2, maxTemp24hC: -11.4, peakWindKmh: 46.5 },
      reportDate: '2026-09-08',
    }, opCookie);
    assert(opSitrep.status === 200, `STATION_OPERATOR: POST /api/sitrep -> HTTP 200 (Got: ${opSitrep.status})`);

    // Permitted: Logistics stage change
    const opLogistics = await executeMutation('/api/logistics/containers', 'PATCH', {
      containerCode: 'IND-POL-2026-01',
      newStage: 'SOUTHERN_OCEAN_TRANSIT',
    }, opCookie);
    assert(opLogistics.status === 200, `STATION_OPERATOR: PATCH /api/logistics/containers -> HTTP 200 (Got: ${opLogistics.status})`);

    // Forbidden: Maintenance scheduling (Admins / assigned managers only)
    const opMaint = await executeMutation('/api/maintenance', 'POST', {
      asset_id: 'f0000000-0000-0000-0000-000000000001',
      maintenance_type: 'PREVENTIVE',
      scheduled_at: new Date().toISOString(),
      description: 'Operator routine check',
    }, opCookie);
    assert(opMaint.status === 403, `STATION_OPERATOR: POST /api/maintenance -> HTTP 403 (Got: ${opMaint.status})`);

    // Permitted: Edge Poll simulation
    const opHw = await executeMutation('/api/hardware/devices', 'POST', { gatewayId: 'EDGE-GW-BHR-01' }, opCookie);
    assert(opHw.status === 200, `STATION_OPERATOR: POST /api/hardware/devices -> HTTP 200 (Got: ${opHw.status})`);

    // Forbidden: Notification test dispatch
    const opNotif = await executeMutation('/api/notifications/test', 'POST', { channel: 'TELEGRAM' }, opCookie);
    assert(opNotif.status === 403, `STATION_OPERATOR: POST /api/notifications/test (Admin only) -> HTTP 403 (Got: ${opNotif.status})`);

    // Forbidden: Asset retirement
    const opRetire = await executeMutation('/api/assets/VEH-PB-01', 'PATCH', { status: 'RETIRED' }, opCookie);
    assert(opRetire.status === 403, `STATION_OPERATOR: PATCH /api/assets/[code] (Retire) -> HTTP 403 (Got: ${opRetire.status})`);

    // -------------------------------------------------------------------------
    // TEST SECTION 4: EXPEDITION_MANAGER ROLE
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 4: EXPEDITION_MANAGER ROLE (Mission Field Authority) ---');
    const expUser = TEST_USERS.find((u) => u.role === 'EXPEDITION_MANAGER')!;
    const expCookie = await loginUser(expUser);

    // Permitted: SITREP filing
    const expSitrep = await executeMutation('/api/sitrep', 'POST', {
      input: {
        stationCode: 'MTR',
        commanderName: 'Dr. Rajesh Nair',
        winterOverHeadcount: 20,
        summerScienceHeadcount: 15,
        fuelConsumed24hLiters: 420,
        generatorRuntimeHours: 24,
        outdoorStatus: 'GREEN_NORMAL',
        operationalRemarks: 'EXPEDITION_MANAGER verified situation dispatch.',
      },
      weatherSummary: { minTemp24hC: -18.5, maxTemp24hC: -12.1, peakWindKmh: 35.0 },
      reportDate: '2026-09-08',
    }, expCookie);
    assert(expSitrep.status === 200, `EXPEDITION_MANAGER: POST /api/sitrep -> HTTP 200 (Got: ${expSitrep.status})`);

    // Permitted: Logistics stage change
    const expLogistics = await executeMutation('/api/logistics/containers', 'PATCH', {
      containerCode: 'IND-POL-2026-02',
      newStage: 'SOUTHERN_OCEAN_TRANSIT',
    }, expCookie);
    assert(expLogistics.status === 200, `EXPEDITION_MANAGER: PATCH /api/logistics/containers -> HTTP 200 (Got: ${expLogistics.status})`);

    // Forbidden: Fuel dip (fuel dip is Station Operator / Admin role)
    const expFuel = await executeMutation('/api/fuel', 'POST', { tankCode: 'BHR-TK-01', newLevelLiters: 122400 }, expCookie);
    assert(expFuel.status === 403, `EXPEDITION_MANAGER: POST /api/fuel -> HTTP 403 (Got: ${expFuel.status})`);

    // Forbidden: Asset retirement
    const expRetire = await executeMutation('/api/assets/VEH-PB-01', 'PATCH', { status: 'RETIRED' }, expCookie);
    assert(expRetire.status === 403, `EXPEDITION_MANAGER: PATCH /api/assets/[code] (Retire) -> HTTP 403 (Got: ${expRetire.status})`);

    // -------------------------------------------------------------------------
    // TEST SECTION 5: COMMAND_ADMIN ROLE
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 5: COMMAND_ADMIN ROLE (HQ Operational Authority) ---');
    const cmdUser = TEST_USERS.find((u) => u.role === 'COMMAND_ADMIN')!;
    const cmdCookie = await loginUser(cmdUser);

    // Permitted: Fuel dip
    const cmdFuel = await executeMutation('/api/fuel', 'POST', { tankCode: 'BHR-TK-01', newLevelLiters: 122400 }, cmdCookie);
    assert(cmdFuel.status === 200, `COMMAND_ADMIN: POST /api/fuel -> HTTP 200 (Got: ${cmdFuel.status})`);

    // Permitted: Notification test dispatch
    const cmdNotif = await executeMutation('/api/notifications/test', 'POST', { channel: 'TELEGRAM' }, cmdCookie);
    assert(cmdNotif.status === 200, `COMMAND_ADMIN: POST /api/notifications/test -> HTTP 200 (Got: ${cmdNotif.status})`);

    // Permitted: Maintenance scheduling
    const cmdMaint = await executeMutation('/api/maintenance', 'POST', {
      asset_id: 'f0000000-0000-0000-0000-000000000001',
      maintenance_type: 'PREVENTIVE',
      scheduled_at: new Date().toISOString(),
      description: 'HQ Commander scheduled work order',
    }, cmdCookie);
    assert(cmdMaint.status === 201, `COMMAND_ADMIN: POST /api/maintenance -> HTTP 201 (Got: ${cmdMaint.status})`);

    // Forbidden: Asset retirement (SUPER_ADMIN strictly isolated)
    const cmdRetire = await executeMutation('/api/assets/VEH-PB-01', 'PATCH', { status: 'RETIRED' }, cmdCookie);
    assert(cmdRetire.status === 403, `COMMAND_ADMIN: PATCH /api/assets/[code] (Retire) -> HTTP 403 (Got: ${cmdRetire.status})`);

    // -------------------------------------------------------------------------
    // TEST SECTION 6: SUPER_ADMIN ROLE (Unrestricted Authority)
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 6: SUPER_ADMIN ROLE (Root Authority) ---');
    const superUser = TEST_USERS.find((u) => u.role === 'SUPER_ADMIN')!;
    const superCookie = await loginUser(superUser);

    const sFuel = await executeMutation('/api/fuel', 'POST', { tankCode: 'BHR-TK-01', newLevelLiters: 122400 }, superCookie);
    assert(sFuel.status === 200, `SUPER_ADMIN: POST /api/fuel -> HTTP 200 (Got: ${sFuel.status})`);

    const sNotif = await executeMutation('/api/notifications/test', 'POST', { channel: 'TELEGRAM' }, superCookie);
    assert(sNotif.status === 200, `SUPER_ADMIN: POST /api/notifications/test -> HTTP 200 (Got: ${sNotif.status})`);

    const sAlert = await executeMutation('/api/alerts', 'POST', {
      id: '90000000-0000-0000-0000-000000000001',
      action: 'ACKNOWLEDGE',
    }, superCookie);
    assert(sAlert.status === 200, `SUPER_ADMIN: POST /api/alerts -> HTTP 200 (Got: ${sAlert.status})`);

    const sMaint = await executeMutation('/api/maintenance', 'POST', {
      asset_id: 'f0000000-0000-0000-0000-000000000001',
      maintenance_type: 'PREVENTIVE',
      scheduled_at: new Date().toISOString(),
      description: 'Super Admin emergency servicing order',
    }, superCookie);
    assert(sMaint.status === 201, `SUPER_ADMIN: POST /api/maintenance -> HTTP 201 (Got: ${sMaint.status})`);

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`   RBAC AUTHORIZATION RESULTS: ${passedAssertions} PASSED, ${failedAssertions} FAILED`);
    console.log('================================================================\n');

    if (failedAssertions > 0) {
      process.exit(1);
    }
  } finally {
    if (serverProcess) {
      serverProcess.kill();
    }
  }
}

runRbacTests().catch((err) => {
  console.error('Fatal error during RBAC matrix testing:', err);
  if (serverProcess) serverProcess.kill();
  process.exit(1);
});
