# Breakstep

![](https://shellfie.vercel.app/s/BgQdYNk.svg)


An in-browser studio for data structures and algorithms. Pick a template, edit the
code, run it, watch it draw itself, and get a complexity verdict backed by an
actual measurement.

Think of it as a companion to sites like NeetCode or LeetCode: a place to *see*
what your code does, step through it line by line, and — when you do want a
problem — paste a LeetCode link and get the technique, the dataset and a worked
solution.

Everything runs client-side. There is no backend, no account, and no network call
after the page loads (except the one-time Pyodide download if you switch to
Python).

> **Not affiliated with LeetCode or NeetCode.** Breakstep is an independent,
> unaffiliated project, not sponsored or endorsed by either. "LeetCode" and
> "NeetCode" are the trademarks of their respective owners and are used here only
> to say which site a problem came from. No problem statement, editorial or
> community solution is reproduced: every problem links back to its own page,
> which is where it should be read. See
> [what is and is not taken](#what-breakstep-takes-from-leetcode-and-what-it-does-not)
> and [notices](#notices).

---

## What it does

**Write** — Monaco editor with TypeScript, JavaScript and Python. What you see
by default is ordinary computer-science code: a `ListNode` class, a `while`
loop, `console.log`. No app-specific API anywhere.

Your fingers should already know it, so nearly all of VS Code's editing surface
is here — Monaco ships those as separately-importable contributions, and the ones
a single-file editor can support are all imported:

| | |
| --- | --- |
| Double-click a word | highlights every other one; so does resting the caret in a symbol |
| `Cmd+D` / `Cmd+Shift+L` | add the next match / select every occurrence |
| `Alt+Click`, `Alt+Cmd+↑/↓` | multiple cursors, column selection |
| `Cmd+F`, `Cmd+Alt+F` | find, find and replace — regex, whole word, in selection |
| `F1` | command palette. `Ctrl+G` go to line, `Cmd+Shift+O` go to symbol |
| `F12`, `F2`, `Cmd+.` | go to definition, rename symbol, quick fix |
| `Cmd+/`, `Shift+Alt+F` | toggle comment, format document |
| `Alt+↑/↓`, `Shift+Alt+↑/↓` | move a line, copy a line. `Cmd+Shift+K` deletes one |
| `Alt+Z` | word wrap. `Cmd+K Cmd+0` folds, `Cmd+Shift+[` / `]` fold one |
| `F8` | next problem. Sticky scroll, indent guides, bracket colouring, IntelliSense |

Two things VS Code has are deliberately off. The minimap, because in a pane this
narrow it costs more width than it gives — one line in `EditorPanel.tsx` if you
disagree. And code lenses, because nothing in a single file provides any, so
leaving them on would buy a model scan per change in exchange for nothing to
show.

**Run** — user code executes in a Web Worker, so a runaway loop cannot freeze the
tab. An instrumented operation counter stops infinite loops, and a hard timeout
terminates the worker if anything survives that.

**Visualize** — plain code visualizes itself. Breakstep rewrites the source so it
reports its own state at every loop iteration and function call, then works out
what the picture is about: a `{val, next}` chain draws as a linked list (cycles
included), a `left`/`right` node draws as a tree, an adjacency map draws as a
graph. Loop counters become pointers; a variable holding a node lights that node
up. Ten structures, each with a scrubbable timeline.

One click on **Plain code / Instrumented** reveals the `breakstep.*` API and hands you
manual control — the same lesson, written explicitly. Instrumenting by hand
switches auto-tracing off, so the two never fight.

**Tune** — inputs are top-level constants (`const values = [1, 2, 3];`), and the
Parameters panel edits *those literals in the editor*. Move a slider and the code
changes. Nothing is substituted behind your back.

**Debug** — press **Debug** and the program *runs*, stopping where you told it
to and nowhere else. The icons are VS Code's own: Monaco already bundles the
codicon font, so the toolbar draws the real glyphs by codepoint rather than
approximating them with a generic icon set. That is the whole contract, and it is the one your fingers
already know: click the gutter to set a breakpoint, `F5` to continue, `F10` over,
`F11` into, `⇧F11` out, `⇧F5` to stop. The transport floats over the editor where
VS Code puts it, the paused line gets the amber band and the arrow in the gutter,
and the sidebar is **Variables**, **Watch**, **Call Stack** and **Breakpoints**
as collapsible sections. The function keys are bound only while a session is
open, so `F5` still reloads the page the rest of the time.

Three things go further than a live debugger can, because the run is recorded
rather than attached to:

- **Step backwards.** The recording runs both ways, so overshooting costs a
  keystroke rather than a restart. With no breakpoints set the session runs to
  the end and *stays there* — a completed run is something to walk back through,
  not something to throw away.
- **Conditions written after the fact.** A breakpoint's condition is evaluated
  against the scope recorded at that line, so you can add `lo > 4` to a run that
  already finished, hit Restart, and land on the iteration you meant. Right-click
  the gutter to write one; conditions can be edited or dropped without losing the
  breakpoint, and one that cannot be answered never stops the run.
- **Watch expressions over a timeline.** They are answered at whatever step the
  cursor is on, so scrubbing the recording animates them.

The visualizer follows the cursor throughout, so the picture and the line that
produced it are always the same moment. And the guided walk this app started as
is still there, one switch away: **every line** stops on every recorded step
instead of running to a breakpoint — for someone meeting recursion for the first
time, every line *is* the lesson.

**Solve** — paste any LeetCode URL. Breakstep recognises all 4,023 published
problems offline and answers in one of three tiers, saying plainly which one you
got:

- **written out here** (40 problems) — the task restated in our own words, the
  example datasets, the constraints, ranked technique recommendations with the
  reason each fits *this* problem, and a worked solution you can reveal into the
  editor;
- **ready to run** (2,990 problems) — LeetCode publishes each problem's
  interface and its example cases separately from the statement, so Breakstep
  generates the whole scaffold from them: a correctly typed stub, `ListNode` and
  `TreeNode` helpers where they are needed, and a driver that runs every
  published example with the answer it should give beside it. Press Run and it
  runs;
- **recognised only** — premium problems, design problems and a handful of
  exotic signatures, which still get a technique recommendation from their real
  topic tags and a link to the statement.

Finding a problem opens it — from a pasted link or a click in the list, one
action either way. It then lives in a **Problem** tab beside the editor, sharing
the pane with **Parameters**: the statement, the examples, the recommended
technique, and the buttons that reveal a solution or reset you to the stub. The
drawer is only for finding. Nothing is fetched at runtime; see
[what is and is not taken](#what-breakstep-takes-from-leetcode-and-what-it-does-not).

**Submit** — Run is a scratchpad; **Submit** is the verdict. It calls your
function once per example case LeetCode publishes for the problem and compares
every answer, so a submission asks the same question the judge asks — not "did
the right thing get printed". You get **Accepted** or **Wrong answer** with the
case that failed, what it should have returned, and what it did return. Every
attempt is kept, with the run time of the judged calls alone, the operation
count, and the static time and space estimate, so the history shows an O(n²)
answer being replaced by an O(n) one. The last verdict rides on the tab, beside
the problem's difficulty, and as a tick on every solved problem in the list.

It judges a solution named however you liked — the function is resolved from your
file, not assumed — and it handles the awkward corners honestly: an in-place
problem is judged on the argument it mutated, a set-valued answer (subsets, group
anagrams) is accepted in any order the way its judge accepts it, and a *flat*
answer with the right values in the wrong order is counted wrong with that said
out loud rather than guessed at. Submissions live in browser storage behind an
async store interface, which is the seam a real service drops into.

**Analyze** — two independent answers to "what is the complexity?":

- a **static** pass that reads the source for loop nesting, logarithmic patterns,
  recurrences and hidden per-call costs, and
- an **empirical** sweep that runs your `breakstep.bench(…)` harness at growing input
  sizes, counts basic operations, and fits the growth curve.

When the two disagree, the app says so and explains why — that disagreement is
usually the most interesting thing on the screen.

---

## The catalogue

**Data structures (12)** — a full implementation plus a driver that exercises
every method, so the output shows what each operation returns. Change the code,
change the parameters, watch the structure respond.

| | | |
| --- | --- | --- |
| Stack | Queue | Linked List |
| Doubly Linked List | Min Heap | Max Heap |
| Priority Queue | Binary Search Tree | Trie |
| Hash Map | Graph | DAG & Topological Sort |

**Patterns (8)** — each technique attached to the named problem it is famous
for, carrying the structure it operates on.

| Pattern | Problem |
| --- | --- |
| Two Pointers | Two Sum II on a sorted array |
| Sliding Window | Longest substring without repeats |
| Binary Search | Find first and last occurrence |
| Sorting | Merge sort vs bubble sort |
| BFS | Shortest unweighted path |
| DFS | Connected components |
| Recursion | Binary tree traversals |
| Backtracking | Subsets and permutations |

**Worked examples (15)** — the original catalogue, preserved and still runnable,
including the DP table and flood-fill templates that fit neither group above.

**LeetCode (40 written out, 2,990 runnable, 4,023 recognised)** — five problems
per pattern carry a restated prompt, their published example datasets, ranked
technique recommendations, a starter stub and a solution. Most of the rest open
as a generated scaffold: the right signature, the published examples, and a
driver that runs them. The remainder — premium, design problems, exotic
signatures — are recognised and recommended for. Loaded problems join the picker
like any other template.

**Scratch (1)** — a blank canvas with the API cheat sheet.

---

## Quick start

```bash
npm install
npm run dev            # http://localhost:5173
```

```bash
npm run build          # typecheck + production bundle into dist/
npm test               # 1118 unit tests
npm run smoke          # end-to-end run in a real Chrome
npm run smoke:python   # …including the Pyodide path (slow: downloads ~10 MB)
npm run responsive     # 16 device profiles, asserting nothing breaks
npm run editor:perf    # frame-by-frame editor scroll cost, in a real Chrome
npm run editor:compare # the app and a bare Monaco, side by side, to scroll by hand
npm run problems:refresh  # re-vendor the problem index (4,023 problems)
npm run problems:details  # re-vendor the runnable interfaces and examples
npm run screenshots    # capture every visualizer to screenshots/
```

Requires Node 20+. The smoke tests use Playwright driving your installed Chrome.

---

## The two faces of a template

| | **Plain code** (default) | **Instrumented** |
| --- | --- | --- |
| What you read | Ordinary CS code, no Breakstep API | The same lesson with explicit `breakstep.*` calls |
| How it draws | Auto-traced — Breakstep infers the subject | You decide, frame by frame |
| Inputs | Top-level constants the panel rewrites | `breakstep.param('name')` |
| Benchmark | Harness appended on your behalf | Visible in the source |

A LeetCode problem has no instrumented variant — it is plain code with an
auto-traced run, and the two sources would be identical — so the toggle is
disabled there and says why, rather than changing the badge and nothing else.

Auto-tracing steps aside the moment your code calls `breakstep.show` itself, so you can
start from plain code, reveal the instrumentation, and edit it — without ever
getting duplicate frames.

## The `breakstep` API

Needed only in instrumented mode. It is injected as a parameter, so there is
nothing to import, and it is fully typed inside the editor.

```ts
breakstep.show(value, options?)     // capture a frame; the shape picks the visualizer
breakstep.log(...args)              // write to the Output panel (console.log works too)
breakstep.label('text')             // name the next frame
breakstep.param('name', fallback)   // read a value from the Parameters panel
breakstep.randomInts(n, max, seed)  // deterministic pseudo-random input
breakstep.bench({ input, run })     // register the harness the Analyze tab sweeps
```

The benchmark harness is the one piece the empirical sweep cannot infer, because
it needs two things the source does not say: how to build a *bigger* input, and
what to call with it.

```ts
breakstep.bench({
  // Build an input of size n. Building it is not measured.
  input: (n) => breakstep.randomInts(n),
  // Call the code being measured. Add any other arguments it takes.
  run: (data) => twoSumSorted(data),
});
```

The Analyze tab shows this same example, in the language you are editing and
naming a function from your own file, whenever nothing has registered one.

`options` accepts:

| Option      | Meaning                                                                   |
| ----------- | ------------------------------------------------------------------------- |
| `label`     | Caption on the timeline                                                    |
| `as`        | Force a visualizer instead of relying on shape detection                   |
| `highlight` | Indices/ids to colour — `[0, 3]` or `{ 2: 'match', 5: 'compare' }`         |
| `pointers`  | Named index markers, e.g. `{ lo: 0, hi: 9 }`                               |
| `meta`      | Key/value badges shown beside the frame                                    |
| `heapType`  | `'min'` or `'max'` (inferred from the data when omitted)                   |
| `directed`  | Force edge direction instead of inferring it from reciprocal links         |

Highlight states: `active`, `compare`, `visited`, `match`, `sorted`, `muted`,
`error`.

### Pass a factory when building options is expensive

```ts
breakstep.show(arr, () => ({ label: `step ${i}`, highlight: paintWholeArray() }));
```

`breakstep.show` accepts a function in place of the options object, and only calls it
while frames are actually being captured. This matters more than it looks:
building an O(n) highlight map on every step would make an O(n) algorithm measure
as O(n²) on the Analyze tab. **Measure your algorithm, not your instrumentation.**

Python uses the same API, with `kind=` in place of the reserved word `as`:

```python
breakstep.show(stack, kind="stack", label="push")
breakstep.show(arr, frame)          # `frame` is a zero-arg callable returning a dict
breakstep.bench(
    input=lambda n: breakstep.random_ints(n),
    run=lambda data: two_sum_sorted(data),
)
```

---

## How it works

```
src/
  engine/            execution: workers, sandbox, shape detection
    normalize.ts       any value → a normalized view  (the shape-detection core)
    autoTrace.ts       decides what a frame is about: subject, pointers, caption
    paramBinding.ts    two-way binding between the panel and literals in the code
    sandbox.ts         compile + run user JS, count operations, capture frames
    jsWorker.ts        transport shell around the sandbox
    pythonRuntime.ts   Python-side runtime, AST instrumenter and value encoder
    pythonWorker.ts    Pyodide transport; replays traces through autoTrace.ts
    runner.ts          main-thread client: lifecycle, timeouts, cancellation
  analysis/          complexity + the two source rewrites
    instrument.ts      inject an op counter into every loop and function
    autoInstrument.ts  inject state-reporting hooks, TDZ-safely
    staticJs.ts        scopes, call composition, per-path recursion counting
    staticPy.ts        the same, driven by Python's indentation
    fit.ts             score growth models against measured operation counts
  components/        panels and the ten visualizers
    ProblemPanel.tsx   the problem you are solving, beside the code
    ProblemDrawer.tsx  finding one: paste a link, or browse by technique
    SubmissionsPanel.tsx  the verdict, the cases behind it, and the history
  leetcode/          the offline problem catalogue
    types.ts           what a problem is: prompt, dataset, techniques, sources
    catalogue.ts       40 problems, five per pattern, written out in full
    problemIndex.json  4,023 problems of vendored metadata, loaded on demand
    problemIndex.ts    decode, look up, and fuzzy-search that index
    details/           per-problem interface and example cases, sharded
    details.ts         load one shard at a time, on demand
    runnable.ts        interface + cases → a typed stub and a working driver
    synthesize.ts      wrap that as a problem the rest of the app can open
    topics.ts          LeetCode's topic tags → Breakstep's patterns and structures
    recommend.ts       URL → slug → catalogue, index, or keyword guess
    toTemplate.ts      wrap a problem as an ordinary template
  submissions/       right or wrong, and the record of it
    types.ts           what a submission is, and the store interface
    judge.ts           generate a judge harness, then grade what it reports
    store.ts           localStorage today, one call away from a service
  templates/
    structures/        the twelve classic structures
    patterns/          the eight classic techniques, on named problems
    examples/          the original catalogue, preserved
  hooks/             workspace state, theme, persistence
    useDebugger.ts     the debug cursor: search a recording, both directions
    useSubmissions.ts  the history for the problem on screen, read async
```

A few decisions worth knowing about:

**The editor owns the text; React hears about it when you pause.** Typing used
to round-trip through React state, and everything downstream of the buffer is
expensive: persisting it, re-reading the bound literals out of it, type-stripping
and parsing it to find the entry function, and re-rendering the tree. That put
**35 ms of synchronous work inside every input event** and keystroke-to-paint at
**48 ms**, with outliers past 180 ms — which is exactly what "laggy" feels like.

Now a keystroke is one ref assignment and one timer. The buffer is published to
React when typing stops, so all of that work happens once instead of per
character, and the frame belongs to Monaco: **1 ms of app work per keystroke,
24 ms to the screen**, which is the vsync floor on a 60 Hz display. Nothing is
lost to the debounce — the runners read the live buffer, every explicit action
flushes first, and leaving a template, hiding the tab or closing the page all
force the pending write through.

The invariant is easy to undo by accident, so it is guarded twice: `hooks.test.tsx`
asserts that typing neither publishes nor persists nor bumps the document
version, and `scripts/editor-perf.mjs` fails the build if the app spends more
than a budgeted slice of a keystroke inside the input handler. Reintroducing the
old behaviour was tried once to check both alarms actually ring: the unit tests
fail and the perf run exits non-zero, reporting 18.9 ms where it budgets 3.

**A recorded run makes some debugger features easier, not harder.** Breakpoint
conditions are the clearest case. A live debugger has to evaluate a condition
inside the paused process, at the moment execution arrives — which is why
conditions are set before you run and cost something on every hit. Here the
scope at every step is already in memory, so a condition is a pure function of
data that exists: it is compiled once, tested against twenty thousand recorded
scopes for free, and can be written, edited or removed long after the program
finished. The same evaluator answers watch expressions. What it gives up is the
thing a recording can never do — you cannot change a variable and continue.

**Operation counts, not wall-clock.** Both runtimes rewrite user code to bump a
counter at every loop iteration and function entry. The resulting number is
machine-independent — immune to JIT warmup, GC pauses and whatever else your
laptop is doing — which is what makes curve fitting trustworthy. Wall-clock time
is shown alongside, for reference only.

**Fitting rewards flat ratios, not raw R².** Plain least-squares on raw counts
lets an O(n³) model "explain" O(n²) data, because the largest sample dominates the
error. Instead each model is scored on how *constant* `y / f(n)` stays across the
whole sweep, which is scale-invariant, and near-ties resolve to the simpler curve.

**Static analysis composes along the call graph.** A loop that calls a function
containing another loop is quadratic, and putting the real work in `solve()` and
calling it at the bottom of the file — how everyone actually writes code — is
analyzed correctly. Recursion is counted per *execution path*, so
`fib(n-1) + fib(n-2)` branches twice while `cond ? bs(lo, mid) : bs(mid, hi)`
branches once. That single distinction is the difference between calling binary
search O(n) and O(log n).

**The debugger records, then replays.** Pausing a real execution would mean
`SharedArrayBuffer` and `Atomics.wait`, which needs cross-origin isolation headers
— fine on Vercel, impossible on a plain file server, and still no help for
Pyodide. So a debug run instead records every statement, function entry and exit
along with the variables in scope, and the panel walks that array. The cost is a
step budget (20 000 steps) and slower debug runs. The payoff is that **step
backwards** is just `index - 1`, the controls stay instant on a phone, and
JavaScript and Python go through exactly the same replay path. Each step also
carries the index of the frame that was current when it happened, which is what
keeps the visualizer and the paused line in sync.

**Method names are recorded qualified.** A step inside `LinkedList.push` reports
as `LinkedList.push`, not `push`, so switching on a breakpoint for one class
cannot stop inside another class's method of the same name. Constructors are
instrumented too, including derived ones — the entry hook never touches `this`,
and `super()` is legal inside the injected `try`.

**The editor is treated as a per-frame budget.** Monaco does not hand its
scrolling to the compositor — it re-renders the visible lines every frame — so
every editor option is a cost paid sixty or a hundred and twenty times a second.
`npm run editor:perf` drives real wheel and scrollbar input in Chrome, records a
DevTools trace, and reports main-thread work per frame; `--throttle 6` simulates
a slower machine. Measured that way, indentation guides alone were about 45% of
the editor's scroll-time JavaScript — one absolutely-positioned element per
indent level per visible line, rebuilt every frame — so they are off, along with
the per-line scanning for homoglyphs, CSS colours and URLs, code lenses, the
lightbulb, occurrence highlighting and the scrollbar's gradient overlays. Smooth
scrolling is off too: it eases every wheel tick over ~125 ms, which reads as lag
no matter how high the frame rate is. Bracket colouring stays — it costs a
fraction as much and shows nesting just as well.

The editor's options object is also memoised on the values that actually change
it. Monaco applies `updateOptions` whenever that object changes identity, and
that forces a full re-layout, so an unrelated re-render — a debug step, a log
line — must not be able to reach the editor.

Two of the settings are there for *feel* rather than for the profiler, and both
match what VS Code ships. `scrollBeyondLastLine` is on: with it off the scroll
stops dead on the last line, and a quick flick slams into a wall — which reads
as the editor stalling even though every frame arrived on time.
`alwaysConsumeMouseWheel` is on: letting unused wheel events escape to the page
sounds polite, but the files here are short, so you reach the end constantly and
every one of those events then goes looking for another scroller.

`npm run editor:compare` opens the app next to a bare Monaco with the same
version, font and file. Numbers only prove the main thread was free; that one is
for hands and eyes, and it settles whether a rough scroll is ours or Monaco's.

**Monaco's editor padding is done in CSS, not in its options.** `padding.top` is
not accounted for when Monaco resolves a click in the gutter, so a 12px gap on a
21px line silently set every breakpoint one line above the one clicked. The gap
now lives on the wrapper, where it cannot lie about geometry, and the smoke test
clicks a gutter and checks the debugger stops on that exact line.

**LeetCode support is entirely offline, and it has to be.** Their GraphQL
endpoint answers unauthenticated requests but sends no CORS headers at all — the
preflight returns 405 with no `Access-Control-Allow-*` — so a page on any other
origin simply cannot call it. That is not a policy choice on our side; a static
site with no backend has no way to fetch any of this at runtime. Everything is
therefore vendored by hand, by the two scripts under `scripts/`, and committed.

**A string is a sequence, so it draws like one.** A multi-character string
becomes a strip of characters, which means the machinery already built for
sequences — pointers, highlights, the visited trail — applies to string problems
for free: a palindrome check shows both ends closing in, a sliding window shows
its edges. Before this, `valid-palindrome` had *nothing* on screen, because the
only thing it works on is a string.

Promoting a string is guarded, because most strings in scope are labels rather
than data. It needs two independent signals to agree: at least two
conventionally-named cursors (`lo`, `hi`, `start`, `end` — the same names that
earn a pointer marker on an array) currently sitting inside its bounds, and the
same text as the previous frame. Either alone is too weak: one small integer
proves nothing, and "unchanged" alone would promote any constant caption. With
neither, a string is still a candidate — just ranked below real structures, so it
draws when nothing else is there and stays out of the way when a trie is. Five
tests pin both directions, including the case that caught it out: the four-letter
key a hash map is mid-insert must not displace the map.

**Cursors say more than "here".** Auto-tracing used to mark every cursor
`active`, which meant the colour key advertised three states plain code could
never produce. It now reads the cursors as a group: the one that moved since the
last frame is *current*, any other conventionally-named cursor is what it is
being *compared* against, and everywhere a cursor has already been in this pass
is *visited*. A cursor jumping backwards starts a new pass, which is what stops
the second sweep of a nested loop painting the whole array purple. The key still
lists only the colours a run actually used, so a single binary search shows one
entry and a bubble sort shows three.

**Connectors sit on the cells' centre line by construction.** The arrows and the
`head`/`null` captions in the linked-list views used to be nudged down by
hand-measured pixels, which held only while nothing above or below the cells
changed — and pointers and index labels come and go. Each one is now a column
with the same structure as a node: empty pointer row, empty pointer arrow, a
body exactly a cell high, empty index line.

**Templates are type-checked in the suite.** Monaco reports errors in the
editor, where nobody was looking, so a handful of templates shipped with red
squiggles in them — the reader cannot tell our mistake from theirs.
`typecheck.test.ts` compiles every template, in both modes, with and without the
appended harness, plus both sources of every problem, using the same compiler
options and the same ambient `breakstep` types the editor gets. What it caught
was worth having: a top-level `const top` shadowing `window.top` (and `length`
shadowing `window.length`), and select parameters whose comparisons TypeScript
called unreachable, because it narrows a `const` by control flow no matter how
the type is annotated. The fix for those was to dispatch through a table keyed
by the option instead of comparing — correct, and the better shape.

**Every verdict ships with its evidence.** The static pass is a heuristic and says
so, with a confidence score and the reasoning that produced it. The empirical
sweep is there to check its homework.

**Auto-tracing has to be invisible or it is worthless.** The rewrite injects a
snapshot *thunk* rather than a snapshot, so a benchmark sweep never invokes it and
the operation count stays clean; op-counting is injected first so the thunks are
not themselves counted. Deciding which identifiers are safe to name is the hard
part — reading a `let` before its declaration is a `ReferenceError` that would
break the user's program — so the instrumenter walks a real scope stack and only
names bindings that are provably live. Forward references from an enclosing scope
(the `let root` under the `function insert` that builds it) go through a
`try`/`catch` instead of being dropped.

**A class name is information the data cannot carry.** A `Stack` and a `Queue`
are both an array underneath; only the constructor name says which way up to
draw one. So the normalizer reads it — `Stack` draws vertically, `MinHeap` and
`MaxHeap` pick their ordering, `PriorityQueue` is recognised as a heap rather
than a queue, and `{ items, head }` shows only the live window so an O(1) queue
is not punished with a misleading picture. A hand-written hash map that exposes
its `buckets` array gets drawn with its *real* collisions rather than a re-hash
into invented ones.

**Choosing the subject is mostly about what it is *not*.** A value reachable from
another candidate is a pointer *into* it — `curr` inside `head`, the subtree a
recursion descended into — so it becomes a highlight, never the subject. After
that: pointer structures beat flat arrays, inner scopes beat module constants,
size breaks ties logarithmically, and a container that has not moved in several
frames is demoted as scenery. Stability matters more than cleverness; a subject
that flickers between variables makes the timeline unreadable.

**Cycle-safe by construction.** Student linked lists have cycles on purpose, so
the normalizer tracks visited nodes and reports the loop rather than recursing
forever. The Python bridge preserves this too: values cross into JavaScript as a
reference graph with explicit back-references, so a cyclic Python list rebuilds as
a real cycle rather than an infinite copy.

---

## What Breakstep takes from LeetCode, and what it does not

Everything here is public and unauthenticated, and it is all vendored at build
time by `npm run problems:refresh` and `npm run problems:details` — never fetched
from a user's browser, which their missing CORS headers make impossible anyway.
The vendored files are a dated snapshot, refreshed by hand: the scripts run
sequentially with a delay between requests, back off for thirty seconds when
rate-limited, identify themselves honestly in the `User-Agent`, send no
credentials, and read only endpoints that answer to anyone with a browser.

**Taken**, because it is data rather than writing:

| | |
| --- | --- |
| Catalogue metadata | number, slug, title, difficulty, premium flag, topic tags — for all 4,023 problems |
| Interface | the function name, its parameter names and types, and the return type |
| Example cases | the inputs LeetCode publishes, and the answers its statement gives for them |

That is exactly enough to identify a problem, recommend a technique from its real
tags, generate a correctly typed stub, run every published example — and judge a
submission against those answers, which is what makes Accepted mean something
here without ever contacting the site.

**Not taken:**

- **The statement.** The prose is LeetCode's copyrighted writing. Breakstep links
  to it; it does not copy it. The forty problems in `catalogue.ts` are restated
  in our own words instead, which is why there are forty and not four thousand.
- **Constraints.** They live inside the statement, so generated problems do not
  carry them. Written-out ones do, restated.
- **Solutions.** There are none to take: the editorial is behind LeetCode
  Premium, and community solutions are other people's work. Only the forty
  written-out problems have a solution to reveal, because we wrote them.
- **Premium problems** (~780 of the 4,023). Nothing about them is published, so
  they are flagged and left alone.

- **Anything behind an account.** No login, no cookie, no API key, no session is
  used anywhere in this project, and nothing paywalled is read or worked around.
  Premium problems are identified from the public flag and skipped.
- **Anything from NeetCode.** Nothing is taken from it at all — not its curated
  lists, not its orderings, not its videos or solutions. Breakstep's own pattern
  groupings come from the topic tags LeetCode publishes, mapped in `topics.ts`.

**Also not generated**, for technical rather than legal reasons: design problems
— `LRUCache` and friends — drive a class through a list of operations rather than
calling one function, and a few problems take parameter types with no obvious
literal form. Those are recognised and recommended for, but not scaffolded.

### Why this is the line

What is kept is the *functional* description of a problem — the name of a
function, the names and types of its parameters, the type it returns — plus the
short example values a statement quotes. That is the interface, not the writing
about it: it is what any two programs must agree on to run the same exercise, and
it is what makes a verdict here mean the same thing a verdict there means. It is
taken for interoperability and study, not as a substitute for the source, which is
why every problem carries a link to its own page and why the ~2,990 assembled
problems deliberately have no statement to read.

What is *not* kept is everything a person wrote: the prose, the constraints
embedded in it, the editorials, the community solutions. The forty problems
written out in `catalogue.ts` are original work — the task restated in our own
words, datasets chosen here, solutions written here — and Breakstep's copyright,
not a copy of anyone's.

**Nothing leaves your browser.** Your code, your submissions and your progress are
yours: they stay in `localStorage`, are never uploaded, and are never sent to
LeetCode or anywhere else. There is no analytics on what you write.

**On request.** If a rights holder believes something here should not be, we will
remove it in good faith and without argument — raise an issue on the repository.
The vendored dataset is regenerable from a script, so removing it costs nothing
but a commit.

This section describes how the project is built and why; it is a statement of
posture, not a legal opinion.

## Testing

| Layer                  | What it covers                                                     |
| ---------------------- | ------------------------------------------------------------------ |
| `engine/*.test.ts`     | shape detection, sandbox, instrumentation, TS stripping, Python bridge |
| `analysis/*.test.ts`   | static heuristics for both languages, curve fitting                |
| `components/*.test.tsx`| every visualizer, both layout engines, all panels                  |
| `hooks/*.test.tsx`     | workspace state machine, persistence, theming, submission history, **the debugger: running to the first breakpoint, conditions, disabled breakpoints, watch expressions, and what the session says it is doing** |
| `submissions/*.test.ts`| **every written problem's own solution is judged Accepted, and its stub is not**; the store contract, independent of `localStorage` |
| `templates/*.test.ts`  | **both faces of every template run, draw, bind their parameters, and measure the complexity they document** |
| `leetcode/*.test.ts`   | **every catalogue solution runs and reproduces its stated output**; the generator scaffolds 98% of the vendored problems, and a filled-in stub reproduces LeetCode's published answers |
| `scripts/smoke.mjs`    | real Chrome: Monaco boots, workers load, Pyodide executes, the debugger steps, a problem reveals, a stub is judged wrong and a solution Accepted — in both runtimes |
| `scripts/responsive.mjs` | 16 device profiles: layout mode, overflow, tap targets, reachability |
| `scripts/editor-perf.mjs` | **editor scrolling *and* typing**: main-thread work per frame against a 120 fps budget, and per keystroke against a handler budget — the guard on the typing path |
| `scripts/editor-features.mjs` | fifteen real keystrokes in a real browser: occurrence highlighting, `Cmd+D`, the palette, find and replace, rename, comment toggle, sticky scroll, folding, word wrap |
| `templates/typecheck.test.ts` | **every template and problem compiles clean**, with the editor's own options |

Every solution in the LeetCode catalogue is executed by the test suite and its
output compared, line for line, against the answers the problem statement
publishes. A solution that stops being correct fails the build.

The judge gets the same treatment from the other direction: all forty written
problems are *submitted*, through the generated harness, and every one must come
back Accepted on every published case. That single test is what catches a renamed
function, a tree rebuilt wrongly, or an in-place problem graded on its return
value — the failures that would otherwise tell a learner their correct answer was
wrong.

The template contract tests are the ones that matter most. A template that throws,
captures nothing, or disagrees with its own documented complexity is a broken
lesson — so for all 16 templates, in both modes and both JS dialects, the suite
asserts that the plain source contains no Breakstep API, auto-traces frames anyway,
logs something, binds every parameter to a real constant, survives a
parameter round trip, and measures the complexity it claims.

---

## Deploying

The app is a static bundle. On Vercel it needs no configuration beyond what is in
`vercel.json` — import the repo and deploy, or:

```bash
npx vercel deploy --prod
```

Anything that can serve a directory works equally well (`npm run build`, then host
`dist/`).

**Bundle note.** Monaco is ~770 kB gzipped and is genuinely that size; it is code
split behind a `Suspense` boundary, so the shell, the visualizers and the analysis
panels all paint before it arrives. Pyodide (~10 MB) is fetched from a CDN on the
first Python run only — open Breakstep in TypeScript mode and you never pay for it.

---

## Adding a structure

1. Add a view to `src/types/viz.ts`.
2. Teach `src/engine/normalize.ts` to detect or force it.
3. Add a component under `src/components/visualizers/` and register it in
   `Visualizer.tsx` — the switch is exhaustive, so this is a compile error until
   you do.
4. Add a template under `src/templates/structures/`; the contract tests pick it
   up automatically.

## Adding a template

Drop a `Template` into `src/templates/structures/`, `patterns/` or `examples/`
and add it to the matching array in `index.ts`. It needs three source sets:

- `code` — plain CS code, no Breakstep API, inputs as top-level constants
- `instrumented` — the same lesson with explicit `breakstep.*` calls
- `bench` — the `breakstep.bench(…)` harness appended in clean mode

Give it an `expected` complexity and the contract tests will hold everything to
it automatically.

## Themes

Three, switchable from the header: **Graphite** (default), **Midnight** and
**Light**.

Graphite is the one built for reading: a charcoal page with lighter panels on
top, borders you can actually see, and near-white text softened just enough to
take the glare off — deliberately close to the palette LeetCode uses, because
that palette stays legible for hours. Its editor uses the Dark+ token colours
rather than this app's accents, so code reads the way it does in every other
editor. Midnight, the old default, is still there: near-black photographs better
than it reads, and some people want that.

Graphite also splits an object from what is read off it — `trie` in one colour,
`size` in another, and a call like `insert(…)` in a third. Monaco's TypeScript
grammar emits `identifier` for both halves, and the type-aware answer, semantic
tokens, is not available: the worker keeps `getEncodedSemanticClassifications`
to itself. The distinction is therefore lexical — a name straight after a dot is
a member, a member straight before a `(` is a call — which is enough for the
distinction worth having, and knows nothing of a function stored in a property.
All three themes do it, each in its own register: Graphite keeps the object blue
and puts the member in near-white with calls in Dark+ yellow; Midnight gives the
member a cooler blue-grey than the near-white objects it hangs off; Light uses a
deep navy for members and the olive-brown that light editors have used for
callables for years.

Every colour comes
from a token in `src/styles/global.scss`, and Monaco has a matching theme for
each.

---

## License

MIT — see [`LICENSE`](LICENSE). It covers Breakstep's own source and content,
including the forty problems written out in `src/leetcode/problems/`, which are
original restatements and original solutions authored here.

It does not cover the vendored metadata in `src/leetcode/problemIndex.json` and
`src/leetcode/details/`, which is factual data about a third-party service rather
than this project's work. No problem statement, editorial or community solution
from any third party is in this repository.

---

## Notices

- **Independence.** Breakstep is an independent project. It is not affiliated
  with, sponsored by, endorsed by, or connected to LeetCode, NeetCode, or any
  other site it can open a problem from.
- **Trademarks.** "LeetCode", "NeetCode" and any other marks that appear are the
  property of their respective owners. They are used nominatively — to identify
  where a problem comes from and to link to it — and not as branding for this
  project or to suggest any endorsement.
- **Statements stay at the source.** No problem statement, constraint text,
  editorial or community solution is reproduced here. Every problem links to its
  own page, and the ~2,990 assembled problems carry no description precisely
  because the description is not ours to carry.
- **What is vendored, and why.** Only factual, functional metadata: a problem's
  number, slug, title, difficulty, public premium flag and topic tags, its
  function signature, and the example inputs and answers its statement quotes.
  Taken to make the same exercise runnable and judgeable here, not to replace the
  source.
- **Public endpoints only.** The refresh scripts read unauthenticated endpoints
  that answer to any browser. No account, cookie, API key or session is used
  anywhere in this project; nothing paywalled is accessed or circumvented;
  premium problems are skipped.
- **Politely, and by hand.** The scripts are run manually, one request at a time,
  with a delay between them, a thirty-second back-off when rate-limited, and a
  `User-Agent` that says what they are. The result is a dated snapshot committed
  to the repository, not a live dependency on anyone's servers.
- **Original work.** The forty written-out problems — restated tasks, chosen
  datasets, worked solutions — the templates, the visualizers, the analyzers and
  the judge are the work of this project.
- **License.** Breakstep's own code and content — the application, the templates,
  the visualizers, the analyzers, the judge, and the forty written-out problems —
  is MIT licensed; see [`LICENSE`](LICENSE). Use it, fork it, sell it.
- **Ownership of the vendored data.** The files under `src/leetcode/details/` and
  `src/leetcode/problemIndex.json` describe a third-party service. They are not
  Breakstep's work, are not claimed as such, and are not covered by the MIT grant
  above — that license cannot give away rights this project never held.
- **Your data is yours.** Code, submissions and progress stay in your browser's
  `localStorage`. Nothing is uploaded, nothing is sent to LeetCode or NeetCode,
  and there is no analytics on what you write. There is no backend to send it to.
- **Removal.** If you hold rights in something here and would rather it were not,
  open an issue on the repository and it will be removed in good faith, without
  argument. The dataset is generated by a script, so removing it costs a commit.

These notices describe how the project is built and the reasoning behind it. They
are not legal advice, and they are not a warranty.

