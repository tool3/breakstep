/**
 * Open Breakstep and a bare Monaco editor side by side, and leave them open.
 *
 * Frame-time numbers only prove that the main thread was free; they cannot tell
 * you whether scrolling *felt* right, and synthetic wheel events are nothing
 * like a trackpad. So this one is for hands and eyes: two windows, the same
 * Monaco, the same font, the same file. Scroll both, hard.
 *
 *   both rough  →  it is Monaco or this machine, not Breakstep
 *   only the app rough  →  it is ours, and there is something to bisect
 *
 * Usage: npm run editor:compare      (Ctrl-C when you are done)
 */
import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({ server: { port: 4363, strictPort: true }, logLevel: 'warn' });
await server.listen();
const base = server.resolvedUrls.local[0];

const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1200,900'] });

const app = await browser.newPage({ viewport: null });
await app.goto(base, { waitUntil: 'domcontentloaded' });

const bare = await browser.newPage({ viewport: null });
await bare.goto(`${base}bare-monaco.html`, { waitUntil: 'domcontentloaded' });

console.log(`
  Two tabs are open:

    Breakstep     ${base}
    Bare Monaco   ${base}bare-monaco.html

  Scroll both — quickly, with whatever you normally use.

    both rough          → Monaco or this machine, not Breakstep
    only Breakstep rough → ours; say so and it gets bisected

  Ctrl-C to stop.
`);

// Hold the process open until interrupted.
await new Promise((resolve) => {
  process.on('SIGINT', resolve);
  process.on('SIGTERM', resolve);
});

await browser.close();
await server.close();
