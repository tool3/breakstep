/**
 * Capture screenshots of each panel for visual review.
 * Usage: node scripts/shots.mjs [templateId ...]
 */
import { chromium } from 'playwright';
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';

const OUT = 'screenshots';
mkdirSync(OUT, { recursive: true });

const server = await preview({
  preview: { port: 4323, strictPort: true, open: false },
  logLevel: 'warn',
});
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });

page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

async function shot(name) {
  // Park the pointer so hover tooltips do not appear in the capture.
  await page.mouse.move(10, 500);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  ${OUT}/${name}.png`);
}

async function pickTemplate(title) {
  await page.locator('button[aria-label^="Template:"]').click();
  await page.waitForTimeout(400);
  // Scope to the drawer: the header button matches the same name and sits
  // behind the modal mask.
  await page.locator('.ant-drawer').getByRole('button', { name: new RegExp(title) }).first().click();
  await page.waitForTimeout(800);
}

async function runAndShow(tab) {
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.waitForTimeout(2200);
  await page.getByRole('tab', { name: new RegExp(tab) }).click();
  await page.waitForTimeout(500);
}

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForSelector('.monaco-editor');
await page.waitForTimeout(2500);

const targets = process.argv.slice(2);
const plan = targets.length
  ? targets.map((t) => ({ title: t, tab: 'Visualize', name: t.toLowerCase().replace(/\W+/g, '-') }))
  : [
      { title: '^Stack', tab: 'Visualize', name: '01-stack' },
      { title: '^Queue', tab: 'Visualize', name: '02-queue' },
      { title: '^Linked List', tab: 'Visualize', name: '03-linkedlist' },
      { title: '^Doubly Linked List', tab: 'Visualize', name: '04-doubly' },
      { title: '^Min Heap', tab: 'Visualize', name: '05-minheap' },
      { title: '^Priority Queue', tab: 'Visualize', name: '06-priorityqueue' },
      { title: '^Binary Search Tree', tab: 'Visualize', name: '07-bst' },
      { title: '^Trie', tab: 'Visualize', name: '08-trie' },
      { title: '^Hash Map', tab: 'Visualize', name: '09-hashmap' },
      { title: '^Graph', tab: 'Visualize', name: '10-graph' },
      { title: 'DAG & Topological', tab: 'Visualize', name: '11-dag' },
      { title: 'BFS — Shortest', tab: 'Visualize', name: '12-bfs' },
      { title: 'DFS — Connected', tab: 'Visualize', name: '13-dfs' },
      { title: 'Recursion — Tree', tab: 'Visualize', name: '14-recursion' },
      { title: 'Backtracking — Subsets', tab: 'Visualize', name: '15-backtracking' },
      { title: 'Two Pointers — Two Sum', tab: 'Visualize', name: '16-twopointers' },
    ];

for (const step of plan) {
  console.log(`▸ ${step.title}`);
  await pickTemplate(step.title);
  await runAndShow(step.tab);
  // Land on a mid-run frame; the first is usually the boring initial state.
  // Step a little way in from the start: the first frame is usually the empty
  // initial state and the last is the finished one.
  await page.locator('[class*="VisualizerPanel"] [role="slider"]').first().click({ force: true });
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft');
  await shot(step.name);
}

// Analysis panel on a template with an interesting curve.
console.log('▸ Analyze panel');
await pickTemplate('Sorting — Merge');
await page.getByRole('button', { name: 'Analyze' }).click();
await page.waitForSelector('table', { timeout: 40_000 });
await page.waitForTimeout(1500);
await shot('20-analyze');

console.log('▸ Template picker');
await page.locator('button[aria-label^="Template:"]').click();
await shot('21-templates');
await page.keyboard.press('Escape');

for (const [name, file] of [['Slate', '22-slate'], ['Light', '23-light'], ['Midnight', '24-midnight']]) {
  console.log(`▸ ${name} theme`);
  await page.getByRole('button', { name: 'Theme' }).click();
  await page.waitForTimeout(300);
  await page.getByText(name, { exact: true }).click();
  // Monaco repaints its theme asynchronously; give it room before capturing.
  await page.waitForTimeout(1500);
  await shot(file);
}

console.log('▸ Instrumented mode');
await page.getByRole('button', { name: 'Show instrumentation' }).click();
await page.waitForTimeout(1500);
await shot('25-instrumented');
await page.getByRole('button', { name: 'Hide instrumentation' }).click();
await page.waitForTimeout(800);

console.log('▸ Narrow viewport');
await page.setViewportSize({ width: 720, height: 950 });
await page.waitForTimeout(900);
await shot('26-narrow');

await browser.close();
await server.close();
console.log('\nDone.');
