import type { Frame } from './viz';
import type { DebugStep } from './debug';

export * from './viz';
export * from './debug';

export type Language = 'typescript' | 'javascript' | 'python';

export const LANGUAGES: { value: Language; label: string; monaco: string }[] = [
  { value: 'typescript', label: 'TypeScript', monaco: 'typescript' },
  { value: 'javascript', label: 'JavaScript', monaco: 'javascript' },
  { value: 'python', label: 'Python', monaco: 'python' },
];

export type LogLevel = 'log' | 'warn' | 'error' | 'info';

export interface LogEntry {
  level: LogLevel;
  text: string;
  at: number;
}

export interface RunError {
  message: string;
  stack?: string;
  line?: number;
  column?: number;
}

export type RunStatus = 'idle' | 'preparing' | 'running' | 'done' | 'error' | 'cancelled';

export interface RunResult {
  status: Extract<RunStatus, 'done' | 'error' | 'cancelled'>;
  logs: LogEntry[];
  frames: Frame[];
  error?: RunError;
  durationMs: number;
  operations?: number;
  returnValue?: unknown;
  steps?: DebugStep[];
}

export interface ParamSpec {
  name: string;
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
  confidence: number;
  notes: string[];
  maxLoopDepth: number;
  recursion: {
    detected: boolean;
    functions: string[];
    branching?: number;
    halving?: boolean;
  };
}

export interface BenchmarkSample {
  n: number;
  operations: number;
  ms: number;
}

export interface FitScore {
  cls: ComplexityClass;
  r2: number;
  coefficient: number;
}

export interface EmpiricalComplexity {
  samples: BenchmarkSample[];
  ranking: FitScore[];
  best: ComplexityClass;
  confidence: number;
  error?: string;
}

export interface ComplexityReport {
  static: StaticComplexity;
  empirical?: EmpiricalComplexity;
}

export type EditorMode = 'clean' | 'instrumented';

export interface SourceSet {
  typescript: string;
  python: string;
  javascript?: string;
}

export interface Template {
  id: string;
  title: string;
  category: string;
  blurb: string;
  tags: string[];
  expected?: { time: ComplexityClass; space: ComplexityClass };
  params: ParamSpec[];

  code: SourceSet;

  instrumented: SourceSet;

  bench: { typescript: string; python: string };

  entry?: {
    typescript: { name: string; expression: string } | null;
    python: { name: string; expression: string } | null;
  };
}
