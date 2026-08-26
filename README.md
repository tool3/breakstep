# Breakstep

![](https://shellfie.vercel.app/s/BgQdYNk.svg)

**Watch your code run.** Breakstep is a free, in-browser studio for data
structures and algorithms — a real debugger you can step *backwards*, a
visualizer that draws your data as it changes, and a complexity verdict backed by
an actual measurement rather than a guess.

Run it alongside LeetCode or NeetCode. Paste a problem link and solve it here,
where you can see what your code is doing.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Backend: none](https://img.shields.io/badge/backend-none-brightgreen.svg)
![Languages: TypeScript, JavaScript, Python](https://img.shields.io/badge/languages-TS%20%7C%20JS%20%7C%20Python-informational.svg)
![Tests: 1533](https://img.shields.io/badge/tests-1533%20passing-success.svg)

```bash
npm install && npm run dev     # http://localhost:5173
```

No account, no sign-up, no server. Your code never leaves the browser.

---

## A debugger that runs backwards

Press **Debug** and the program runs, stopping where you told it to and nowhere
else. `F5` continues, `F10` steps over, `F11` in, `⇧F11` out — the transport
floats over the editor and the sidebar is Variables, Watch, Call Stack and
Breakpoints, so your fingers already know it.

Then it does three things a live debugger can't, because the run is recorded
rather than attached to:

- **Step backwards.** Overshot the bug? Go back a step. The recording runs both
  ways, so a wrong turn costs a keystroke instead of a restart.
- **Add a breakpoint condition *after* the run.** Type `lo > 4`, hit Restart, and
  land on the iteration you actually meant. Conditions are answered against the
  scope recorded at that line, so they cost nothing and can be edited freely.
- **Watch expressions over a timeline.** Scrub the recording and watch
  `node.next.val` change as you drag.

Same debugger for Python and JavaScript, because it replays a recording rather
than speaking two debug protocols.

---

## Your data, drawn as it changes

Plain textbook code visualizes itself. Breakstep reads your source and works out
what the picture is about: a `{val, next}` chain draws as a linked list, cycles
and all; a `left`/`right` node draws as a tree; an adjacency map draws as a graph.
Loop counters become pointers. Ten structures, each with a scrubbable timeline.

No API to learn and nothing to annotate — but if you want to drive the picture
yourself, one click reveals a `breakstep.*` version of the same code and hands
you the controls.

---

## Solve the problem you came for

Paste any LeetCode URL. Breakstep recognises all **4,023** published problems
offline and opens what it can:

- **40 written out in full** — the task restated, the real datasets, ranked
  technique recommendations, and a solution to reveal when you want it.
- **~2,990 ready to run** — a correctly typed stub, `ListNode` and `TreeNode`
  helpers, and every published example already wired up. Press Run and it runs.

Then press **Submit**. Breakstep calls your function once per published example
and compares every answer, so you get **Accepted** or the exact case you got
wrong — with the input, what it should have returned, and what it did. Every
attempt is kept with its runtime, operation count and complexity, so you can see
the brute force being replaced by the linear one.

---

## Know what your code costs

Two independent answers to "what's the complexity?" — a static pass that reads
your source for loop nesting, recurrences and hidden per-call costs, and an
empirical sweep that runs your code at growing input sizes and fits the curve.

When they disagree, the app says so. That disagreement is usually the most
interesting thing on the screen.

---

## An editor that feels like VS Code

Monaco, with the editing surface you expect: double-click a word to highlight
every other one, `Cmd+D`, multiple cursors, find and replace, `F1` command
palette, `F2` rename, `F12` go to definition, `Cmd+/`, sticky scroll, IntelliSense.

And it's fast. Typing costs **1 ms of app work per keystroke** — the frame
belongs to Monaco, because the editor owns the buffer and the rest of the app
only hears about it when you pause. `npm run editor:perf` holds that to a budget
and fails if it ever stops being true.

---

## Quick start

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # typecheck + production bundle into dist/
```

Requires Node 20+. Deploys as a static bundle — Vercel needs nothing beyond the
committed `vercel.json`.

<details>
<summary>Everything else in the toolbox</summary>

```bash
npm test                  # 1,533 unit tests
npm run smoke             # end-to-end run in a real Chrome
npm run smoke:python      # …including the Pyodide path (slow: downloads ~10 MB)
npm run responsive        # 16 device profiles, asserting nothing breaks
npm run editor:perf       # scroll and typing cost, against a frame budget
npm run editor:features   # 15 real keystrokes, checking the editor still does them
npm run screenshots       # capture every visualizer to screenshots/
npm run problems:refresh  # re-vendor the problem index
npm run problems:details  # re-vendor the runnable interfaces and examples
```

</details>

---

## What's in the box

**36 templates.** Twelve data structures, each a full implementation plus a
driver that exercises every method. Eight classic patterns, each attached to the
problem it's famous for. Fifteen worked examples. One blank canvas.

**Three languages.** TypeScript, JavaScript and Python — the same visualizer, the
same debugger, the same analysis for all three. Python runs on Pyodide, fetched
once on first use.

**Three themes.** Graphite (default, built for reading), Midnight and Light.

**Editable inputs.** Parameters are top-level constants in the code, and the
Parameters panel edits *those literals in the editor*. Move a slider, the code
changes. Nothing is substituted behind your back.

---

## The `breakstep` API

Only needed if you want to drive the visualizer by hand. It's injected as a
parameter — nothing to import, fully typed in the editor.

```ts
breakstep.show(value, options?)     // capture a frame; the shape picks the visualizer
breakstep.label('text')             // name the next frame
breakstep.param('name', fallback)   // read a value from the Parameters panel
breakstep.randomInts(n, max, seed)  // deterministic pseudo-random input
breakstep.bench({ input, run })     // register the harness the Analyze tab sweeps
```

`bench` is the one thing the empirical sweep can't infer, because it needs to
know how to build a *bigger* input and what to call with it:

```ts
breakstep.bench({
  input: (n) => breakstep.randomInts(n, 1000),   // building it isn't measured
  run: (data) => mergeSort(data),                // this is
});
```

---

## Under the hood

- **Everything client-side.** No backend, no account, no network call after load
  (except Pyodide, once, if you use Python). Code and progress live in
  `localStorage`.
- **User code runs in a Web Worker**, so a runaway loop can't freeze the tab — and
  an instrumented operation counter stops one before the timeout has to.
- **Operation counts, not wall-clock**, for curve fitting: the number is
  machine-independent, immune to JIT warmup and whatever else your laptop is doing.
- **Static analysis composes along the call graph**, so putting the real work in
  `solve()` and calling it at the bottom of the file is analyzed correctly.
- **1,533 unit tests** plus end-to-end suites in real Chrome covering the editor,
  the debugger, sixteen device profiles and a frame-by-frame perf budget.

Want the reasoning behind any of it? The code is commented for exactly that.

---

## License

MIT — see [`LICENSE`](LICENSE). Use it, fork it, sell it. That covers Breakstep's
own source and content, including the forty problems in `src/leetcode/problems/`,
which are original restatements with original solutions written here.

It does not cover the vendored metadata in `src/leetcode/problemIndex.json` and
`src/leetcode/details/` — factual data describing a third-party service, which
isn't this project's work to license.

---

## Notices

- **Independence.** Breakstep is an independent project, not affiliated with,
  sponsored by, endorsed by or connected to LeetCode, NeetCode, or any other site
  it can open a problem from.
- **Trademarks.** "LeetCode", "NeetCode" and any other marks that appear are the
  property of their respective owners, used only to identify where a problem comes
  from and to link to it.
- **Statements stay at the source.** No problem statement, constraint text,
  editorial or community solution is reproduced here. Every problem links to its
  own page, and the assembled problems carry no description precisely because the
  description isn't ours to carry.
- **What is vendored, and why.** Only factual, functional metadata: a problem's
  number, slug, title, difficulty, public premium flag and topic tags, its
  function signature, and the example inputs and answers its statement quotes.
  Taken to make the same exercise runnable and judgeable here, not to replace the
  source.
- **Public endpoints only.** The refresh scripts read unauthenticated endpoints
  that answer to any browser. No account, cookie, API key or session is used
  anywhere in this project; nothing paywalled is accessed or circumvented; premium
  problems are skipped.
- **Politely, and by hand.** Those scripts are run manually, one request at a
  time, with a delay between them, a thirty-second back-off when rate-limited, and
  a `User-Agent` that says what they are. The result is a dated snapshot committed
  to the repository, not a live dependency on anyone's servers.
- **Original work.** The forty written-out problems, the templates, the
  visualizers, the analyzers and the judge are the work of this project.
- **Your data is yours.** Code, submissions and progress stay in your browser.
  Nothing is uploaded, nothing is sent to LeetCode or NeetCode, and there's no
  analytics on what you write. There is no backend to send it to.
- **Removal.** If you hold rights in something here and would rather it weren't,
  open an issue and it will be removed in good faith, without argument. The
  dataset is generated by a script, so removing it costs a commit.

These notices describe how the project is built and the reasoning behind it. They
are not legal advice, and they are not a warranty.
