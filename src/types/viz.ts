/**
 * Normalized visualization models.
 *
 * User code never builds these directly. It calls `breakstep.show(anything)` and the
 * normalizer (`src/engine/normalize.ts`) converts plain JS/Python values into
 * one of these views. Every visualizer component renders exactly one view kind,
 * so adding a data structure means adding a view + a component and nothing else.
 */

/** Highlight state for a single element, driving its color in every visualizer. */
export type CellState =
  | 'default'
  | 'active'
  | 'compare'
  | 'visited'
  | 'match'
  | 'sorted'
  | 'muted'
  | 'error';

export const CELL_STATES: CellState[] = [
  'default',
  'active',
  'compare',
  'visited',
  'match',
  'sorted',
  'muted',
  'error',
];

/** A single value in a linear structure. */
export interface Cell {
  value: unknown;
  state?: CellState;
  /** Small caption under the cell (e.g. an index alias or running sum). */
  note?: string;
}

/** A named index marker floating above an array/heap (`i`, `j`, `left`, `right`). */
export interface Pointer {
  name: string;
  index: number;
}

export interface ArrayView {
  kind: 'array';
  items: Cell[];
  pointers?: Pointer[];
  /** `stack` and `queue` change the axis and the entry/exit affordances. */
  variant?: 'array' | 'stack' | 'queue' | 'deque';
  /** Show 0..n-1 index labels. */
  showIndices?: boolean;
}

export interface MatrixView {
  kind: 'matrix';
  rows: Cell[][];
  /** Optional row/column header labels. */
  rowLabels?: string[];
  colLabels?: string[];
}

export interface LinkedListNode {
  id: string;
  value: unknown;
  state?: CellState;
  /** Index into `nodes` this node points to, or null for the tail. */
  next: number | null;
  prev?: number | null;
}

export interface LinkedListView {
  kind: 'linkedList';
  nodes: LinkedListNode[];
  doubly?: boolean;
  /** True when traversal detected a cycle; the last edge loops back. */
  cyclic?: boolean;
  /** Named references such as `head`, `slow`, `fast`. */
  pointers?: Pointer[];
}

export interface TreeNode {
  id: string;
  value: unknown;
  state?: CellState;
  children: (TreeNode | null)[];
  /** Preserve null slots so a binary tree keeps left/right alignment. */
  note?: string;
}

export interface TreeView {
  kind: 'tree';
  root: TreeNode | null;
  /** Binary trees draw null slots; n-ary trees skip them. */
  binary?: boolean;
}

export interface GraphNode {
  id: string;
  label: string;
  state?: CellState;
  /** Optional fixed position (0..1 normalized). Omitted nodes are auto-laid-out. */
  x?: number;
  y?: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  weight?: number;
  state?: CellState;
}

export interface GraphView {
  kind: 'graph';
  nodes: GraphNode[];
  edges: GraphEdge[];
  directed?: boolean;
}

export interface TrieNode {
  id: string;
  /** The character on the edge leading into this node; empty for the root. */
  char: string;
  terminal?: boolean;
  state?: CellState;
  children: TrieNode[];
}

export interface TrieView {
  kind: 'trie';
  root: TrieNode;
}

export interface HeapView {
  kind: 'heap';
  /** Level-order array backing the heap. */
  items: Cell[];
  heapType: 'min' | 'max';
}

export interface HashBucketEntry {
  key: unknown;
  value: unknown;
  state?: CellState;
}

export interface HashMapView {
  kind: 'hashmap';
  buckets: { index: number; entries: HashBucketEntry[] }[];
  /** When true the view was built from a plain object/Map with no bucket info. */
  synthetic?: boolean;
}

export interface CallStackEntry {
  label: string;
  depth: number;
  state?: CellState;
  returnValue?: unknown;
}

export interface CallStackView {
  kind: 'callstack';
  entries: CallStackEntry[];
}

/** Fallback for values with no structural match — pretty-printed JSON. */
export interface RawView {
  kind: 'raw';
  value: unknown;
}

export type VizView =
  | ArrayView
  | MatrixView
  | LinkedListView
  | TreeView
  | GraphView
  | TrieView
  | HeapView
  | HashMapView
  | CallStackView
  | RawView;

export type VizKind = VizView['kind'];

/** One captured moment in the run — the unit the timeline scrubs through. */
export interface Frame {
  id: number;
  /** Short caption shown on the timeline and above the canvas. */
  label: string;
  view: VizView;
  /** Source line that produced the frame, when the runner could determine it. */
  line?: number;
  /** Arbitrary key/value badges (counters, current sum, etc.). */
  meta?: Record<string, unknown>;
}

/** Options accepted by `breakstep.show(value, options)` inside user code. */
export interface ShowOptions {
  label?: string;
  /** Force a specific view instead of relying on shape detection. */
  as?: VizKind | 'stack' | 'queue' | 'deque';
  /** Indices/ids to mark, by state. */
  highlight?: Record<string, CellState> | (number | string)[];
  /**
   * Raw values to mark by object *identity* rather than by index.
   *
   * Auto-tracing uses this: it knows `curr` holds some node, but not where that
   * node sits in the structure. Identity matching finds it wherever it is.
   */
  focus?: unknown[];
  /** State applied to focused values. Defaults to `active`. */
  focusState?: CellState;
  pointers?: Record<string, number>;
  meta?: Record<string, unknown>;
  heapType?: 'min' | 'max';
  directed?: boolean;
}
