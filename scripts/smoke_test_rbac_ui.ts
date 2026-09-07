import fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { chromium, Browser, BrowserContext, Page } from 'playwright';

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

async function runRbacUiSmoke() {
  console.log('================================================================');
  console.log(`   POLARIS RBAC PLAYWRIGHT BROWSER SMOKE TEST SUITE             `);
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

  let browser: Browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
  } catch {
    browser = await chromium.launch({ headless: true });
  }

  const context: BrowserContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page: Page = await context.newPage();

  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.log(`  [BROWSER ERROR] ${msg.text()}`);
    } else {
      console.log(`  [BROWSER ${msg.type()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    console.error(`  [PAGE CRASH]`, err);
  });

  async function loginAs(email: string, roleName: string) {
    console.log(`\n--- Testing ${roleName} in Browser (${email}) ---`);
    await context.clearCookies();
    await page.goto(`${TARGET_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'Polaris@2026');
    
    await Promise.all([
      page.waitForURL((url) => url.pathname === '/' || url.pathname === '', { timeout: 15000 }),
      page.click('button[type="submit"]')
    ]);
    
    await page.waitForSelector('header', { timeout: 10000 });
    // Wait for the specific role badge to populate via AuthProvider
    await page.waitForSelector(`header span:has-text("${roleName}")`, { timeout: 10000 });
  }

  try {
    // -------------------------------------------------------------------------
    // ROLE 1: VIEWER (Read-Only)
    // -------------------------------------------------------------------------
    await loginAs('viewer_6c6_027160@polaris.test', 'VIEWER');

    // Check Header Role Badge
    const viewerBadge = page.locator('header').getByText('VIEWER', { exact: true });
    assert(await viewerBadge.isVisible(), 'Header displays VIEWER role badge');

    // Check SITREP page: File button must NOT be visible
    await page.goto(`${TARGET_URL}/sitrep`, { waitUntil: 'networkidle' });
    const fileSitrepBtn = page.locator('button:has-text("+ File Daily SITREP")');
    assert((await fileSitrepBtn.count()) === 0, 'VIEWER cannot see "+ File Daily SITREP" button');

    // Check Assets page: Permanently Retire must NOT be visible
    await page.goto(`${TARGET_URL}/assets/VEH-PB-01`, { waitUntil: 'networkidle' });
    const retireBtnViewer = page.locator('button:has-text("Permanently Retire")');
    assert((await retireBtnViewer.count()) === 0, 'VIEWER cannot see "Permanently Retire" button');

    // -------------------------------------------------------------------------
    // ROLE 2: STATION_OPERATOR
    // -------------------------------------------------------------------------
    await loginAs('operator_6c6_027160@polaris.test', 'STATION_OPERATOR');

    // Check Header Role Badge
    const opBadge = page.locator('header').getByText('STATION_OPERATOR', { exact: true });
    assert(await opBadge.isVisible(), 'Header displays STATION_OPERATOR role badge');

    // Check SITREP page: File button MUST be visible
    await page.goto(`${TARGET_URL}/sitrep`, { waitUntil: 'networkidle' });
    const opSitrepBtn = page.locator('button:has-text("+ File Daily SITREP")');
    assert(await opSitrepBtn.isVisible(), 'STATION_OPERATOR sees "+ File Daily SITREP" button');

    // Check Assets page: Schedule Maintenance NOT visible, Permanently Retire NOT visible
    await page.goto(`${TARGET_URL}/assets/VEH-PB-01`, { waitUntil: 'networkidle' });
    const opMaintBtn = page.locator('button:has-text("Schedule Maintenance")');
    assert((await opMaintBtn.count()) === 0, 'STATION_OPERATOR cannot see "Schedule Maintenance" button');
    const opRetireBtn = page.locator('button:has-text("Permanently Retire")');
    assert((await opRetireBtn.count()) === 0, 'STATION_OPERATOR cannot see "Permanently Retire" button');

    // -------------------------------------------------------------------------
    // ROLE 3: SUPER_ADMIN
    // -------------------------------------------------------------------------
    await loginAs('super_admin_6c6_027160@polaris.test', 'SUPER_ADMIN');

    // Check Header Role Badge
    const superBadge = page.locator('header').getByText('SUPER_ADMIN', { exact: true });
    assert(await superBadge.isVisible(), 'Header displays SUPER_ADMIN role badge');

    // Check Assets page: Schedule Maintenance and Permanently Retire MUST be visible
    await page.goto(`${TARGET_URL}/assets/VEH-PB-01`, { waitUntil: 'networkidle' });
    const superMaintBtn = page.locator('button:has-text("Schedule Maintenance")');
    assert(await superMaintBtn.isVisible(), 'SUPER_ADMIN sees "Schedule Maintenance" button');
    const superRetireBtn = page.locator('button:has-text("Permanently Retire")');
    assert(await superRetireBtn.isVisible(), 'SUPER_ADMIN sees "Permanently Retire" button');

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`   RBAC UI SMOKE RESULTS: ${passedAssertions} PASSED, ${failedAssertions} FAILED`);
    console.log(`   Console Errors Detected: ${consoleErrors.length}`);
    console.log('================================================================\n');

    if (failedAssertions > 0) {
      process.exit(1);
    }
  } finally {
    await browser.close();
    if (serverProcess) serverProcess.kill();
  }
}

runRbacUiSmoke().catch((err) => {
  console.error('Fatal error in RBAC UI smoke test:', err);
  if (serverProcess) serverProcess.kill();
  process.exit(1);
});
