import { normalize } from './normalize';
import { instrument, OP_LIMIT_MESSAGE } from '@/analysis/instrument';
import { autoInstrument, hasManualInstrumentation } from '@/analysis/autoInstrument';
import { createAutoTracer } from './autoTrace';
import { NO_BENCHMARK_MESSAGE } from './benchNotice';
import type { BenchmarkSample, LogEntry, LogLevel, ParamValues, RunError } from '@/types';
import type { Frame, ShowOptions } from '@/types/viz';
import type { DebugStep } from '@/types/debug';

export interface BenchSpec {
  input: (n: number) => unknown;
  run: (input: unknown) => unknown;
  sizes?: number[];
  label?: string;
}

export interface SandboxOptions {
  opLimit: number;
  frameLimit: number;
  autoTrace?: boolean;
  debug?: boolean;
  stepLimit?: number;
  onFlush?: (payload: { frames: Frame[]; logs: LogEntry[] }) => void;
  flushEveryMs?: number;
}

export interface SandboxResult {
  frames: Frame[];
  steps?: DebugStep[];
  traced?: boolean;
  logs: LogEntry[];
  error?: RunError;
  durationMs: number;
  operations: number;
  returnValue?: unknown;
  bench?: BenchSpec;
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
  ...args: string[]
) => (...args: unknown[]) => Promise<unknown>;

export function stringifyArg(value: unknown, depth = 0): string {
  if (typeof value === 'string') return depth === 0 ? value : JSON.stringify(value);
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'bigint') return `${value}n`;
  if (typeof value === 'function') return `[Function: ${value.name || 'anonymous'}]`;
  if (typeof value !== 'object') return String(value);
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (depth > 4) return '…';

  const seen = new WeakSet<object>();
  const walk = (v: unknown, d: number): string => {
    if (v === null) return 'null';
    if (typeof v === 'string') return JSON.stringify(v);
    if (typeof v !== 'object') return String(v);
    if (seen.has(v as object)) return '[Circular]';
    if (d > 4) return '…';
    seen.add(v as object);
    if (Array.isArray(v)) {
      const items = v.slice(0, 100).map((x) => walk(x, d + 1));
      if (v.length > 100) items.push(`… ${v.length - 100} more`);
      return `[${items.join(', ')}]`;
    }
    if (v instanceof Map) {
      return `Map(${v.size}) {${[...v.entries()]
        .slice(0, 50)
        .map(([k, val]) => `${walk(k, d + 1)} => ${walk(val, d + 1)}`)
        .join(', ')}}`;
    }
    if (v instanceof Set) {
      return `Set(${v.size}) {${[...v].slice(0, 50).map((x) => walk(x, d + 1)).join(', ')}}`;
    }
    const ctor = (v as object).constructor?.name;
    const prefix = ctor && ctor !== 'Object' ? `${ctor} ` : '';
    const entries = Object.entries(v as Record<string, unknown>).slice(0, 50);
    return `${prefix}{ ${entries.map(([k, val]) => `${k}: ${walk(val, d + 1)}`).join(', ')} }`;
  };

  return walk(value, depth);
}

export function toTransferable(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== 'object') {
    return typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint'
      ? stringifyArg(value)
      : value;
  }
  if (seen.has(value as object) || depth > 8) return '[Circular]';
  seen.add(value as object);
  if (Array.isArray(value)) return value.slice(0, 500).map((v) => toTransferable(v, depth + 1, seen));
  if (value instanceof Map) {
    return Object.fromEntries(
      [...value.entries()].slice(0, 500).map(([k, v]) => [String(k), toTransferable(v, depth + 1, seen)]),
    );
  }
  if (value instanceof Set) return [...value].slice(0, 500).map((v) => toTransferable(v, depth + 1, seen));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 200)) {
    out[k] = toTransferable(v, depth + 1, seen);
  }
  return out;
}

export function stripModuleSyntax(code: string): string {
  return code
    .replace(/^\s*export\s+default\s+/gm, '')
    .replace(/^\s*export\s+(?=(?:const|let|var|function|class|async|\{))/gm, '')
    .replace(/^\s*export\s*\{[^}]*\}\s*;?\s*$/gm, '')
    .replace(/^\s*import\s+[^;\n]*;?\s*$/gm, '');
}

interface Harness {
  breakstep: Record<string, unknown>;
  frames: Frame[];
  steps: DebugStep[];
  logs: LogEntry[];
  getBench: () => BenchSpec | undefined;
  countOp: () => void;
  readOps: () => number;
  resetOps: () => void;
  setCapture: (on: boolean) => void;
  step: (line: number, snapshot: () => Record<string, unknown>, tag?: string) => void;
  enter: (name: string, line: number, snapshot: () => Record<string, unknown>) => void;
  exit: () => void;
}

function createHarness(params: ParamValues, options: SandboxOptions, startedAt: number): Harness {
  const frames: Frame[] = [];
  const steps: DebugStep[] = [];
  const logs: LogEntry[] = [];
  let ops = 0;
  let frameId = 0;
  let bench: BenchSpec | undefined;
  let capturing = true;
  let pendingLabel: string | undefined;
  let lastFlush = startedAt;
  let flushedFrames = 0;
  let flushedLogs = 0;

  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  const maybeFlush = (force = false) => {
    if (!options.onFlush) return;
    const t = now();
    if (!force && t - lastFlush < (options.flushEveryMs ?? 60)) return;
    if (frames.length === flushedFrames && logs.length === flushedLogs) return;
    options.onFlush({
      frames: frames.slice(flushedFrames),
      logs: logs.slice(flushedLogs),
    });
    flushedFrames = frames.length;
    flushedLogs = logs.length;
    lastFlush = t;
  };

  const countOp = () => {
    if (++ops > options.opLimit) {
      const e = new Error(OP_LIMIT_MESSAGE);
      e.name = 'BreakstepOperationLimit';
      throw e;
    }
  };

  const record = (level: LogLevel, args: unknown[]) => {
    if (!capturing) return;
    if (logs.length >= 5000) return;
    logs.push({
      level,
      text: args.map((a) => stringifyArg(a)).join(' '),
      at: Math.round(now() - startedAt),
    });
    maybeFlush();
  };

  const show = (value: unknown, optsOrFactory: ShowOptions | (() => ShowOptions) = {}) => {
    if (!capturing) return;
    if (frames.length >= options.frameLimit) return;
    const opts = typeof optsOrFactory === 'function' ? (optsOrFactory() ?? {}) : optsOrFactory;
    frames.push({
      id: frameId++,
      label: opts.label ?? pendingLabel ?? `Step ${frameId}`,
      view: normalize(value, opts),
      meta: opts.meta,
    });
    pendingLabel = undefined;
    maybeFlush();
  };

  const breakstep: Record<string, unknown> = {
    show,
    viz: show,
    log: (...args: unknown[]) => record('log', args),
    warn: (...args: unknown[]) => record('warn', args),
    error: (...args: unknown[]) => record('error', args),
    label: (text: string) => {
      pendingLabel = text;
    },
    params,
    param: (name: string, fallback?: unknown) => params[name] ?? fallback,
    bench: (spec: BenchSpec) => {
      bench = spec;
    },
    randomInts: (count: number, max = 100, seed = 42) => {
      let s = seed >>> 0;
      const out: number[] = [];
      for (let i = 0; i < count; i++) {
        s = (s * 1664525 + 1013904223) >>> 0;
        out.push(s % max);
      }
      return out;
    },
  };

  const stepLimit = options.stepLimit ?? 20_000;

  const tracer = createAutoTracer({
    enabled: () => capturing,
    emit: (view, label, line, meta) => {
      if (frames.length >= options.frameLimit) return false;
      frames.push({ id: frameId++, label, view, line, meta });
      maybeFlush();
      return true;
    },
    record: options.debug
      ? (kind, line, scope, stack, fn, frame) => {
          if (steps.length >= stepLimit) return false;
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

  return {
    breakstep,
    frames,
    steps,
    logs,
    getBench: () => bench,
    countOp,
    readOps: () => ops,
    resetOps: () => {
      ops = 0;
    },
    setCapture: (on: boolean) => {
      capturing = on;
      if (!on) maybeFlush(true);
    },
    step: tracer.step,
    enter: tracer.enter,
    exit: tracer.exit,
  };
}

function toRunError(err: unknown, code: string): RunError {
  if (!(err instanceof Error)) return { message: String(err) };
  const stack = err.stack ?? '';
  const match = stack.match(/<anonymous>:(\d+):(\d+)/);
  let line: number | undefined;
  let column: number | undefined;
  if (match) {
    line = Math.max(1, Number(match[1]) - 3);
    column = Number(match[2]);
    if (line > code.split('\n').length) line = undefined;
  }
  return { message: `${err.name}: ${err.message}`, stack, line, column };
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export async function runInSandbox(
  rawCode: string,
  params: ParamValues,
  options: SandboxOptions,
): Promise<SandboxResult> {
  const cleaned = stripModuleSyntax(rawCode);

  const manual = hasManualInstrumentation(cleaned);
  const traced = Boolean(options.autoTrace) && !manual;

  const counted = instrument(cleaned).code;
  const traceable = traced ? autoInstrument(counted, { debug: options.debug }) : null;
  const instrumented = traceable?.ok ? traceable.code : counted;
  const startedAt = now();
  const h = createHarness(params, options, startedAt);

  let compiled: (...args: unknown[]) => Promise<unknown>;
  try {
    compiled = new AsyncFunction(
      'breakstep',
      'params',
      '__breakstep_op',
      'console',
      '__breakstep_step',
      '__breakstep_enter',
      '__breakstep_exit',
      `"use strict";\n${instrumented}`,
    );
  } catch (err) {
    return {
      frames: [],
      logs: [],
      error: toRunError(err, cleaned),
      durationMs: 0,
      operations: 0,
    };
  }

  const consoleShim = {
    log: (...a: unknown[]) => (h.breakstep.log as (...x: unknown[]) => void)(...a),
    info: (...a: unknown[]) => (h.breakstep.log as (...x: unknown[]) => void)(...a),
    warn: (...a: unknown[]) => (h.breakstep.warn as (...x: unknown[]) => void)(...a),
    error: (...a: unknown[]) => (h.breakstep.error as (...x: unknown[]) => void)(...a),
    debug: (...a: unknown[]) => (h.breakstep.log as (...x: unknown[]) => void)(...a),
    table: (...a: unknown[]) => (h.breakstep.log as (...x: unknown[]) => void)(...a),
  };

  let returnValue: unknown;
  let error: RunError | undefined;
  try {
    returnValue = await compiled(
      h.breakstep,
      params,
      h.countOp,
      consoleShim,
      h.step,
      h.enter,
      h.exit,
    );
  } catch (err) {
    error = toRunError(err, cleaned);
  }
  const durationMs = now() - startedAt;
  h.setCapture(false);

  return {
    frames: h.frames,
    steps: options.debug ? h.steps : undefined,
    traced: traced && traceable?.ok === true,
    logs: h.logs,
    error,
    durationMs,
    operations: h.readOps(),
    returnValue: toTransferable(returnValue),
    bench: h.getBench(),
  };
}

export interface BenchOutcome {
  samples: BenchmarkSample[];
  error?: string;
}

export async function benchInSandbox(
  rawCode: string,
  params: ParamValues,
  sizes: number[],
  opLimit: number,
): Promise<BenchOutcome> {
  const prep = await runInSandbox(rawCode, params, {
    opLimit,
    frameLimit: 0,
    autoTrace: false,
    flushEveryMs: Number.POSITIVE_INFINITY,
  });

  if (prep.error) return { samples: [], error: prep.error.message };
  const spec = prep.bench;
  if (!spec || typeof spec.input !== 'function' || typeof spec.run !== 'function') {
    return {
      samples: [],
      error:
        NO_BENCHMARK_MESSAGE,
    };
  }

  const sweep = spec.sizes?.length ? spec.sizes : sizes;
  const samples: BenchmarkSample[] = [];
  const cleaned = stripModuleSyntax(rawCode);
  const { code: instrumented } = instrument(cleaned);

  const startedAt = now();
  const h = createHarness(params, { opLimit, frameLimit: 0 }, startedAt);
  h.setCapture(false);
  const silentConsole = { log() {}, info() {}, warn() {}, error() {}, debug() {}, table() {} };

  let compiled: (...args: unknown[]) => Promise<unknown>;
  try {
    compiled = new AsyncFunction(
      'breakstep',
      'params',
      '__breakstep_op',
      'console',
      '__breakstep_step',
      '__breakstep_enter',
      '__breakstep_exit',
      `"use strict";\n${instrumented}`,
    );
    await compiled(h.breakstep, params, h.countOp, silentConsole, h.step, h.enter, h.exit);
  } catch (err) {
    return { samples: [], error: err instanceof Error ? err.message : String(err) };
  }

  const liveSpec = h.getBench();
  if (!liveSpec) return { samples: [], error: 'Benchmark harness disappeared after re-compilation.' };

  let stoppedBy: string | undefined;
  for (const n of sweep) {
    let data: unknown;
    try {
      data = liveSpec.input(n);
    } catch (err) {
      stoppedBy = `input(${n}) threw: ${err instanceof Error ? err.message : String(err)}`;
      break;
    }

    h.resetOps();
    const t0 = now();
    try {
      const out = liveSpec.run(data);
      if (out instanceof Promise) await out;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      stoppedBy = `stopped at n=${n}: ${message}`;
      break;
    }
    const ms = now() - t0;
    samples.push({ n, operations: h.readOps(), ms });

    if (h.readOps() > opLimit / 4) {
      stoppedBy = `stopped after n=${n} — the next size would exceed the operation budget`;
      break;
    }
    if (now() - startedAt > 15_000) {
      stoppedBy = `stopped after n=${n} — benchmark time budget reached`;
      break;
    }
  }

  if (samples.length < 3) {
    return { samples, error: stoppedBy ?? 'Not enough sizes completed to fit a curve.' };
  }
  return { samples };
}
