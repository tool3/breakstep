import { describe, expect, it } from 'vitest';
import { runInSandbox } from './sandbox';
import { autoInstrument, listFunctions } from '@/analysis/autoInstrument';
import type { DebugStep } from '@/types/debug';

const OPTS = { opLimit: 5_000_000, frameLimit: 400, autoTrace: true, debug: true };
const run = (code: string) => runInSandbox(code, {}, OPTS);

describe('debug recording', () => {
  it('records nothing unless the run asks for it', async () => {
    const result = await runInSandbox(`const a = [1, 2];\nfor (const x of a) x;`, {}, {
      opLimit: 100000,
      frameLimit: 50,
      autoTrace: true,
    });
    expect(result.steps).toBeUndefined();
  });

  it('records a step for every statement', async () => {
    const result = await run(`const a = 1;\nconst b = 2;\nconst c = a + b;`);
    expect(result.error).toBeUndefined();

    const lines = result.steps!.filter((s) => s.kind === 'statement').map((s) => s.line);
    expect(lines).toEqual([1, 2, 3]);
  });

  it('records function entry and exit around the body', async () => {
    const result = await run(`
function add(a, b) {
  const sum = a + b;
  return sum;
}
add(2, 3);
`);
    expect(result.error).toBeUndefined();

    const kinds = result.steps!.map((s) => s.kind);
    expect(kinds).toContain('entry');
    expect(kinds).toContain('exit');

    const entry = result.steps!.find((s) => s.kind === 'entry')!;
    const exits = result.steps!.filter((s) => s.kind === 'exit');
    const exit = exits[exits.length - 1];
    expect(entry.fn).toBe('add');
    expect(exit.fn).toBe('add');
    expect(entry.id).toBeLessThan(exit.id);
  });

  it('carries the variables visible at each step', async () => {
    const result = await run(`
const nums = [4, 5, 6];
let total = 0;
for (const n of nums) {
  total += n;
}
`);
    const inLoop = result.steps!.filter((s) => s.kind === 'statement' && s.line === 5);
    expect(inLoop.length).toBe(3);
    expect(inLoop.map((s) => s.scope.n)).toEqual([4, 5, 6]);
    expect(inLoop.map((s) => s.scope.total)).toEqual([0, 4, 9]);
  });

  it('tracks call depth and the call stack', async () => {
    const result = await run(`
function outer() { return inner(); }
function inner() { return 1; }
outer();
`);
    const innerEntry = result.steps!.find((s) => s.kind === 'entry' && s.fn === 'inner')!;
    expect(innerEntry.depth).toBe(2);
    expect(innerEntry.stack.map((f) => f.label)).toEqual(['outer', 'inner']);
  });

  it('points each step at the picture current at that moment', async () => {
    const result = await run(`
const nums = [1, 2, 3];
for (let i = 0; i < nums.length; i++) {
  const doubled = nums[i] * 2;
}
`);
    const withFrames = result.steps!.filter((s) => s.frame !== undefined);
    expect(withFrames.length).toBeGreaterThan(0);
    for (const step of withFrames) {
      expect(result.frames[step.frame!]).toBeDefined();
    }
    // The frame index only ever moves forwards through the recording.
    const indices = withFrames.map((s) => s.frame!);
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
  });

  it('still produces the visualizer frames a normal run would', async () => {
    const plain = await runInSandbox(
      `const nums = [1, 2, 3];\nfor (let i = 0; i < nums.length; i++) { nums[i]; }`,
      {},
      { opLimit: 500000, frameLimit: 100, autoTrace: true },
    );
    const debug = await run(`const nums = [1, 2, 3];\nfor (let i = 0; i < nums.length; i++) { nums[i]; }`);
    expect(debug.frames.length).toBe(plain.frames.length);
  });

  it('honours the step budget rather than filling memory', async () => {
    const result = await runInSandbox(
      `let t = 0;\nfor (let i = 0; i < 100000; i++) { t += i; }`,
      {},
      { ...OPTS, stepLimit: 200 },
    );
    expect(result.steps!.length).toBeLessThanOrEqual(200);
    expect(result.error).toBeUndefined();
  });

  it('records a debuggable run of ordinary class-based code', async () => {
    const result = await run(`
class Stack {
  constructor() { this.items = []; }
  push(v) { this.items.push(v); }
  pop() { return this.items.pop(); }
}
const s = new Stack();
s.push(1);
s.push(2);
s.pop();
`);
    expect(result.error).toBeUndefined();

    // Methods report qualified, so a breakpoint switch cannot stop in the
    // wrong class when two classes share a method name.
    const entries = result.steps!.filter((s) => s.kind === 'entry').map((s) => s.fn);
    expect(entries).toEqual(['Stack.constructor', 'Stack.push', 'Stack.push', 'Stack.pop']);
  });

  it('stops at a constructor, including a derived one', async () => {
    const result = await run(`
class Node {
  constructor(value) { this.value = value; }
}
class Boxed extends Node {
  constructor(value) { super(value); this.boxed = true; }
}
const b = new Boxed(7);
console.log(b.value, b.boxed);
`);
    expect(result.error).toBeUndefined();
    // super() still runs, and the program is unchanged.
    expect(result.logs[0].text).toBe('7 true');

    const entries = result.steps!.filter((s) => s.kind === 'entry').map((s) => s.fn);
    expect(entries).toEqual(['Boxed.constructor', 'Node.constructor']);
  });

  it('keeps same-named methods of different classes apart', async () => {
    const result = await run(`
class A { go() { return 1; } }
class B { go() { return 2; } }
new A().go();
new B().go();
`);
    const entries = result.steps!.filter((s) => s.kind === 'entry').map((s) => s.fn);
    expect(entries).toEqual(['A.go', 'B.go']);
  });

  it('leaves the program working exactly as it did', async () => {
    const source = `
function fib(n) {
  if (n < 2) return n;
  return fib(n - 1) + fib(n - 2);
}
console.log(fib(9));
`;
    const plain = await runInSandbox(source, {}, { opLimit: 500000, frameLimit: 50, autoTrace: true });
    const debug = await run(source);
    expect(debug.logs[0].text).toBe('34');
    expect(debug.logs[0].text).toBe(plain.logs[0].text);
  });
});

describe('autoInstrument statement hooks', () => {
  it('adds nothing extra unless debugging', () => {
    const source = `const a = 1;\nconst b = 2;`;
    expect(autoInstrument(source).code).not.toContain("'stmt'");
    expect(autoInstrument(source, { debug: true }).code).toContain("'stmt'");
  });

  it('keeps the line count stable so error lines stay accurate', () => {
    const source = `const a = 1;\nfor (let i = 0; i < 2; i++) {\n  a;\n}\n`;
    const { code } = autoInstrument(source, { debug: true });
    expect(code.split('\n').length).toBeLessThanOrEqual(source.split('\n').length + 1);
  });

  it('does not double-report the first statement of a loop body', async () => {
    const result = await run(`for (let i = 0; i < 2; i++) {\n  const x = i;\n}`);
    const atLine2 = result.steps!.filter((s) => s.line === 2);
    // One statement step per iteration, not two.
    expect(atLine2.length).toBe(2);
  });
});

describe('listFunctions', () => {
  it('finds declarations, arrows and methods in source order', () => {
    const found = listFunctions(`
function first() {}
const second = () => {};
class Thing {
  third() {}
}
`);
    expect(found.map((f) => f.qualified)).toEqual(['first', 'second', 'Thing.third']);
    expect(found[0].line).toBe(2);
    expect(found[2].line).toBe(5);
  });

  it('skips anonymous callbacks', () => {
    const found = listFunctions(`[1, 2].map(function () { return 1; });`);
    expect(found).toHaveLength(0);
  });

  it('returns nothing for unparseable source', () => {
    expect(listFunctions('function ( {')).toEqual([]);
  });
});

describe('DebugStep shape', () => {
  it('is structured-clone safe, cycles and all', async () => {
    const result = await run(`
const a = { name: 'a' };
a.self = a;
const b = [a];
`);
    const steps = result.steps as DebugStep[];
    expect(() => structuredClone(steps)).not.toThrow();
  });
});
