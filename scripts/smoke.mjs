/**
 * End-to-end smoke test against a real browser.
 *
 * Unit tests cover the engine and the analyzers, but only a real browser proves
 * the pieces are wired together: that Monaco boots, that the Web Workers load
 * under module format, that a run produces frames on screen, and that the
 * analysis panel reaches a verdict.
 *
 * Usage: node scripts/smoke.mjs [--headed] [--python]
 */
import { chromium } from 'playwright';
import { preview } from 'vite';

const HEADED = process.argv.includes('--headed');
const WITH_PYTHON = process.argv.includes('--python');

const failures = [];
const notes = [];

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${name}`);
  } else {
    console.log(`  ✕ ${name}${detail ? ` — ${detail}` : ''}`);
    failures.push(name);
  }
}

const server = await preview({
  preview: { port: 4319, strictPort: true, open: false },
  logLevel: 'warn',
});
const base = server.resolvedUrls.local[0];
console.log(`\nPreview server: ${base}\n`);

const browser = await chromium.launch({ channel: 'chrome', headless: !HEADED });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

try {
  console.log('▸ Loading the app');
  await page.goto(base, { waitUntil: 'networkidle' });

  check('the header renders', await page.getByText('Breakstep', { exact: true }).isVisible());
  check(
    'the default template is selected',
    await page.getByRole('button', { name: /Template: Linked List/ }).isVisible(),
  );

  console.log('▸ Waiting for Monaco');
  await page.waitForSelector('.monaco-editor', { timeout: 45_000 });
  // Monaco paints the container before it paints the text; wait for content.
  await page.waitForFunction(
    () => (document.querySelector('.view-lines')?.textContent ?? '').length > 40,
    { timeout: 30_000 },
  );
  // Monaco emits U+00A0 for spaces inside rendered lines; normalise before
  // matching or every multi-word assertion silently fails.
  const editorText = (await page.locator('.view-lines').first().innerText()).replace(
    /\u00a0/g,
    ' ',
  );
  check(
    'the editor loaded the template source',
    editorText.includes('linked list'),
    JSON.stringify(editorText.slice(0, 80)),
  );
  // The headline of the redesign: what you see first is ordinary CS code.
  check(
    'the default view is plain code with no Breakstep API',
    !/breakstep\s*\./.test(editorText),
    JSON.stringify(editorText.slice(0, 120)),
  );

  console.log('▸ Running the code');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.waitForSelector('[class*="counter"]', { timeout: 20_000 });
  const counter = await page.locator('[class*="counter"]').first().innerText();
  check('frames were captured', /\/\s*[1-9]/.test(counter), `counter read "${counter}"`);
  notes.push(`frames: ${counter.trim()}`);

  check('a visualization is on screen', await page.locator('[role="grid"]').first().isVisible());

  console.log('▸ Stepping the timeline');
  const before = await page.locator('[class*="counter"]').first().innerText();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);
  const after = await page.locator('[class*="counter"]').first().innerText();
  check('the timeline advances with the arrow keys', before !== after, `${before} → ${after}`);

  console.log('▸ Reading the output panel');
  await page.getByRole('tab', { name: /Output/ }).click();
  const output = await page.locator('[class*="OutputPanel"]').first().innerText();
  check('output contains the logged result', output.includes('contents'), output.slice(0, 120));
  check('the run reported success', output.includes('finished'));

  console.log('▸ Analyzing complexity');
  await page.getByRole('button', { name: /Analyze/ }).first().click();
  await page.waitForSelector('[class*="verdictValue"]', { timeout: 40_000 });
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[class*="verdictValue"]');
      return el && el.textContent && el.textContent.trim() !== '…';
    },
    { timeout: 40_000 },
  );
  const measured = (await page.locator('[class*="verdictValue"]').first().innerText()).trim();
  check('the measured complexity is O(n)', measured === 'O(n)', `got "${measured}"`);
  notes.push(`categories: ${(await page.getByRole('heading').allInnerTexts()).join(' | ') || 'n/a'}`);
  check('the growth chart rendered', await page.locator('svg[role="img"]').first().isVisible());
  notes.push(`two-pointers measured ${measured}`);

  console.log('▸ Revealing the instrumentation');
  await page.getByRole('button', { name: 'Show instrumentation' }).click();
  await page.waitForTimeout(1200);
  const instrumentedText = (await page.locator('.view-lines').first().innerText()).replace(
    /\u00a0/g,
    ' ',
  );
  check('instrumented view shows breakstep.* calls', /breakstep\s*\./.test(instrumentedText));
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.waitForTimeout(2200);
  check(
    'instrumented code still runs',
    /\/\s*[1-9]/.test(await page.locator('[class*="counter"]').first().innerText()),
  );
  await page.getByRole('button', { name: 'Hide instrumentation' }).click();
  await page.waitForTimeout(1000);

  console.log('▸ Editing a parameter rewrites the code');
  const codeBefore = (await page.locator('.view-lines').first().innerText()).replace(/\u00a0/g, ' ');
  // Number params render as a slider plus a spin box; the spin box carries the
  // accessible label, the slider carries the id.
  const targetInput = page.getByLabel('Value to find');
  await targetInput.fill('20');
  await targetInput.press('Enter');
  await page.waitForTimeout(700);
  const codeAfter = (await page.locator('.view-lines').first().innerText()).replace(/\u00a0/g, ' ');
  check(
    'the constant in the source changed',
    codeBefore !== codeAfter && /const target = 20/.test(codeAfter),
    codeAfter.slice(0, 120),
  );

  console.log('▸ Switching templates (graph)');
  await page.getByRole('button', { name: /Template: Linked List/ }).click();
  await page.getByRole('button', { name: /^Graph/ }).first().click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.waitForTimeout(2500);
  await page.getByRole('tab', { name: /Visualize/ }).click();
  check('the graph visualizer rendered', await page.locator('svg circle').first().isVisible());

  console.log('▸ Switching language to JavaScript');
  await page.locator('.ant-segmented-item-label', { hasText: 'JavaScript' }).click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.waitForTimeout(2500);
  await page.getByRole('tab', { name: /Output/ }).click();
  const jsOutput = await page.locator('[class*="OutputPanel"]').first().innerText();
  check('the JavaScript variant runs', jsOutput.includes('vertices'), jsOutput.slice(0, 120));

  console.log('▸ Debugging a run');
  // Back to TypeScript and a template with named functions to step through.
  await page.locator('.ant-segmented-item-label', { hasText: 'TypeScript' }).click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'Debug', exact: true }).click();
  await page.waitForTimeout(3000);

  check(
    'the debugger recorded a run',
    await page.getByRole('button', { name: 'Step into' }).isVisible(),
  );
  const firstPosition = await page.locator('[class*="positionText"]').first().innerText();
  await page.getByRole('button', { name: 'Step into' }).click();
  await page.waitForTimeout(300);
  const secondPosition = await page.locator('[class*="positionText"]').first().innerText();
  check('stepping moves the cursor', firstPosition !== secondPosition, `${firstPosition} -> ${secondPosition}`);

  check(
    'the paused line is highlighted in the editor',
    (await page.locator('[class*="activeLine"]').count()) > 0,
  );
  check(
    'variables are listed for the current step',
    (await page.locator('[class*="scopeRow"]').count()) > 0,
  );
  check(
    'every function gets a breakpoint switch',
    (await page.getByRole('switch').count()) > 0,
  );
  check(
    'the visualizer follows the debugger',
    await page.getByText('following the debugger').isVisible(),
  );

  // A gutter click must set the breakpoint on the line you clicked. Monaco does
  // not account for its own top padding here, which silently put every
  // breakpoint one line high until the padding moved into CSS.
  //
  // The line is taken from the debugger rather than hardcoded, so this works
  // whatever template the run above left loaded.
  await page.getByRole('button', { name: 'Step into' }).click();
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Step into' }).click();
  await page.waitForTimeout(250);

  const here = await page.locator('[class*="positionText"]').first().innerText();
  const targetLine = Number(here.trim().match(/line (\d+)$/)?.[1] ?? 0);
  // Bring it into view before clicking its gutter.
  await page.locator('[class*="position"]').first().click();
  await page.waitForTimeout(400);

  const gutter = page.locator('.line-numbers', { hasText: new RegExp(`^${targetLine}$`) }).first();
  const gutterBox = await gutter.boundingBox();
  await page.mouse.click(gutterBox.x + gutterBox.width / 2, gutterBox.y + gutterBox.height / 2);
  await page.waitForTimeout(300);

  const listed = await page.evaluate(() =>
    [...document.querySelectorAll('[class*="functionName"] code')]
      .map((n) => n.textContent)
      .filter((t) => t.startsWith('line')),
  );
  check(
    'a gutter click sets the breakpoint on the line clicked',
    listed.includes(`line ${targetLine}`),
    `wanted line ${targetLine}, got ${listed.join() || 'none'}`,
  );

  await page.getByRole('button', { name: 'Restart' }).first().click();
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForTimeout(400);
  const stopped = await page.locator('[class*="positionText"]').first().innerText();
  check(
    'continue stops at that breakpoint',
    stopped.trim().endsWith(`line ${targetLine}`),
    `wanted line ${targetLine}, stopped at ${stopped.trim()}`,
  );

  // Hovering a variable should answer what it holds right now, not its type.
  const varName = (await page.locator('[class*="scopeName"]').allInnerTexts())[0];
  const nameSpan = varName
    ? page.locator('.view-line span', { hasText: new RegExp(`^${varName}$`) }).first()
    : null;

  if (nameSpan && (await nameSpan.count())) {
    await nameSpan.hover();
    await page.waitForTimeout(1500);
    // `.monaco-hover` is the outer widget and is empty; the text is inside.
    const hoverText = (await page.locator('.hover-contents').allInnerTexts()).join(' ');
    check(
      'hovering a variable shows its value at this step',
      hoverText.includes('value at this step'),
      `${varName}: ${hoverText.slice(0, 120)}`,
    );
  } else {
    check(
      'hovering a variable shows its value at this step',
      false,
      `no span for ${varName ?? 'any variable'}`,
    );
  }

  await page.getByRole('button', { name: 'Stop debugging' }).click();
  await page.waitForTimeout(400);
  check(
    'leaving the debugger restores the inputs panel',
    (await page.locator('[class*="ParamsPanel"]').count()) > 0 &&
      (await page.getByRole('button', { name: 'Step into' }).count()) === 0,
  );

  console.log('▸ Loading a LeetCode problem');
  await page.getByRole('button', { name: 'LeetCode problems' }).click();
  await page.waitForTimeout(500);
  await page.getByLabel('LeetCode problem URL').fill('https://leetcode.com/problems/koko-eating-bananas/');
  await page.getByRole('button', { name: 'Find', exact: true }).click();
  await page.waitForTimeout(400);

  // Finding a problem opens it, and the problem panel below the editor is where
  // it lives from then on.
  check(
    'the problem opened into the problem panel',
    await page.getByRole('heading', { name: 'Koko Eating Bananas' }).isVisible(),
  );
  check(
    'a technique is recommended there',
    await page.getByRole('button', { name: /Open the binary search template/ }).isVisible(),
  );
  check('the exact dataset is shown', await page.getByText('piles = [3,6,7,11], h = 8').isVisible());
  check(
    'and the parameters are one tab away',
    await page.getByRole('tab', { name: /Parameters/ }).isVisible(),
  );

  await page.getByRole('button', { name: /Reveal the solution/ }).click();
  await page.waitForTimeout(1200);
  const revealed = await page.locator('.monaco-editor').first().innerText();
  check(
    'revealing replaces the editor with the solution',
    revealed.includes('minEatingSpeed') && !revealed.includes('TODO'),
    revealed.slice(0, 120),
  );

  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.waitForTimeout(2500);
  await page.getByRole('tab', { name: /Output/ }).click();
  const solutionOutput = await page.locator('[class*="OutputPanel"]').first().innerText();
  check(
    'the revealed solution answers the examples',
    solutionOutput.includes('example 1 -> 4') && solutionOutput.includes('example 2 -> 30'),
    solutionOutput.slice(0, 200),
  );

  console.log('▸ Running a problem Breakstep does not carry');
  await page.getByRole('button', { name: 'LeetCode problems' }).click();
  await page.waitForTimeout(500);
  await page.getByLabel('LeetCode problem URL').fill('https://leetcode.com/problems/two-sum/');
  await page.getByRole('button', { name: 'Find', exact: true }).click();
  await page.waitForTimeout(2000);

  check(
    'a problem with no statement here is still opened, runnable',
    await page.getByRole('heading', { name: 'Two Sum' }).isVisible(),
  );
  check(
    'it says where the statement lives',
    await page.getByText('statement on LeetCode', { exact: true }).isVisible(),
  );
  check(
    'it offers no solution it does not have',
    (await page.getByRole('button', { name: /Reveal the solution/ }).count()) === 0,
  );
  const generated = (await page.locator('.view-lines').first().innerText()).replace(/\u00a0/g, ' ');
  check(
    'the generated stub has the right signature',
    /function twoSum\(nums: number\[\], target: number\)/.test(generated),
    generated.slice(0, 140),
  );

  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.waitForTimeout(2500);
  await page.getByRole('tab', { name: /Output/ }).click();
  const generatedOutput = await page.locator('[class*="OutputPanel"]').first().innerText();
  check(
    'the generated driver runs every published example',
    (generatedOutput.match(/example \d ->/g) ?? []).length >= 2,
    generatedOutput.slice(0, 160),
  );

  console.log('▸ Opening a problem from the list');
  await page.getByRole('button', { name: 'LeetCode problems' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Valid Palindrome/ }).click();
  await page.waitForTimeout(1500);

  check(
    'clicking a problem in the list opens it and closes the drawer',
    (await page.locator('.ant-drawer-open').count()) === 0,
  );
  check(
    'and the problem tab is showing it',
    await page.getByRole('heading', { name: 'Valid Palindrome' }).isVisible(),
  );
  // A problem is plain code either way, so the toggle must say so rather than
  // changing the badge and nothing else.
  check(
    'instrumentation is not offered for a problem',
    await page.getByRole('button', { name: 'Show instrumentation' }).isDisabled(),
  );
  check(
    'and that problem is what the editor now holds',
    await page.getByRole('button', { name: /Template: 125\. Valid Palindrome/ }).isVisible(),
  );

  console.log('▸ Submitting an answer');
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await page.getByRole('heading', { name: /Wrong answer|Accepted/ }).waitFor({ timeout: 30_000 });

  const stubVerdict = await page.locator('[class*="SubmissionsPanel-module__panel"]').first().innerText();
  check(
    'submitting the stub is judged wrong, not accepted',
    /Wrong answer/.test(stubVerdict),
    stubVerdict.slice(0, 160),
  );
  check(
    'and it shows the case, the published answer and what came back',
    /expected true/.test(stubVerdict) && /got false/.test(stubVerdict),
    stubVerdict.slice(0, 400),
  );

  await page.getByRole('tab', { name: /Problem/ }).click();
  await page.getByRole('button', { name: /Reveal the solution/ }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('tab', { name: /Submissions/ }).click();

  // Submitted from the keyboard, with focus inside Monaco — the case where the
  // editor could have swallowed the chord before the app ever saw it.
  await page.locator('.view-lines').first().click();
  await page.keyboard.press('Shift+Meta+Enter');
  await page.getByRole('heading', { name: 'Accepted' }).waitFor({ timeout: 30_000 });

  const acceptedVerdict = await page
    .locator('[class*="SubmissionsPanel-module__panel"]')
    .first()
    .innerText();
  check(
    'the worked solution is accepted on every published case',
    /Accepted/.test(acceptedVerdict) && /3\/3 cases/.test(acceptedVerdict),
    acceptedVerdict.slice(0, 200),
  );
  check(
    'the record carries the metrics that make it worth keeping',
    /RUN TIME/i.test(acceptedVerdict) &&
      /TIME/i.test(acceptedVerdict) &&
      /SPACE/i.test(acceptedVerdict),
    acceptedVerdict.slice(0, 300),
  );
  check(
    'and names the function it actually called',
    /isPalindrome\(\)/.test(acceptedVerdict),
    acceptedVerdict.slice(0, 300),
  );
  check('both attempts are in the history', /2 attempts/.test(acceptedVerdict), acceptedVerdict.slice(0, 120));

  // The verdict has to be visible without opening the history: on the tab, and
  // beside the problem itself.
  check(
    'the tab carries the last verdict',
    (await page.getByRole('tab', { name: /Submissions/ }).locator('[aria-label="Accepted"]').count()) > 0,
  );
  await page.getByRole('tab', { name: /Problem/ }).click();
  check(
    'and so does the problem, beside its difficulty',
    await page.getByText('Accepted', { exact: true }).first().isVisible(),
  );

  await page.getByRole('button', { name: 'LeetCode problems' }).click();
  await page.waitForTimeout(600);
  const solvedRow = page.getByRole('button', { name: /Valid Palindrome/ });
  check(
    'the problem list ticks what has been solved',
    (await solvedRow.locator('[aria-label="solved"]').count()) > 0,
  );
  check('and says how many', await page.getByText('1 solved').isVisible());
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // Back to a built-in template so the sections below test what they say.
  await page.locator('button[aria-label^="Template:"]').click();
  await page.getByRole('button', { name: /^Graph/ }).first().click();
  await page.waitForTimeout(800);

  check(
    'the problem tab greys out with no problem loaded',
    (await page.getByRole('tab', { name: /Problem/ }).getAttribute('aria-disabled')) === 'true',
  );

  console.log('▸ Switching themes');
  check(
    'graphite is the default theme',
    (await page.evaluate(() => document.documentElement.dataset.theme)) === 'graphite',
  );
  for (const [name, expected] of [
    ['Light', 'light'],
    ['Midnight', 'midnight'],
    ['Graphite', 'graphite'],
  ]) {
    await page.getByRole('button', { name: 'Theme' }).click();
    await page.waitForTimeout(250);
    await page.getByText(name, { exact: true }).click();
    await page.waitForTimeout(500);
    check(
      `${name} theme applies`,
      (await page.evaluate(() => document.documentElement.dataset.theme)) === expected,
    );
  }

  if (WITH_PYTHON) {
    console.log('▸ Running Python (downloads Pyodide, may take a minute)');
    await page.locator('.ant-segmented-item-label', { hasText: 'Python' }).click();
    await page.waitForTimeout(900);
    await page.getByRole('button', { name: 'Run', exact: true }).click();
    await page.waitForTimeout(2000);
    await page.getByRole('tab', { name: /Output/ }).click();
    await page.waitForFunction(
      () => document.body.innerText.includes('finished') || document.body.innerText.includes('failed'),
      null,
      { timeout: 180_000 },
    );
    const pyOutput = await page.locator('[class*="OutputPanel"]').first().innerText();
    check('python executed successfully', pyOutput.includes('finished'), pyOutput.slice(0, 300));
    check('python produced output', pyOutput.includes('vertices'), pyOutput.slice(0, 200));

    await page.getByRole('tab', { name: /Visualize/ }).click();
    check('python produced a visualization', await page.locator('svg circle').first().isVisible());

    // The debugger records Python through the same replay path as JavaScript.
    await page.getByRole('button', { name: 'Debug', exact: true }).click();
    await page
      .getByRole('button', { name: 'Step into' })
      .waitFor({ state: 'visible', timeout: 120_000 });
    check('python is debuggable too', await page.getByRole('button', { name: 'Step into' }).isVisible());
    const pyStart = await page.locator('[class*="positionText"]').first().innerText();
    await page.getByRole('button', { name: 'Step into' }).click();
    await page.waitForTimeout(300);
    const pyNext = await page.locator('[class*="positionText"]').first().innerText();
    check('python steps advance', pyStart !== pyNext, `${pyStart} -> ${pyNext}`);
    check(
      'python reports variables in scope',
      (await page.locator('[class*="scopeRow"]').count()) > 0,
    );
    await page.getByRole('button', { name: 'Stop debugging' }).click();
    await page.waitForTimeout(300);

    // Judging is a generated harness, and Python's is a different generator, so
    // the only proof it is right is running one.
    console.log('▸ Submitting a Python answer');
    await page.getByRole('button', { name: 'LeetCode problems' }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /Valid Palindrome/ }).click();
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: /Reveal the solution/ }).click();
    await page.waitForTimeout(1200);

    const pySource = (await page.locator('.view-lines').first().innerText()).replace(/\u00a0/g, ' ');
    check('the Python solution is what the editor holds', /def is_palindrome/.test(pySource), pySource.slice(0, 120));

    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await page.getByRole('heading', { name: /Accepted|Wrong answer|Runtime error/ }).waitFor({
      timeout: 120_000,
    });
    const pyVerdict = await page.locator('[class*="SubmissionsPanel-module__panel"]').first().innerText();
    check(
      'the Python judge accepts the Python solution',
      /Accepted/.test(pyVerdict) && /3\/3 cases/.test(pyVerdict),
      pyVerdict.slice(0, 300),
    );
    check('and records it as a Python attempt', /\bPY\b/.test(pyVerdict), pyVerdict.slice(0, 200));
  }

  console.log('▸ Checking responsive layout');
  await page.setViewportSize({ width: 700, height: 900 });
  await page.waitForTimeout(500);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  check('no horizontal overflow on a narrow viewport', overflow <= 1, `overflow ${overflow}px`);
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.waitForTimeout(400);
  await page.screenshot({ path: 'smoke-screenshot.png', fullPage: false });
  console.log('\n  screenshot written to smoke-screenshot.png');
} catch (err) {
  console.error('\n✕ Smoke run threw:', err.message);
  failures.push(`exception: ${err.message}`);
  try {
    await page.screenshot({ path: 'smoke-failure.png' });
  } catch {
    /* ignore */
  }
}

// Monaco emits a benign cancellation error when a model is disposed mid-request.
const realErrors = consoleErrors.filter(
  (e) => !/Canceled|ResizeObserver loop|favicon/i.test(e),
);

console.log('\n── Console ──');
if (realErrors.length === 0) {
  console.log('  ✓ no console errors');
} else {
  console.log(`  ✕ ${realErrors.length} console error(s):`);
  for (const e of realErrors.slice(0, 10)) console.log(`     ${e}`);
  failures.push('console errors');
}

if (notes.length) {
  console.log('\n── Notes ──');
  for (const n of notes) console.log(`  · ${n}`);
}

await browser.close();
await server.close();

console.log('');
if (failures.length) {
  console.log(`✕ ${failures.length} check(s) failed: ${failures.join(', ')}\n`);
  process.exit(1);
}
console.log('✓ All smoke checks passed\n');
process.exit(0);
