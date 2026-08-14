/**
 * Main-thread client for the execution workers.
 *
 * Owns worker lifecycle, request correlation and the hard timeout. The timeout
 * matters: the in-code operation guard stops runaway loops, but it cannot stop
 * a `while (true) await sleep(1)`. Terminating the worker always can.
 */
import {
  BENCH_TIMEOUT_MS,
  DEFAULT_BENCH_SIZES,
  DEFAULT_FRAME_LIMIT,
  DEFAULT_OP_LIMIT,
  DEFAULT_TIMEOUT_MS,
  type WorkerRequest,
  type WorkerResponse,
} from './protocol';
import { toRunnableJs } from './transpile';
import { buildEmpiricalReport } from '@/analysis/fit';
import type {
  BenchmarkSample,
  EmpiricalComplexity,
  Language,
  LogEntry,
  ParamValues,
  RunResult,
} from '@/types';
import type { Frame } from '@/types/viz';

/** Python is 10–50× slower under Pyodide, so it sweeps a smaller range. */
export const PYTHON_BENCH_SIZES = [8, 16, 32, 64, 128, 256, 512];

export interface RunOptions {
  code: string;
  language: Language;
  params: ParamValues;
  timeoutMs?: number;
  opLimit?: number;
  frameLimit?: number;
  /** Let plain textbook code visualize itself. Defaults to on. */
  autoTrace?: boolean;
  onProgress?: (update: { frames?: Frame[]; logs?: LogEntry[]; detail?: string }) => void;
}

export interface EngineHandle {
  run(options: RunOptions): Promise<RunResult>;
  bench(options: RunOptions & { sizes?: number[] }): Promise<EmpiricalComplexity>;
  cancel(): void;
  dispose(): void;
}

type WorkerKind = 'js' | 'python';

function createWorker(kind: WorkerKind): Worker {
  return kind === 'js'
    ? new Worker(new URL('./jsWorker.ts', import.meta.url), { type: 'module', name: 'breakstep-js' })
    : new Worker(new URL('./pythonWorker.ts', import.meta.url), { type: 'module', name: 'breakstep-python' });
}

export function createEngine(): EngineHandle {
  const workers: Partial<Record<WorkerKind, Worker>> = {};
  let requestId = 0;
  let activeAbort: (() => void) | null = null;

  const workerFor = (kind: WorkerKind): Worker => {
    if (!workers[kind]) workers[kind] = createWorker(kind);
    return workers[kind]!;
  };

  const killWorker = (kind: WorkerKind) => {
    workers[kind]?.terminate();
    delete workers[kind];
  };

  /** Send one request and resolve when the worker reports a terminal message. */
  function dispatch<T>(
    kind: WorkerKind,
    request: WorkerRequest,
    timeoutMs: number,
    handlers: {
      onMessage: (msg: WorkerResponse) => void;
      settle: (msg: WorkerResponse) => T | undefined;
      onTimeout: () => T;
    },
  ): Promise<T> {
    const worker = workerFor(kind);

    return new Promise<T>((resolve) => {
      let finished = false;

      const cleanup = () => {
        finished = true;
        clearTimeout(timer);
        worker.removeEventListener('message', listener);
        worker.removeEventListener('error', onError);
        if (activeAbort === abort) activeAbort = null;
      };

      const finish = (value: T) => {
        if (finished) return;
        cleanup();
        resolve(value);
      };

      const listener = (event: MessageEvent<WorkerResponse>) => {
        const msg = event.data;
        if (msg.type === 'ready') return;
        if ('id' in msg && msg.id !== request.id) return;
        handlers.onMessage(msg);
        const settled = handlers.settle(msg);
        if (settled !== undefined) finish(settled);
      };

      const onError = (event: ErrorEvent) => {
        killWorker(kind);
        finish(
          handlers.settle({
            type: 'error',
            id: request.id,
            error: { message: event.message || 'The execution worker crashed.' },
            durationMs: 0,
          }) as T,
        );
      };

      const abort = () => {
        killWorker(kind);
        finish(handlers.onTimeout());
      };

      const timer = setTimeout(abort, timeoutMs);
      activeAbort = abort;

      worker.addEventListener('message', listener);
      worker.addEventListener('error', onError);
      worker.postMessage(request);
    });
  }

  return {
    async run(options: RunOptions): Promise<RunResult> {
      const id = ++requestId;
      const kind: WorkerKind = options.language === 'python' ? 'python' : 'js';

      let code = options.code;
      if (kind === 'js') {
        const compiled = toRunnableJs(options.code, options.language as 'typescript' | 'javascript');
        if (!compiled.ok) {
          return {
            status: 'error',
            logs: [],
            frames: [],
            error: { message: compiled.error ?? 'Compilation failed.', line: compiled.line },
            durationMs: 0,
          };
        }
        code = compiled.code;
      }

      const frames = new Map<number, Frame>();
      const logs: LogEntry[] = [];
      const seenLogs = new Set<string>();

      const request: WorkerRequest = {
        type: 'run',
        id,
        code,
        params: options.params,
        opLimit: options.opLimit ?? DEFAULT_OP_LIMIT,
        frameLimit: options.frameLimit ?? DEFAULT_FRAME_LIMIT,
        autoTrace: options.autoTrace ?? true,
      };

      return dispatch<RunResult>(kind, request, options.timeoutMs ?? DEFAULT_TIMEOUT_MS, {
        onMessage: (msg) => {
          if (msg.type === 'frame') {
            for (const f of msg.frames) frames.set(f.id, f);
            options.onProgress?.({ frames: [...frames.values()] });
          } else if (msg.type === 'log') {
            for (const entry of msg.entries) {
              // The worker replays its buffer at the end; keep each line once.
              const key = `${entry.at}|${entry.level}|${entry.text}`;
              if (seenLogs.has(key)) continue;
              seenLogs.add(key);
              logs.push(entry);
            }
            options.onProgress?.({ logs: [...logs] });
          } else if (msg.type === 'progress') {
            options.onProgress?.({ detail: msg.detail });
          }
        },
        settle: (msg) => {
          if (msg.type === 'done') {
            return {
              status: 'done' as const,
              logs,
              frames: [...frames.values()].sort((a, b) => a.id - b.id),
              durationMs: msg.durationMs,
              operations: msg.operations,
              returnValue: msg.returnValue,
            };
          }
          if (msg.type === 'error') {
            return {
              status: 'error' as const,
              logs,
              frames: [...frames.values()].sort((a, b) => a.id - b.id),
              error: msg.error,
              durationMs: msg.durationMs,
            };
          }
          return undefined;
        },
        onTimeout: () => ({
          status: 'error' as const,
          logs,
          frames: [...frames.values()].sort((a, b) => a.id - b.id),
          error: {
            message: `Execution timed out after ${(options.timeoutMs ?? DEFAULT_TIMEOUT_MS) / 1000}s and was stopped.`,
          },
          durationMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        }),
      });
    },

    async bench(options: RunOptions & { sizes?: number[] }): Promise<EmpiricalComplexity> {
      const id = ++requestId;
      const kind: WorkerKind = options.language === 'python' ? 'python' : 'js';

      let code = options.code;
      if (kind === 'js') {
        const compiled = toRunnableJs(options.code, options.language as 'typescript' | 'javascript');
        if (!compiled.ok) return buildEmpiricalReport([], compiled.error ?? 'Compilation failed.');
        code = compiled.code;
      }

      const sizes =
        options.sizes ?? (kind === 'python' ? PYTHON_BENCH_SIZES : DEFAULT_BENCH_SIZES);

      const request: WorkerRequest = {
        type: 'bench',
        id,
        code,
        params: options.params,
        sizes,
        opLimit: options.opLimit ?? DEFAULT_OP_LIMIT,
      };

      let samples: BenchmarkSample[] = [];

      return dispatch<EmpiricalComplexity>(kind, request, BENCH_TIMEOUT_MS, {
        onMessage: (msg) => {
          if (msg.type === 'progress') options.onProgress?.({ detail: msg.detail });
          if (msg.type === 'benchDone') samples = msg.samples;
        },
        settle: (msg) => {
          if (msg.type === 'benchDone') return buildEmpiricalReport(msg.samples, msg.error);
          if (msg.type === 'error') return buildEmpiricalReport([], msg.error.message);
          return undefined;
        },
        onTimeout: () =>
          buildEmpiricalReport(samples, 'The benchmark timed out and was stopped.'),
      });
    },

    cancel() {
      activeAbort?.();
    },

    dispose() {
      for (const kind of Object.keys(workers) as WorkerKind[]) killWorker(kind);
    },
  };
}
