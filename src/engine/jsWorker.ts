/// <reference lib="webworker" />
import { benchInSandbox, runInSandbox, toTransferable } from './sandbox';
import type { WorkerRequest } from './protocol';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.postMessage({ type: 'ready' });

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;

  if (msg.type === 'run') {
    const result = await runInSandbox(msg.code, msg.params, {
      opLimit: msg.opLimit,
      frameLimit: msg.frameLimit,
      autoTrace: msg.autoTrace,
      debug: msg.debug,
      onFlush: ({ frames, logs }) => {
        if (frames.length) ctx.postMessage({ type: 'frame', id: msg.id, frames });
        if (logs.length) ctx.postMessage({ type: 'log', id: msg.id, entries: logs });
      },
    });

    ctx.postMessage({ type: 'frame', id: msg.id, frames: result.frames });
    ctx.postMessage({ type: 'log', id: msg.id, entries: result.logs });

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
        returnValue: toTransferable(result.returnValue),
        hasBenchmark: Boolean(result.bench),
        steps: result.steps,
      });
    }
    return;
  }

  if (msg.type === 'bench') {
    const { samples, error } = await benchInSandbox(msg.code, msg.params, msg.sizes, msg.opLimit);
    ctx.postMessage({ type: 'benchDone', id: msg.id, samples, error });
  }
};
