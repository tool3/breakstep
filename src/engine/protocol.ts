/** Message contract shared by the main thread and both execution workers. */
import type { BenchmarkSample, LogEntry, ParamValues, RunError } from '@/types';
import type { Frame } from '@/types/viz';
import type { DebugStep } from '@/types/debug';

export interface RunRequest {
  type: 'run';
  id: number;
  /** Already type-stripped for TS; raw source for Python. */
  code: string;
  params: ParamValues;
  opLimit: number;
  /** Cap on captured frames so a loop that shows every step can't OOM the tab. */
  frameLimit: number;
  /**
   * Let plain code visualize itself by rewriting it to report its own state.
   * Ignored when the source already calls `breakstep.show`.
   */
  autoTrace: boolean;
  /** Record a step per statement so the run can be debugged afterwards. */
  debug?: boolean;
}

export interface BenchRequest {
  type: 'bench';
  id: number;
  code: string;
  params: ParamValues;
  sizes: number[];
  opLimit: number;
}

export type WorkerRequest = RunRequest | BenchRequest;

export interface LogMessage {
  type: 'log';
  id: number;
  entries: LogEntry[];
}

export interface FrameMessage {
  type: 'frame';
  id: number;
  frames: Frame[];
}

export interface DoneMessage {
  type: 'done';
  id: number;
  durationMs: number;
  operations?: number;
  returnValue?: unknown;
  /** True when the code registered a `breakstep.bench(...)` harness. */
  hasBenchmark: boolean;
  /** The recorded execution, when the run was a debug run. */
  steps?: DebugStep[];
}

export interface ErrorMessage {
  type: 'error';
  id: number;
  error: RunError;
  durationMs: number;
}

export interface BenchDoneMessage {
  type: 'benchDone';
  id: number;
  samples: BenchmarkSample[];
  error?: string;
}

export interface ReadyMessage {
  type: 'ready';
  /** Python only — reports Pyodide boot progress. */
  detail?: string;
}

export interface ProgressMessage {
  type: 'progress';
  id: number;
  detail: string;
}

export type WorkerResponse =
  | LogMessage
  | FrameMessage
  | DoneMessage
  | ErrorMessage
  | BenchDoneMessage
  | ReadyMessage
  | ProgressMessage;

/** Default sweep. Small enough that O(2^n) code still finishes. */
export const DEFAULT_BENCH_SIZES = [8, 16, 32, 64, 128, 256, 512, 1024];

export const DEFAULT_OP_LIMIT = 20_000_000;
export const DEFAULT_FRAME_LIMIT = 2000;
export const DEFAULT_TIMEOUT_MS = 10_000;
export const BENCH_TIMEOUT_MS = 25_000;
