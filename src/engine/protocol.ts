import type { BenchmarkSample, LogEntry, ParamValues, RunError } from '@/types';
import type { Frame } from '@/types/viz';
import type { DebugStep } from '@/types/debug';

export interface RunRequest {
  type: 'run';
  id: number;
  code: string;
  params: ParamValues;
  opLimit: number;
  frameLimit: number;
  autoTrace: boolean;
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
  hasBenchmark: boolean;
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

export const DEFAULT_BENCH_SIZES = [8, 16, 32, 64, 128, 256, 512, 1024];

export const DEFAULT_OP_LIMIT = 20_000_000;
export const DEFAULT_FRAME_LIMIT = 2000;
export const DEFAULT_TIMEOUT_MS = 10_000;
export const BENCH_TIMEOUT_MS = 25_000;
