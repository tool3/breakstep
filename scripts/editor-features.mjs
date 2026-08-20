/**
 * Does the editor do what a code editor does?
 *
 * Monaco ships its editing features as separately-importable contributions, so
 * "does Cmd+D work" is a question about the bundle, not about configuration —
 * and turning one off to save bytes is a silent removal that no unit test would
 * notice. This drives the real keystrokes in a real browser and checks the real
 * result, so a contribution that stops being imported fails the build.
 *
 * Two of these are configuration rather than contributions, and they are the two
 * that were most recently wrong: occurrence highlighting and indent guides were
 * both switched off in the name of scroll performance. They are back on, and
 * `scripts/editor-perf.mjs` is what proves they are affordable.
 *
 * Usage: node scripts/editor-features.mjs
 */
import { chromium } from 'playwright';
import { preview } from 'vite';

const server = await preview({ preview: { port: 4371, strictPort: true, open: false }, logLevel: 'warn' });
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✕'} ${name}${ok || !detail ? '' : ` — ${detail}`}`);
  ok ? pass++ : fail++;
};

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForSelector('.monaco-editor', { timeout: 60_000 });
await page.waitForFunction(() => (document.querySelector('.view-lines')?.textContent ?? '').length > 40,
  null, { timeout: 30_000 });
await page.waitForTimeout(2500);

const area = page.locator('.monaco-editor textarea').first();

/** Monaco's overlays intercept element clicks, so drive the mouse by position. */
async function wordBox(word) {
  const handle = await page.evaluateHandle((w) => {
    const spans = [...document.querySelectorAll('.view-line span span')];
    return spans.find((s) => s.textContent?.trim() === w) ?? null;
  }, word);
  const el = handle.asElement();
  return el ? await el.boundingBox() : null;
}
async function dblclickWord(word) {
  const box = await wordBox(word);
  if (!box) return false;
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  return true;
}
async function clickWord(word) {
  const box = await wordBox(word);
  if (!box) return false;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  return true;
}
/** A word that occurs more than once on screen, so occurrences have something to mark. */
const repeated = await page.evaluate(() => {
  const words = [...document.querySelectorAll('.view-line span span')]
    .map((s) => s.textContent?.trim() ?? '')
    .filter((t) => /^[A-Za-z_]\w{3,}$/.test(t));
  const counts = new Map();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  return [...counts.entries()].find(([, n]) => n > 1)?.[0] ?? words[0] ?? 'value';
});
console.log(`  (using the word "${repeated}", which occurs more than once on screen)`);

// --- double-click a word highlights every other one -------------------------
await dblclickWord(repeated);
await page.waitForTimeout(900);
const marks = await page.evaluate(() => ({
  selection: document.querySelectorAll('.selectionHighlight').length,
  word: document.querySelectorAll('.wordHighlight, .wordHighlightStrong, .wordHighlightText').length,
}));
check('double-clicking a word highlights the others',
  marks.selection + marks.word > 0, JSON.stringify(marks));

// --- Cmd+D adds the next match --------------------------------------------
await page.keyboard.press(`${mod}+d`);
await page.waitForTimeout(300);
const cursors = await page.evaluate(() => document.querySelectorAll('.cursors-layer .cursor').length);
check('Cmd+D adds a cursor at the next match', cursors >= 2, `${cursors} cursors`);
await page.keyboard.press('Escape');

// --- Cmd+Shift+L selects all occurrences -----------------------------------
await dblclickWord(repeated);
await page.keyboard.press(`${mod}+Shift+l`);
await page.waitForTimeout(300);
const all = await page.evaluate(() => document.querySelectorAll('.cursors-layer .cursor').length);
check('Cmd+Shift+L selects every occurrence', all >= 2, `${all} cursors`);
await page.keyboard.press('Escape');

// --- the command palette ---------------------------------------------------
await area.click({ force: true });
await page.keyboard.press('F1');
await page.waitForTimeout(600);
check('F1 opens the command palette',
  await page.locator('.quick-input-widget').isVisible().catch(() => false));
await page.keyboard.press('Escape');

// --- go to line ------------------------------------------------------------
await area.click({ force: true });
await page.keyboard.press('Control+g');
await page.waitForTimeout(500);
check('Ctrl+G opens go-to-line',
  await page.locator('.quick-input-widget').isVisible().catch(() => false));
await page.keyboard.press('Escape');

// --- go to symbol ----------------------------------------------------------
await area.click({ force: true });
await page.keyboard.press(`${mod}+Shift+o`);
await page.waitForTimeout(700);
const symbols = await page.locator('.quick-input-list .monaco-list-row').count().catch(() => 0);
check('Cmd+Shift+O lists the symbols in the file', symbols > 0, `${symbols} rows`);
await page.keyboard.press('Escape');

// --- find and replace ------------------------------------------------------
await area.click({ force: true });
await page.keyboard.press(`${mod}+f`);
await page.waitForTimeout(400);
check('Cmd+F opens find', await page.locator('.find-widget').isVisible().catch(() => false));
await page.keyboard.press('Escape');
await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Alt+f' : 'Control+h');
await page.waitForTimeout(400);
const replaceVisible = await page.locator('.find-widget .replace-part').isVisible().catch(() => false);
check('the replace field opens (Cmd+Alt+F on mac, Ctrl+H elsewhere)', replaceVisible);
await page.keyboard.press('Escape');

// --- toggle comment --------------------------------------------------------
const text = () => page.evaluate(() =>
  [...document.querySelectorAll('.view-line')].map((l) => l.textContent).join('\n'));
await clickWord(repeated);
const beforeComment = await text();
await page.keyboard.press(`${mod}+/`);
await page.waitForTimeout(400);
check('Cmd+/ toggles a line comment', (await text()) !== beforeComment);
await page.keyboard.press(`${mod}+z`);
await page.waitForTimeout(200);

// --- move a line -----------------------------------------------------------
const beforeMove = await text();
await page.keyboard.press('Alt+ArrowDown');
await page.waitForTimeout(400);
check('Alt+Down moves the line', (await text()) !== beforeMove);
await page.keyboard.press(`${mod}+z`);
await page.waitForTimeout(200);

// --- rename ----------------------------------------------------------------
await clickWord(repeated);
await page.keyboard.press('F2');
await page.waitForTimeout(600);
check('F2 opens rename', await page.locator('.rename-box, .monaco-editor .rename-input').first().isVisible().catch(() => false));
await page.keyboard.press('Escape');

// --- word wrap toggle ------------------------------------------------------
await area.click({ force: true });
await page.keyboard.press(`${mod}+End`);
await page.keyboard.press('Enter');
await page.keyboard.insertText(`// ${'a-very-long-token '.repeat(40)}`);
await page.waitForTimeout(500);
/*
 * Wrapping is measured on the widest rendered line, not on the scroll container:
 * Monaco's scrollable element reports a synthetic width in the millions, and the
 * rendered row count cannot change because the viewport height caps it.
 */
const widestLine = () => page.evaluate(() =>
  Math.max(...[...document.querySelectorAll('.view-line')].map((l) => l.offsetWidth)));
const wideBefore = await widestLine();
await page.keyboard.press('Alt+z');
await page.waitForTimeout(700);
const wideAfter = await widestLine();
check('Alt+Z toggles word wrap', wideAfter < wideBefore / 2,
  `widest line ${wideBefore}px -> ${wideAfter}px`);
await page.keyboard.press('Alt+z');
await page.waitForTimeout(300);

// --- indent guides and sticky scroll ---------------------------------------
check('indent guides render', await page.evaluate(() =>
  document.querySelectorAll('[class*="core-guide"]').length > 0),
  JSON.stringify(await page.evaluate(() => [...new Set([...document.querySelectorAll('.monaco-editor div')]
    .flatMap((d) => [...d.classList]).filter((c) => c.includes('guide')))])));

await page.mouse.move(800, 500);
for (let i = 0; i < 30; i++) await page.mouse.wheel(0, 120);
await page.waitForTimeout(900);
check('sticky scroll pins the enclosing scope', await page.evaluate(() =>
  !!document.querySelector('.sticky-widget, .monaco-editor .sticky-line-content')));

// --- folding ---------------------------------------------------------------
check('folding controls are in the gutter', await page.evaluate(() =>
  document.querySelectorAll('.cldr.codicon-folding-expanded, .folding').length > 0));

console.log(`\n  ${pass} passed, ${fail} failed\n`);
await browser.close();
await server.close();
process.exitCode = fail ? 1 : 0;
