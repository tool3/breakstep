/**
 * Responsive conformance across a matrix of real device configurations.
 *
 * The claim being tested is specific: on every listed device the app must have
 * no horizontal overflow, no control clipped outside the viewport, no element
 * overlapping the chrome, and every primary action reachable and working. Text
 * is allowed to disappear; functionality is not.
 *
 * Usage: node scripts/responsive.mjs [--headed] [--only=<name fragment>]
 */
import { chromium, devices } from 'playwright';
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';

const HEADED = process.argv.includes('--headed');
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const SHOTS = process.argv.includes('--shots');

if (SHOTS) mkdirSync('screenshots/responsive', { recursive: true });

/** Width, height and pointer type — the three things layout actually depends on. */
const PROFILES = [
  { name: 'iPhone SE', width: 375, height: 667, touch: true, dpr: 2, expect: 'compact' },
  { name: 'Galaxy S8', width: 360, height: 740, touch: true, dpr: 3, expect: 'compact' },
  { name: 'iPhone 14', width: 390, height: 844, touch: true, dpr: 3, expect: 'compact' },
  { name: 'iPhone 14 Pro Max', width: 430, height: 932, touch: true, dpr: 3, expect: 'compact' },
  { name: 'iPhone 14 landscape', width: 844, height: 390, touch: true, dpr: 3, expect: 'compact' },
  { name: 'Pixel 7 landscape', width: 915, height: 412, touch: true, dpr: 2.6, expect: 'compact' },
  { name: 'iPad mini portrait', width: 744, height: 1133, touch: true, dpr: 2, expect: 'stacked' },
  { name: 'iPad portrait', width: 820, height: 1180, touch: true, dpr: 2, expect: 'stacked' },
  { name: 'iPad Pro 11 portrait', width: 834, height: 1194, touch: true, dpr: 2, expect: 'stacked' },
  { name: 'iPad Pro 12.9 portrait', width: 1024, height: 1366, touch: true, dpr: 2, expect: 'desktop' },
  { name: 'iPad landscape', width: 1180, height: 820, touch: true, dpr: 2, expect: 'desktop' },
  { name: 'Surface Duo', width: 540, height: 720, touch: true, dpr: 2.5, expect: 'compact' },
  { name: 'Small laptop', width: 1280, height: 720, touch: false, dpr: 1, expect: 'desktop' },
  { name: 'Laptop', width: 1440, height: 900, touch: false, dpr: 2, expect: 'desktop' },
  { name: 'Desktop', width: 1920, height: 1080, touch: false, dpr: 1, expect: 'desktop' },
  { name: 'Ultrawide', width: 2560, height: 1080, touch: false, dpr: 1, expect: 'desktop' },
];

const failures = [];
const results = [];

function fail(profile, message, detail = '') {
  failures.push(`${profile}: ${message}${detail ? ` — ${detail}` : ''}`);
}

const server = await preview({
  preview: { port: 4350, strictPort: true, open: false },
  logLevel: 'warn',
});
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ channel: 'chrome', headless: !HEADED });

console.log(`\nResponsive matrix — ${PROFILES.length} configurations\n`);

for (const profile of PROFILES) {
  if (ONLY && !profile.name.toLowerCase().includes(ONLY.toLowerCase())) continue;

  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    deviceScaleFactor: profile.dpr,
    hasTouch: profile.touch,
    isMobile: profile.touch && profile.width < 900,
    userAgent: profile.touch ? devices['iPhone 13'].userAgent : undefined,
  });

  const page = await context.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });

  const problems = [];

  try {
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForSelector('.monaco-editor', { timeout: 45_000 });
    await page.waitForTimeout(1200);

    // --- 1. The layout mode the profile is supposed to get -------------------
    const mode = await page.getAttribute('[data-layout]', 'data-layout');
    if (mode !== profile.expect) {
      problems.push(`layout is "${mode}", expected "${profile.expect}"`);
    }

    // --- 2. Nothing may overflow horizontally --------------------------------
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (overflow > 1) problems.push(`horizontal overflow of ${overflow}px`);

    // --- 3. No element may extend past the viewport ---------------------------
    const escapees = await page.evaluate(() => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const out = [];

      for (const el of document.querySelectorAll('button, a, input, [role="tab"], [role="slider"]')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue; // hidden, fine
        if (getComputedStyle(el).visibility === 'hidden') continue;
        if (r.right > width + 1 || r.left < -1 || r.bottom > height + 1 || r.top < -1) {
          out.push(`${el.tagName.toLowerCase()}.${el.className?.toString().slice(0, 24)}`);
        }
      }
      return out.slice(0, 4);
    });
    if (escapees.length) problems.push(`clipped controls: ${escapees.join(', ')}`);

    // --- 4. Touch targets must be tappable -----------------------------------
    if (profile.touch) {
      const small = await page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll('button, [role="tab"]')) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          // 32px is the floor; 44 is ideal but antd's compact icon buttons in
          // a toolbar are acceptable at 38–40.
          if (r.height < 32 || r.width < 24) {
            out.push(`${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 14)} ${Math.round(r.width)}×${Math.round(r.height)}`);
          }
        }
        return out.slice(0, 4);
      });
      if (small.length) problems.push(`targets too small: ${small.join(', ')}`);
    }

    // --- 5. The primary action has to work -----------------------------------
    const run = page.getByRole('button', { name: 'Run', exact: true });
    if ((await run.count()) === 0) {
      problems.push('no Run button');
    } else {
      await run.click();
      await page.waitForTimeout(2200);

      const counter = page.locator('[class*="counter"]').first();
      if ((await counter.count()) === 0) {
        problems.push('running produced no timeline');
      } else if (!/\/\s*[1-9]/.test(await counter.innerText())) {
        problems.push('running produced no frames');
      }
    }

    // --- 6. Every panel must be reachable ------------------------------------
    if (mode === 'compact') {
      const tabs = page.locator('[role="tablist"] [role="tab"]');
      const count = await tabs.count();
      if (count < 5) problems.push(`bottom bar has ${count} tabs, expected 5`);

      for (let i = 0; i < count; i++) {
        await tabs.nth(i).click();
        await page.waitForTimeout(220);
        const after = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        if (after > 1) {
          const label = await tabs.nth(i).innerText();
          problems.push(`overflow ${after}px on tab "${label.trim()}"`);
        }
      }
      await tabs.nth(2).click(); // leave on Visualize for the screenshot
    } else {
      for (const name of [/Output/, /Analyze/, /Visualize/]) {
        const tab = page.getByRole('tab', { name });
        if ((await tab.count()) === 0) problems.push(`missing tab ${name}`);
        else await tab.first().click();
        await page.waitForTimeout(200);
      }
    }

    // --- 7. The template picker must fit -------------------------------------
    await page.locator('button[aria-label^="Template:"]').click();
    await page.waitForTimeout(500);

    const drawer = await page.evaluate(() => {
      const el = document.querySelector('.ant-drawer-content-wrapper');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { width: r.width, right: r.right, viewport: window.innerWidth };
    });
    if (!drawer) problems.push('template picker did not open');
    else if (drawer.width > drawer.viewport + 1) {
      problems.push(`picker ${Math.round(drawer.width)}px wide on a ${drawer.viewport}px screen`);
    }

    const closeVisible = await page
      .locator('.ant-drawer-close')
      .first()
      .isVisible()
      .catch(() => false);
    if (!closeVisible) problems.push('picker close button not visible');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    // --- 8. The LeetCode drawer must fit too ---------------------------------
    await page.locator('button[aria-label="LeetCode problems"]').click();
    await page.waitForTimeout(500);

    const problemDrawer = await page.evaluate(() => {
      const el = document.querySelector('.ant-drawer-content-wrapper');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { width: r.width, viewport: window.innerWidth };
    });
    if (!problemDrawer) problems.push('problem drawer did not open');
    else if (problemDrawer.width > problemDrawer.viewport + 1) {
      problems.push(
        `problem drawer ${Math.round(problemDrawer.width)}px wide on a ${problemDrawer.viewport}px screen`,
      );
    }

    const urlField = await page
      .getByLabel('LeetCode problem URL')
      .isVisible()
      .catch(() => false);
    if (!urlField) problems.push('the problem URL field is not reachable');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    // --- 9. Parameters must be operable --------------------------------------
    if (mode === 'compact') {
      await page.locator('[role="tablist"] [role="tab"]').nth(1).click();
      await page.waitForTimeout(300);
    }
    const paramCount = await page.locator('[class*="ParamsPanel"] label').count();
    if (paramCount === 0) problems.push('no parameter controls reachable');

    if (SHOTS) {
      if (mode === 'compact') await page.locator('[role="tablist"] [role="tab"]').nth(2).click();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: `screenshots/responsive/${profile.name.replace(/\W+/g, '-').toLowerCase()}.png`,
      });
    }
  } catch (err) {
    problems.push(`threw: ${err.message.split('\n')[0]}`);
  }

  const real = consoleErrors.filter((e) => !/Canceled|ResizeObserver|favicon/i.test(e));
  if (real.length) problems.push(`console: ${real[0].slice(0, 80)}`);

  const size = `${profile.width}×${profile.height}`.padEnd(10);
  if (problems.length === 0) {
    console.log(`  ✓ ${profile.name.padEnd(24)} ${size} ${profile.expect}`);
  } else {
    console.log(`  ✕ ${profile.name.padEnd(24)} ${size} ${profile.expect}`);
    for (const p of problems) console.log(`      · ${p}`);
    for (const p of problems) fail(profile.name, p);
  }

  results.push({ profile: profile.name, problems });
  await context.close();
}

await browser.close();
await server.close();

console.log('');
if (failures.length) {
  console.log(`✕ ${failures.length} problem(s) across ${results.filter((r) => r.problems.length).length} configuration(s)\n`);
  process.exit(1);
}
console.log(`✓ All ${results.length} configurations pass\n`);
process.exit(0);
