import { chromium } from 'playwright';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  [PASS] ${message}`);
}

async function verifyLiveSitrep() {
  const TARGET_URL = 'https://polaris-five-eta.vercel.app';
  console.log('================================================================');
  console.log(`  LIVE SITREP INTEGRITY PLAYWRIGHT TEST: ${TARGET_URL}/sitrep   `);
  console.log('================================================================\n');

  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
  } catch {
    browser = await chromium.launch({ headless: true });
  }
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.log(`  [BROWSER ERROR] ${msg.text()}`);
    } else {
      console.log(`  [BROWSER LOG] ${msg.text()}`);
    }
  });

  try {
    // 1. Authenticate as Super Admin
    console.log('--- 1. Authenticating test session via /login ---');
    await page.goto(`${TARGET_URL}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', 'super_admin_6c6_027160@polaris.test');
    await page.fill('input[type="password"]', 'Polaris@2026');
    await page.click('button[type="submit"]');
    await page.waitForURL(`${TARGET_URL}/`, { timeout: 10000 });
    assert(page.url().includes(TARGET_URL), 'Authenticated session active');

    // 2. Open /sitrep
    console.log('\n--- 2. Opening Daily SITREP Page ---');
    await page.goto(`${TARGET_URL}/sitrep`, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Persisted Official Dispatches', { timeout: 10000 });
    assert(await page.locator('text=Persisted Official Dispatches').isVisible(), 'SITREP page loaded successfully');

    // 3. Choose an existing SITREP and click "Verify Integrity"
    console.log('\n--- 3. Verifying Integrity on Existing SITREP ---');
    const verifyButtons = page.locator('button:has-text("Verify Integrity")');
    const verifyCount = await verifyButtons.count();
    assert(verifyCount > 0, `Found ${verifyCount} SITREPs with Verify Integrity button`);

    // Click the first Verify button
    await verifyButtons.first().click();
    await page.waitForSelector('text=SHA-256 VERIFIED', { timeout: 8000 });
    const verifiedBadge = page.locator('text=SHA-256 VERIFIED').first();
    assert(await verifiedBadge.isVisible(), 'UI reports "✓ SHA-256 VERIFIED" for existing SITREP');
    const badgeText = await verifiedBadge.innerText();
    console.log(`  Captured verification result badge: "${badgeText}"`);

    // 4. Create a new SITREP
    console.log('\n--- 4. Creating New SITREP via UI ---');
    await page.click('button:has-text("File Daily SITREP")');
    await page.waitForSelector('text=File Official Daily SITREP', { timeout: 5000 });

    const testCommander = `Cmdr. Live Verification ${Date.now().toString().slice(-4)}`;
    await page.fill('input[value*="Cmdr."]', testCommander);
    await page.click('button[type="submit"]:has-text("Commit")');

    // Wait for card to appear
    await page.waitForSelector(`text=${testCommander}`, { timeout: 10000 });
    assert(await page.locator(`text=${testCommander}`).isVisible(), `New SITREP created with commander "${testCommander}"`);

    // 5. Verify integrity immediately on the new SITREP
    console.log('\n--- 5. Verifying Integrity Immediately on New SITREP ---');
    const newSitrepCard = page.locator(`div.rounded-2xl:has-text("${testCommander}")`).first();
    const newVerifyBtn = newSitrepCard.locator('button:has-text("Verify Integrity")');
    await newVerifyBtn.click();
    await newSitrepCard.locator('text=SHA-256 VERIFIED').waitFor({ timeout: 10000 });
    assert(await newSitrepCard.locator('text=SHA-256 VERIFIED').isVisible(), 'Immediate verification reports "✓ SHA-256 VERIFIED"');

    // 6. Reload page and verify same SITREP again
    console.log('\n--- 6. Reloading Page and Re-verifying Same SITREP ---');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector(`text=${testCommander}`, { timeout: 10000 });

    const reloadedCard = page.locator(`div.rounded-2xl:has-text("${testCommander}")`).first();
    const reloadedVerifyBtn = reloadedCard.locator('button:has-text("Verify Integrity")');
    await reloadedVerifyBtn.click();
    await reloadedCard.locator('text=SHA-256 VERIFIED').waitFor({ timeout: 10000 });
    assert(await reloadedCard.locator('text=SHA-256 VERIFIED').isVisible(), 'Post-reload verification reports "✓ SHA-256 VERIFIED"');

    // Check for any unhandled browser errors
    assert(consoleErrors.length === 0, `0 browser console errors during SITREP integrity workflows (Found: ${consoleErrors.length})`);

    console.log('\n================================================================');
    console.log('  LIVE SITREP INTEGRITY PLAYWRIGHT TEST PASSED 100%');
    console.log('================================================================\n');
  } finally {
    await browser.close();
  }
}

verifyLiveSitrep();
