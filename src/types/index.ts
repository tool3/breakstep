import type { Frame } from './viz';

export * from './viz';

export type Language = 'typescript' | 'javascript' | 'python';

export const LANGUAGES: { value: Language; label: string; monaco: string }[] = [
  { value: 'typescript', label: 'TypeScript', monaco: 'typescript' },
  { value: 'javascript', label: 'JavaScript', monaco: 'javascript' },
  { value: 'python', label: 'Python', monaco: 'python' },
];

export type LogLevel = 'log' | 'warn' | 'error' | 'info';

export interface LogEntry {
  level: LogLevel;
  /** Already-stringified arguments, joined by a space, as console would. */
  text: string;
  /** Milliseconds since run start. */
  at: number;
}

export interface RunError {
  message: string;
  stack?: string;
  /** 1-based line in the user's source, when recoverable. */
  line?: number;
  column?: number;
}

export type RunStatus = 'idle' | 'preparing' | 'running' | 'done' | 'error' | 'cancelled';

export interface RunResult {
  status: Extract<RunStatus, 'done' | 'error' | 'cancelled'>;
  logs: LogEntry[];
  frames: Frame[];
  error?: RunError;
  /** Wall-clock duration of the user's code, excluding runtime boot. */
  durationMs: number;
  /** Instrumented basic-operation count for the whole run (JS/TS only). */
  operations?: number;
  /** The value returned by the entry function, if any. */
  returnValue?: unknown;
}

/** A knob rendered in the Parameters panel and injected into user code. */
export interface ParamSpec {
  name: string;
  /**
   * Top-level constant this parameter edits in the clean source, when it differs
   * from `name`. In instrumented mode the value arrives via `breakstep.param(name)`.
   */
  binds?: string;
  label: string;
  type: 'number' | 'string' | 'boolean' | 'select' | 'numberArray' | 'stringArray';
  default: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: string | number }[];
  help?: string;
}

export type ParamValues = Record<string, unknown>;

/** Growth classes the empirical fitter and static analyzer can report. */
export type ComplexityClass =
  | 'O(1)'
  | 'O(log n)'
  | 'O(sqrt n)'
  | 'O(n)'
  | 'O(n log n)'
  | 'O(n^2)'
  | 'O(n^2 log n)'
  | 'O(n^3)'
  | 'O(2^n)'
  | 'O(n!)'
  | 'unknown';

export interface StaticComplexity {
  time: ComplexityClass;
  space: ComplexityClass;
  /** 0..1 — how much the heuristics agree on this answer. */
  confidence: number;
  /** Human-readable evidence, e.g. "2 nested loops over `n`". */
  notes: string[];
  maxLoopDepth: number;
  recursion: {
    detected: boolean;
    functions: string[];
    /** Recursive calls per invocation, when statically countable. */
    branching?: number;
    /** True when the recursive call shrinks the input by a constant factor. */
    halving?: boolean;
  };
}

export interface BenchmarkSample {
  n: number;
  /** Instrumented operation count (preferred signal — machine independent). */
  operations: number;
  /** Wall-clock milliseconds, median of repeats. */
  ms: number;
}

export interface FitScore {
  cls: ComplexityClass;
  /** Coefficient of determination against the samples, 0..1. */
  r2: number;
  /** Fitted leading constant. */
  coefficient: number;
}

export interface EmpiricalComplexity {
  samples: BenchmarkSample[];
  /** Best fit against operation counts, ranked. */
  ranking: FitScore[];
  best: ComplexityClass;
  confidence: number;
  /** Set when the benchmark could not run (no entry function, timeout, ...). */
  error?: string;
}

export interface ComplexityReport {
  static: StaticComplexity;
  empirical?: EmpiricalComplexity;
}

/** How the editor presents a template's source. */
export type EditorMode = 'clean' | 'instrumented';

export interface SourceSet {
  typescript: string;
  python: string;
  /** Derived from the TypeScript variant when absent, so the two never drift. */
  javascript?: string;
}

export interface Template {
  id: string;
  title: string;
  /** Grouping in the template picker sidebar. */
  category: string;
  /** One-line pitch shown under the title. */
  blurb: string;
  tags: string[];
  /** Expected answer, shown once analysis completes so users can compare. */
  expected?: { time: ComplexityClass; space: ComplexityClass };
  params: ParamSpec[];

  /**
   * Plain code, as it would appear in a computer-science class: no BCS API
   * anywhere. This is what the editor shows by default; the run is auto-traced
   * so it visualizes itself.
   */
  code: SourceSet;

  /**
   * The same lesson with explicit `breakstep.*` calls, revealed by the Instrumented
   * toggle. Manual instrumentation switches auto-tracing off, so this is also
   * the escape hatch for controlling exactly what gets drawn.
   */
  instrumented: SourceSet;

  /**
   * Benchmark harness appended when running the clean variant, which has no
   * `breakstep.bench` of its own. Visible in the instrumented source.
   */
  bench: { typescript: string; python: string };
}
