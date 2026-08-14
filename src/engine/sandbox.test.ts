import { describe, expect, it } from 'vitest';
import { benchInSandbox, runInSandbox, stringifyArg, stripModuleSyntax, toTransferable } from './sandbox';
import type { ArrayView } from '@/types/viz';

const opts = { opLimit: 5_000_000, frameLimit: 100 };

describe('runInSandbox', () => {
  it('captures logs from breakstep.log and console.log alike', async () => {
    const result = await runInSandbox(
      `breakstep.log('from breakstep'); console.log('from console', 42);`,
      {},
      opts,
    );
    expect(result.error).toBeUndefined();
    expect(result.logs.map((l) => l.text)).toEqual(['from breakstep', 'from console 42']);
  });

  it('captures frames and normalizes them', async () => {
    const result = await runInSandbox(`breakstep.show([3, 1, 2], { label: 'data' });`, {}, opts);
    expect(result.frames).toHaveLength(1);
    expect(result.frames[0].label).toBe('data');
    expect((result.frames[0].view as ArrayView).items.map((c) => c.value)).toEqual([3, 1, 2]);
  });

  it('uses breakstep.label for the next frame when no label option is given', async () => {
    const result = await runInSandbox(`breakstep.label('named'); breakstep.show([1]);`, {}, opts);
    expect(result.frames[0].label).toBe('named');
  });

  it('exposes parameters through breakstep.param and the params object', async () => {
    const result = await runInSandbox(
      `breakstep.log(breakstep.param('size'), params.name, breakstep.param('missing', 'fallback'));`,
      { size: 12, name: 'x' },
      opts,
    );
    expect(result.logs[0].text).toBe('12 x fallback');
  });

  it('counts operations for loops and function calls', async () => {
    const result = await runInSandbox(`for (let i = 0; i < 100; i++) {}`, {}, opts);
    expect(result.operations).toBe(100);
  });

  it('counts un-braced loop bodies too', async () => {
    const result = await runInSandbox(`let x = 0;\nfor (let i = 0; i < 10; i++) x += i;`, {}, opts);
    expect(result.operations).toBe(10);
  });

  it('stops an infinite loop via the operation budget', async () => {
    const result = await runInSandbox(`while (true) {}`, {}, { opLimit: 1000, frameLimit: 10 });
    expect(result.error?.message).toMatch(/Operation limit exceeded/);
    expect(result.operations).toBeGreaterThan(1000);
  });

  it('reports runtime errors with the user line number', async () => {
    const result = await runInSandbox(`const a = 1;\nthrow new Error('boom');`, {}, opts);
    expect(result.error?.message).toContain('boom');
    expect(result.error?.line).toBe(2);
  });

  it('reports syntax errors instead of throwing', async () => {
    const result = await runInSandbox(`function ( {`, {}, opts);
    expect(result.error).toBeDefined();
    expect(result.frames).toHaveLength(0);
  });

  it('supports top-level await', async () => {
    const result = await runInSandbox(
      `const v = await Promise.resolve(7); breakstep.log('got', v);`,
      {},
      opts,
    );
    expect(result.error).toBeUndefined();
    expect(result.logs[0].text).toBe('got 7');
  });

  it('honours the frame limit', async () => {
    const result = await runInSandbox(
      `for (let i = 0; i < 500; i++) breakstep.show([i]);`,
      {},
      { opLimit: 1_000_000, frameLimit: 10 },
    );
    expect(result.frames).toHaveLength(10);
  });

  it('registers a benchmark harness without running it', async () => {
    const result = await runInSandbox(
      `let ran = false; breakstep.bench({ input: (n) => n, run: () => { ran = true; } }); breakstep.log('ran', ran);`,
      {},
      opts,
    );
    expect(result.bench).toBeDefined();
    expect(result.logs[0].text).toBe('ran false');
  });

  it('produces deterministic randomInts', async () => {
    const once = await runInSandbox(`breakstep.log(breakstep.randomInts(5, 10).join(','));`, {}, opts);
    const twice = await runInSandbox(`breakstep.log(breakstep.randomInts(5, 10).join(','));`, {}, opts);
    expect(once.logs[0].text).toBe(twice.logs[0].text);
  });

  it('streams progress through onFlush', async () => {
    const seen: number[] = [];
    await runInSandbox(`for (let i = 0; i < 5; i++) breakstep.show([i]);`, {}, {
      ...opts,
      flushEveryMs: -1,
      onFlush: ({ frames }) => seen.push(frames.length),
    });
    expect(seen.length).toBeGreaterThan(0);
  });
});

describe('benchInSandbox', () => {
  const linear = `
    function sum(arr) { let t = 0; for (const v of arr) t += v; return t; }
    breakstep.bench({ input: (n) => Array.from({length: n}, (_, i) => i), run: sum });
  `;

  it('produces a sample per size with growing operation counts', async () => {
    const { samples, error } = await benchInSandbox(linear, {}, [10, 20, 40, 80], 1_000_000);
    expect(error).toBeUndefined();
    expect(samples.map((s) => s.n)).toEqual([10, 20, 40, 80]);
    expect(samples[3].operations).toBeGreaterThan(samples[0].operations);
  });

  it('excludes input generation from the operation count', async () => {
    const { samples } = await benchInSandbox(linear, {}, [100, 200, 400], 1_000_000);
    // ~1 op per element plus the wrapper call, not 2× for generation as well.
    expect(samples[0].operations).toBeLessThan(150);
  });

  it('prefers sizes declared by the harness itself', async () => {
    const withSizes = `${linear.replace('run: sum', 'run: sum, sizes: [5, 6, 7]')}`;
    const { samples } = await benchInSandbox(withSizes, {}, [100, 200], 1_000_000);
    expect(samples.map((s) => s.n)).toEqual([5, 6, 7]);
  });

  it('explains itself when no harness is registered', async () => {
    const { samples, error } = await benchInSandbox(`breakstep.log('nothing');`, {}, [10, 20, 40], 100000);
    expect(samples).toHaveLength(0);
    expect(error).toMatch(/No benchmark registered/);
  });

  it('keeps partial samples when a size blows the budget', async () => {
    const quadratic = `
      function slow(n) { let t = 0; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) t++; return t; }
      breakstep.bench({ input: (n) => n, run: slow });
    `;
    const { samples } = await benchInSandbox(quadratic, {}, [10, 20, 40, 80, 1000], 100_000);
    expect(samples.length).toBeGreaterThanOrEqual(3);
    expect(samples.at(-1)!.n).toBeLessThan(1000);
  });
});

describe('serialization helpers', () => {
  it('stringifies nested values without choking on cycles', () => {
    const a: Record<string, unknown> = { name: 'a' };
    a.self = a;
    expect(stringifyArg(a)).toContain('[Circular]');
  });

  it('formats Maps and Sets readably', () => {
    expect(stringifyArg(new Map([['k', 1]]))).toBe('Map(1) {"k" => 1}');
    expect(stringifyArg(new Set([1, 2]))).toBe('Set(2) {1, 2}');
  });

  it('keeps top-level strings unquoted, like console.log', () => {
    expect(stringifyArg('hello')).toBe('hello');
    expect(stringifyArg(['hello'])).toBe('["hello"]');
  });

  it('makes cyclic values structured-clone safe', () => {
    const a: Record<string, unknown> = { n: 1 };
    a.self = a;
    expect(() => structuredClone(toTransferable(a))).not.toThrow();
  });

  it('strips module syntax that new Function would reject', () => {
    expect(stripModuleSyntax(`export const a = 1;`)).toBe(`const a = 1;`);
    expect(stripModuleSyntax(`export default foo;`)).toBe(`foo;`);
    expect(stripModuleSyntax(`import x from 'y';\nconst a = 1;`).trim()).toBe(`const a = 1;`);
  });
});
