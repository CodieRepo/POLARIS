// ==============================================================================
// POLARIS Live Production Verification Script
// Validates live public deployment: https://polaris-five-eta.vercel.app
// ==============================================================================

async function verifyLiveProduction() {
  const BASE = 'https://polaris-five-eta.vercel.app';
  console.log('================================================================');
  console.log(`  VERIFYING LIVE PRODUCTION: ${BASE}`);
  console.log('================================================================\n');

  const pageChecks: [string, number][] = [
    ['/', 200],
    ['/sitrep', 200],
    ['/logistics', 200],
    ['/stations', 200],
    ['/assets', 200],
    ['/expeditions', 200],
    ['/provenance', 200],
    ['/sw.js', 200],
    ['/manifest.webmanifest', 200],
    ['/api/health/db', 200],
    ['/api/hardware/devices', 200],
    ['/api/notifications/outbox', 200],
  ];

  let passed = 0;
  let total = 0;

  function assert(cond: boolean, desc: string) {
    total++;
    if (cond) {
      passed++;
      console.log(`  [PASS] ${desc}`);
    } else {
      console.log(`  [FAIL] ${desc}`);
    }
  }

  for (const [path, expectedStatus] of pageChecks) {
    try {
      const res = await fetch(BASE + path);
      assert(res.status === expectedStatus, `GET ${path} -> HTTP ${res.status} (expected ${expectedStatus})`);
    } catch (err) {
      assert(false, `GET ${path} -> Network Error: ${(err as Error).message}`);
    }
  }

  // 1. Check Service Worker distribution & precache definition
  try {
    const swRes = await fetch(BASE + '/sw.js');
    const swText = await swRes.text();
    assert(
      swText.includes('polaris-shell-v2') && swText.includes('PRECACHE_ASSETS'),
      'sw.js contains valid polaris-shell-v2 cache identifier and PRECACHE_ASSETS'
    );
  } catch (err) {
    assert(false, `sw.js fetch failed: ${(err as Error).message}`);
  }

  // 2. Check PWA Web App Manifest
  try {
    const manifestRes = await fetch(BASE + '/manifest.webmanifest');
    const manifest = await manifestRes.json();
    const nameValid = typeof manifest.name === 'string' && manifest.name.includes('POLARIS');
    const displayValid = manifest.display === 'standalone';
    const hasIcons = Array.isArray(manifest.icons) && manifest.icons.length > 0;
    
    assert(
      nameValid && displayValid && hasIcons,
      `manifest.webmanifest metadata valid: name="${manifest.name}", display="${manifest.display}", icons=${manifest.icons?.length}`
    );
  } catch (err) {
    assert(false, `manifest.webmanifest fetch failed: ${(err as Error).message}`);
  }

  // 3. Check Database Connectivity
  try {
    const healthRes = await fetch(BASE + '/api/health/db');
    const healthJson = await healthRes.json();
    assert(healthJson.status === 'connected', `Database Health check: status="${healthJson.status}"`);
  } catch (err) {
    assert(false, `db health check failed: ${(err as Error).message}`);
  }

  console.log('\n================================================================');
  console.log(`  RESULT: ${passed}/${total} LIVE PRODUCTION CHECKS PASSED`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

verifyLiveProduction().catch((e) => {
  console.error('Fatal verification failure:', e);
  process.exit(1);
});
