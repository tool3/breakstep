import { describe, expect, it } from 'vitest';
import { analyzeStatic, compareComplexity, maxComplexity } from './index';
import { analyzeJs } from './staticJs';
import { analyzePython, stripPythonNoise } from './staticPy';

describe('analyzeJs — loop nesting', () => {
  it('calls straight-line code constant', () => {
    const r = analyzeJs(`const a = 1; const b = a + 2;`);
    expect(r.time).toBe('O(1)');
    expect(r.maxLoopDepth).toBe(0);
  });

  it('calls a single loop linear', () => {
    const r = analyzeJs(`for (let i = 0; i < n; i++) { total += i; }`);
    expect(r.time).toBe('O(n)');
    expect(r.maxLoopDepth).toBe(1);
  });

  it('calls two nested loops quadratic', () => {
    const r = analyzeJs(`for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) total++;`);
    expect(r.time).toBe('O(n^2)');
    expect(r.maxLoopDepth).toBe(2);
  });

  it('calls three nested loops cubic', () => {
    const r = analyzeJs(`
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++)
          for (let k = 0; k < n; k++) total++;
    `);
    expect(r.time).toBe('O(n^3)');
  });

  it('ignores loops bounded by a small literal', () => {
    const r = analyzeJs(`for (let i = 0; i < 26; i++) { counts[i] = 0; }`);
    expect(r.time).toBe('O(1)');
  });

  it('counts an iterating array method as a loop', () => {
    const r = analyzeJs(`const out = items.map((x) => x * 2);`);
    expect(r.time).toBe('O(n)');
  });

  it('composes cost across the call graph', () => {
    // A loop calling a function that loops is quadratic, even though neither
    // scope contains nested loops on its own.
    const r = analyzeJs(`
      function helper() { for (let i = 0; i < n; i++) work(); }
      for (let j = 0; j < n; j++) helper();
    `);
    expect(r.maxLoopDepth).toBe(2);
    expect(r.time).toBe('O(n^2)');
  });

  it('finds work that lives inside a function called from the top level', () => {
    const r = analyzeJs(`
      function solve(items) { let t = 0; for (const x of items) t += x; return t; }
      solve([1, 2, 3]);
    `);
    expect(r.time).toBe('O(n)');
  });

  it('falls back to the worst function when nothing is called yet', () => {
    const r = analyzeJs(`function solve(items) { for (const x of items) use(x); }`);
    expect(r.time).toBe('O(n)');
  });
});

describe('analyzeJs — logarithmic patterns', () => {
  it('detects a doubling loop', () => {
    const r = analyzeJs(`for (let i = 1; i < n; i *= 2) { work(); }`);
    expect(r.time).toBe('O(log n)');
  });

  it('detects a binary-search while loop', () => {
    const r = analyzeJs(`
      let lo = 0, hi = arr.length - 1;
      while (lo <= hi) {
        const mid = lo + Math.floor((hi - lo) / 2);
        if (arr[mid] === want) return mid;
        if (arr[mid] < want) lo = mid + 1; else hi = mid - 1;
      }
    `);
    expect(r.time).toBe('O(log n)');
  });

  it('combines a linear loop with an inner halving loop', () => {
    const r = analyzeJs(`
      for (let i = 0; i < n; i++) {
        for (let j = 1; j < n; j *= 2) { work(); }
      }
    `);
    expect(r.time).toBe('O(n log n)');
  });
});

describe('analyzeJs — recursion', () => {
  it('reports linear recursion', () => {
    const r = analyzeJs(`function countdown(n) { if (n <= 0) return 0; return 1 + countdown(n - 1); }`);
    expect(r.recursion.detected).toBe(true);
    expect(r.recursion.functions).toContain('countdown');
    expect(r.time).toBe('O(n)');
  });

  it('reports naive fibonacci as exponential', () => {
    const r = analyzeJs(`function fib(n) { if (n < 2) return n; return fib(n - 1) + fib(n - 2); }`);
    expect(r.time).toBe('O(2^n)');
  });

  it('solves merge sort as n log n', () => {
    const r = analyzeJs(`
      function mergeSort(a) {
        if (a.length <= 1) return a;
        const mid = Math.floor(a.length / 2);
        const left = mergeSort(a.slice(0, mid));
        const right = mergeSort(a.slice(mid));
        const out = [];
        let i = 0, j = 0;
        while (i < left.length && j < right.length) out.push(left[i] <= right[j] ? left[i++] : right[j++]);
        return out;
      }
    `);
    expect(r.time).toBe('O(n log n)');
  });

  it('solves binary-search recursion as logarithmic', () => {
    const r = analyzeJs(`
      function bs(arr, lo, hi, want) {
        if (lo > hi) return -1;
        const mid = Math.floor((lo + hi) / 2);
        if (arr[mid] === want) return mid;
        return arr[mid] < want ? bs(arr, mid + 1, hi, want) : bs(arr, lo, mid - 1, want);
      }
    `);
    expect(r.time).toBe('O(log n)');
  });

  it('flags recursion inside a loop as exponential', () => {
    const r = analyzeJs(`
      function permute(nums, current) {
        if (current.length === nums.length) return;
        for (let i = 0; i < nums.length; i++) { permute(nums, current.concat(nums[i])); }
      }
    `);
    expect(r.time).toBe('O(2^n)');
    expect(r.notes.join(' ')).toMatch(/recurses from inside a loop/);
  });

  it('softens an exponential verdict when memoization is visible', () => {
    const r = analyzeJs(`
      const memo = new Map();
      function fib(n) {
        if (memo.has(n)) return memo.get(n);
        if (n < 2) return n;
        const v = fib(n - 1) + fib(n - 2);
        memo.set(n, v);
        return v;
      }
    `);
    expect(r.time).toBe('O(n^2)');
    expect(r.notes.join(' ')).toMatch(/memoized/);
  });
});

describe('analyzeJs — hidden costs and space', () => {
  it('calls out sort() as n log n', () => {
    const r = analyzeJs(`const s = [...items].sort((a, b) => a - b);`);
    expect(r.time).toBe('O(n log n)');
    expect(r.notes.join(' ')).toMatch(/sort/);
  });

  it('warns about shift() re-indexing', () => {
    const r = analyzeJs(`while (queue.length) { const x = queue.shift(); use(x); }`);
    expect(r.notes.join(' ')).toMatch(/shift/);
  });

  it('reports linear space when a collection grows in a loop', () => {
    const r = analyzeJs(`const out = []; for (let i = 0; i < n; i++) out.push(i);`);
    expect(r.space).toBe('O(n)');
  });

  it('reports quadratic space for a 2-D table', () => {
    const r = analyzeJs(`const dp = Array.from({length: n}, () => new Array(m).fill(0));`);
    expect(r.space).toBe('O(n^2)');
  });

  it('charges recursion depth to space', () => {
    const r = analyzeJs(`function walk(node) { if (!node) return; walk(node.next); }`);
    expect(r.space).toBe('O(n)');
  });

  it('reports parse failures instead of throwing', () => {
    const r = analyzeJs(`function ( {`);
    expect(r.time).toBe('unknown');
    expect(r.confidence).toBe(0);
  });
});

describe('analyzePython', () => {
  it('uses indentation to find nested loops', () => {
    const r = analyzePython(`
for i in range(n):
    for j in range(n):
        total += 1
`);
    expect(r.time).toBe('O(n^2)');
    expect(r.maxLoopDepth).toBe(2);
  });

  it('counts a single loop as linear', () => {
    expect(analyzePython(`for x in items:\n    total += x`).time).toBe('O(n)');
  });

  it('ignores range() loops with a small literal bound', () => {
    expect(analyzePython(`for i in range(26):\n    counts[i] = 0`).time).toBe('O(1)');
  });

  it('counts nested comprehensions', () => {
    const r = analyzePython(`grid = [[0 for _ in range(n)] for _ in range(n)]`);
    expect(r.maxLoopDepth).toBeGreaterThanOrEqual(2);
  });

  it('detects a binary-search while loop', () => {
    const r = analyzePython(`
lo, hi = 0, len(arr) - 1
while lo <= hi:
    mid = (lo + hi) // 2
    if arr[mid] == want:
        break
    if arr[mid] < want:
        lo = mid + 1
    else:
        hi = mid - 1
`);
    expect(r.time).toBe('O(log n)');
  });

  it('detects exponential recursion', () => {
    const r = analyzePython(`
def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)
`);
    expect(r.time).toBe('O(2^n)');
    expect(r.recursion.functions).toContain('fib');
  });

  it('detects linear recursion', () => {
    const r = analyzePython(`
def walk(node):
    if node is None:
        return
    walk(node.next)
`);
    expect(r.time).toBe('O(n)');
  });

  it('respects an lru_cache decorator', () => {
    const r = analyzePython(`
@functools.lru_cache
def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)
`);
    expect(r.time).toBe('O(n^2)');
    expect(r.notes.join(' ')).toMatch(/memoized/);
  });

  it('flags sorted() as n log n', () => {
    const r = analyzePython(`out = sorted(items)`);
    expect(r.time).toBe('O(n log n)');
  });

  it('reports 2-D table allocation as quadratic space', () => {
    const r = analyzePython(`dp = [[0] * m for _ in range(n)]`);
    expect(r.space).toBe('O(n^2)');
  });

  it('does not count keywords that appear inside strings or comments', () => {
    const r = analyzePython(`
# for i in range(n):
message = "for x in items"
value = 1
`);
    expect(r.time).toBe('O(1)');
  });

  it('handles an empty program', () => {
    expect(analyzePython('   \n\n').time).toBe('O(1)');
  });

  it('finds work inside a function called from the top level', () => {
    const r = analyzePython(`
def solve(items):
    total = 0
    for x in items:
        total += x
    return total

solve([1, 2, 3])
`);
    expect(r.time).toBe('O(n)');
  });

  it('composes cost across the call graph', () => {
    const r = analyzePython(`
def helper(items):
    for x in items:
        work(x)

def main(items):
    for y in items:
        helper(items)

main(data)
`);
    expect(r.time).toBe('O(n^2)');
  });

  it('treats mutually exclusive return-recursion as a single branch', () => {
    const r = analyzePython(`
def bs(arr, lo, hi, want):
    if lo > hi:
        return -1
    mid = (lo + hi) // 2
    if arr[mid] == want:
        return mid
    if arr[mid] < want:
        return bs(arr, mid + 1, hi, want)
    return bs(arr, lo, mid - 1, want)
`);
    expect(r.time).toBe('O(log n)');
  });

  it('solves merge sort as n log n', () => {
    const r = analyzePython(`
def merge_sort(a):
    if len(a) <= 1:
        return a
    mid = len(a) // 2
    left = merge_sort(a[:mid])
    right = merge_sort(a[mid:])
    out = []
    i = j = 0
    while i < len(left) and j < len(right):
        out.append(left[i])
        i += 1
    return out
`);
    expect(r.time).toBe('O(n log n)');
  });

  it('flags backtracking that recurses inside a loop', () => {
    const r = analyzePython(`
def permute(nums, current, out):
    if len(current) == len(nums):
        out.append(list(current))
        return
    for i in range(len(nums)):
        current.append(nums[i])
        permute(nums, current, out)
        current.pop()
`);
    expect(r.time).toBe('O(2^n)');
  });
});

describe('stripPythonNoise', () => {
  it('blanks comments and string bodies but preserves line count', () => {
    const src = `a = "for x in y"  # for z in w\nb = 2`;
    const out = stripPythonNoise(src);
    expect(out.split('\n')).toHaveLength(2);
    expect(out).not.toContain('for x in y');
    expect(out).not.toContain('for z in w');
  });
});

describe('analyzeStatic dispatch', () => {
  it('strips TypeScript types before analyzing', () => {
    const r = analyzeStatic(
      `function f(items: number[]): number {\n  let t: number = 0;\n  for (const x of items) t += x;\n  return t;\n}`,
      'typescript',
    );
    expect(r.time).toBe('O(n)');
  });

  it('reports TypeScript syntax errors', () => {
    const r = analyzeStatic(`const x: = ;`, 'typescript');
    expect(r.time).toBe('unknown');
  });

  it('routes python source to the python analyzer', () => {
    const r = analyzeStatic(`for i in range(n):\n    for j in range(n):\n        pass`, 'python');
    expect(r.time).toBe('O(n^2)');
  });
});

describe('complexity ordering helpers', () => {
  it('orders classes by growth', () => {
    expect(compareComplexity('O(n)', 'O(n^2)')).toBeLessThan(0);
    expect(compareComplexity('O(n log n)', 'O(n)')).toBeGreaterThan(0);
  });

  it('takes the larger of two classes, ignoring unknown', () => {
    expect(maxComplexity('O(n)', 'O(n^2)')).toBe('O(n^2)');
    expect(maxComplexity('unknown', 'O(n)')).toBe('O(n)');
  });
});
