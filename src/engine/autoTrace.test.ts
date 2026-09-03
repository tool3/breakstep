import { describe, expect, it } from 'vitest';
import { runInSandbox } from './sandbox';
import { autoInstrument, hasManualInstrumentation } from '@/analysis/autoInstrument';
import { pickSubject, viewSize } from './autoTrace';
import { normalize } from './normalize';
import type { ArrayView, Frame, LinkedListView, TreeView } from '@/types/viz';

const OPTS = { opLimit: 5_000_000, frameLimit: 400, autoTrace: true };

const run = (code: string) => runInSandbox(code, {}, OPTS);

describe('autoInstrument — safety', () => {
  it('never reads a binding before its declaration (no TDZ crash)', async () => {
    const result = await run(`
      const out = [];
      for (let i = 0; i < 3; i++) {
        out.push(i);
        const later = i * 2;
        out.push(later);
      }
      console.log(out.join(','));
    `);
    expect(result.error).toBeUndefined();
    expect(result.logs[0].text).toBe('0,0,1,2,2,4');
  });

  it('never reads a binding from a block that already closed', async () => {
    const result = await run(`
      { const secret = 1; }
      const arr = [1, 2, 3];
      for (const x of arr) { arr.length; }
      console.log('done');
    `);
    expect(result.error).toBeUndefined();
    expect(result.logs[0].text).toBe('done');
  });

  it('does not touch `this` inside a constructor', async () => {
    const result = await run(`
      class Node {
        constructor(v) { this.val = v; this.next = null; }
      }
      const n = new Node(5);
      console.log(n.val);
    `);
    expect(result.error).toBeUndefined();
    expect(result.logs[0].text).toBe('5');
  });

  it('preserves return values through the try/finally wrapper', async () => {
    const result = await run(`
      function add(a, b) { return a + b; }
      console.log(add(2, 3));
    `);
    expect(result.error).toBeUndefined();
    expect(result.logs[0].text).toBe('5');
  });

  it('preserves thrown errors through the try/finally wrapper', async () => {
    const result = await run(`
      function boom() { throw new Error('expected'); }
      try { boom(); } catch (e) { console.log('caught', e.message); }
    `);
    expect(result.error).toBeUndefined();
    expect(result.logs[0].text).toBe('caught expected');
  });

  it('handles derived classes and super()', async () => {
    const result = await run(`
      class Base { constructor(v) { this.v = v; } }
      class Child extends Base { constructor(v) { super(v * 2); } }
      console.log(new Child(4).v);
    `);
    expect(result.error).toBeUndefined();
    expect(result.logs[0].text).toBe('8');
  });

  it('handles destructured parameters and declarations', async () => {
    const result = await run(`
      function f({ a, b }, [c]) { return a + b + c; }
      const { x, y } = { x: 1, y: 2 };
      console.log(f({ a: 1, b: 2 }, [3]), x + y);
    `);
    expect(result.error).toBeUndefined();
    expect(result.logs[0].text).toBe('6 3');
  });

  it('handles un-braced loop bodies', async () => {
    const result = await run(`let t = 0;\nfor (let i = 0; i < 4; i++) t += i;\nconsole.log(t);`);
    expect(result.error).toBeUndefined();
    expect(result.logs[0].text).toBe('6');
  });

  it('keeps generators and async functions working', async () => {
    const result = await run(`
      function* gen() { yield 1; yield 2; }
      console.log([...gen()].join(','));
      const later = async () => 7;
      console.log(await later());
    `);
    expect(result.error).toBeUndefined();
    expect(result.logs.map((l) => l.text)).toEqual(['1,2', '7']);
  });

  it('preserves the line count so error lines stay accurate', () => {
    const source = `const a = 1;\nfor (let i = 0; i < 2; i++) {\n  a;\n}\n`;
    const { code } = autoInstrument(source);
    expect(code.split('\n').length).toBeLessThanOrEqual(source.split('\n').length + 1);
  });

  it('leaves unparseable source alone', () => {
    expect(autoInstrument('function ( {').ok).toBe(false);
  });
});

describe('autoTrace — what it captures', () => {
  it('captures a frame per loop iteration', async () => {
    const result = await run(`
      const nums = [5, 3, 8, 1];
      let total = 0;
      for (let i = 0; i < nums.length; i++) {
        total += nums[i];
      }
      console.log(total);
    `);
    expect(result.traced).toBe(true);
    expect(result.frames.length).toBeGreaterThanOrEqual(4);
    expect((result.frames[0].view as ArrayView).items.map((c) => c.value)).toEqual([5, 3, 8, 1]);
  });

  it('marks the loop index as a pointer and highlights it', async () => {
    const result = await run(`
      const nums = [1, 2, 3, 4];
      for (let i = 0; i < nums.length; i++) { nums[i]; }
    `);
    const view = result.frames[1].view as ArrayView;
    expect(view.pointers?.some((p) => p.name === 'i' && p.index === 1)).toBe(true);
    expect(view.items[1].state).toBe('active');
  });

  it('names the frame after the loop variables', async () => {
    const result = await run(`
      const nums = [1, 2, 3];
      let total = 0;
      for (let i = 0; i < nums.length; i++) { total += nums[i]; }
    `);
    expect(result.frames[0].label).toMatch(/i = 0/);
  });

  it('records the source line on each frame', async () => {
    const result = await run(`const nums = [1, 2];\nfor (let i = 0; i < 2; i++) { nums[i]; }`);
    expect(result.frames[0].line).toBe(2);
  });

  it('draws a hand-rolled linked list and highlights the cursor', async () => {
    const result = await run(`
      class ListNode {
        constructor(val, next = null) { this.val = val; this.next = next; }
      }
      let head = null;
      for (const v of [4, 3, 2, 1]) head = new ListNode(v, head);

      let curr = head;
      let count = 0;
      while (curr !== null) {
        count++;
        curr = curr.next;
      }
      console.log(count);
    `);

    expect(result.error).toBeUndefined();
    expect(result.logs.at(-1)!.text).toBe('4');

    const listFrames = result.frames.filter(
      (f): f is Frame & { view: LinkedListView } => f.view.kind === 'linkedList',
    );
    expect(listFrames.length).toBeGreaterThan(0);

    const complete = listFrames.filter((f) => f.view.nodes.length === 4);
    expect(complete.length).toBeGreaterThan(0);
    expect(complete[0].view.nodes.map((n) => n.value)).toEqual([1, 2, 3, 4]);

    const walked = complete
      .map((f) => f.view.nodes.findIndex((n) => n.state === 'active'))
      .filter((i) => i >= 0);
    expect(walked).toEqual([0, 1, 2, 3]);
  });

  it('draws a tree built by an ordinary insert function', async () => {
    const result = await run(`
      class TreeNode {
        constructor(value) { this.value = value; this.left = null; this.right = null; }
      }
      function insert(node, value) {
        if (node === null) return new TreeNode(value);
        if (value < node.value) node.left = insert(node.left, value);
        else node.right = insert(node.right, value);
        return node;
      }
      let root = null;
      for (const v of [50, 30, 70, 20, 40]) root = insert(root, v);
      console.log('built');
    `);

    expect(result.error).toBeUndefined();
    const treeFrames = result.frames.filter((f) => f.view.kind === 'tree');
    expect(treeFrames.length).toBeGreaterThan(0);
    const last = treeFrames.at(-1)!.view as TreeView;
    expect(last.root?.value).toBe(50);
  });

  it('falls back to the call stack for pure recursion', async () => {
    const result = await run(`
      function fib(n) {
        if (n < 2) return n;
        return fib(n - 1) + fib(n - 2);
      }
      console.log(fib(6));
    `);
    expect(result.logs[0].text).toBe('8');
    const stackFrames = result.frames.filter((f) => f.view.kind === 'callstack');
    expect(stackFrames.length).toBeGreaterThan(0);
  });

  it('emits a final-state frame for a program with no loops', async () => {
    const result = await run(`const data = { a: [1], b: [2] };`);
    expect(result.frames.length).toBeGreaterThan(0);
  });

  it('respects the frame budget', async () => {
    const result = await runInSandbox(
      `const a = [1];\nfor (let i = 0; i < 5000; i++) { a[0]; }`,
      {},
      { opLimit: 5_000_000, frameLimit: 25, autoTrace: true },
    );
    expect(result.frames).toHaveLength(25);
  });

  it('adds no operations of its own to the count', async () => {
    const plain = await runInSandbox(`for (let i = 0; i < 50; i++) {}`, {}, { ...OPTS, autoTrace: false });
    const traced = await run(`for (let i = 0; i < 50; i++) {}`);
    expect(traced.operations).toBe(plain.operations);
  });
});

describe('autoTrace — deferring to manual instrumentation', () => {
  it('detects manual instrumentation', () => {
    expect(hasManualInstrumentation(`breakstep.show(x)`)).toBe(true);
    expect(hasManualInstrumentation(`breakstep.viz(x)`)).toBe(true);
    expect(hasManualInstrumentation(`breakstep.log('hi')`)).toBe(false);
    expect(hasManualInstrumentation(`const a = 1;`)).toBe(false);
  });

  it('steps aside when the code calls breakstep.show itself', async () => {
    const result = await run(`
      const nums = [1, 2, 3];
      for (let i = 0; i < nums.length; i++) {
        breakstep.show(nums, { label: 'mine' });
      }
    `);
    expect(result.traced).toBe(false);
    expect(result.frames).toHaveLength(3);
    expect(result.frames.every((f: Frame) => f.label === 'mine')).toBe(true);
  });

  it('captures nothing when auto-trace is off and nothing is instrumented', async () => {
    const result = await runInSandbox(
      `const nums = [1, 2, 3];\nfor (const n of nums) { n; }`,
      {},
      { opLimit: 100000, frameLimit: 100, autoTrace: false },
    );
    expect(result.frames).toHaveLength(0);
  });
});

describe('pickSubject', () => {
  it('prefers a structure over a scalar', () => {
    expect(pickSubject({ i: 3, arr: [1, 2, 3] }, null)?.name).toBe('arr');
  });

  it('prefers a linked list over an equally sized array', () => {
    const list = { val: 1, next: { val: 2, next: null } };
    expect(pickSubject({ arr: [1, 2], list }, null)?.name).toBe('list');
  });

  it('prefers the larger structure', () => {
    expect(pickSubject({ small: [1], big: [1, 2, 3, 4, 5] }, null)?.name).toBe('big');
  });

  it('is sticky: a near-tie keeps the previous subject', () => {
    const snapshot = { a: [1, 2, 3], b: [1, 2, 3, 4] };
    expect(pickSubject(snapshot, 'a')?.name).toBe('a');
    expect(pickSubject(snapshot, null)?.name).toBe('b');
  });

  it('ignores empty structures', () => {
    expect(pickSubject({ empty: [], real: [1] }, null)?.name).toBe('real');
  });

  it('returns null when nothing is structural', () => {
    expect(pickSubject({ i: 1, name: 'x' }, null)).toBeNull();
  });
});

describe('viewSize', () => {
  it('counts elements per view kind', () => {
    expect(viewSize(normalize([1, 2, 3]))).toBe(3);
    expect(viewSize(normalize([[1, 2], [3, 4]]))).toBe(4);
    expect(viewSize(normalize({ val: 1, next: { val: 2, next: null } }))).toBe(2);
    expect(viewSize(normalize({ a: ['b'], b: ['a'] }))).toBe(2);
    expect(viewSize(normalize({ x: 1, y: 2 }))).toBe(2);
  });
});

describe('pickSubject — weighting', () => {
  it('prefers a small tree over a larger unrelated input array', () => {
    const root = { value: 50, left: { value: 30, left: null, right: null }, right: null };
    const snapshot = { root, value: 40, values: [50, 30, 70, 20, 40, 60, 80, 35, 65] };
    expect(pickSubject(snapshot)?.name).toBe('root');
  });

  it('still prefers an array when that is what the algorithm holds', () => {
    const snapshot = { arr: [1, 2, 3, 4, 5], lo: 0, hi: 4 };
    expect(pickSubject(snapshot)?.name).toBe('arr');
  });

  it('prefers the innermost binding when two hold the same data', () => {
    const shared = [1, 2, 3];
    expect(pickSubject({ arr: shared, nums: shared })?.name).toBe('arr');
  });

  it('prefers a structure that changed over one that did not', () => {
    const snapshot = { built: [1, 2, 3], input: [9, 8, 7] };
    const history = new Map([
      ['built', { size: 2, stale: 0 }],
      ['input', { size: 3, stale: 2 }],
    ]);
    expect(pickSubject(snapshot, { history })?.name).toBe('built');
  });

  it('accepts the legacy string form for the previous subject', () => {
    const snapshot = { a: [1, 2, 3], b: [1, 2, 3] };
    expect(pickSubject(snapshot, 'b')?.name).toBe('b');
  });
});

describe('autoTrace — end-to-end subject choice', () => {
  it('draws the tree, not the input array, while a BST is built', async () => {
    const result = await run(`
      const values = [50, 30, 70, 20, 40, 60, 80, 35, 65];

      class TreeNode {
        constructor(value) { this.value = value; this.left = null; this.right = null; }
      }

      function insert(root, value) {
        if (root === null) return new TreeNode(value);
        if (value < root.value) root.left = insert(root.left, value);
        else if (value > root.value) root.right = insert(root.right, value);
        return root;
      }

      let root = null;
      for (const v of values) root = insert(root, v);
      console.log('built');
    `);

    expect(result.error).toBeUndefined();
    const kinds = result.frames.map((f) => f.view.kind);
    const trees = kinds.filter((k) => k === 'tree').length;
    const arrays = kinds.filter((k) => k === 'array').length;
    expect(trees).toBeGreaterThan(arrays);
  });
});

describe('pickSubject — staleness', () => {
  it('demotes an input array that has not moved in several frames', () => {
    const history = new Map([
      ['input', { size: 9, stale: 3 }],
      ['tree', { size: 3, stale: 0 }],
    ]);
    const tree = { value: 5, left: { value: 3, left: null, right: null }, right: null };
    expect(pickSubject({ input: [1, 2, 3, 4, 5, 6, 7, 8, 9], tree }, { history })?.name).toBe('tree');
  });

  it('does not demote a linked list just because a cursor is walking it', () => {
    const head = { val: 1, next: { val: 2, next: { val: 3, next: null } } };
    const curr = head.next!;
    const history = new Map([
      ['head', { size: 3, stale: 3 }],
      ['curr', { size: 2, stale: 0 }],
    ]);
    expect(pickSubject({ head, curr }, { lastName: 'head', history })?.name).toBe('head');
  });

  it('prefers the whole structure over the subtree a recursion is inside', () => {
    const subtree = { value: 30, left: { value: 20, left: null, right: null }, right: null };
    const root = {
      value: 50,
      left: subtree,
      right: { value: 70, left: null, right: null },
    };
    expect(pickSubject({ node: subtree, value: 40, root })?.name).toBe('root');
  });
});

describe('pickSubject — containment', () => {
  it('never picks a node that lives inside another candidate', () => {
    const leaf = { value: 20, left: null, right: null };
    const subtree = { value: 30, left: leaf, right: null };
    const root = { value: 50, left: subtree, right: { value: 70, left: null, right: null } };

    expect(pickSubject({ node: subtree, root })?.name).toBe('root');
    expect(pickSubject({ node: subtree, root }, { lastName: 'node' })?.name).toBe('root');
  });

  it('keeps a cursor out of the running so the list stays the subject', () => {
    const third = { val: 3, next: null };
    const second = { val: 2, next: third };
    const head = { val: 1, next: second };
    expect(pickSubject({ curr: second, head })?.name).toBe('head');
  });

  it('leaves disjoint structures competing on merit', () => {
    const prev = { val: 2, next: { val: 1, next: null } };
    const curr = { val: 3, next: null };
    expect(pickSubject({ curr, prev })?.name).toBe('prev');
  });

  it('does not eliminate a candidate that is merely an alias', () => {
    const shared = [1, 2, 3];
    expect(pickSubject({ arr: shared, nums: shared })?.name).toBe('arr');
  });
});

describe('autoInstrument — forward references', () => {
  it('sees a structure declared below the function that builds it', async () => {
    const result = await run(`
      class TreeNode {
        constructor(value) { this.value = value; this.left = null; this.right = null; }
      }
      function insert(node, value) {
        if (node === null) return new TreeNode(value);
        if (value < node.value) node.left = insert(node.left, value);
        else node.right = insert(node.right, value);
        return node;
      }
      let root = null;
      for (const v of [50, 30, 70, 20, 40]) root = insert(root, v);
      console.log('built');
    `);

    expect(result.error).toBeUndefined();

    const count = (node: TreeView['root']): number =>
      node ? 1 + node.children.reduce((sum, c) => sum + count(c), 0) : 0;

    const treeFrames = result.frames.filter(
      (f): f is Frame & { view: TreeView } => f.view.kind === 'tree',
    );
    expect(treeFrames.length).toBeGreaterThan(0);

    expect(Math.max(...treeFrames.map((f) => count(f.view.root)))).toBe(5);
  });

  it('still refuses to read a binding that is genuinely in its dead zone', async () => {
    const result = await run(`
      const out = [];
      for (let i = 0; i < 3; i++) {
        out.push(i);
        const later = i * 2;
        out.push(later);
      }
      console.log(out.join(','));
    `);
    expect(result.error).toBeUndefined();
    expect(result.logs[0].text).toBe('0,0,1,2,2,4');
  });
});

describe('autoTrace — recursion picture', () => {
  it('shows the call stack when recursion has no structure to draw', async () => {
    const result = await run(`
      const out = [];
      const current = [];

      function explore(nums, index) {
        if (index === nums.length) { out.push([...current]); return; }
        explore(nums, index + 1);
        current.push(nums[index]);
        explore(nums, index + 1);
        current.pop();
      }

      explore([1, 2, 3], 0);
      console.log(out.length);
    `);

    expect(result.error).toBeUndefined();
    expect(result.logs[0].text).toBe('8');

    const stackFrames = result.frames.filter((f) => f.view.kind === 'callstack');
    expect(stackFrames.length).toBeGreaterThan(0);
    expect(stackFrames.length).toBeGreaterThan(result.frames.length / 2);
  });

  it('still shows the tree when recursion walks a pointer structure', async () => {
    const result = await run(`
      class TreeNode {
        constructor(value) { this.value = value; this.left = null; this.right = null; }
      }
      function insert(node, value) {
        if (node === null) return new TreeNode(value);
        if (value < node.value) node.left = insert(node.left, value);
        else node.right = insert(node.right, value);
        return node;
      }
      let root = null;
      for (const v of [50, 30, 70, 20, 40, 60]) root = insert(root, v);
      console.log('built');
    `);

    const trees = result.frames.filter((f) => f.view.kind === 'tree').length;
    const stacks = result.frames.filter((f) => f.view.kind === 'callstack').length;
    expect(trees).toBeGreaterThan(stacks);
  });
});

describe('autoTrace — pointer promotion', () => {
  it('promotes conventionally named cursors, including one past the end', () => {
    const view = pickSubject({ arr: [1, 2, 3], i: 1, right: 3 })!;
    expect(view.name).toBe('arr');
  });

  it('does not turn an unrelated constant into a pointer', async () => {
    const result = await run(`
      const keys = ['a', 'b', 'c', 'd'];
      const initialCapacity = 4;
      for (let i = 0; i < keys.length; i++) { keys[i]; }
    `);

    const pointered = result.frames
      .filter((f) => f.view.kind === 'array')
      .flatMap((f) => (f.view as { pointers?: { name: string }[] }).pointers ?? [])
      .map((p) => p.name);

    expect(pointered).toContain('i');
    expect(pointered).not.toContain('initialCapacity');
  });

  it('shows a hand-written hash map rather than the array it was built from', async () => {
    const result = await run(`
      const keys = ['red', 'green', 'blue', 'cyan', 'magenta', 'yellow'];

      class HashMap {
        constructor(capacity) {
          this.buckets = Array.from({ length: capacity }, () => []);
          this.size = 0;
        }
        hash(key) {
          let h = 5381;
          for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
          return h % this.buckets.length;
        }
        set(key, value) {
          this.buckets[this.hash(key)].push([key, value]);
          this.size++;
        }
      }

      const map = new HashMap(8);
      keys.forEach((key, i) => map.set(key, i));
      console.log('size', map.size);
    `);

    expect(result.error).toBeUndefined();
    const kinds = result.frames.map((f) => f.view.kind);
    expect(kinds.filter((k) => k === 'hashmap').length).toBeGreaterThan(0);
  });
});
