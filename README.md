# BCS — Browser Code Studio

An in-browser studio for data structures and algorithms. Pick a template, edit the
code, run it, watch it draw itself, and get a complexity verdict backed by an
actual measurement.

Think of it as the companion to NeetCode or LeetCode that has no problems in it —
just a place to *see* what your code does.

Everything runs client-side. There is no backend, no account, and no network call
after the page loads (except the one-time Pyodide download if you switch to
Python).

---

## What it does

**Write** — Monaco editor with TypeScript, JavaScript and Python. What you see
by default is ordinary computer-science code: a `ListNode` class, a `while`
loop, `console.log`. No app-specific API anywhere.

**Run** — user code executes in a Web Worker, so a runaway loop cannot freeze the
tab. An instrumented operation counter stops infinite loops, and a hard timeout
terminates the worker if anything survives that.

**Visualize** — plain code visualizes itself. BCS rewrites the source so it
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

**Scratch (1)** — a blank canvas with the API cheat sheet.

---

## Quick start

```bash
npm install
npm run dev            # http://localhost:5173
```

```bash
npm run build          # typecheck + production bundle into dist/
npm test               # 854 unit tests
npm run smoke          # end-to-end run in a real Chrome
npm run smoke:python   # …including the Pyodide path (slow: downloads ~10 MB)
npm run screenshots    # capture every visualizer to screenshots/
```

Requires Node 20+. The smoke tests use Playwright driving your installed Chrome.

---

## The two faces of a template

| | **Plain code** (default) | **Instrumented** |
| --- | --- | --- |
| What you read | Ordinary CS code, no BCS API | The same lesson with explicit `breakstep.*` calls |
| How it draws | Auto-traced — BCS infers the subject | You decide, frame by frame |
| Inputs | Top-level constants the panel rewrites | `breakstep.param('name')` |
| Benchmark | Harness appended on your behalf | Visible in the source |

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
breakstep.bench(input=lambda n: ..., run=solve)
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
  templates/
    structures/        the twelve classic structures
    patterns/          the eight classic techniques, on named problems
    examples/          the original catalogue, preserved
  hooks/             workspace state, theme, persistence
```

A few decisions worth knowing about:

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

## Testing

| Layer                  | What it covers                                                     |
| ---------------------- | ------------------------------------------------------------------ |
| `engine/*.test.ts`     | shape detection, sandbox, instrumentation, TS stripping, Python bridge |
| `analysis/*.test.ts`   | static heuristics for both languages, curve fitting                |
| `components/*.test.tsx`| every visualizer, both layout engines, all panels                  |
| `hooks/*.test.tsx`     | workspace state machine, persistence, theming                      |
| `templates/*.test.ts`  | **both faces of every template run, draw, bind their parameters, and measure the complexity they document** |
| `scripts/smoke.mjs`    | real Chrome: Monaco boots, workers load, Pyodide executes          |

The template contract tests are the ones that matter most. A template that throws,
captures nothing, or disagrees with its own documented complexity is a broken
lesson — so for all 16 templates, in both modes and both JS dialects, the suite
asserts that the plain source contains no BCS API, auto-traces frames anyway,
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
first Python run only — open BCS in TypeScript mode and you never pay for it.

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

- `code` — plain CS code, no BCS API, inputs as top-level constants
- `instrumented` — the same lesson with explicit `breakstep.*` calls
- `bench` — the `breakstep.bench(…)` harness appended in clean mode

Give it an `expected` complexity and the contract tests will hold everything to
it automatically.

## Themes

Three, switchable from the header: **Midnight** (default, near-black neutral),
**Slate** (the original cooler blue-tinted dark) and **Light**. Every colour comes
from a token in `src/styles/global.scss`, and Monaco has a matching theme for
each.
