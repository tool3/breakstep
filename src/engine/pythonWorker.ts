/// <reference lib="webworker" />
import { PYTHON_BOOTSTRAP, revivePython } from './pythonRuntime';
import { normalize } from './normalize';
import { createAutoTracer } from './autoTrace';
import { toTransferable } from './sandbox';
import { hasManualInstrumentation } from '@/analysis/autoInstrument';
import type { WorkerRequest } from './protocol';
import type { BenchmarkSample, LogEntry, RunError } from '@/types';
import type { Frame, ShowOptions } from '@/types/viz';
import type { DebugStep } from '@/types/debug';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

const PYODIDE_VERSION = '0.27.2';
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

interface PyodideApi {
  runPython: (code: string) => unknown;
  globals: { get: (name: string) => unknown };
}

let pyodide: PyodideApi | null = null;
let booting: Promise<PyodideApi> | null = null;

async function boot(id: number): Promise<PyodideApi> {
  if (pyodide) return pyodide;
  if (booting) return booting;

  booting = (async () => {
    ctx.postMessage({ type: 'progress', id, detail: 'Downloading Python runtime (~10 MB, first run only)…' });
    const mod = (await import(/* @vite-ignore */ `${PYODIDE_URL}pyodide.mjs`)) as {
      loadPyodide: (opts: { indexURL: string }) => Promise<PyodideApi>;
    };
    ctx.postMessage({ type: 'progress', id, detail: 'Starting Python…' });
    const instance = await mod.loadPyodide({ indexURL: PYODIDE_URL });
    instance.runPython(PYTHON_BOOTSTRAP);
    pyodide = instance;
    ctx.postMessage({ type: 'progress', id, detail: 'Python ready.' });
    return instance;
  })();

  return booting;
}

function callPython(py: PyodideApi, fn: string, args: unknown[]): unknown {
  const payload = JSON.stringify(args).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const expr = `${fn}(*json.loads('${payload}'))`;
  const raw = py.runPython(expr);
  return JSON.parse(String(raw));
}

interface PyFrame {
  id: number;
  label: string;
  payload: unknown;
  options: unknown;
}

interface PyTrace {
  k: 'step' | 'enter' | 'exit';
  line?: number;
  tag?: string | null;
  name?: string;
  scope?: unknown;
}

interface PyRunResult {
  error: (RunError & { line?: number }) | null;
  logs: LogEntry[];
  frames: PyFrame[];
  traces: PyTrace[];
  durationMs: number;
  operations: number;
  hasBenchmark: boolean;
}

function toFrames(pyFrames: PyFrame[]): Frame[] {
  return pyFrames.map((f) => {
    const value = revivePython(f.payload);
    const options = (revivePython(f.options) ?? {}) as ShowOptions;
    return {
      id: f.id,
      label: f.label,
      view: normalize(value, options),
      meta: options.meta,
    };
  });
}

function replayTraces(
  traces: PyTrace[],
  frameLimit: number,
  debug: boolean,
): { frames: Frame[]; steps: DebugStep[] } {
  const frames: Frame[] = [];
  const steps: DebugStep[] = [];
  let id = 0;

  const tracer = createAutoTracer({
    enabled: () => true,
    emit: (view, label, line, meta) => {
      if (frames.length >= frameLimit) return false;
      frames.push({ id: id++, label, view, line, meta });
      return true;
    },
    record: debug
      ? (kind, line, scope, stack, fn, frame) => {
          if (steps.length >= 20_000) return false;
          steps.push({
            id: steps.length,
            line,
            kind,
            fn,
            depth: stack.length,
            scope: toTransferable(scope, 5) as Record<string, unknown>,
            stack: stack.map((e) => ({ label: e.label, depth: e.depth })),
            frame,
          });
          return true;
        }
      : undefined,
  });

  for (const trace of traces) {
    const scope = () => (revivePython(trace.scope) ?? {}) as Record<string, unknown>;
    if (trace.k === 'step') tracer.step(trace.line ?? 0, scope, trace.tag ?? undefined);
    else if (trace.k === 'enter') tracer.enter(trace.name ?? '(anonymous)', trace.line ?? 0, scope);
    else tracer.exit();
  }

  return { frames, steps };
}

ctx.postMessage({ type: 'ready' });

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;

  let py: PyodideApi;
  try {
    py = await boot(msg.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ctx.postMessage({
      type: 'error',
      id: msg.id,
      error: { message: `Could not load the Python runtime: ${message}` },
      durationMs: 0,
    });
    return;
  }

  try {
    if (msg.type === 'run') {
      const autoTrace = Boolean(msg.autoTrace) && !hasManualInstrumentation(msg.code);

      const debug = Boolean(msg.debug);

      const result = callPython(py, '_breakstep_run', [
        msg.code,
        msg.params,
        msg.opLimit,
        msg.frameLimit,
        autoTrace,
        debug,
      ]) as PyRunResult;

      const explicit = toFrames(result.frames ?? []);
      const replayed = replayTraces(result.traces ?? [], msg.frameLimit, debug);
      const frames = explicit.length > 0 ? explicit : replayed.frames;

      ctx.postMessage({ type: 'log', id: msg.id, entries: result.logs ?? [] });
      ctx.postMessage({ type: 'frame', id: msg.id, frames });

      if (result.error) {
        ctx.postMessage({
          type: 'error',
          id: msg.id,
          error: result.error,
          durationMs: result.durationMs,
        });
      } else {
        ctx.postMessage({
          type: 'done',
          id: msg.id,
          durationMs: result.durationMs,
          operations: result.operations,
          hasBenchmark: result.hasBenchmark,
          steps: debug ? replayed.steps : undefined,
        });
      }
      return;
    }

    if (msg.type === 'bench') {
      const result = callPython(py, '_breakstep_bench', [
        msg.code,
        msg.params,
        msg.sizes,
        msg.opLimit,
      ]) as { samples: BenchmarkSample[]; error?: string };
      ctx.postMessage({ type: 'benchDone', id: msg.id, samples: result.samples ?? [], error: result.error });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (msg.type === 'bench') {
      ctx.postMessage({ type: 'benchDone', id: msg.id, samples: [], error: message });
    } else {
      ctx.postMessage({ type: 'error', id: msg.id, error: { message }, durationMs: 0 });
    }
  }
};
