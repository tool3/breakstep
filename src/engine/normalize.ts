/**
 * Shape detection: turns arbitrary user values into a normalized `VizView`.
 *
 * The whole point of BCS is that you write ordinary code — a plain `{val, next}`
 * chain, a `Map`, a class with a `root` — and it just draws. This module is the
 * only place that guesses. It is pure and synchronous so it can be unit tested
 * without a worker, and it is cycle-safe because student linked lists have
 * cycles on purpose.
 */
import type {
  ArrayView,
  CallStackEntry,
  CallStackView,
  Cell,
  CellState,
  GraphEdge,
  GraphNode,
  GraphView,
  HashMapView,
  HeapView,
  LinkedListNode,
  LinkedListView,
  MatrixView,
  Pointer,
  ShowOptions,
  TreeNode,
  TreeView,
  TrieNode,
  TrieView,
  VizView,
} from '@/types/viz';

/** Hard ceilings so a runaway structure can't lock up the renderer. */
export const LIMITS = {
  nodes: 500,
  arrayItems: 400,
  matrixCells: 2500,
  depth: 64,
} as const;

const VALUE_KEYS = ['value', 'val', 'data', 'key', 'item', 'label'] as const;

/**
 * Class names that tell us how to draw an instance.
 *
 * A hand-written `class Stack` and `class Queue` are both an array underneath;
 * only the name says which way up to draw it. Reading the constructor is the
 * one piece of information the data itself cannot carry.
 */
const CLASS_HINTS: { pattern: RegExp; variant?: ArrayView['variant']; heapType?: 'min' | 'max' }[] = [
  // Order matters: a PriorityQueue is a heap, not a queue, and would otherwise
  // be caught by the `queue$` rule below.
  { pattern: /maxheap|max_heap|maxpriority/i, heapType: 'max' },
  { pattern: /minheap|min_heap|priority/i, heapType: 'min' },
  { pattern: /(^|[^a-z])stack$/i, variant: 'stack' },
  { pattern: /deque/i, variant: 'deque' },
  { pattern: /queue$/i, variant: 'queue' },
];

/** The constructor name of a class instance, if it has a useful one. */
export function className(value: unknown): string {
  if (value === null || typeof value !== 'object') return '';
  const name = (value as { constructor?: { name?: string } }).constructor?.name;
  return name && name !== 'Object' ? name : '';
}

function classHint(value: unknown) {
  const name = className(value);
  if (!name) return undefined;
  return CLASS_HINTS.find((hint) => hint.pattern.test(name));
}
const CHILD_LIST_KEYS = ['children', 'kids', 'nodes'] as const;
const CONTAINER_KEYS = ['root', 'head', 'first', 'heap', 'items', 'list', 'store'] as const;

function isPlainRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isPrimitive(v: unknown): boolean {
  return v === null || v === undefined || typeof v !== 'object';
}

function has(obj: Record<string, unknown>, key: string): boolean {
  return key in obj && obj[key] !== undefined;
}

/** Pull the display value out of a node-like object, falling back to the object. */
export function nodeValue(obj: unknown): unknown {
  if (!isPlainRecord(obj)) return obj;
  for (const k of VALUE_KEYS) {
    if (has(obj, k)) return obj[k];
  }
  // No recognizable value key: show the non-structural fields only.
  const structural = new Set(['next', 'prev', 'left', 'right', 'children', 'parent']);
  const rest = Object.entries(obj).filter(([k]) => !structural.has(k));
  if (rest.length === 0) return '•';
  if (rest.length === 1) return rest[0][1];
  return Object.fromEntries(rest);
}

// ---------------------------------------------------------------------------
// Highlight resolution
// ---------------------------------------------------------------------------

type StateLookup = (key: string | number) => CellState | undefined;

function buildStateLookup(highlight: ShowOptions['highlight']): StateLookup {
  if (!highlight) return () => undefined;
  if (Array.isArray(highlight)) {
    const set = new Set(highlight.map(String));
    return (k) => (set.has(String(k)) ? 'active' : undefined);
  }
  const map = new Map(Object.entries(highlight).map(([k, v]) => [k, v]));
  return (k) => map.get(String(k));
}

/**
 * Identity lookup for `options.focus`.
 *
 * Auto-tracing knows a variable holds *some* node but not where it sits in the
 * structure, so matching has to be by object identity rather than by index.
 */
function buildFocusLookup(opts: ShowOptions): (raw: unknown) => CellState | undefined {
  if (!opts.focus?.length) return () => undefined;
  const set = new Set<unknown>(opts.focus.filter((f) => f !== null && typeof f === 'object'));
  if (set.size === 0) return () => undefined;
  const state = opts.focusState ?? 'active';
  return (raw) => (set.has(raw) ? state : undefined);
}

function toPointers(p: ShowOptions['pointers']): Pointer[] | undefined {
  if (!p) return undefined;
  const out = Object.entries(p)
    .filter(([, index]) => Number.isFinite(index))
    .map(([name, index]) => ({ name, index: Number(index) }));
  return out.length ? out : undefined;
}

// ---------------------------------------------------------------------------
// Structure predicates
// ---------------------------------------------------------------------------

export function looksLikeLinkedListNode(v: unknown): boolean {
  return isPlainRecord(v) && 'next' in v;
}

export function looksLikeBinaryTreeNode(v: unknown): boolean {
  return isPlainRecord(v) && ('left' in v || 'right' in v);
}

export function looksLikeTrieNode(v: unknown): boolean {
  if (!isPlainRecord(v)) return false;
  const terminalish = ['isEnd', 'isWord', 'terminal', 'end', 'isTerminal', 'word'].some((k) =>
    has(v, k),
  );
  const kids = v.children ?? v.child ?? v.next;
  const childMap =
    kids instanceof Map || (isPlainRecord(kids) && !Array.isArray(kids)) || Array.isArray(kids);
  return terminalish && childMap;
}

export function looksLikeNaryTreeNode(v: unknown): boolean {
  if (!isPlainRecord(v)) return false;
  return CHILD_LIST_KEYS.some((k) => Array.isArray(v[k]));
}

export function looksLikeGraph(v: unknown): boolean {
  if (!isPlainRecord(v)) return false;
  if (Array.isArray(v.nodes) && Array.isArray(v.edges)) return true;
  if (Array.isArray(v.vertices) && Array.isArray(v.edges)) return true;
  return false;
}

/** `{a: ['b','c'], b: ['c']}` or a Map of the same shape. */
export function looksLikeAdjacency(v: unknown): boolean {
  const entries = toEntries(v);
  if (!entries || entries.length === 0) return false;
  // `Map<string, Set<string>>` is the better adjacency structure — O(1) edge
  // tests — so accept Sets alongside arrays.
  const lists = entries.filter(([, val]) => Array.isArray(val) || val instanceof Set);
  if (lists.length !== entries.length) return false;
  const keys = new Set(entries.map(([k]) => String(k)));
  // At least one neighbour must reference another key, else it's just a map of lists.
  return lists.some(([, val]) =>
    [...(val as Iterable<unknown>)].some((n) => keys.has(String(edgeTarget(n)))),
  );
}

function edgeTarget(n: unknown): unknown {
  if (isPlainRecord(n)) return n.to ?? n.node ?? n.id ?? n.v ?? n.target;
  if (Array.isArray(n)) return n[0];
  return n;
}

function edgeWeight(n: unknown): number | undefined {
  if (isPlainRecord(n)) {
    const w = n.weight ?? n.w ?? n.cost ?? n.dist;
    return typeof w === 'number' ? w : undefined;
  }
  if (Array.isArray(n) && typeof n[1] === 'number') return n[1];
  return undefined;
}

function toEntries(v: unknown): [unknown, unknown][] | null {
  if (v instanceof Map) return [...v.entries()];
  if (isPlainRecord(v)) return Object.entries(v);
  return null;
}

/** Unwrap `new LinkedList()` / `new BST()` style containers to their payload. */
const OFFSET_KEYS = ['head', 'start', 'offset', 'front'] as const;
const STORAGE_KEYS = ['items', 'store', 'data', 'buffer', 'list', 'elements'] as const;

export function unwrapContainer(v: unknown): unknown {
  if (!isPlainRecord(v)) return v;
  // Already a recognizable node — don't unwrap.
  if (looksLikeLinkedListNode(v) || looksLikeBinaryTreeNode(v) || looksLikeTrieNode(v)) return v;
  if (looksLikeGraph(v)) return v;

  /*
   * The O(1) queue idiom: `{ items: [...], head: 2 }`. Only the live window
   * should be drawn — the consumed prefix is an implementation detail, and a
   * queue that correctly avoids `shift()` should not be punished with a
   * misleading picture.
   */
  const offsetKey = OFFSET_KEYS.find((k) => typeof v[k] === 'number');
  const storageKey = STORAGE_KEYS.find((k) => Array.isArray(v[k]));
  if (offsetKey && storageKey) {
    const offset = v[offsetKey] as number;
    const storage = v[storageKey] as unknown[];
    if (offset >= 0 && offset <= storage.length) return storage.slice(offset);
  }
  for (const key of CONTAINER_KEYS) {
    if (has(v, key)) {
      const inner = v[key];
      if (inner !== null && (typeof inner === 'object' || Array.isArray(inner))) return inner;
      // `root: null` on an empty tree is still a tree — keep it.
      if (inner === null && (key === 'root' || key === 'head')) return null;
    }
  }
  const adj = v.adj ?? v.adjacency ?? v.adjList ?? v.graph;
  if (adj && looksLikeAdjacency(adj)) return adj;
  return v;
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function buildArray(
  input: unknown[],
  opts: ShowOptions,
  variant: ArrayView['variant'],
): ArrayView {
  const stateAt = buildStateLookup(opts.highlight);
  const focusAt = buildFocusLookup(opts);
  const items: Cell[] = input.slice(0, LIMITS.arrayItems).map((value, i) => ({
    value: isPrimitive(value) ? value : nodeValue(value),
    state: focusAt(value) ?? stateAt(i),
  }));
  return {
    kind: 'array',
    items,
    variant,
    pointers: toPointers(opts.pointers),
    showIndices: variant === 'array' || variant === undefined,
  };
}

function buildMatrix(input: unknown[][], opts: ShowOptions): MatrixView {
  const stateAt = buildStateLookup(opts.highlight);
  const rows: Cell[][] = [];
  let budget = LIMITS.matrixCells;
  for (let r = 0; r < input.length && budget > 0; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < input[r].length && budget > 0; c++, budget--) {
      row.push({
        value: input[r][c],
        // Accept both "r,c" and flat-index highlight keys.
        state: stateAt(`${r},${c}`) ?? stateAt(r * input[r].length + c),
      });
    }
    rows.push(row);
  }
  return { kind: 'matrix', rows };
}

function buildLinkedList(headRaw: unknown, opts: ShowOptions): LinkedListView {
  const stateAt = buildStateLookup(opts.highlight);
  const focusAt = buildFocusLookup(opts);
  const nodes: LinkedListNode[] = [];
  const indexOf = new Map<unknown, number>();
  let cursor = headRaw;
  let cyclic = false;

  while (isPlainRecord(cursor) && nodes.length < LIMITS.nodes) {
    if (indexOf.has(cursor)) {
      cyclic = true;
      break;
    }
    indexOf.set(cursor, nodes.length);
    nodes.push({
      id: `n${nodes.length}`,
      value: nodeValue(cursor),
      next: null,
      state: focusAt(cursor) ?? stateAt(nodes.length) ?? stateAt(String(nodeValue(cursor))),
    });
    cursor = cursor.next;
  }

  // Second pass wires `next` now that every node has an index.
  cursor = headRaw;
  for (let i = 0; i < nodes.length; i++) {
    const rec = cursor as Record<string, unknown>;
    const nxt = rec.next;
    nodes[i].next = isPlainRecord(nxt) ? (indexOf.get(nxt) ?? null) : null;
    if (isPlainRecord(rec.prev)) nodes[i].prev = indexOf.get(rec.prev) ?? null;
    cursor = nxt;
  }

  const doubly = nodes.some((n) => n.prev !== undefined);
  return {
    kind: 'linkedList',
    nodes,
    cyclic,
    doubly,
    pointers: toPointers(opts.pointers),
  };
}

function buildBinaryTree(rootRaw: unknown, opts: ShowOptions): TreeView {
  const stateAt = buildStateLookup(opts.highlight);
  const focusAt = buildFocusLookup(opts);
  const seen = new Set<unknown>();
  let counter = 0;

  const walk = (node: unknown, depth: number): TreeNode | null => {
    if (!isPlainRecord(node) || depth > LIMITS.depth || counter >= LIMITS.nodes) return null;
    if (seen.has(node)) return null;
    seen.add(node);
    const value = nodeValue(node);
    const id = `t${counter++}`;
    return {
      id,
      value,
      state: focusAt(node) ?? stateAt(String(value)) ?? stateAt(counter - 1),
      children: [walk(node.left, depth + 1), walk(node.right, depth + 1)],
    };
  };

  return { kind: 'tree', root: walk(rootRaw, 0), binary: true };
}

function buildNaryTree(rootRaw: unknown, opts: ShowOptions): TreeView {
  const stateAt = buildStateLookup(opts.highlight);
  const focusAt = buildFocusLookup(opts);
  const seen = new Set<unknown>();
  let counter = 0;

  const walk = (node: unknown, depth: number): TreeNode | null => {
    if (!isPlainRecord(node) || depth > LIMITS.depth || counter >= LIMITS.nodes) return null;
    if (seen.has(node)) return null;
    seen.add(node);
    const value = nodeValue(node);
    const id = `t${counter++}`;
    const kidsKey = CHILD_LIST_KEYS.find((k) => Array.isArray(node[k]));
    const kids = kidsKey ? (node[kidsKey] as unknown[]) : [];
    return {
      id,
      value,
      state: focusAt(node) ?? stateAt(String(value)) ?? stateAt(counter - 1),
      children: kids.map((c) => walk(c, depth + 1)).filter((c): c is TreeNode => c !== null),
    };
  };

  return { kind: 'tree', root: walk(rootRaw, 0), binary: false };
}

function trieChildEntries(node: Record<string, unknown>): [string, unknown][] {
  const raw = node.children ?? node.child ?? node.next ?? node.map;
  if (raw instanceof Map) return [...raw.entries()].map(([k, v]) => [String(k), v]);
  if (Array.isArray(raw)) {
    // Dense 26-slot array keyed by letter offset.
    return raw
      .map((v, i) => [String.fromCharCode(97 + i), v] as [string, unknown])
      .filter(([, v]) => v != null);
  }
  if (isPlainRecord(raw)) return Object.entries(raw);
  return [];
}

function isTerminal(node: Record<string, unknown>): boolean {
  return Boolean(node.isEnd ?? node.isWord ?? node.terminal ?? node.end ?? node.isTerminal ?? node.word);
}

function buildTrie(rootRaw: unknown, opts: ShowOptions): TrieView {
  const stateAt = buildStateLookup(opts.highlight);
  const focusAt = buildFocusLookup(opts);
  let counter = 0;
  const seen = new Set<unknown>();

  const walk = (node: unknown, char: string, depth: number, path: string): TrieNode => {
    const id = `r${counter++}`;
    const base: TrieNode = { id, char, children: [], state: focusAt(node) ?? stateAt(path) };
    if (!isPlainRecord(node) || depth > LIMITS.depth || counter >= LIMITS.nodes) return base;
    if (seen.has(node)) return base;
    seen.add(node);
    base.terminal = isTerminal(node);
    base.children = trieChildEntries(node)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ch, child]) => walk(child, ch, depth + 1, path + ch));
    return base;
  };

  return { kind: 'trie', root: walk(rootRaw, '', 0, '') };
}

function buildGraph(raw: unknown, opts: ShowOptions): GraphView {
  const stateAt = buildStateLookup(opts.highlight);
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seenIds = new Set<string>();

  const addNode = (id: unknown, label?: string) => {
    const key = String(id);
    if (seenIds.has(key) || nodes.length >= LIMITS.nodes) return;
    seenIds.add(key);
    nodes.push({ id: key, label: label ?? key, state: stateAt(key) });
  };

  if (isPlainRecord(raw) && (Array.isArray(raw.nodes) || Array.isArray(raw.vertices))) {
    const list = (raw.nodes ?? raw.vertices) as unknown[];
    for (const n of list) {
      if (isPlainRecord(n)) addNode(n.id ?? n.name ?? n.label, String(n.label ?? n.name ?? n.id));
      else addNode(n);
    }
    for (const e of (raw.edges as unknown[]) ?? []) {
      if (Array.isArray(e)) {
        addNode(e[0]);
        addNode(e[1]);
        edges.push({
          from: String(e[0]),
          to: String(e[1]),
          weight: typeof e[2] === 'number' ? e[2] : undefined,
          state: stateAt(`${e[0]}-${e[1]}`),
        });
      } else if (isPlainRecord(e)) {
        const from = e.from ?? e.source ?? e.u ?? e.a;
        const to = e.to ?? e.target ?? e.v ?? e.b;
        addNode(from);
        addNode(to);
        edges.push({
          from: String(from),
          to: String(to),
          weight: edgeWeight(e),
          state: stateAt(`${from}-${to}`),
        });
      }
    }
    return { kind: 'graph', nodes, edges, directed: opts.directed ?? Boolean(raw.directed) };
  }

  // Adjacency list/map.
  const entries = toEntries(raw) ?? [];
  for (const [k] of entries) addNode(k);
  for (const [k, neighbours] of entries) {
    for (const n of neighbours ? [...(neighbours as Iterable<unknown>)] : []) {
      const to = edgeTarget(n);
      addNode(to);
      edges.push({
        from: String(k),
        to: String(to),
        weight: edgeWeight(n),
        state: stateAt(`${k}-${to}`),
      });
    }
  }

  // Undirected graphs list each edge twice; collapse unless told otherwise.
  const directed = opts.directed ?? !isMutuallyLinked(edges);
  const deduped = directed ? edges : dedupeUndirected(edges);
  return { kind: 'graph', nodes, edges: deduped, directed };
}

function isMutuallyLinked(edges: GraphEdge[]): boolean {
  if (edges.length === 0) return false;
  const set = new Set(edges.map((e) => `${e.from} ${e.to}`));
  const reciprocal = edges.filter((e) => set.has(`${e.to} ${e.from}`)).length;
  return reciprocal / edges.length > 0.9;
}

function dedupeUndirected(edges: GraphEdge[]): GraphEdge[] {
  const seen = new Set<string>();
  const out: GraphEdge[] = [];
  for (const e of edges) {
    const key = [e.from, e.to].sort().join(' ');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

function buildHeap(input: unknown[], opts: ShowOptions): HeapView {
  const stateAt = buildStateLookup(opts.highlight);
  const items = input.slice(0, LIMITS.arrayItems).map((value, i) => ({
    value: isPrimitive(value) ? value : nodeValue(value),
    state: stateAt(i),
  }));
  return { kind: 'heap', items, heapType: opts.heapType ?? inferHeapType(items) };
}

function inferHeapType(items: Cell[]): 'min' | 'max' {
  const nums = items.map((c) => c.value).filter((v): v is number => typeof v === 'number');
  if (nums.length < 2) return 'min';
  let minViolations = 0;
  let maxViolations = 0;
  for (let i = 1; i < nums.length; i++) {
    const parent = nums[(i - 1) >> 1];
    if (parent > nums[i]) minViolations++;
    if (parent < nums[i]) maxViolations++;
  }
  return minViolations <= maxViolations ? 'min' : 'max';
}

/**
 * Call stacks are force-only (`{as: 'callstack'}`): an array of `{label, depth}`
 * is too generic to auto-detect without stealing values that should render as
 * an ordinary array.
 */
function buildCallStack(input: unknown[], opts: ShowOptions): CallStackView {
  const stateAt = buildStateLookup(opts.highlight);
  const entries: CallStackEntry[] = input.slice(0, LIMITS.nodes).map((item, i) => {
    if (isPlainRecord(item)) {
      return {
        label: String(item.label ?? item.name ?? item.fn ?? nodeValue(item)),
        depth: typeof item.depth === 'number' ? item.depth : i,
        state: (item.state as CellState) ?? stateAt(i),
        returnValue: item.returnValue ?? item.result,
      };
    }
    return { label: String(item), depth: i, state: stateAt(i) };
  });
  return { kind: 'callstack', entries };
}

function buildHashMap(raw: unknown, opts: ShowOptions): HashMapView {
  const stateAt = buildStateLookup(opts.highlight);
  const entries = toEntries(raw) ?? [];
  const bucketCount = Math.max(4, Math.min(16, 1 << Math.ceil(Math.log2(entries.length || 1))));
  const buckets: HashMapView['buckets'] = Array.from({ length: bucketCount }, (_, index) => ({
    index,
    entries: [],
  }));
  for (const [key, value] of entries.slice(0, LIMITS.nodes)) {
    buckets[stringHash(String(key)) % bucketCount].entries.push({
      key,
      value,
      state: stateAt(String(key)),
    });
  }
  return { kind: 'hashmap', buckets, synthetic: true };
}

const BUCKET_KEYS = ['buckets', 'table', 'slots', 'bins'] as const;

/**
 * A hand-written hash map exposes its real bucket array. Drawing *that* — with
 * its actual collisions — beats re-hashing the entries into invented buckets,
 * so a student can see their own hash function spreading keys well or badly.
 */
export function looksLikeBucketTable(v: unknown): boolean {
  if (!isPlainRecord(v)) return false;
  const key = BUCKET_KEYS.find((k) => Array.isArray(v[k]));
  if (!key) return false;
  const rows = v[key] as unknown[];
  if (rows.length < 2) return false;
  // Every slot is a chain (array), an entry object, or empty.
  return rows.every((row) => row === null || row === undefined || Array.isArray(row) || isPlainRecord(row));
}

function buildBucketTable(raw: Record<string, unknown>, opts: ShowOptions): HashMapView {
  const stateAt = buildStateLookup(opts.highlight);
  const key = BUCKET_KEYS.find((k) => Array.isArray(raw[k]))!;
  const rows = raw[key] as unknown[];

  const buckets = rows.slice(0, 64).map((row, index) => {
    const chain: unknown[] = Array.isArray(row) ? row : row == null ? [] : [row];
    return {
      index,
      entries: chain.slice(0, 16).map((item) => {
        // `[key, value]` tuples, `{key, value}` objects, or a linked chain node.
        const [k, value] = Array.isArray(item)
          ? [item[0], item[1]]
          : isPlainRecord(item)
            ? [item.key ?? item.k, item.value ?? item.v]
            : [item, undefined];
        return { key: k, value, state: stateAt(String(k)) };
      }),
    };
  });

  return { kind: 'hashmap', buckets, synthetic: false };
}

/** Deterministic djb2 — stable across runs so buckets don't jump between frames. */
export function stringHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/** Convert any user value into a renderable view, honouring an explicit `as`. */
export function normalize(value: unknown, opts: ShowOptions = {}): VizView {
  const forced = opts.as;

  if (forced) {
    const view = forceKind(value, forced, opts);
    if (view) return view;
  }

  // A class instance can say how it wants to be drawn before its shape is read.
  const hint = classHint(value);
  if (hint?.heapType && !opts.as) {
    const inner = unwrapContainer(value);
    if (Array.isArray(inner)) return buildHeap(inner, { ...opts, heapType: hint.heapType });
  }

  const target = unwrapContainer(value);

  if (isPlainRecord(value) && looksLikeBucketTable(value)) return buildBucketTable(value, opts);

  if (target instanceof Set) return buildArray([...target], opts, 'array');
  if (target instanceof Map) {
    return looksLikeAdjacency(target) ? buildGraph(target, opts) : buildHashMap(target, opts);
  }

  if (Array.isArray(target)) {
    const rows = target.filter(Array.isArray);
    if (target.length > 0 && rows.length === target.length && !hint?.variant) {
      return buildMatrix(target as unknown[][], opts);
    }
    return buildArray(target, opts, hint?.variant ?? 'array');
  }

  if (target === null || target === undefined) {
    // An explicitly-null head/root is a legitimately empty structure.
    if (isPlainRecord(value) && (has(value, 'head') || has(value, 'root'))) {
      return has(value, 'head')
        ? { kind: 'linkedList', nodes: [] }
        : { kind: 'tree', root: null, binary: true };
    }
    return { kind: 'raw', value };
  }

  if (isPrimitive(target)) return { kind: 'raw', value: target };

  if (looksLikeTrieNode(target)) return buildTrie(target, opts);
  if (looksLikeLinkedListNode(target)) return buildLinkedList(target, opts);
  if (looksLikeBinaryTreeNode(target)) return buildBinaryTree(target, opts);
  if (looksLikeGraph(target)) return buildGraph(target, opts);
  if (looksLikeAdjacency(target)) return buildGraph(target, opts);
  if (looksLikeNaryTreeNode(target)) return buildNaryTree(target, opts);

  if (isPlainRecord(target)) return buildHashMap(target, opts);

  return { kind: 'raw', value: target };
}

function forceKind(value: unknown, as: NonNullable<ShowOptions['as']>, opts: ShowOptions): VizView | null {
  const target = unwrapContainer(value);
  const asArray = Array.isArray(target) ? target : target instanceof Set ? [...target] : null;

  switch (as) {
    case 'array':
    case 'stack':
    case 'queue':
    case 'deque':
      return buildArray(asArray ?? [target], opts, as === 'array' ? 'array' : as);
    case 'heap':
      return buildHeap(asArray ?? [], opts);
    case 'matrix':
      return Array.isArray(target) ? buildMatrix(target as unknown[][], opts) : null;
    case 'linkedList':
      return buildLinkedList(target, opts);
    case 'tree':
      return looksLikeNaryTreeNode(target)
        ? buildNaryTree(target, opts)
        : buildBinaryTree(target, opts);
    case 'trie':
      return buildTrie(target, opts);
    case 'graph':
      return buildGraph(target, opts);
    case 'hashmap':
      return buildHashMap(target, opts);
    case 'callstack':
      return buildCallStack(asArray ?? [], opts);
    case 'raw':
      return { kind: 'raw', value };
    default:
      return null;
  }
}
