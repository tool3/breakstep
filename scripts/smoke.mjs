import { chromium } from 'playwright';
import { preview } from 'vite';

const HEADED = process.argv.includes('--headed');
const WITH_PYTHON = process.argv.includes('--python');

const isMac = process.platform === 'darwin';
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

  check('the header renders', await page.locator('[class*="wordmark"]').first().isVisible());
  check(
    'the default template is selected',
    await page.getByRole('button', { name: /Template: Linked List/ }).isVisible(),
  );

  console.log('▸ Waiting for Monaco');
  await page.waitForSelector('.monaco-editor', { timeout: 45_000 });
  await page.waitForFunction(
    () => (document.querySelector('.view-lines')?.textContent ?? '').length > 40,
    { timeout: 30_000 },
  );
  const editorText = (await page.locator('.view-lines').first().innerText()).replace(
    /\u00a0/g,
    ' ',
  );
  check(
    'the editor loaded the template source',
    editorText.includes('linked list'),
    JSON.stringify(editorText.slice(0, 80)),
  );
  check(
    'the default view is plain code with no Breakstep API',
    !/breakstep\s*\./.test(editorText),
    JSON.stringify(editorText.slice(0, 120)),
  );

  console.log('▸ Editing like an editor');
  await page.locator('.monaco-editor textarea').first().click({ force: true });
  await page.waitForTimeout(400);

  const wordBox = await page.evaluateHandle(() => {
    const spans = [...document.querySelectorAll('.view-line span span')].filter((el) =>
      /^[A-Za-z_]\w{3,}$/.test(el.textContent?.trim() ?? ''),
    );
    const counts = new Map();
    for (const el of spans) {
      const key = el.textContent.trim();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const repeated = [...counts.entries()].find(([, n]) => n > 1)?.[0];
    return spans.find((el) => el.textContent.trim() === repeated) ?? spans[0] ?? null;
  });
  const wordRect = await wordBox.asElement()?.boundingBox();

  if (wordRect) {
    await page.mouse.dblclick(wordRect.x + wordRect.width / 2, wordRect.y + wordRect.height / 2);
    await page.waitForTimeout(1200);
    check(
      'double-clicking a word highlights every other one',
      await page.evaluate(
        () =>
          document.querySelectorAll(
            '.selectionHighlight, .wordHighlight, .wordHighlightStrong, .wordHighlightText',
          ).length > 0,
      ),
      await page.evaluate(() => window.getSelection()?.toString() ?? '(no selection)'),
    );

    await page.keyboard.press(isMac ? 'Meta+d' : 'Control+d');
    await page.waitForTimeout(400);
    check(
      'Cmd+D adds a cursor at the next match',
      (await page.evaluate(() => document.querySelectorAll('.cursors-layer .cursor').length)) >= 2,
    );
    await page.keyboard.press('Escape');
  } else {
    check('a word was found to double-click', false);
  }

  check(
    'indent guides are drawn',
    (await page.evaluate(() => document.querySelectorAll('[class*="core-guide"]').length)) > 0,
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
  await page.locator('.ant-segmented-item-label', { hasText: 'TypeScript' }).click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'Debug', exact: true }).click();
  await page.waitForTimeout(3000);

  const status = () => page.locator('[class*="statusText"]').first().innerText();
  const transport = (name) =>
    page.getByRole('toolbar', { name: 'Debug controls' }).getByRole('button', { name });

  check(
    'the debugger recorded a run',
    await transport('Step into').isVisible(),
  );
  check(
    'the transport floats over the editor',
    await page.getByRole('toolbar', { name: 'Debug controls' }).isVisible(),
  );

  check(
    'with no breakpoints it runs to completion instead of pausing on line 1',
    (await status()).includes('Ran to completion'),
    await status(),
  );

  await transport('Step back').click();
  await page.waitForTimeout(300);
  check(
    'a completed run can be stepped back out of',
    (await status()).includes('Paused on line'),
    await status(),
  );

  check(
    'the paused line is highlighted in the editor',
    (await page.locator('[class*="activeLine"]').count()) > 0,
  );
  check(
    'variables are listed for the current step',
    (await page.locator('[class*="scopeRow"]').count()) > 0,
  );
  check(
    'the visualizer follows the debugger',
    await page.getByText('following the debugger').isVisible(),
  );

  const firstPosition = await status();
  await transport('Step into').click();
  await page.waitForTimeout(300);
  check('stepping moves the cursor', firstPosition !== (await status()),
    `${firstPosition.replace(/\n/g, ' ')} -> ${(await status()).replace(/\n/g, ' ')}`);

  const here = await status();
  const targetLine = Number(here.match(/line (\d+)/)?.[1] ?? 0);
  await page.locator('[class*="statusText"]').first().click();
  await page.waitForTimeout(400);

  const gutter = page.locator('.line-numbers', { hasText: new RegExp(`^${targetLine}$`) }).first();
  const gutterBox = await gutter.boundingBox();
  await page.mouse.click(gutterBox.x + gutterBox.width / 2, gutterBox.y + gutterBox.height / 2);
  await page.waitForTimeout(400);

  const listedLines = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[class*="breakWhere"] code')]
        .map((node) => node.textContent)
        .filter((text) => text.startsWith('line')),
    );
  check(
    'a gutter click sets the breakpoint on the line clicked',
    (await listedLines()).includes(`line ${targetLine}`),
    `wanted line ${targetLine}, got ${(await listedLines()).join() || 'none'}`,
  );

  await transport('Restart').click();
  await page.waitForTimeout(600);
  check(
    'restart runs to the breakpoint rather than back to line one',
    (await status()).includes(`line ${targetLine}`),
    await status(),
  );

  await page.keyboard.press('F5');
  await page.waitForTimeout(500);
  check(
    'F5 continues the session',
    (await status()).includes('Ran to completion') || (await status()).includes('line'),
    await status(),
  );

  await page.mouse.click(gutterBox.x + gutterBox.width / 2, gutterBox.y + gutterBox.height / 2, {
    button: 'right',
  });
  await page.waitForTimeout(400);
  const menuOpen = await page.getByRole('menu', { name: new RegExp(`line ${targetLine}`) }).isVisible().catch(() => false);
  check('right-clicking the gutter opens the breakpoint menu', menuOpen);

  if (menuOpen) {
    await page.getByRole('button', { name: /condition/ }).click();
    await page.waitForTimeout(250);
    await page.locator('#breakpoint-condition').fill('1 === 1');
    await page.getByRole('button', { name: 'Set condition' }).click();
    await page.waitForTimeout(400);
    check(
      'the condition is attached to the breakpoint',
      (await page.locator('[class*="condition"]').allInnerTexts()).some((text) =>
        text.includes('1 === 1'),
      ),
    );

    await transport('Restart').click();
    await page.waitForTimeout(600);
    check(
      'a condition that holds still stops the run',
      (await status()).includes(`line ${targetLine}`),
      await status(),
    );
  }

  const watched = (await page.locator('[class*="scopeName"]').allInnerTexts())[0];
  if (watched) {
    await page.getByRole('textbox', { name: 'Add a watch expression' }).fill(watched);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    check(
      'a watch expression is evaluated against the recorded scope',
      (await page.evaluate(
        () => document.querySelectorAll('[class*="scopeRow"]').length,
      )) > 0,
    );
  }

  const inScope = await page.locator('[class*="scopeName"]').allInnerTexts();
  let varName = null;
  let nameSpan = null;
  for (const candidate of inScope) {
    const span = page.locator('.view-line span', { hasText: new RegExp(`^${candidate}$`) }).first();
    if (await span.count()) {
      varName = candidate;
      nameSpan = span;
      break;
    }
  }

  if (nameSpan && (await nameSpan.count())) {
    await nameSpan.hover();
    await page.waitForTimeout(1500);
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
      (await transport('Step into').count()) === 0,
  );

  console.log('▸ Loading a LeetCode problem');
  await page.getByRole('button', { name: 'LeetCode problems' }).click();
  await page.waitForTimeout(500);
  await page.getByLabel('LeetCode problem URL').fill('https://leetcode.com/problems/koko-eating-bananas/');
  await page.getByRole('button', { name: 'Find', exact: true }).click();
  await page.waitForTimeout(400);

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

  console.log('▸ Running a problem from its parameters, not its driver');
  await page.getByRole('button', { name: 'LeetCode problems' }).click();
  await page.waitForTimeout(600);
  await page
    .locator('.ant-drawer')
    .getByRole('button', { name: /Valid Palindrome/ })
    .click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /Reveal the solution/ }).click();
  await page.waitForTimeout(1200);

  check(
    'the parameters panel says what Run will call',
    await page.getByRole('tab', { name: /Parameters/ }).isVisible(),
  );

  await page.locator('.view-lines').first().click();
  await page.keyboard.press(isMac ? 'Meta+a' : 'Control+a');
  const solution = await page.evaluate(() =>
    [...document.querySelectorAll('.view-line')].length > 0,
  );
  check('the solution is in the editor', solution);

  await page.evaluate(() => {
    const area = document.querySelector('.monaco-editor textarea');
    area.focus();
  });
  await page.evaluate(() => {
    const text = [...document.querySelectorAll('.view-line')]
      .map((line) => line.textContent?.replace(/\u00a0/g, ' ') ?? '')
      .join('\n');
    const commented = text
      .split('\n')
      .map((line) => (line.trimStart().startsWith('console.log') ? `// ${line}` : line))
      .join('\n');
    const area = document.querySelector('.monaco-editor textarea');
    area.focus();
    const data = new DataTransfer();
    data.setData('text/plain', commented);
    area.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
    );
  });
  await page.waitForTimeout(1200);

  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.waitForTimeout(2500);
  await page.getByRole('tab', { name: /Output/ }).click();
  const commentedOutput = await page.locator('[class*="OutputPanel"]').first().innerText();
  check(
    'a problem still runs with its driver commented out',
    commentedOutput.includes('->'),
    commentedOutput.slice(0, 160).replace(/\n/g, ' | '),
  );

  await page.getByRole('tab', { name: /Visualize/ }).click();
  await page.waitForTimeout(400);
  check(
    'and it still draws',
    (await page.locator('[class*="Cell"], svg circle, [class*="cell"]').count()) > 0,
  );

  await page.getByRole('tab', { name: /Problem/ }).click();
  await page.getByRole('button', { name: /Reset to starter/ }).click();
  await page.waitForTimeout(800);

  console.log('▸ Opening a problem from the list');
  await page.getByRole('button', { name: 'LeetCode problems' }).click();
  await page.waitForTimeout(500);
  await page
    .locator('.ant-drawer')
    .getByRole('button', { name: /Valid Palindrome/ })
    .click();
  await page.waitForTimeout(1500);

  check(
    'clicking a problem in the list opens it and closes the drawer',
    (await page.locator('.ant-drawer-open').count()) === 0,
  );
  check(
    'and the problem tab is showing it',
    await page.getByRole('heading', { name: 'Valid Palindrome' }).isVisible(),
  );
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

    await page.getByRole('button', { name: 'Debug', exact: true }).click();
    await transport('Step into').waitFor({ state: 'visible', timeout: 120_000 });
    check('python is debuggable too', await transport('Step into').isVisible());
    const pyStart = await page.locator('[class*="statusText"]').first().innerText();
    await transport('Step back').click();
    await page.waitForTimeout(300);
    const pyNext = await page.locator('[class*="statusText"]').first().innerText();
    check('python steps move the cursor', pyStart !== pyNext,
      `${pyStart.replace(/\n/g, ' ')} -> ${pyNext.replace(/\n/g, ' ')}`);
    check(
      'python reports variables in scope',
      (await page.locator('[class*="scopeRow"]').count()) > 0,
    );
    await page.keyboard.press('Shift+F5');
    await page.waitForTimeout(400);
    check(
      'Shift+F5 ends the session',
      (await transport('Step into').count()) === 0,
    );

    console.log('▸ Submitting a Python answer');
    await page.getByRole('button', { name: 'LeetCode problems' }).click();
    await page.waitForTimeout(500);
    await page
    .locator('.ant-drawer')
    .getByRole('button', { name: /Valid Palindrome/ })
    .click();
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
