
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

export interface Cell {
  value: unknown;
  state?: CellState;
  note?: string;
}

export interface Pointer {
  name: string;
  index: number;
}

export interface ArrayView {
  kind: 'array';
  items: Cell[];
  pointers?: Pointer[];
  variant?: 'array' | 'stack' | 'queue' | 'deque';
  showIndices?: boolean;
}

export interface MatrixView {
  kind: 'matrix';
  rows: Cell[][];
  rowLabels?: string[];
  colLabels?: string[];
}

export interface LinkedListNode {
  id: string;
  value: unknown;
  state?: CellState;
  next: number | null;
  prev?: number | null;
}

export interface LinkedListView {
  kind: 'linkedList';
  nodes: LinkedListNode[];
  doubly?: boolean;
  cyclic?: boolean;
  pointers?: Pointer[];
}

export interface TreeNode {
  id: string;
  value: unknown;
  state?: CellState;
  children: (TreeNode | null)[];
  note?: string;
}

export interface TreeView {
  kind: 'tree';
  root: TreeNode | null;
  binary?: boolean;
}

export interface GraphNode {
  id: string;
  label: string;
  state?: CellState;
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

export interface Frame {
  id: number;
  label: string;
  view: VizView;
  line?: number;
  meta?: Record<string, unknown>;
}

export interface ShowOptions {
  label?: string;
  as?: VizKind | 'stack' | 'queue' | 'deque';
  highlight?: Record<string, CellState> | (number | string)[];
  focus?: unknown[];
  focusState?: CellState;
  pointers?: Record<string, number>;
  meta?: Record<string, unknown>;
  heapType?: 'min' | 'max';
  directed?: boolean;
}
