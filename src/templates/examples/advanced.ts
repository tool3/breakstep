import type { Template } from '@/types';

export const backtracking: Template = {
  id: 'example-backtracking',
  title: 'Recursion & Backtracking',
  category: 'Worked examples',
  blurb: 'Watch the call stack grow and unwind while enumerating subsets.',
  tags: ['recursion', 'backtracking', 'exponential', 'call-stack'],
  expected: { time: 'O(2^n)', space: 'O(n)' },
  params: [
    { name: 'n', label: 'Set size', type: 'number', default: 4, min: 1, max: 12, help: '2ⁿ subsets — 12 already means 4096.' },
    {
      name: 'mode',
      label: 'Enumerate',
      type: 'select',
      default: 'subsets',
      options: [
        { label: 'Subsets — 2ⁿ', value: 'subsets' },
        { label: 'Permutations — n!', value: 'permutations' },
      ],
    },
  ],
  code: {
    typescript: `// Backtracking - choose, explore, un-choose.
//
// The shape of the recursion tree IS the complexity. Subsets branch twice per
// element (in or out) -> 2^n leaves. Permutations branch over every unused
// element -> n! leaves. The call stack stays only n deep either way, which is
// why the space cost is linear while the time cost explodes.

const n = 4;
const mode = 'subsets';

const items = Array.from({ length: n }, (_, i) => i + 1);

function subsets(nums: number[]): number[][] {
  const out: number[][] = [];
  const current: number[] = [];

  const explore = (index: number) => {
    if (index === nums.length) {
      out.push([...current]);
      return;
    }

    // Choice 1: leave nums[index] out.
    explore(index + 1);

    // Choice 2: take it - then undo, which is the "backtrack".
    current.push(nums[index]);
    explore(index + 1);
    current.pop();
  };

  explore(0);
  return out;
}

function permutations(nums: number[]): number[][] {
  const out: number[][] = [];
  const current: number[] = [];
  const used = nums.map(() => false);

  const explore = () => {
    if (current.length === nums.length) {
      out.push([...current]);
      return;
    }

    for (let i = 0; i < nums.length; i++) {
      if (used[i]) continue;

      used[i] = true;
      current.push(nums[i]);
      explore();
      current.pop();
      used[i] = false;
    }
  };

  explore();
  return out;
}

const results = mode === 'permutations' ? permutations(items) : subsets(items);

console.log(results.length, mode, 'of', items.join(', '));
console.log(results.slice(0, 12).map((r) => '[' + r.join(',') + ']').join('  '));
`,
    python: `# Backtracking - choose, explore, un-choose.
#
# The shape of the recursion tree IS the complexity. Subsets branch twice per
# element (in or out) -> 2^n leaves. Permutations branch over every unused
# element -> n! leaves. The call stack stays only n deep either way, which is
# why the space cost is linear while the time cost explodes.

n = 4
mode = 'subsets'

items = list(range(1, n + 1))


def subsets(nums):
    out = []
    current = []

    def explore(index):
        if index == len(nums):
            out.append(list(current))
            return

        # Choice 1: leave nums[index] out.
        explore(index + 1)

        # Choice 2: take it - then undo, which is the "backtrack".
        current.append(nums[index])
        explore(index + 1)
        current.pop()

    explore(0)
    return out


def permutations(nums):
    out = []
    current = []
    used = [False] * len(nums)

    def explore():
        if len(current) == len(nums):
            out.append(list(current))
            return

        for i in range(len(nums)):
            if used[i]:
                continue

            used[i] = True
            current.append(nums[i])
            explore()
            current.pop()
            used[i] = False

    explore()
    return out


results = permutations(items) if mode == "permutations" else subsets(items)

print(len(results), mode, "of", items)
print("  ".join(str(r) for r in results[:12]))
`,
  },
  bench: {
    typescript: `breakstep.bench({
  input: (size) => Array.from({ length: size }, (_, i) => i),
  run: (arr) => (mode === 'permutations' ? permutations(arr as number[]) : subsets(arr as number[])),
  // Exponential growth: n is the SET SIZE here, not an array length.
  sizes: mode === 'permutations' ? [2, 3, 4, 5, 6, 7, 8] : [2, 4, 6, 8, 10, 12, 14, 16],
});
`,
    python: `breakstep.bench(
    input=lambda size: list(range(size)),
    run=lambda arr: permutations(arr) if mode == "permutations" else subsets(arr),
    # Exponential growth: n is the SET SIZE here, not a list length.
    sizes=[2, 3, 4, 5, 6, 7] if mode == "permutations" else [2, 4, 6, 8, 10, 12],
)
`,
  },
  instrumented: {
    typescript: `// Backtracking — choose, explore, un-choose.
//
// The shape of the recursion tree IS the complexity. Subsets branch twice per
// element (in or out) → 2ⁿ leaves. Permutations branch over every unused
// element → n! leaves. The call stack stays only n deep either way, which is
// why the space cost is linear while the time cost explodes.

const n = breakstep.param<number>('n', 4);
const mode = breakstep.param<string>('mode', 'subsets');
const items = Array.from({ length: n }, (_, i) => i + 1);

function subsets(nums: number[]): number[][] {
  const out: number[][] = [];
  const current: number[] = [];
  const stack: { label: string; depth: number }[] = [];

  const explore = (index: number) => {
    stack.push({ label: \`explore(i=\${index}) [\${current.join(',')}]\`, depth: stack.length });
    breakstep.show(stack, {
      as: 'callstack',
      label: \`depth \${stack.length}\`,
      highlight: { [stack.length - 1]: 'active' },
      meta: { current: \`[\${current.join(',')}]\`, found: out.length },
    });

    if (index === nums.length) {
      out.push([...current]);
    } else {
      // Choice 1: leave nums[index] out.
      explore(index + 1);

      // Choice 2: take it — then undo, which is the "backtrack".
      current.push(nums[index]);
      explore(index + 1);
      current.pop();
    }

    stack.pop();
  };

  explore(0);
  return out;
}

function permutations(nums: number[]): number[][] {
  const out: number[][] = [];
  const current: number[] = [];
  const used = nums.map(() => false);
  const stack: { label: string; depth: number }[] = [];

  const explore = () => {
    stack.push({ label: \`perm [\${current.join(',')}]\`, depth: stack.length });
    breakstep.show(stack, {
      as: 'callstack',
      label: \`depth \${stack.length}\`,
      highlight: { [stack.length - 1]: 'active' },
      meta: { current: \`[\${current.join(',')}]\`, found: out.length },
    });

    if (current.length === nums.length) {
      out.push([...current]);
    } else {
      for (let i = 0; i < nums.length; i++) {
        if (used[i]) continue;
        used[i] = true;
        current.push(nums[i]);
        explore();
        current.pop();
        used[i] = false;
      }
    }

    stack.pop();
  };

  explore();
  return out;
}

const results = mode === 'permutations' ? permutations(items) : subsets(items);

breakstep.show([], { as: 'callstack', label: 'Stack unwound — done' });
breakstep.log(\`\${results.length} \${mode} of [\${items.join(', ')}]\`);
breakstep.log(results.slice(0, 20).map((r) => \`[\${r.join(',')}]\`).join('  '));
if (results.length > 20) breakstep.log(\`… and \${results.length - 20} more\`);
breakstep.log(mode === 'permutations' ? \`n! = \${results.length}\` : \`2^n = \${results.length}\`);

breakstep.bench({
  input: (size) => Array.from({ length: size }, (_, i) => i),
  run: (arr) => (mode === 'permutations' ? permutations(arr as number[]) : subsets(arr as number[])),
  // Exponential growth: n is the SET SIZE here, not an array length.
  sizes: mode === 'permutations' ? [2, 3, 4, 5, 6, 7, 8] : [2, 4, 6, 8, 10, 12, 14, 16],
});
`,
    python: `# Backtracking - choose, explore, un-choose.
#
# The shape of the recursion tree IS the complexity. Subsets branch twice per
# element (in or out) -> 2^n leaves. Permutations branch over every unused
# element -> n! leaves. The call stack stays only n deep either way, which is
# why the space cost is linear while the time cost explodes.

n = breakstep.param('n', 4)
mode = breakstep.param('mode', 'subsets')
items = list(range(1, n + 1))


def subsets(nums):
    out = []
    current = []
    stack = []

    def explore(index):
        stack.append({"label": f"explore(i={index}) {current}", "depth": len(stack)})
        breakstep.show(stack, kind="callstack", label=f"depth {len(stack)}",
                 highlight={len(stack) - 1: "active"},
                 meta={"current": str(current), "found": len(out)})

        if index == len(nums):
            out.append(list(current))
        else:
            # Choice 1: leave nums[index] out.
            explore(index + 1)

            # Choice 2: take it - then undo, which is the "backtrack".
            current.append(nums[index])
            explore(index + 1)
            current.pop()

        stack.pop()

    explore(0)
    return out


def permutations(nums):
    out = []
    current = []
    used = [False] * len(nums)
    stack = []

    def explore():
        stack.append({"label": f"perm {current}", "depth": len(stack)})
        breakstep.show(stack, kind="callstack", label=f"depth {len(stack)}",
                 highlight={len(stack) - 1: "active"},
                 meta={"current": str(current), "found": len(out)})

        if len(current) == len(nums):
            out.append(list(current))
        else:
            for i in range(len(nums)):
                if used[i]:
                    continue
                used[i] = True
                current.append(nums[i])
                explore()
                current.pop()
                used[i] = False

        stack.pop()

    explore()
    return out


results = permutations(items) if mode == "permutations" else subsets(items)

breakstep.show([], kind="callstack", label="Stack unwound - done")
print(f"{len(results)} {mode} of {items}")
print("  ".join(str(r) for r in results[:20]))
if len(results) > 20:
    print(f"... and {len(results) - 20} more")
print(f"n! = {len(results)}" if mode == "permutations" else f"2^n = {len(results)}")

breakstep.bench(
    input=lambda size: list(range(size)),
    run=lambda arr: permutations(arr) if mode == "permutations" else subsets(arr),
    # Exponential growth: n is the SET SIZE here, not a list length.
    sizes=[2, 3, 4, 5, 6, 7] if mode == "permutations" else [2, 4, 6, 8, 10, 12],
)
`,
  },
};

export const dynamicProgramming: Template = {
  id: 'example-dp',
  title: 'Dynamic Programming — LCS',
  category: 'Worked examples',
  blurb: 'Fill a table once instead of re-deriving the same subproblem forever.',
  tags: ['dp', 'matrix', 'memoization'],
  expected: { time: 'O(n^2)', space: 'O(n^2)' },
  params: [
    { name: 'a', label: 'String A', type: 'string', default: 'ABCBDAB' },
    { name: 'b', label: 'String B', type: 'string', default: 'BDCABA' },
  ],
  code: {
    typescript: `// Longest Common Subsequence via a DP table.
//
// The naive recursion re-solves the same (i, j) pair an exponential number of
// times. The table computes each pair exactly once, so the cost collapses
// from O(2^(n+m)) to O(n x m) - one cell per pair, filled bottom-up.
//
//   dp[i][j] = length of the LCS of a[0..i) and b[0..j)

const a = 'ABCBDAB';
const b = 'BDCABA';

function lcs(s1: string, s2: string): { length: number; sequence: string } {
  const n = s1.length;
  const m = s2.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = s1[i - 1] === s2[j - 1]
        ? dp[i - 1][j - 1] + 1                  // match: extend the diagonal
        : Math.max(dp[i - 1][j], dp[i][j - 1]); // else inherit the better neighbour
    }
  }

  // Walk backwards through the table to recover the actual subsequence.
  let i = n;
  let j = m;
  const chars: string[] = [];

  while (i > 0 && j > 0) {
    if (s1[i - 1] === s2[j - 1]) {
      chars.push(s1[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return { length: dp[n][m], sequence: chars.reverse().join('') };
}

const { length, sequence } = lcs(a, b);
console.log('LCS:', sequence, '(length ' + length + ')');
console.log('table cells filled:', (a.length + 1) * (b.length + 1));
`,
    python: `# Longest Common Subsequence via a DP table.
#
# The naive recursion re-solves the same (i, j) pair an exponential number of
# times. The table computes each pair exactly once, so the cost collapses
# from O(2^(n+m)) to O(n x m) - one cell per pair, filled bottom-up.
#
#   dp[i][j] = length of the LCS of a[0..i) and b[0..j)

a = 'ABCBDAB'
b = 'BDCABA'


def lcs(s1, s2):
    n, m = len(s1), len(s2)
    dp = [[0] * (m + 1) for _ in range(n + 1)]

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if s1[i - 1] == s2[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1          # match: extend diagonal
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])  # inherit the better

    # Walk backwards through the table to recover the actual subsequence.
    i, j = n, m
    chars = []

    while i > 0 and j > 0:
        if s1[i - 1] == s2[j - 1]:
            chars.append(s1[i - 1])
            i -= 1
            j -= 1
        elif dp[i - 1][j] >= dp[i][j - 1]:
            i -= 1
        else:
            j -= 1

    return dp[n][m], "".join(reversed(chars))


length, sequence = lcs(a, b)
print("LCS:", sequence, "(length " + str(length) + ")")
print("table cells filled:", (len(a) + 1) * (len(b) + 1))
`,
  },
  bench: {
    typescript: `breakstep.bench({
  input: (n) => {
    const alphabet = 'ABCD';
    const make = (seed: number) =>
      breakstep.randomInts(n, alphabet.length, seed).map((v) => alphabet[v]).join('');
    return [make(1), make(2)] as [string, string];
  },
  run: (pair) => {
    const [x, y] = pair as [string, string];
    return lcs(x, y);
  },
  sizes: [8, 16, 32, 64, 128, 256],
});
`,
    python: `def _make_pair(n):
    alphabet = "ABCD"

    def make(seed):
        return "".join(alphabet[v] for v in breakstep.random_ints(n, len(alphabet), seed))

    return (make(1), make(2))


breakstep.bench(input=_make_pair, run=lambda pair: lcs(pair[0], pair[1]), sizes=[8, 16, 32, 64, 128])
`,
  },
  instrumented: {
    typescript: `// Longest Common Subsequence via a DP table.
//
// The naive recursion re-solves the same (i, j) pair an exponential number of
// times. The table computes each pair exactly once, so the cost collapses from
// O(2^(n+m)) to O(n × m) — one cell per pair, filled bottom-up.
//
//   dp[i][j] = length of the LCS of a[0..i) and b[0..j)

const a = breakstep.param<string>('a', 'ABCBDAB');
const b = breakstep.param<string>('b', 'BDCABA');

function lcs(s1: string, s2: string): { length: number; sequence: string } {
  const n = s1.length;
  const m = s2.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] =
        s1[i - 1] === s2[j - 1]
          ? dp[i - 1][j - 1] + 1        // characters match: extend the diagonal
          : Math.max(dp[i - 1][j], dp[i][j - 1]); // else inherit the better neighbour

      breakstep.show(dp, {
        label: \`dp[\${i}][\${j}] — '\${s1[i - 1]}' vs '\${s2[j - 1]}' → \${dp[i][j]}\`,
        highlight: {
          [\`\${i},\${j}\`]: s1[i - 1] === s2[j - 1] ? 'match' : 'active',
          [\`\${i - 1},\${j - 1}\`]: 'compare',
          [\`\${i - 1},\${j}\`]: 'compare',
          [\`\${i},\${j - 1}\`]: 'compare',
        },
        meta: { i, j, chars: \`\${s1[i - 1]} / \${s2[j - 1]}\`, best: dp[i][j] },
      });
    }
  }

  // Walk backwards through the table to recover the actual subsequence.
  let i = n;
  let j = m;
  const chars: string[] = [];
  const path: Record<string, 'match'> = {};

  while (i > 0 && j > 0) {
    if (s1[i - 1] === s2[j - 1]) {
      chars.push(s1[i - 1]);
      path[\`\${i},\${j}\`] = 'match';
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  breakstep.show(dp, { label: 'Traceback through the table', highlight: path });
  return { length: dp[n][m], sequence: chars.reverse().join('') };
}

const { length, sequence } = lcs(a, b);
breakstep.log(\`LCS("\${a}", "\${b}") = "\${sequence}" (length \${length})\`);
breakstep.log('table cells filled:', (a.length + 1) * (b.length + 1));

breakstep.bench({
  input: (n) => {
    const alphabet = 'ABCD';
    const make = (seed: number) =>
      breakstep.randomInts(n, alphabet.length, seed).map((v) => alphabet[v]).join('');
    return [make(1), make(2)] as [string, string];
  },
  run: (pair) => {
    const [x, y] = pair as [string, string];
    return lcs(x, y);
  },
  sizes: [8, 16, 32, 64, 128, 256],
});
`,
    python: `# Longest Common Subsequence via a DP table.
#
# The naive recursion re-solves the same (i, j) pair an exponential number of
# times. The table computes each pair exactly once, so the cost collapses from
# O(2^(n+m)) to O(n x m) - one cell per pair, filled bottom-up.
#
#   dp[i][j] = length of the LCS of a[0..i) and b[0..j)

a = breakstep.param('a', 'ABCBDAB')
b = breakstep.param('b', 'BDCABA')


def lcs(s1, s2):
    n, m = len(s1), len(s2)
    dp = [[0] * (m + 1) for _ in range(n + 1)]

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if s1[i - 1] == s2[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1        # match: extend the diagonal
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])  # inherit the better neighbour

            breakstep.show(
                dp,
                label=f"dp[{i}][{j}] - '{s1[i - 1]}' vs '{s2[j - 1]}' -> {dp[i][j]}",
                highlight={
                    f"{i},{j}": "match" if s1[i - 1] == s2[j - 1] else "active",
                    f"{i - 1},{j - 1}": "compare",
                    f"{i - 1},{j}": "compare",
                    f"{i},{j - 1}": "compare",
                },
                meta={"i": i, "j": j, "chars": f"{s1[i - 1]} / {s2[j - 1]}", "best": dp[i][j]},
            )

    # Walk backwards through the table to recover the actual subsequence.
    i, j = n, m
    chars = []
    path = {}

    while i > 0 and j > 0:
        if s1[i - 1] == s2[j - 1]:
            chars.append(s1[i - 1])
            path[f"{i},{j}"] = "match"
            i -= 1
            j -= 1
        elif dp[i - 1][j] >= dp[i][j - 1]:
            i -= 1
        else:
            j -= 1

    breakstep.show(dp, label="Traceback through the table", highlight=path)
    return dp[n][m], "".join(reversed(chars))


length, sequence = lcs(a, b)
print(f'LCS("{a}", "{b}") = "{sequence}" (length {length})')
print("table cells filled:", (len(a) + 1) * (len(b) + 1))


def make_pair(n):
    alphabet = "ABCD"
    def make(seed):
        return "".join(alphabet[v] for v in breakstep.random_ints(n, len(alphabet), seed))
    return (make(1), make(2))


breakstep.bench(
    input=make_pair,
    run=lambda pair: lcs(pair[0], pair[1]),
    sizes=[8, 16, 32, 64, 128],
)
`,
  },
};

export const blank: Template = {
  id: 'blank',
  title: 'Blank Canvas',
  category: 'Scratch',
  blurb: 'An empty file with the Breakstep API cheat-sheet. Bring your own algorithm.',
  tags: ['scratch'],
  params: [
    { name: 'n', label: 'n', type: 'number', default: 10, min: 1, max: 1000 },
  ],
  code: {
    typescript: `// Blank canvas. Write ordinary code - Breakstep traces it and draws whatever data
// structures it finds, with no API calls of your own.
//
// Declare inputs as top-level constants and the Parameters panel edits them
// in place. For full manual control, switch the editor to Instrumented mode.

const n = 10;

function solve(size: number): number {
  const seen: number[] = [];
  let total = 0;

  for (let i = 0; i < size; i++) {
    seen.push(i);
    total += i;
  }

  return total;
}

console.log('sum 0..n-1 =', solve(n));
`,
    python: `# Blank canvas. Write ordinary code - Breakstep traces it and draws whatever data
# structures it finds, with no API calls of your own.
#
# Declare inputs as top-level constants and the Parameters panel edits them
# in place. For full manual control, switch the editor to Instrumented mode.

n = 10


def solve(size):
    seen = []
    total = 0

    for i in range(size):
        seen.append(i)
        total += i

    return total


print("sum 0..n-1 =", solve(n))
`,
  },
  bench: {
    typescript: `breakstep.bench({
  input: (size) => size,
  run: (size) => solve(size as number),
});
`,
    python: `breakstep.bench(input=lambda size: size, run=solve)
`,
  },
  instrumented: {
    typescript: `// Blank canvas. Everything below is optional — delete what you don't need.
//
//   breakstep.show(value, options)   capture a frame; shape is auto-detected
//   breakstep.log(...args)           write to the Output panel (console.log works too)
//   breakstep.label('text')          name the next frame
//   breakstep.param('name', default) read a value from the Parameters panel
//   breakstep.randomInts(n, max)     deterministic pseudo-random ints
//   breakstep.bench({ input, run })  register the harness the Analyze tab measures
//
// show() options: { label, as, highlight, pointers, meta, heapType, directed }
//   as: 'array' | 'stack' | 'queue' | 'matrix' | 'linkedList' | 'tree'
//     | 'trie' | 'graph' | 'heap' | 'hashmap' | 'callstack'
//   highlight: an array of indices, or { index: 'active' | 'compare'
//     | 'visited' | 'match' | 'sorted' | 'muted' | 'error' }

const n = breakstep.param<number>('n', 10);

function solve(size: number): number {
  let total = 0;
  for (let i = 0; i < size; i++) {
    total += i;
    breakstep.show(Array.from({ length: size }, (_, k) => (k <= i ? k : 0)), {
      label: \`i = \${i}, total = \${total}\`,
      highlight: { [i]: 'active' },
      meta: { total },
    });
  }
  return total;
}

breakstep.log('sum 0..n-1 =', solve(n));

breakstep.bench({
  input: (size) => size,
  run: (size) => solve(size as number),
});
`,
    python: `# Blank canvas. Everything below is optional - delete what you don't need.
#
#   breakstep.show(value, **options)  capture a frame; shape is auto-detected
#   breakstep.log(*args)              write to the Output panel (print() works too)
#   breakstep.label('text')           name the next frame
#   breakstep.param('name', default)  read a value from the Parameters panel
#   breakstep.random_ints(n, max)     deterministic pseudo-random ints
#   breakstep.bench(input=, run=)     register the harness the Analyze tab measures
#
# show() options: label, kind, highlight, pointers, meta, heapType, directed
#   kind: 'array' | 'stack' | 'queue' | 'matrix' | 'linkedList' | 'tree'
#       | 'trie' | 'graph' | 'heap' | 'hashmap' | 'callstack'
#   highlight: a list of indices, or {index: 'active' | 'compare'
#       | 'visited' | 'match' | 'sorted' | 'muted' | 'error'}

n = breakstep.param('n', 10)


def solve(size):
    total = 0
    for i in range(size):
        total += i
        breakstep.show([k if k <= i else 0 for k in range(size)],
                 label=f"i = {i}, total = {total}",
                 highlight={i: "active"},
                 meta={"total": total})
    return total


print("sum 0..n-1 =", solve(n))

breakstep.bench(input=lambda size: size, run=solve)
`,
  },
};
