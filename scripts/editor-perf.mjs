/**
 * Measure how smoothly the editor scrolls.
 *
 * Monaco does not hand its scrolling to the compositor — it re-renders the
 * visible lines every frame — so editor options are per-frame costs, and the
 * only way to keep them honest is to measure them. This drives real wheel and
 * scrollbar-drag input in Chrome, records a DevTools trace, and reports the
 * gaps between committed frames along with where the time went.
 *
 * A 120 Hz display gives you 8.3 ms per frame, a 60 Hz one 16.7 ms.
 *
 * Usage:
 *   node scripts/editor-perf.mjs                 # production build, 1x CPU
 *   node scripts/editor-perf.mjs --throttle 6    # simulate a slower machine
 *   node scripts/editor-perf.mjs --dev           # against the dev server
 *   node scripts/editor-perf.mjs --headless      # no window (no frame data)
 */
import { chromium } from 'playwright';
import { createServer, preview } from 'vite';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};

const DEV = process.argv.includes('--dev');
// Headed by default: a headless Chrome has no real compositor, so it never
// commits frames and the numbers that matter here do not exist.
const HEADLESS = process.argv.includes('--headless');
const THROTTLE = Number(arg('--throttle', 1));
const WIDTH = Number(arg('--width', 1600));
const HEIGHT = Number(arg('--height', 1000));
const DPR = Number(arg('--dpr', 2));

/**
 * A 120 Hz budget, since that is the bar this is held to.
 *
 * The verdict is on main-thread work per frame, not on the gaps between
 * committed frames: a gap only means the compositor had nothing new to show,
 * which happens whenever input arrives slower than the display refreshes. What
 * the app controls — and what makes scrolling stutter — is how long the main
 * thread blocks.
 */
const BUDGET_MS = 8.3;

let server;
let base;
if (DEV) {
  server = await createServer({ server: { port: 4356, strictPort: true }, logLevel: 'warn' });
  await server.listen();
  base = server.resolvedUrls.local[0];
} else {
  server = await preview({ preview: { port: 4357, strictPort: true, open: false }, logLevel: 'warn' });
  base = server.resolvedUrls.local[0];
}

console.log(
  `\nEditor scroll performance — ${DEV ? 'dev server' : 'production build'}, ` +
    `${WIDTH}×${HEIGHT} @${DPR}x, CPU ${THROTTLE}×\n`,
);

const browser = await chromium.launch({ channel: 'chrome', headless: HEADLESS });
const page = await browser.newPage({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: DPR,
});

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForSelector('.monaco-editor', { timeout: 60_000 });
// Monaco paints its container before its text; wait for real content.
await page.waitForFunction(
  () => (document.querySelector('.view-lines')?.textContent ?? '').length > 40,
  null,
  { timeout: 30_000 },
);
await page.waitForTimeout(3000);

const cdp = await page.context().newCDPSession(page);
if (THROTTLE > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });

async function record(action) {
  const events = [];
  const onData = (d) => events.push(...d.value);
  cdp.on('Tracing.dataCollected', onData);
  const complete = new Promise((res) => cdp.once('Tracing.tracingComplete', res));

  await cdp.send('Tracing.start', {
    transferMode: 'ReportEvents',
    traceConfig: {
      includedCategories: [
        'devtools.timeline',
        // Commit — the moment a frame is handed to the compositor — is only
        // emitted under this category, and it is the frame signal that matters.
        'disabled-by-default-devtools.timeline',
      ],
    },
  });
  await action();
  await cdp.send('Tracing.end');
  await complete;
  cdp.off('Tracing.dataCollected', onData);
  return events;
}

function summarise(label, events) {
  const spent = (name) =>
    events.filter((e) => e.name === name && e.ph === 'X').reduce((a, e) => a + e.dur / 1000, 0);

  const commits = events
    .filter((e) => e.name === 'Commit' && e.ph === 'X')
    .map((e) => e.ts / 1000)
    .sort((a, b) => a - b);
  const gaps = commits.slice(1).map((t, i) => t - commits[i]).sort((a, b) => a - b);
  const at = (q) => gaps[Math.floor(gaps.length * q)] ?? 0;

  // Main-thread tasks are what block a frame from being produced at all.
  const tasks = events
    .filter((e) => e.name === 'RunTask' && e.ph === 'X')
    .map((e) => e.dur / 1000)
    .sort((a, b) => a - b);
  const taskAt = (q) => tasks[Math.floor(tasks.length * q)] ?? 0;
  const blocking = tasks.filter((d) => d > BUDGET_MS).length;
  const worstTask = tasks[tasks.length - 1] ?? 0;
  const worst = gaps[gaps.length - 1] ?? 0;

  console.log(`  ${label}`);
  console.log(
    `    main thread   p99 task ${taskAt(0.99).toFixed(1)}ms   worst ${worstTask.toFixed(1)}ms   ` +
      `over ${BUDGET_MS}ms: ${blocking} of ${tasks.length}`,
  );
  console.log(
    `    frames ${commits.length}   median gap ${at(0.5).toFixed(1)}ms   p90 ${at(0.9).toFixed(1)}ms   ` +
      `worst ${worst.toFixed(1)}ms`,
  );
  console.log(
    `    script ${spent('FunctionCall').toFixed(0)}ms   style ${spent('UpdateLayoutTree').toFixed(0)}ms   ` +
      `layout ${spent('Layout').toFixed(0)}ms   paint ${spent('Paint').toFixed(0)}ms   ` +
      `raster ${spent('RasterTask').toFixed(0)}ms`,
  );

  // What the slowest main-thread task was actually doing — the thing to fix.
  if (process.argv.includes('--explain')) {
    const worstRun = events
      .filter((e) => e.name === 'RunTask' && e.ph === 'X')
      .sort((a, b) => b.dur - a.dur)[0];

    if (worstRun) {
      const from = worstRun.ts;
      const to = worstRun.ts + worstRun.dur;
      const inside = events
        .filter((e) => e.ph === 'X' && e.ts >= from && e.ts + e.dur <= to && e !== worstRun)
        .filter((e) => e.dur > 200)
        .sort((a, b) => b.dur - a.dur)
        .slice(0, 8)
        .map((e) => {
          const d = e.args?.data ?? {};
          const where = d.url ? ` ${String(d.url).split('/').pop()}:${d.lineNumber}:${d.columnNumber}` : '';
          return `      ${(e.dur / 1000).toFixed(1)}ms ${e.name}${d.functionName ? ` (${d.functionName})` : ''}${where}`;
        });
      console.log(`    inside the worst task (${(worstRun.dur / 1000).toFixed(1)}ms):`);
      console.log(inside.length ? inside.join('\n') : '      (no attributable sub-events)');
    }
  }

  return { blocking, worstTask, median: at(0.5) };
}

const box = await page.locator('.monaco-editor').first().boundingBox();

// A warm-up pass: the first scroll tokenizes lines nothing has rendered yet,
// which is real work but not what steady-state scrolling costs.
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
for (let i = 0; i < 20; i++) {
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(16);
}
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(500);

const results = [];

results.push(
  summarise(
    'mouse wheel, 60 ticks',
    await record(async () => {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      for (let i = 0; i < 60; i++) {
        await page.mouse.wheel(0, i % 12 < 6 ? 120 : -120);
        await page.waitForTimeout(16);
      }
    }),
  ),
);

const slider = await page
  .locator('.monaco-editor .slider')
  .first()
  .boundingBox()
  .catch(() => null);

if (slider) {
  results.push(
    summarise(
      'scrollbar drag',
      await record(async () => {
        await page.mouse.move(slider.x + slider.width / 2, slider.y + slider.height / 2);
        await page.mouse.down();
        for (let i = 0; i < 50; i++) {
          await page.mouse.move(slider.x + slider.width / 2, slider.y + 4 + (i % 25) * 8);
          await page.waitForTimeout(16);
        }
        await page.mouse.up();
      }),
    ),
  );
} else {
  console.log('  scrollbar drag — skipped, the file is too short to have a slider');
}

await browser.close();
await server.close();

const blocking = results.reduce((a, r) => a + r.blocking, 0);
const worstTask = Math.max(...results.map((r) => r.worstTask));

console.log('');
if (blocking === 0) {
  console.log(
    `✓ Nothing blocked the main thread past ${BUDGET_MS}ms — worst task ${worstTask.toFixed(1)}ms, ` +
      'so the editor can hold 120 fps\n',
  );
} else {
  console.log(`✕ ${blocking} task(s) over ${BUDGET_MS}ms, worst ${worstTask.toFixed(1)}ms\n`);
  process.exitCode = 1;
}
