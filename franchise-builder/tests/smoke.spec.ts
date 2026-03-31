import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:3000';

// ─── helpers ────────────────────────────────────────────────

async function startNewGame(page: Page) {
  await page.goto(BASE);
  // Clear any existing save so we always get a clean state
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: /new empire/i }).click();
  // Pick the first team card
  await page.locator('.card').first().click();
  // Hit the confirm/start franchise button if present (use exact phrase to avoid matching tier headers with "start")
  const confirmBtn = page.getByRole('button', { name: /start franchise|acquire|confirm empire|begin/i }).first();
  if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await confirmBtn.click();
  }
  // Wait for dashboard tabs to appear
  await expect(page.getByRole('button', { name: /home/i }).first()).toBeVisible({ timeout: 10000 });
  // Dismiss tutorial overlay if it appears (tutorial shows on first visit when localStorage is cleared)
  const skipBtn = page.getByRole('button', { name: /skip tutorial/i });
  if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipBtn.click();
  }
  // Wait for auto-save to complete so persistence tests can rely on a saved state
  await page.waitForTimeout(1000);
}

// ─── 1. Intro screen ────────────────────────────────────────
test('intro: renders title and New Empire button', async ({ page }) => {
  await page.goto(BASE);
  await expect(page.getByText(/business of ball/i).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /new empire/i })).toBeVisible();
});

// ─── 2. No JS errors on fresh load ──────────────────────────
test('intro: no JS errors on fresh page load', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto(BASE);
  await page.waitForTimeout(1500);
  expect(errors).toHaveLength(0);
});

// ─── 3. Ticker bar ──────────────────────────────────────────
test('ticker: renders on intro screen', async ({ page }) => {
  await page.goto(BASE);
  await expect(page.locator('.ticker-bar')).toBeVisible();
});

test('ticker: shows NGL and ABL labels after game starts', async ({ page }) => {
  await startNewGame(page);
  await expect(page.locator('.ticker-label.ngl').first()).toBeVisible();
  await expect(page.locator('.ticker-label.abl').first()).toBeVisible();
});

// ─── 4. Franchise selection ────────────────────────────────
test('setup: franchise selection lists teams with league filters', async ({ page }) => {
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: /new empire/i }).click();
  await expect(page.getByText(/choose your franchise/i)).toBeVisible();
  // At least several team cards
  await expect(page.locator('.card').first()).toBeVisible();
  expect(await page.locator('.card').count()).toBeGreaterThan(4);
  // League filter buttons
  await expect(page.getByRole('button', { name: /ngl/i }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /abl/i }).first()).toBeVisible();
});

// ─── 5. Active tab styling ──────────────────────────────────
test('tabs: active tab text is not white-on-white', async ({ page }) => {
  await startNewGame(page);
  const activeTab = page.locator('.tab-btn.active').first();
  await expect(activeTab).toBeVisible();
  // Must not be white text (the old broken state)
  const color = await activeTab.evaluate(el => getComputedStyle(el).color);
  expect(color).not.toBe('rgb(255, 255, 255)');
  // Must not be solid red background (old pill style)
  const bg = await activeTab.evaluate(el => getComputedStyle(el).backgroundColor);
  expect(bg).not.toBe('rgb(200, 32, 42)');
});

test('tabs: active tab has a bottom border (underline style)', async ({ page }) => {
  await startNewGame(page);
  const activeTab = page.locator('.tab-btn.active').first();
  const borderBottom = await activeTab.evaluate(el => getComputedStyle(el).borderBottomWidth);
  // Should be non-zero (2.5px)
  expect(parseFloat(borderBottom)).toBeGreaterThan(0);
});

// ─── 6. Dashboard tabs all render ───────────────────────────
test('dashboard: all tab buttons are visible', async ({ page }) => {
  await startNewGame(page);
  const expectedTabs = ['home', 'slots', 'coach', 'biz', 'facilities', 'finance', 'legacy', 'history'];
  for (const tab of expectedTabs) {
    await expect(
      page.getByRole('button', { name: new RegExp(tab, 'i') }).first()
    ).toBeVisible({ timeout: 5000 });
  }
});

test('dashboard: clicking each tab renders content without JS errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));
  await startNewGame(page);

  const tabs = [
    /slots/i, /coach/i, /biz/i, /facilities/i,
    /finance/i, /legacy/i, /history/i, /home/i,
  ];
  for (const label of tabs) {
    await page.locator('.tab-nav').getByRole('button', { name: label }).first().click();
    await page.waitForTimeout(350);
    await expect(page.locator('.tab-nav').first()).toBeVisible();
  }
  expect(errors).toHaveLength(0);
});

// ─── 7. Facilities tab content ──────────────────────────────
test('facilities: shows stadium name, capacity, and condition', async ({ page }) => {
  await startNewGame(page);
  await page.getByRole('button', { name: /facilities/i }).first().click();
  await expect(page.getByText(/stadium/i).first()).toBeVisible({ timeout: 5000 });
  await expect(page.getByText(/capacity/i).first()).toBeVisible();
  await expect(page.getByText(/condition/i).first()).toBeVisible();
});

// ─── 8. Top nav screens ─────────────────────────────────────
test('nav: Empire screen renders', async ({ page }) => {
  await startNewGame(page);
  await page.getByRole('button', { name: /empire/i }).first().click();
  await expect(page.locator('body')).toContainText(/empire|portfolio|franchise/i, { timeout: 5000 });
});

test('nav: League screen renders standings', async ({ page }) => {
  await startNewGame(page);
  await page.getByRole('button', { name: /league/i }).first().click();
  await expect(page.locator('body')).toContainText(/ngl|abl|standings/i, { timeout: 5000 });
});

test('nav: Market screen renders', async ({ page }) => {
  await startNewGame(page);
  await page.getByRole('button', { name: /market/i }).first().click();
  await expect(page.locator('body')).toContainText(/market|stake|invest/i, { timeout: 5000 });
});

test('nav: Finances screen renders', async ({ page }) => {
  await startNewGame(page);
  await page.getByRole('button', { name: /finances/i }).first().click();
  await expect(page.locator('body')).toContainText(/revenue|cash|profit/i, { timeout: 5000 });
});

test('nav: Analytics screen renders', async ({ page }) => {
  await startNewGame(page);
  await page.getByRole('button', { name: /analytics/i }).first().click();
  await expect(page.locator('body')).toContainText(/analytics|performance|trend|season/i, { timeout: 5000 });
});

// ─── 9. Settings screen ─────────────────────────────────────
test('settings: renders and has delete save option', async ({ page }) => {
  await startNewGame(page);
  await page.getByRole('button', { name: /⚙|settings/i }).first().click();
  await expect(page.getByText(/delete save/i)).toBeVisible({ timeout: 5000 });
});

// ─── 10. Simulate season button ─────────────────────────────
test('gameplay: simulate season button is visible and enabled', async ({ page }) => {
  await startNewGame(page);
  // Should be on home tab — look for sim button
  const simBtn = page.getByRole('button', { name: /simulate|sim season|advance|play/i }).first();
  await expect(simBtn).toBeVisible({ timeout: 5000 });
  await expect(simBtn).toBeEnabled();
});

// ─── 11. Save / load round-trip ─────────────────────────────
test('persistence: team name survives page reload', async ({ page }) => {
  await startNewGame(page);
  // Grab the team heading
  const teamHeading = page.locator('h2').first();
  const teamName = await teamHeading.innerText();
  // Reload
  await page.reload();
  await page.waitForTimeout(1000);
  // Either Continue button or the team name itself should be present
  const hasContinue = await page.getByRole('button', { name: /continue/i }).isVisible().catch(() => false);
  const hasName = await page.getByText(teamName).isVisible().catch(() => false);
  expect(hasContinue || hasName).toBe(true);
});

// ─── Phase 2 — Owner Report & Front Office Log ──────────────

async function simulateOneSeason(page: Page) {
  // Click simulate/advance button and wait for the offseason flow
  // to reach a stable resting state (draft, FA, or back to home).
  // Use a generous timeout — the quarterly flow takes several seconds.
  const simBtn = page.getByRole('button', { name: /simulate|advance|start q/i }).first();
  await simBtn.click();
  // Wait until sim button reappears OR offseason UI appears
  await page.waitForFunction(() => {
    const body = document.body.innerText;
    return body.includes('Draft') || body.includes('Free Agency') ||
           body.includes('Simulate') || body.includes('Start Q');
  }, { timeout: 45000 });
}

// ─── Owner Report (Phase 2A) integration ───────────────────────

test('owner report: does not appear before first simulation', async ({ page }) => {
  await startNewGame(page);
  // Navigate to home tab
  await page.locator('.tab-nav').getByRole('button', { name: /home/i }).first().click();
  await page.waitForTimeout(500);
  const body = await page.locator('body').innerText();
  for (const heading of ['On-Field Results', 'Fan Sentiment', 'Financial Performance', 'Valuation', 'Front Office Verdict']) {
    expect(body).not.toContain(heading);
  }
});

test('owner report: all five sections visible after season simulates', async ({ page }) => {
  await startNewGame(page);
  // Run through the full season flow: training camp → Q1 → Q2 → trade deadline → Q3 → Q4 → playoffs → offseason
  // Keep clicking advance/sim/start buttons until we reach a resting offseason state
  for (let i = 0; i < 20; i++) {
    const btn = page.getByRole('button', { name: /simulate|advance|start q|continue|begin q|finish|done|skip|complete draft|end free agency/i }).first();
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(1500);
    }
    // Check if we've reached the offseason recap state (owner report is visible)
    const hasRecap = await page.getByText(/on.?field results/i).isVisible({ timeout: 1000 }).catch(() => false);
    if (hasRecap) break;
  }
  // Navigate to home tab in case we're not there
  await page.locator('.tab-nav').getByRole('button', { name: /home/i }).first().click().catch(() => {});
  await page.waitForTimeout(500);
  for (const pattern of [/on.?field results/i, /fan sentiment/i, /financial performance/i, /valuation/i, /front office verdict/i]) {
    await expect(page.getByText(pattern).first()).toBeVisible({ timeout: 10000 });
  }
});

test('owner report: GM grade letter is one of A B C D F', async ({ page }) => {
  await startNewGame(page);
  for (let i = 0; i < 20; i++) {
    const btn = page.getByRole('button', { name: /simulate|advance|start q|continue|begin q|finish|done|skip|complete draft|end free agency/i }).first();
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(1500);
    }
    const hasRecap = await page.getByText(/on.?field results/i).isVisible({ timeout: 1000 }).catch(() => false);
    if (hasRecap) break;
  }
  await page.locator('.tab-nav').getByRole('button', { name: /home/i }).first().click().catch(() => {});
  await page.waitForTimeout(500);
  const gradeEl = page.getByText(/grade/i).first();
  await expect(gradeEl).toBeVisible({ timeout: 10000 });
  const text = await gradeEl.innerText();
  expect(/[ABCDF]/.test(text)).toBe(true);
});

test('owner report: no JS errors during or after simulation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));
  await startNewGame(page);
  for (let i = 0; i < 20; i++) {
    const btn = page.getByRole('button', { name: /simulate|advance|start q|continue|begin q|finish|done|skip|complete draft|end free agency/i }).first();
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(1500);
    }
    const hasRecap = await page.getByText(/on.?field results/i).isVisible({ timeout: 1000 }).catch(() => false);
    if (hasRecap) break;
  }
  expect(errors).toHaveLength(0);
});

// ─── Front Office Log integration ──────────────────────────────

test('front office log: history tab renders Log and Stats sub-tabs', async ({ page }) => {
  await startNewGame(page);
  await page.locator('.tab-nav').getByRole('button', { name: /history/i }).first().click();
  await page.waitForTimeout(500);
  await expect(page.getByRole('button', { name: /^Log$/i })).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('button', { name: /^Stats$/i })).toBeVisible({ timeout: 5000 });
});

test('front office log: empty state visible before any moves', async ({ page }) => {
  await startNewGame(page);
  await page.locator('.tab-nav').getByRole('button', { name: /history/i }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /^Log$/i }).click();
  await page.waitForTimeout(300);
  await expect(page.locator('body')).toContainText(/no front office moves/i, { timeout: 5000 });
});

test('front office log: playoff entry appears after season completes', async ({ page }) => {
  await startNewGame(page);
  // Run through the full season
  for (let i = 0; i < 30; i++) {
    const btn = page.getByRole('button', { name: /simulate|advance|start q|continue|begin q|finish|done|skip|complete draft|end free agency|dismiss|continue to season/i }).first();
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(1500);
    }
    // Check if we're back at dashboard with simulate button visible
    const simBtn = await page.getByRole('button', { name: /simulate season/i }).isVisible({ timeout: 1000 }).catch(() => false);
    if (simBtn) break;
  }
  await page.locator('.tab-nav').getByRole('button', { name: /history/i }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /^Log$/i }).click();
  await page.waitForTimeout(500);
  await expect(page.locator('body')).toContainText(/playoff|champion|eliminated/i, { timeout: 10000 });
});

test('front office log: filter pills are visible and clickable', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));
  await startNewGame(page);
  await page.locator('.tab-nav').getByRole('button', { name: /history/i }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /^Log$/i }).click();
  await page.waitForTimeout(300);
  for (const pill of ['All', 'Roster', 'Business', 'Milestones']) {
    const btn = page.getByRole('button', { name: new RegExp(`^${pill}$`, 'i') });
    await expect(btn).toBeVisible({ timeout: 5000 });
    await btn.click();
    await page.waitForTimeout(200);
  }
  expect(errors).toHaveLength(0);
});

test('front office log: Stats sub-tab still shows season data', async ({ page }) => {
  await startNewGame(page);
  // Run through the full season
  for (let i = 0; i < 30; i++) {
    const btn = page.getByRole('button', { name: /simulate|advance|start q|continue|begin q|finish|done|skip|complete draft|end free agency|dismiss|continue to season/i }).first();
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(1500);
    }
    const simBtn = await page.getByRole('button', { name: /simulate season/i }).isVisible({ timeout: 1000 }).catch(() => false);
    if (simBtn) break;
  }
  await page.locator('.tab-nav').getByRole('button', { name: /history/i }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /^Stats$/i }).click();
  await page.waitForTimeout(500);
  await expect(page.locator('body')).toContainText(/revenue|expenses|profit/i, { timeout: 10000 });
});

test('front office log: save round-trip preserves log entries', async ({ page }) => {
  await startNewGame(page);
  // Run through the full season
  for (let i = 0; i < 30; i++) {
    const btn = page.getByRole('button', { name: /simulate|advance|start q|continue|begin q|finish|done|skip|complete draft|end free agency|dismiss|continue to season/i }).first();
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(1500);
    }
    const simBtn = await page.getByRole('button', { name: /simulate season/i }).isVisible({ timeout: 1000 }).catch(() => false);
    if (simBtn) break;
  }
  // Wait for auto-save
  await page.waitForTimeout(2000);
  // Reload page
  await page.reload();
  await page.waitForTimeout(2000);
  // Click Continue if present
  const continueBtn = page.getByRole('button', { name: /continue/i });
  if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await continueBtn.click();
    await page.waitForTimeout(1000);
  }
  // Navigate to history tab, Log sub-tab
  await page.locator('.tab-nav').getByRole('button', { name: /history/i }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /^Log$/i }).click();
  await page.waitForTimeout(500);
  await expect(page.locator('body')).toContainText(/playoff|champion|eliminated/i, { timeout: 10000 });
});
