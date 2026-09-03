import { normalize } from './normalize';
import type { CallStackEntry, CellState, ShowOptions, VizView } from '@/types/viz';
import type { StepKind } from '@/types/debug';

const POINTER_NAMES = [
  'i', 'j', 'k', 'lo', 'low', 'hi', 'high', 'left', 'right', 'mid', 'middle',
  'start', 'end', 'slow', 'fast', 'index', 'idx', 'pos', 'cursor', 'p', 'q',
];

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

const POINTER_KINDS = new Set<VizView['kind']>(['linkedList', 'tree', 'trie', 'graph', 'heap']);

const MAX_POINTERS = 5;
const MAX_META = 6;

export interface AutoTracer {
  step(line: number, snapshot: () => Record<string, unknown>, tag?: string): void;
  enter(name: string, line: number, snapshot: () => Record<string, unknown>): void;
  exit(): void;
  depth(): number;
}

export interface AutoTracerHost {
  emit(view: VizView, label: string, line: number, meta: Record<string, unknown>): boolean;
  enabled(): boolean;
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

interface LiveFrame extends CallStackEntry {
  line: number;
}

interface PointerTrail {
  owner: unknown;
  size: number;
  last: Record<string, number>;
  visited: Set<number>;
}

export function createAutoTracer(host: AutoTracerHost): AutoTracer {
  const callStack: LiveFrame[] = [];
  const trail: { current: PointerTrail | null } = { current: null };
  const active = new Map<string, number>();
  let lastSubject: string | null = null;
  const history = new Map<string, Observation>();
  let budgetSpent = false;

  let frameCount = 0;

  const record = (
    snapshot: Record<string, unknown>,
    line: number,
    tag?: string,
    isEnter = false,
  ): void => {
    const scalars = collectScalars(snapshot);
    const subject = pickSubject(snapshot, { lastName: lastSubject, history });

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
        if (seen > 0) record(scope, line, name, true);
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

function isStructural(v: unknown): boolean {
  return v !== null && typeof v === 'object';
}

const MAX_STRING_CELLS = 160;

function isVisualString(v: unknown): v is string {
  return typeof v === 'string' && v.length >= 2 && v.length <= MAX_STRING_CELLS;
}

const STRING_PENALTY = 4;

const STRING_CURSOR_BONUS = 5;
const CURSORS_FOR_STRING = 2;

function cursorsInto(text: string, snapshot: Record<string, unknown>): number {
  const positions = new Set<number>();
  for (const [name, value] of Object.entries(snapshot)) {
    if (!POINTER_NAMES.includes(name)) continue;
    if (typeof value !== 'number' || !Number.isInteger(value)) continue;
    if (value >= 0 && value <= text.length) positions.add(value);
  }
  return positions.size;
}

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
      return count - 1;
    }
    case 'hashmap':
      return view.buckets.reduce((sum, b) => sum + b.entries.length, 0);
    case 'callstack':
      return view.entries.length;
    default:
      return 0;
  }
}

function remember(snapshot: Record<string, unknown>, history: Map<string, Observation>): void {
  for (const [name, raw] of Object.entries(snapshot)) {
    if (!isVisualString(raw) && !isStructural(raw)) continue;
    try {
      const size = viewSize(normalize(raw));
      const previous = history.get(name);
      history.set(name, {
        size,
        text: typeof raw === 'string' ? raw : undefined,
        stale: previous && previous.size === size ? previous.stale + 1 : 0,
      });
    } catch {
      /* not renderable — nothing to remember */
    }
  }
}

function isContainer(raw: unknown): boolean {
  if (!isStructural(raw) || Array.isArray(raw)) return false;
  const rec = raw as Record<string, unknown>;
  return 'head' in rec || 'root' in rec || 'items' in rec || 'heap' in rec;
}

export interface Observation {
  size: number;
  text?: string;
  stale: number;
}

export interface PickOptions {
  lastName?: string | null;
  history?: Map<string, Observation>;
}

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
    const isString = isVisualString(raw);
    if (!isString && !isStructural(raw)) continue;
    if (!isString && typeof (raw as { then?: unknown }).then === 'function') continue;

    let view: VizView;
    try {
      view = normalize(raw);
    } catch {
      continue;
    }
    if (view.kind === 'raw') continue;

    const size = viewSize(view);
    if (size === 0) continue;

    const seen = opts.history?.get(name);
    const grew = seen !== undefined && size > seen.size;
    const scenery = view.kind === 'array' || view.kind === 'matrix' || view.kind === 'hashmap';
    const stale = scenery && seen ? Math.min(seen.stale, 3) : 0;

    const score =
      Math.log2(size + 1) * 3.5 +
      KIND_BONUS[view.kind] +
      (isString
        ? cursorsInto(raw, snapshot) >= CURSORS_FOR_STRING && seen?.text === raw
          ? STRING_CURSOR_BONUS
          : -STRING_PENALTY
        : 0) +
      Math.max(0, 3 - position * 0.5) +
      (name === opts.lastName ? 3 : 0) +
      (grew ? 5 : 0) -
      stale * 1.6 +
      (isContainer(raw) ? 1 : 0) +
      (name === 'this' ? 0.5 : 0);

    candidates.push({ name, raw, view, size, score });
  }

  if (candidates.length === 0) return null;

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

function buildFocusedView(
  subject: Candidate,
  snapshot: Record<string, unknown>,
  trail: { current: PointerTrail | null },
): VizView {
  const opts: ShowOptions = {};

  const focus: unknown[] = [];
  for (const [name, raw] of Object.entries(snapshot)) {
    if (name === subject.name || !isStructural(raw)) continue;
    if (Array.isArray(raw) || raw instanceof Map || raw instanceof Set) continue;
    focus.push(raw);
  }
  if (focus.length > 0) opts.focus = focus.slice(0, 12);

  if (subject.view.kind === 'array' || subject.view.kind === 'heap') {
    const length = subject.size;
    const pointers: Record<string, number> = {};
    const numeric = Object.entries(snapshot)
      .filter(([, v]) => typeof v === 'number' && Number.isInteger(v))
      .sort((a, b) => pointerRank(a[0]) - pointerRank(b[0]));

    for (const [name, value] of numeric) {
      const index = value as number;
      if (index < 0) continue;

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
  const primary = moved[0] ?? names[0];

  const wentBackwards =
    previous !== null && previous.last[primary] !== undefined && pointers[primary] < previous.last[primary];

  const visited = wentBackwards || !previous ? new Set<number>() : new Set(previous.visited);

  const highlight: Record<string, CellState> = {};
  for (const index of visited) {
    if (index >= 0 && index < length) highlight[index] = 'visited';
  }

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

function collectScalars(snapshot: Record<string, unknown>): [string, unknown][] {
  const out: [string, unknown][] = [];
  for (const [name, value] of Object.entries(snapshot)) {
    if (name === 'this') continue;
    const t = typeof value;
    if (t === 'number' || t === 'boolean') out.push([name, value]);
    else if (t === 'string' && (value as string).length <= 24) out.push([name, value]);
  }
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
