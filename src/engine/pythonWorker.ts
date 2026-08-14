/// <reference lib="webworker" />
/**
 * Python execution worker, backed by Pyodide.
 *
 * Pyodide is ~10 MB, so it is loaded from the CDN on first use and never as part
 * of the app bundle — open BCS in TypeScript mode and you never pay for it. The
 * worker boots lazily on the first Python run and stays warm afterwards.
 */
import { PYTHON_BOOTSTRAP, revivePython } from './pythonRuntime';
import { normalize } from './normalize';
import { createAutoTracer } from './autoTrace';
import { hasManualInstrumentation } from '@/analysis/autoInstrument';
import type { WorkerRequest } from './protocol';
import type { BenchmarkSample, LogEntry, RunError } from '@/types';
import type { Frame, ShowOptions } from '@/types/viz';

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

/** Call a Python function with JSON-encoded args and parse the JSON result. */
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

/** One auto-trace record, as emitted by the Python runtime. */
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

/**
 * Replay Python's trace records through the *JavaScript* auto-tracer.
 *
 * Subject selection, pointer detection and captions all live in one place, so
 * the same algorithm written in either language produces the same picture.
 */
function framesFromTraces(traces: PyTrace[], frameLimit: number): Frame[] {
  const frames: Frame[] = [];
  let id = 0;

  const tracer = createAutoTracer({
    enabled: () => true,
    emit: (view, label, line, meta) => {
      if (frames.length >= frameLimit) return false;
      frames.push({ id: id++, label, view, line, meta });
      return true;
    },
  });

  for (const trace of traces) {
    const scope = () => (revivePython(trace.scope) ?? {}) as Record<string, unknown>;
    if (trace.k === 'step') tracer.step(trace.line ?? 0, scope, trace.tag ?? undefined);
    else if (trace.k === 'enter') tracer.enter(trace.name ?? '(anonymous)', trace.line ?? 0, scope);
    else tracer.exit();
  }

  return frames;
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
      // Auto-tracing steps aside when the source drives the visualizer itself.
      const autoTrace = Boolean(msg.autoTrace) && !hasManualInstrumentation(msg.code);

      const result = callPython(py, '_bcs_run', [
        msg.code,
        msg.params,
        msg.opLimit,
        msg.frameLimit,
        autoTrace,
      ]) as PyRunResult;

      const explicit = toFrames(result.frames ?? []);
      const frames = explicit.length > 0
        ? explicit
        : framesFromTraces(result.traces ?? [], msg.frameLimit);

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
        });
      }
      return;
    }

    if (msg.type === 'bench') {
      const result = callPython(py, '_bcs_bench', [
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
