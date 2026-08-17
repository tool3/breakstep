/**
 * The auto-trace runtime.
 *
 * `autoInstrument` rewrites user code to report its own locals at every loop
 * iteration and function call. This module decides what to *do* with that: which
 * variable is the subject of the picture, which numbers are pointers into it,
 * which objects should light up, and what the caption says.
 *
 * Two properties matter more than cleverness here:
 *
 *  - **Stability.** If the subject flickers between variables from frame to
 *    frame, scrubbing the timeline is unreadable. Candidates get a bonus for
 *    being the same variable that was chosen last time.
 *  - **Never break the program.** Every hook is wrapped so that a bad snapshot
 *    degrades to a missing frame rather than an exception in the user's code.
 */
import { normalize } from './normalize';
import type { CallStackEntry, CellState, ShowOptions, VizView } from '@/types/viz';
import type { StepKind } from '@/types/debug';

/** Index names worth surfacing as pointers, in order of preference. */
const POINTER_NAMES = [
  'i', 'j', 'k', 'lo', 'low', 'hi', 'high', 'left', 'right', 'mid', 'middle',
  'start', 'end', 'slow', 'fast', 'index', 'idx', 'pos', 'cursor', 'p', 'q',
];

/**
 * How much each structure is worth showing when several are in scope.
 *
 * These are large relative to the size term on purpose. A nine-element input
 * array should not outrank the three-node tree the algorithm is currently
 * building just because it happens to hold more elements — the pointer
 * structure is what the lesson is about.
 */
const KIND_BONUS: Record<VizView['kind'], number> = {
  linkedList: 8,
  tree: 8,
  trie: 8,
  graph: 8,
  heap: 8,
  matrix: 6,
  hashmap: 6,
  array: 2,
  callstack: 0,
  raw: -100,
};

/** Structures whose picture beats the call stack even during recursion. */
const POINTER_KINDS = new Set<VizView['kind']>(['linkedList', 'tree', 'trie', 'graph', 'heap']);

const MAX_POINTERS = 5;
const MAX_META = 6;

export interface AutoTracer {
  /**
   * Called at the top of every loop iteration, and — during a debug run —
   * before every statement. `tag` is `'stmt'` for the latter.
   */
  step(line: number, snapshot: () => Record<string, unknown>, tag?: string): void;
  /** Called on function entry. */
  enter(name: string, line: number, snapshot: () => Record<string, unknown>): void;
  /** Called on function exit, from a `finally` block. */
  exit(): void;
  /** Current call depth, for the run summary. */
  depth(): number;
}

export interface AutoTracerHost {
  /** Push a frame. Returns false once the frame budget is spent. */
  emit(view: VizView, label: string, line: number, meta: Record<string, unknown>): boolean;
  /** Auto-tracing pauses entirely while this is false (benchmark sweeps). */
  enabled(): boolean;
  /**
   * Record one debugger step. Present only on a debug run; the tracer calls it
   * for every hook, including the statement hooks the visualizer ignores.
   */
  record?: (
    kind: StepKind,
    line: number,
    scope: Record<string, unknown>,
    stack: CallStackEntry[],
    fn: string | undefined,
    frame: number | undefined,
  ) => boolean;
}

interface Candidate {
  name: string;
  raw: unknown;
  view: VizView;
  size: number;
  score: number;
}

/**
 * Every object reachable from `raw`, for containment testing.
 *
 * Bounded, because a graph with back-references would otherwise be walked in
 * full on every frame.
 */
function reachable(raw: unknown, limit = 400): Set<unknown> {
  const seen = new Set<unknown>();
  const stack: unknown[] = [raw];

  while (stack.length > 0 && seen.size < limit) {
    const value = stack.pop();
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);

    if (Array.isArray(value)) {
      for (const item of value) stack.push(item);
    } else if (value instanceof Map) {
      for (const item of value.values()) stack.push(item);
    } else if (value instanceof Set) {
      for (const item of value) stack.push(item);
    } else {
      for (const item of Object.values(value as Record<string, unknown>)) stack.push(item);
    }
  }

  return seen;
}

/** The live call stack, carrying the entry line so `exit` can report it. */
interface LiveFrame extends CallStackEntry {
  line: number;
}

/**
 * What the cursors have done so far in the current pass.
 *
 * Without this a frame can only say "here". With it, the cursor that just moved
 * is the current one, any other cursor is something being compared against it,
 * and the ground already covered is visited — which is the difference between a
 * colour key that describes the format and one that describes the run.
 */
interface PointerTrail {
  /** The structure these cursors belong to; a different one starts over. */
  owner: unknown;
  size: number;
  last: Record<string, number>;
  visited: Set<number>;
}

export function createAutoTracer(host: AutoTracerHost): AutoTracer {
  const callStack: LiveFrame[] = [];
  const trail: { current: PointerTrail | null } = { current: null };
  /** Function names currently on the stack, for recursion detection. */
  const active = new Map<string, number>();
  let lastSubject: string | null = null;
  const history = new Map<string, Observation>();
  let budgetSpent = false;

  /** Frames emitted so far — a step points at the picture current at its time. */
  let frameCount = 0;

  const record = (
    snapshot: Record<string, unknown>,
    line: number,
    tag?: string,
    isEnter = false,
  ): void => {
    const scalars = collectScalars(snapshot);
    const subject = pickSubject(snapshot, { lastName: lastSubject, history });

    /*
     * Recursion into a pointer structure is best shown as that structure — a
     * BST insert wants the tree, with the current node lit up. Recursion that
     * merely enumerates (subsets, permutations) has no such structure, and
     * there the growing and unwinding call stack IS the lesson.
     */
    const recursing = isEnter && callStack.length >= 2;
    const structural = subject && POINTER_KINDS.has(subject.view.kind);
    const useStack = callStack.length > 0 && (!subject || (recursing && !structural));

    let view: VizView;
    let label: string;

    if (useStack) {
      view = {
        kind: 'callstack',
        entries: callStack.map((entry, i) => ({
          ...entry,
          state: stateForDepth(i, callStack.length),
        })),
      };
      label = captionFor(null, scalars, tag) || `depth ${callStack.length}`;
      if (subject) remember(snapshot, history);
    } else if (subject) {
      lastSubject = subject.name;
      remember(snapshot, history);
      view = buildFocusedView(subject, snapshot, trail);
      label = captionFor(subject.name, scalars, tag);
    } else {
      return;
    }

    const meta: Record<string, unknown> = {};
    for (const [key, value] of scalars.slice(0, MAX_META)) meta[key] = value;
    if (callStack.length > 0) meta.depth = callStack.length;

    if (host.emit(view, label, line, meta)) frameCount++;
    else budgetSpent = true;
  };

  /**
   * A statement step carries no picture of its own — it points at whatever the
   * visualizer last drew, so scrubbing the debugger keeps the canvas in sync.
   */
  const recordStatement = (
    kind: StepKind,
    line: number,
    snapshot: Record<string, unknown>,
    fn?: string,
  ): void => {
    host.record?.(
      kind,
      line,
      snapshot,
      callStack.map((e) => ({ ...e })),
      fn,
      frameCount > 0 ? frameCount - 1 : undefined,
    );
  };

  const safely = (fn: () => void): void => {
    if (budgetSpent || !host.enabled()) return;
    try {
      fn();
    } catch {
      // A snapshot that throws must never take the user's program with it.
    }
  };

  return {
    step(line, snapshot, tag) {
      if (!host.enabled()) return;

      // A statement hook only feeds the debugger; the visualizer would show a
      // near-identical picture for every line of a function body.
      if (tag === 'stmt') {
        try {
          recordStatement('statement', line, snapshot() ?? {}, callStack.at(-1)?.label);
        } catch {
          /* a snapshot must never take the program with it */
        }
        return;
      }

      safely(() => {
        const scope = snapshot() ?? {};
        record(scope, line, tag);
        recordStatement('loop', line, scope, callStack.at(-1)?.label);
      });
    },

    enter(name, line, snapshot) {
      const depth = callStack.length;
      callStack.push({ label: name, depth, line });
      const seen = active.get(name) ?? 0;
      active.set(name, seen + 1);

      if (!host.enabled()) return;

      safely(() => {
        const scope = snapshot() ?? {};
        // Emitting a frame on every call would drown a hot helper. Recursion —
        // the same function already on the stack — is the case worth drawing.
        if (seen > 0) record(scope, line, name, true);
        // The debugger, though, stops at every entry: that is the point.
        recordStatement('entry', line, scope, name);
      });
    },

    exit() {
      const entry = callStack.pop();
      if (!entry) return;
      const seen = active.get(entry.label) ?? 1;
      if (seen <= 1) active.delete(entry.label);
      else active.set(entry.label, seen - 1);

      if (host.enabled()) recordStatement('exit', entry.line, {}, entry.label);
    },

    depth() {
      return callStack.length;
    },
  };
}

// ---------------------------------------------------------------------------
// Subject selection
// ---------------------------------------------------------------------------

function isStructural(v: unknown): boolean {
  return v !== null && typeof v === 'object';
}

/** Rough node count, used to prefer the richest structure in scope. */
export function viewSize(view: VizView): number {
  switch (view.kind) {
    case 'array':
    case 'heap':
      return view.items.length;
    case 'matrix':
      return view.rows.reduce((sum, row) => sum + row.length, 0);
    case 'linkedList':
      return view.nodes.length;
    case 'tree': {
      let count = 0;
      const walk = (n: typeof view.root) => {
        if (!n) return;
        count++;
        n.children.forEach(walk);
      };
      walk(view.root);
      return count;
    }
    case 'graph':
      return view.nodes.length;
    case 'trie': {
      let count = 0;
      const walk = (n: (typeof view)['root']) => {
        count++;
        n.children.forEach(walk);
      };
      walk(view.root);
      return count - 1; // the root carries no character
    }
    case 'hashmap':
      return view.buckets.reduce((sum, b) => sum + b.entries.length, 0);
    case 'callstack':
      return view.entries.length;
    default:
      return 0;
  }
}

/** Record every structural binding's size, tracking how long it has sat still. */
function remember(snapshot: Record<string, unknown>, history: Map<string, Observation>): void {
  for (const [name, raw] of Object.entries(snapshot)) {
    if (!isStructural(raw)) continue;
    try {
      const size = viewSize(normalize(raw));
      const previous = history.get(name);
      history.set(name, {
        size,
        stale: previous && previous.size === size ? previous.stale + 1 : 0,
      });
    } catch {
      /* not renderable — nothing to remember */
    }
  }
}

/** `this` for a `LinkedList` instance, a `{head}` object, and so on. */
function isContainer(raw: unknown): boolean {
  if (!isStructural(raw) || Array.isArray(raw)) return false;
  const rec = raw as Record<string, unknown>;
  return 'head' in rec || 'root' in rec || 'items' in rec || 'heap' in rec;
}

/** What we remember about a binding between frames. */
export interface Observation {
  size: number;
  /** Consecutive frames this binding has been the same size. */
  stale: number;
}

export interface PickOptions {
  /** Subject chosen for the previous frame; near-ties stick to it. */
  lastName?: string | null;
  /** History per variable — a changing structure is the live one. */
  history?: Map<string, Observation>;
}

/**
 * Choose what the frame is about.
 *
 * Four signals, in rough order of weight:
 *
 *  - **Kind.** A tree or a linked list beats a flat array.
 *  - **Scope.** The snapshot lists innermost bindings first, so a parameter of
 *    the running function outranks a module-level constant.
 *  - **Size**, dampened logarithmically so it breaks ties rather than deciding.
 *  - **Change.** A structure that grew or shrank since the last frame is the one
 *    being worked on; an untouched input array is scenery.
 */
export function pickSubject(
  snapshot: Record<string, unknown>,
  options: PickOptions | string | null = null,
): Candidate | null {
  const opts: PickOptions =
    typeof options === 'string' || options === null ? { lastName: options } : options;

  const candidates: Candidate[] = [];
  let index = 0;

  for (const [name, raw] of Object.entries(snapshot)) {
    const position = index++;
    if (!isStructural(raw)) continue;
    if (typeof (raw as { then?: unknown }).then === 'function') continue; // promises

    let view: VizView;
    try {
      view = normalize(raw);
    } catch {
      continue;
    }
    if (view.kind === 'raw') continue;

    const size = viewSize(view);
    if (size === 0) continue;

    // Growth specifically, not any change: a structure being *built* is the
    // subject, whereas a cursor walking a list merely shrinks and should stay a
    // highlight on the container it points into.
    // Growth specifically, not any change: a structure being *built* is the
    // subject, whereas a cursor walking a list merely shrinks and should stay a
    // highlight on the container it points into.
    const seen = opts.history?.get(name);
    const grew = seen !== undefined && size > seen.size;
    // A binding that has sat still for several frames is scenery — the input
    // array the algorithm reads, not the structure it is working on. This only
    // applies to flat containers: a linked list that a cursor is walking does
    // not change either, and it is still exactly what should be on screen.
    const scenery = view.kind === 'array' || view.kind === 'matrix' || view.kind === 'hashmap';
    const stale = scenery && seen ? Math.min(seen.stale, 3) : 0;

    const score =
      // Logarithmic so size breaks ties rather than deciding — but weighted
      // enough that a whole tree still beats the subtree one frame is recursing
      // into.
      Math.log2(size + 1) * 3.5 +
      KIND_BONUS[view.kind] +
      // Inner scopes come first in the snapshot; the first few get a boost.
      Math.max(0, 3 - position * 0.5) +
      (name === opts.lastName ? 3 : 0) +
      // The strongest signal available: an input array sits still while the
      // structure under construction grows. Weighted to beat a larger constant.
      (grew ? 5 : 0) -
      stale * 1.6 +
      (isContainer(raw) ? 1 : 0) +
      // `this` is usually the object the method is about.
      (name === 'this' ? 0.5 : 0);

    candidates.push({ name, raw, view, size, score });
  }

  if (candidates.length === 0) return null;

  /*
   * A candidate reachable from another one is a *pointer into* it — `curr`
   * inside `head`, the subtree a recursion descends into inside the whole
   * tree. Those belong on screen as highlights, not as the subject, so the
   * container wins outright rather than by a hair of scoring.
   */
  if (candidates.length > 1) {
    const reach = candidates.map((c) => reachable(c.raw));
    const contained = candidates.map((candidate, i) =>
      candidates.some(
        (other, j) => i !== j && other.raw !== candidate.raw && reach[j].has(candidate.raw),
      ),
    );
    const outer = candidates.filter((_, i) => !contained[i]);
    if (outer.length > 0) {
      outer.sort((a, b) => b.score - a.score);
      return outer[0];
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

// ---------------------------------------------------------------------------
// Frame construction
// ---------------------------------------------------------------------------

/**
 * Re-normalize the subject with pointers and identity highlights derived from
 * everything else in scope.
 */
function buildFocusedView(
  subject: Candidate,
  snapshot: Record<string, unknown>,
  trail: { current: PointerTrail | null },
): VizView {
  const opts: ShowOptions = {};

  // Objects other than the subject may be nodes *inside* it — `curr`, `node`,
  // `prev`. Identity matching lights them up wherever they happen to sit.
  // Excluded by NAME, not by value: a cursor that currently happens to equal
  // the head is still a cursor, and should light up the node it sits on.
  const focus: unknown[] = [];
  for (const [name, raw] of Object.entries(snapshot)) {
    if (name === subject.name || !isStructural(raw)) continue;
    if (Array.isArray(raw) || raw instanceof Map || raw instanceof Set) continue;
    focus.push(raw);
  }
  if (focus.length > 0) opts.focus = focus.slice(0, 12);

  // Numeric locals that index into a linear structure become pointers.
  if (subject.view.kind === 'array' || subject.view.kind === 'heap') {
    const length = subject.size;
    const pointers: Record<string, number> = {};
    const numeric = Object.entries(snapshot)
      .filter(([, v]) => typeof v === 'number' && Number.isInteger(v))
      .sort((a, b) => pointerRank(a[0]) - pointerRank(b[0]));

    for (const [name, value] of numeric) {
      const index = value as number;
      if (index < 0) continue;

      // A conventionally-named cursor may sit one past the end (`right = n`).
      // Anything else has to be a real index, or every unrelated constant that
      // happens to be small would be drawn as a pointer.
      const limit = POINTER_NAMES.includes(name) ? length : length - 1;
      if (index > limit) continue;

      pointers[name] = index;
      if (Object.keys(pointers).length >= MAX_POINTERS) break;
    }
    if (Object.keys(pointers).length > 0) {
      opts.pointers = pointers;
      opts.highlight = markProgress(pointers, length, subject.raw, trail);
    }
  }

  // Graph and hash-map nodes are addressed by key, so scalars can name them.
  if (subject.view.kind === 'graph' || subject.view.kind === 'hashmap') {
    const ids = new Set(
      subject.view.kind === 'graph'
        ? subject.view.nodes.map((n) => n.id)
        : subject.view.buckets.flatMap((b) => b.entries.map((e) => String(e.key))),
    );
    const highlight: Record<string, CellState> = {};
    for (const [, value] of Object.entries(snapshot)) {
      if (typeof value !== 'string' && typeof value !== 'number') continue;
      const key = String(value);
      if (ids.has(key)) highlight[key] = 'active';
    }
    if (Object.keys(highlight).length > 0) opts.highlight = highlight;
  }

  try {
    return normalize(subject.raw, opts);
  } catch {
    return subject.view;
  }
}

/**
 * Turn the cursors into states: current, comparing, and visited.
 *
 * The cursor that changed since the last frame is the one doing the work, so it
 * is current; any other cursor is what it is being measured against. Everywhere
 * a cursor has already been in this pass is visited — and a cursor jumping
 * backwards starts a new pass, which is what keeps a nested loop from painting
 * the whole array purple on its second sweep.
 */
function markProgress(
  pointers: Record<string, number>,
  length: number,
  owner: unknown,
  trail: { current: PointerTrail | null },
): Record<string, CellState> {
  const previous =
    trail.current && trail.current.owner === owner && trail.current.size === length
      ? trail.current
      : null;

  const names = Object.keys(pointers).sort((a, b) => pointerRank(a) - pointerRank(b));
  const moved = names.filter((name) => previous && previous.last[name] !== pointers[name]);
  // Nothing moved on the first frame, so fall back to the best-named cursor.
  const primary = moved[0] ?? names[0];

  const wentBackwards =
    previous !== null && previous.last[primary] !== undefined && pointers[primary] < previous.last[primary];

  const visited = wentBackwards || !previous ? new Set<number>() : new Set(previous.visited);

  const highlight: Record<string, CellState> = {};
  for (const index of visited) {
    if (index >= 0 && index < length) highlight[index] = 'visited';
  }

  // Cursors win over the trail they left behind. Only a conventionally named
  // one counts as "comparing", because an ordinary number that happens to be a
  // valid index — a running maximum, a count — is drawn as a pointer but is not
  // being compared against anything.
  for (const name of names) {
    const index = pointers[name];
    if (index < 0 || index >= length) continue;
    if (name === primary) highlight[index] = 'active';
    else if (POINTER_NAMES.includes(name)) highlight[index] = 'compare';
  }

  for (const name of names) {
    const index = pointers[name];
    if (index >= 0 && index < length) visited.add(index);
  }

  trail.current = { owner, size: length, last: { ...pointers }, visited };
  return highlight;
}

function pointerRank(name: string): number {
  const index = POINTER_NAMES.indexOf(name);
  return index === -1 ? POINTER_NAMES.length : index;
}

function stateForDepth(index: number, total: number): CellState | undefined {
  return index === total - 1 ? 'active' : undefined;
}

/** Scalars are the caption and the meta badges: `i = 3, sum = 12`. */
function collectScalars(snapshot: Record<string, unknown>): [string, unknown][] {
  const out: [string, unknown][] = [];
  for (const [name, value] of Object.entries(snapshot)) {
    if (name === 'this') continue;
    const t = typeof value;
    if (t === 'number' || t === 'boolean') out.push([name, value]);
    else if (t === 'string' && (value as string).length <= 24) out.push([name, value]);
  }
  // Loop counters first — they are what the reader is tracking.
  out.sort((a, b) => pointerRank(a[0]) - pointerRank(b[0]));
  return out;
}

function captionFor(
  subjectName: string | null,
  scalars: [string, unknown][],
  tag?: string,
): string {
  const parts: string[] = [];
  if (tag && tag !== 'final') parts.push(`${tag}()`);
  else if (tag === 'final') parts.push('final state');
  else if (subjectName && subjectName !== 'this') parts.push(subjectName);

  const summary = scalars
    .slice(0, 3)
    .map(([name, value]) => `${name} = ${formatScalar(value)}`)
    .join(', ');

  if (summary) parts.push(summary);
  return parts.join(' · ') || 'step';
}

function formatScalar(value: unknown): string {
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number' && !Number.isInteger(value)) return value.toFixed(2);
  return String(value);
}
