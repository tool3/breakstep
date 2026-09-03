export const BREAKSTEP_API_DTS = `
/** Highlight states available to \`show\`. */
type BreakstepState =
  | 'default' | 'active' | 'compare' | 'visited'
  | 'match' | 'sorted' | 'muted' | 'error';

/** Force a specific visualizer instead of relying on shape detection. */
type BreakstepKind =
  | 'array' | 'stack' | 'queue' | 'deque' | 'matrix' | 'linkedList'
  | 'tree' | 'trie' | 'graph' | 'heap' | 'hashmap' | 'callstack' | 'raw';

interface BreakstepShowOptions {
  /** Caption shown on the timeline and above the canvas. */
  label?: string;
  /** Override shape detection. */
  as?: BreakstepKind;
  /**
   * Elements to colour. Pass indices for \`active\`, or a map for finer control.
   * Matrices accept \`"row,col"\` keys; graphs and tries accept node ids/prefixes.
   */
  highlight?: (number | string)[] | Record<string | number, BreakstepState>;
  /** Named index markers drawn above the structure, e.g. \`{ lo: 0, hi: 9 }\`. */
  pointers?: Record<string, number>;
  /** Key/value badges shown beside the frame. */
  meta?: Record<string, unknown>;
  /** Ordering for the heap view. Inferred from the data when omitted. */
  heapType?: 'min' | 'max';
  /** Force edge direction instead of inferring it from reciprocal links. */
  directed?: boolean;
}

interface BreakstepBenchSpec<T = unknown> {
  /** Build an input of size \`n\`. Its cost is excluded from the measurement. */
  input: (n: number) => T;
  /** The code under measurement. */
  run: (input: T) => unknown;
  /** Override the size sweep. Use small sizes for exponential algorithms. */
  sizes?: number[];
}

interface Breakstep {
  /**
   * Capture a frame. The shape of \`value\` decides the visualizer.
   *
   * \`options\` may be a factory — \`breakstep.show(arr, () => ({ … }))\` — which is
   * only invoked while frames are being captured. Use it whenever building the
   * options costs more than O(1), so the Analyze tab measures your algorithm
   * rather than your instrumentation.
   */
  show(value: unknown, options?: BreakstepShowOptions | (() => BreakstepShowOptions)): void;
  /** Alias for \`show\`. */
  viz(value: unknown, options?: BreakstepShowOptions | (() => BreakstepShowOptions)): void;

  /** Write a line to the Output panel. \`console.log\` works identically. */
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;

  /** Name the next captured frame. */
  label(text: string): void;

  /** Read a value from the Parameters panel. */
  param<T = unknown>(name: string, fallback?: T): T;
  /** Every parameter at once. */
  readonly params: Record<string, unknown>;

  /** Register the harness the Analyze tab sweeps across input sizes. */
  bench<T>(spec: BreakstepBenchSpec<T>): void;

  /** Deterministic pseudo-random integers — same seed, same array, every run. */
  randomInts(count: number, max?: number, seed?: number): number[];
}

declare const breakstep: Breakstep;
declare const params: Record<string, unknown>;
`;
