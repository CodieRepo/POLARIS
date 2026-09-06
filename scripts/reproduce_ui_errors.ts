// ==============================================================================
// POLARIS UI Error Reproduction & Interactive Controls Smoke Test
// ==============================================================================

import fs from 'fs';

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
const TARGET = process.argv[2] || 'https://polaris-five-eta.vercel.app';

interface ControlTest {
  name: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: any;
}

async function runAudit() {
  console.log(`Auditing UI actions & API endpoints against: ${TARGET}\n`);

  const tests: ControlTest[] = [
    // 1. Hardware Telemetry Simulate Edge Poll
    {
      name: 'Simulate Edge Poll (BHR)',
      url: `${TARGET}/api/hardware/devices`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { gatewayId: 'EDGE-GW-BHR-01' },
    },
    {
      name: 'Simulate Edge Poll (MTR)',
      url: `${TARGET}/api/hardware/devices`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { gatewayId: 'EDGE-GW-MTR-01' },
    },
    // 2. Fuel Dip Submission
    {
      name: 'Record Fuel Dip (POST /api/fuel)',
      url: `${TARGET}/api/fuel`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        tankCode: 'BHR-TK-01',
        newLevelLiters: 122200,
      },
    },
    // 3. SITREP Submission
    {
      name: 'Submit Daily SITREP (POST /api/sitrep)',
      url: `${TARGET}/api/sitrep`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        stationId: 'b0000000-0000-0000-0000-000000000001',
        reportDate: new Date().toISOString().split('T')[0],
        commanderName: 'Dr. S. K. Roy',
        signerIdentity: 'EXPEDITION_LEADER',
        headcount: { winterOver: 24, summerScience: 0, transient: 0 },
        operations: {
          powerGeneratorRuntimeHours: 24,
          stationFuelConsumedLiters: 480,
          outdoorOperationsClearance: 'GREEN_NORMAL',
          remarks: 'Automated smoke test SITREP',
        },
        weather: {
          minTempC: -15.4,
          maxTempC: -9.8,
          peakWindKmh: 32.1,
          meanPressureHpa: 984.2,
          pressureDelta6h: -0.5,
        },
      },
    },
    // 4. SITREP Verify Integrity
    {
      name: 'Verify SITREP Integrity (POST /api/sitrep/verify)',
      url: `${TARGET}/api/sitrep/verify`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { id: 'dummy-verify-id' }, // Test route handles invalid ID gracefully
    },
    // 5. Offline Sync
    {
      name: 'Offline Sync Endpoint (POST /api/offline/sync)',
      url: `${TARGET}/api/offline/sync`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { mutations: [] },
    },
    // 6. Logistics Container Stage Change
    {
      name: 'Logistics Container Stage Update (PATCH /api/logistics/containers)',
      url: `${TARGET}/api/logistics/containers`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: {
        containerCode: 'IND-POL-2026-01',
        newStage: 'SOUTHERN_OCEAN_TRANSIT',
      },
    },
    // 7. Alert Acknowledgment
    {
      name: 'Acknowledge Operational Alert (POST /api/alerts)',
      url: `${TARGET}/api/alerts`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        id: 'dummy-alert-id',
        action: 'ACKNOWLEDGE',
      },
    },
    // 8. Notification Outbox Summary (GET /api/notifications/outbox)
    {
      name: 'Notification Outbox Status (GET /api/notifications/outbox)',
      url: `${TARGET}/api/notifications/outbox`,
      method: 'GET',
    },
    // 9. Notification Test (POST /api/notifications/test)
    {
      name: 'Notification Test Dispatch (POST /api/notifications/test)',
      url: `${TARGET}/api/notifications/test`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        channel: 'MOCK',
        recipient: 'test@polaris.gov.in',
        severity: 'WATCH',
        category: 'SMOKE_TEST',
        title: 'Smoke Test Alert',
        message: 'Verifying notification pipeline from UI',
      },
    },
    // 10. Push Subscribe (POST /api/notifications/push-subscribe)
    {
      name: 'Push Subscription Registration (POST /api/notifications/push-subscribe)',
      url: `${TARGET}/api/notifications/push-subscribe`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        subscription: {
          endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/test-smoke-endpoint',
          keys: {
            p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9AcUbV3CjdUncnIdjfDqWD6PCbIInCGWuXWYpTUVoHFlG0',
            auth: 'tBHItJI5svbpez7KI4CCXg',
          },
        },
        stationId: 'b0000000-0000-0000-0000-000000000001',
      },
    },
  ];

  for (const t of tests) {
    try {
      const res = await fetch(t.url, {
        method: t.method,
        headers: t.headers,
        body: t.body ? JSON.stringify(t.body) : undefined,
      });
      const data = await res.json().catch(() => null);
      console.log(`[${res.status}] ${t.name} -> ${res.ok ? 'OK' : 'FAILED'}`);
      if (!res.ok) {
        console.log(`   Error Response:`, data);
      }
    } catch (err) {
      console.log(`[ERR] ${t.name} -> ${(err as Error).message}`);
    }
  }
}

runAudit();
