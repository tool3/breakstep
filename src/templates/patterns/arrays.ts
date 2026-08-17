import type { Template } from '@/types';

export const twoPointers: Template = {
  id: 'two-pointers',
  title: 'Two Pointers — Two Sum II',
  category: 'Patterns',
  blurb: 'Converge from both ends of a sorted array and drop a whole row per step.',
  tags: ['two-pointers', 'array', 'sorted', 'linear'],
  expected: { time: 'O(n)', space: 'O(1)' },
  params: [
    {
      name: 'nums',
      label: 'Sorted array',
      type: 'numberArray',
      default: [2, 4, 7, 11, 15, 19, 24, 30],
      help: 'Must be sorted ascending — the invariant depends on it.',
    },
    { name: 'target', label: 'Target sum', type: 'number', default: 26, min: -1000, max: 1000 },
  ],
  code: {
    typescript: `// PATTERN: two pointers  ·  PROBLEM: Two Sum II (sorted input)
//
// Find two numbers in a SORTED array that add to a target.
//
// The brute force compares every pair: O(n²). The insight is that sorting
// makes one comparison decisive. If nums[lo] + nums[hi] is too small, then
// nums[lo] paired with ANY smaller index is also too small — so lo can never
// be part of the answer and moves right. Each step eliminates an entire row of
// the comparison matrix, which is why n comparisons suffice instead of n².
//
// The pattern generalises: any time a sorted order lets one comparison rule out
// a whole region, two converging pointers will beat the nested loop.

const nums = [2, 4, 7, 11, 15, 19, 24, 30];
const target = 26;

function twoSumSorted(arr: number[], want: number): [number, number] | null {
  let lo = 0;
  let hi = arr.length - 1;

  while (lo < hi) {
    const sum = arr[lo] + arr[hi];

    if (sum === want) return [lo, hi];
    if (sum < want) lo++;  // need more: only a bigger left value can help
    else hi--;             // need less: only a smaller right value can help
  }

  return null;
}

/** The same pattern, different question: remove duplicates from a sorted array. */
function dedupeSorted(arr: number[]): number[] {
  if (arr.length === 0) return [];

  let write = 0;
  for (let read = 1; read < arr.length; read++) {
    if (arr[read] !== arr[write]) {
      write++;
      arr[write] = arr[read];
    }
  }

  return arr.slice(0, write + 1);
}

const found = twoSumSorted(nums, target);
console.log('indices ->', found);
if (found) console.log('values  ->', nums[found[0]], '+', nums[found[1]], '=', target);

console.log('no pair for 1000 ->', twoSumSorted(nums, 1000));
console.log('dedupe [1,1,2,3,3] ->', dedupeSorted([1, 1, 2, 3, 3]).join(', '));
`,
    python: `# PATTERN: two pointers  ·  PROBLEM: Two Sum II (sorted input)
#
# Find two numbers in a SORTED list that add to a target.
#
# The brute force compares every pair: O(n^2). The insight is that sorting
# makes one comparison decisive. If nums[lo] + nums[hi] is too small, then
# nums[lo] paired with ANY smaller index is also too small - so lo can never
# be part of the answer and moves right. Each step eliminates an entire row of
# the comparison matrix, which is why n comparisons suffice instead of n^2.
#
# The pattern generalises: any time a sorted order lets one comparison rule out
# a whole region, two converging pointers will beat the nested loop.

nums = [2, 4, 7, 11, 15, 19, 24, 30]
target = 26


def two_sum_sorted(arr, want):
    lo, hi = 0, len(arr) - 1

    while lo < hi:
        total = arr[lo] + arr[hi]

        if total == want:
            return (lo, hi)
        if total < want:
            lo += 1   # need more: only a bigger left value can help
        else:
            hi -= 1   # need less: only a smaller right value can help

    return None


def dedupe_sorted(arr):
    """The same pattern, different question: remove duplicates in place."""
    if not arr:
        return []

    write = 0
    for read in range(1, len(arr)):
        if arr[read] != arr[write]:
            write += 1
            arr[write] = arr[read]

    return arr[:write + 1]


found = two_sum_sorted(nums, target)
print("indices ->", found)
if found:
    print("values  ->", nums[found[0]], "+", nums[found[1]], "=", target)

print("no pair for 1000 ->", two_sum_sorted(nums, 1000))
print("dedupe [1,1,2,3,3] ->", ", ".join(str(v) for v in dedupe_sorted([1, 1, 2, 3, 3])))
`,
  },
  bench: {
    typescript: `breakstep.bench({
  input: (n) => Array.from({ length: n }, (_, i) => i * 2),
  run: (arr: number[]) => twoSumSorted(arr, -1), // never found = full sweep
});
`,
    python: `breakstep.bench(
    input=lambda n: [i * 2 for i in range(n)],
    run=lambda arr: two_sum_sorted(arr, -1),  # never found = full sweep
)
`,
  },
  instrumented: {
    typescript: `// Two pointers — the same solution, drawn explicitly.

const nums = breakstep.param<number[]>('nums', [2, 4, 7, 11, 15]);
const target = breakstep.param<number>('target', 26);

function twoSumSorted(arr: number[], want: number): [number, number] | null {
  let lo = 0;
  let hi = arr.length - 1;

  while (lo < hi) {
    const sum = arr[lo] + arr[hi];

    breakstep.show(arr, {
      label: \`\${arr[lo]} + \${arr[hi]} = \${sum}\`,
      pointers: { lo, hi },
      highlight: { [lo]: 'active', [hi]: 'active' },
      meta: { sum, target: want, need: want - sum },
    });

    if (sum === want) {
      breakstep.show(arr, {
        label: 'Found the pair',
        highlight: { [lo]: 'match', [hi]: 'match' },
        pointers: { lo, hi },
      });
      return [lo, hi];
    }

    if (sum < want) lo++;
    else hi--;
  }

  breakstep.show(arr, { label: 'No pair sums to the target' });
  return null;
}

const found = twoSumSorted(nums, target);
breakstep.log('indices ->', found);

breakstep.bench({
  input: (n) => Array.from({ length: n }, (_, i) => i * 2),
  run: (arr: number[]) => twoSumSorted(arr, -1),
});
`,
    python: `# Two pointers - the same solution, drawn explicitly.

nums = breakstep.param('nums', [2, 4, 7, 11, 15])
target = breakstep.param('target', 26)


def two_sum_sorted(arr, want):
    lo, hi = 0, len(arr) - 1

    while lo < hi:
        total = arr[lo] + arr[hi]

        breakstep.show(arr, label=f"{arr[lo]} + {arr[hi]} = {total}",
                 pointers={"lo": lo, "hi": hi},
                 highlight={lo: "active", hi: "active"},
                 meta={"sum": total, "target": want, "need": want - total})

        if total == want:
            breakstep.show(arr, label="Found the pair",
                     highlight={lo: "match", hi: "match"},
                     pointers={"lo": lo, "hi": hi})
            return (lo, hi)

        if total < want:
            lo += 1
        else:
            hi -= 1

    breakstep.show(arr, label="No pair sums to the target")
    return None


found = two_sum_sorted(nums, target)
breakstep.log("indices ->", found)

breakstep.bench(
    input=lambda n: [i * 2 for i in range(n)],
    run=lambda arr: two_sum_sorted(arr, -1),
)
`,
  },
};

export const slidingWindow: Template = {
  id: 'sliding-window',
  title: 'Sliding Window — Longest Unique Substring',
  category: 'Patterns',
  blurb: 'Both ends only move right, so a nested-looking loop is really linear.',
  tags: ['sliding-window', 'string', 'hashmap', 'amortized'],
  expected: { time: 'O(n)', space: 'O(1)' },
  params: [{ name: 'text', label: 'Input string', type: 'string', default: 'abcabcbbxyzzyx' }],
  code: {
    typescript: `// PATTERN: sliding window  ·  PROBLEM: longest substring without repeats
//
// A window [left, right] slides along the input. \`right\` always advances;
// \`left\` advances only when the window becomes invalid. Neither ever moves
// backwards, so across the whole run each index is touched at most twice —
// amortised O(n), even though the code looks like it could be quadratic.
//
// The two questions that define any sliding-window problem:
//   1. What makes the window INVALID?   (here: a repeated character)
//   2. How does shrinking restore it?   (here: jump left past the last copy)
//
// Answer those and the loop writes itself.

const text = 'abcabcbbxyzzyx';

function longestUnique(s: string): { length: number; start: number } {
  const lastSeen = new Map<string, number>();
  let left = 0;
  let best = 0;
  let bestStart = 0;

  for (let right = 0; right < s.length; right++) {
    const seenAt = lastSeen.get(s[right]);

    // Only ever jump forward — left must never walk backwards.
    if (seenAt !== undefined && seenAt >= left) left = seenAt + 1;
    lastSeen.set(s[right], right);

    const width = right - left + 1;
    if (width > best) {
      best = width;
      bestStart = left;
    }
  }

  return { length: best, start: bestStart };
}

/** Fixed-size window: the other half of the pattern. */
function maxSum(nums: number[], k: number): number {
  if (nums.length < k) return 0;

  let window = 0;
  for (let i = 0; i < k; i++) window += nums[i];

  let best = window;
  for (let right = k; right < nums.length; right++) {
    // Slide by one: add the entering element, drop the leaving one.
    window += nums[right] - nums[right - k];
    if (window > best) best = window;
  }

  return best;
}

const { length: width, start } = longestUnique(text);
console.log('longest unique ->', text.slice(start, start + width), '(length', width + ')');
console.log('starts at index ->', start);
console.log('max sum of any 3 in [1,9,2,8,3] ->', maxSum([1, 9, 2, 8, 3], 3));
`,
    python: `# PATTERN: sliding window  ·  PROBLEM: longest substring without repeats
#
# A window [left, right] slides along the input. \`right\` always advances;
# \`left\` advances only when the window becomes invalid. Neither ever moves
# backwards, so across the whole run each index is touched at most twice -
# amortised O(n), even though the code looks like it could be quadratic.
#
# The two questions that define any sliding-window problem:
#   1. What makes the window INVALID?   (here: a repeated character)
#   2. How does shrinking restore it?   (here: jump left past the last copy)
#
# Answer those and the loop writes itself.

text = 'abcabcbbxyzzyx'


def longest_unique(s):
    last_seen = {}
    left = 0
    best = 0
    best_start = 0

    for right, ch in enumerate(s):
        seen_at = last_seen.get(ch)

        # Only ever jump forward - left must never walk backwards.
        if seen_at is not None and seen_at >= left:
            left = seen_at + 1
        last_seen[ch] = right

        width = right - left + 1
        if width > best:
            best = width
            best_start = left

    return best, best_start


def max_sum(nums, k):
    """Fixed-size window: the other half of the pattern."""
    if len(nums) < k:
        return 0

    window = sum(nums[:k])
    best = window

    for right in range(k, len(nums)):
        # Slide by one: add the entering element, drop the leaving one.
        window += nums[right] - nums[right - k]
        if window > best:
            best = window

    return best


length, start = longest_unique(text)
print("longest unique ->", text[start:start + length], "(length " + str(length) + ")")
print("starts at index ->", start)
print("max sum of any 3 in [1,9,2,8,3] ->", max_sum([1, 9, 2, 8, 3], 3))
`,
  },
  bench: {
    typescript: `breakstep.bench({
  input: (n) => breakstep.randomInts(n, 26).map((v) => String.fromCharCode(97 + v)).join(''),
  run: (s) => longestUnique(s as string),
});
`,
    python: `breakstep.bench(
    input=lambda n: "".join(chr(97 + v) for v in breakstep.random_ints(n, 26)),
    run=longest_unique,
)
`,
  },
  instrumented: {
    typescript: `// Sliding window — the same solution, drawn explicitly.
//
// The factory form matters here: shading the whole array is O(n) per step, and
// building it eagerly would make this O(n) algorithm measure as O(n²).

const text = breakstep.param<string>('text', 'abcabcbb');
const chars = text.split('');

function longestUnique(s: string[]): { length: number; start: number } {
  const lastSeen = new Map<string, number>();
  let left = 0;
  let best = 0;
  let bestStart = 0;

  for (let right = 0; right < s.length; right++) {
    const seenAt = lastSeen.get(s[right]);
    if (seenAt !== undefined && seenAt >= left) left = seenAt + 1;
    lastSeen.set(s[right], right);

    const width = right - left + 1;
    if (width > best) {
      best = width;
      bestStart = left;
    }

    breakstep.show(s, () => {
      const highlight: Record<number, 'active' | 'match' | 'muted'> = {};
      for (let i = 0; i < s.length; i++) {
        if (i >= left && i <= right) highlight[i] = 'active';
        else if (i < left) highlight[i] = 'muted';
      }
      highlight[right] = 'match';
      return {
        label: \`window "\${s.slice(left, right + 1).join('')}" (len \${width})\`,
        pointers: { left, right },
        highlight,
        meta: { width, best, distinct: lastSeen.size },
      };
    });
  }

  return { length: best, start: bestStart };
}

const { length: width, start } = longestUnique(chars);
breakstep.log('longest ->', text.slice(start, start + width), '→', width);

breakstep.bench({
  input: (n) => breakstep.randomInts(n, 26).map((v) => String.fromCharCode(97 + v)),
  run: (arr: string[]) => longestUnique(arr),
});
`,
    python: `# Sliding window - the same solution, drawn explicitly.

text = breakstep.param('text', 'abcabcbb')
chars = list(text)


def longest_unique(s):
    last_seen = {}
    left = 0
    best = 0
    best_start = 0

    for right, ch in enumerate(s):
        seen_at = last_seen.get(ch)
        if seen_at is not None and seen_at >= left:
            left = seen_at + 1
        last_seen[ch] = right

        width = right - left + 1
        if width > best:
            best = width
            best_start = left

        def frame():
            highlight = {}
            for i in range(len(s)):
                if left <= i <= right:
                    highlight[i] = "active"
                elif i < left:
                    highlight[i] = "muted"
            highlight[right] = "match"
            return {
                "label": 'window "' + "".join(s[left:right + 1]) + f'" (len {width})',
                "pointers": {"left": left, "right": right},
                "highlight": highlight,
                "meta": {"width": width, "best": best, "distinct": len(last_seen)},
            }

        breakstep.show(s, frame)

    return best, best_start


length, start = longest_unique(chars)
breakstep.log("longest ->", text[start:start + length], "->", length)

breakstep.bench(
    input=lambda n: [chr(97 + v) for v in breakstep.random_ints(n, 26)],
    run=longest_unique,
)
`,
  },
};

export const binarySearch: Template = {
  id: 'binary-search',
  title: 'Binary Search — Find First & Last',
  category: 'Patterns',
  blurb: 'Halve the space each step; nudge the boundaries to find a range, not a point.',
  tags: ['binary-search', 'array', 'logarithmic', 'boundaries'],
  expected: { time: 'O(log n)', space: 'O(1)' },
  params: [
    { name: 'size', label: 'Array size', type: 'number', default: 32, min: 4, max: 256, step: 4 },
    { name: 'target', label: 'Target value', type: 'number', default: 23, min: 0, max: 512 },
  ],
  code: {
    typescript: `// PATTERN: binary search  ·  PROBLEM: find first and last occurrence
//
// Plain binary search answers "is it there?". The far more useful version
// answers "where does it START and END?" — and the only difference is what you
// do when you find a match: instead of returning, keep going in one direction.
//
// Almost every binary-search bug is a boundary bug. Three habits prevent them:
//   · \`lo + (hi - lo) / 2\` never overflows.
//   · Every branch must shrink the range, or the loop hangs.
//   · Decide up front whether \`hi\` is inclusive; here it is.

const size = 32;
const target = 23;

// A sorted array with deliberate duplicates, so "first and last" differ.
const sorted = Array.from({ length: size }, (_, i) => Math.floor(i / 2) * 2);

function search(arr: number[], want: number): number {
  let lo = 0;
  let hi = arr.length - 1;

  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);

    if (arr[mid] === want) return mid;
    if (arr[mid] < want) lo = mid + 1;
    else hi = mid - 1;
  }

  return -1;
}

/** Leftmost index holding \`want\`, or -1. */
function firstOccurrence(arr: number[], want: number): number {
  let lo = 0;
  let hi = arr.length - 1;
  let found = -1;

  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);

    if (arr[mid] === want) {
      found = mid;
      hi = mid - 1; // a match is not the end — look further left
    } else if (arr[mid] < want) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return found;
}

/** Rightmost index holding \`want\`, or -1. */
function lastOccurrence(arr: number[], want: number): number {
  let lo = 0;
  let hi = arr.length - 1;
  let found = -1;

  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);

    if (arr[mid] === want) {
      found = mid;
      lo = mid + 1; // mirror image: look further right
    } else if (arr[mid] < want) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return found;
}

console.log('array ->', sorted.slice(0, 12).join(', '), '…');
console.log('search(' + target + ')          ->', search(sorted, target));
console.log('firstOccurrence(22) ->', firstOccurrence(sorted, 22));
console.log('lastOccurrence(22)  ->', lastOccurrence(sorted, 22));
console.log('count of 22         ->', lastOccurrence(sorted, 22) - firstOccurrence(sorted, 22) + 1);
console.log('worst case for n =', size, '->', Math.ceil(Math.log2(size + 1)), 'probes');
`,
    python: `# PATTERN: binary search  ·  PROBLEM: find first and last occurrence
#
# Plain binary search answers "is it there?". The far more useful version
# answers "where does it START and END?" - and the only difference is what you
# do when you find a match: instead of returning, keep going in one direction.
#
# Almost every binary-search bug is a boundary bug. Three habits prevent them:
#   - \`lo + (hi - lo) // 2\` never overflows.
#   - Every branch must shrink the range, or the loop hangs.
#   - Decide up front whether \`hi\` is inclusive; here it is.

import math

size = 32
target = 23

# A sorted list with deliberate duplicates, so "first and last" differ.
sorted_arr = [(i // 2) * 2 for i in range(size)]


def search(arr, want):
    lo, hi = 0, len(arr) - 1

    while lo <= hi:
        mid = lo + (hi - lo) // 2

        if arr[mid] == want:
            return mid
        if arr[mid] < want:
            lo = mid + 1
        else:
            hi = mid - 1

    return -1


def first_occurrence(arr, want):
    """Leftmost index holding want, or -1."""
    lo, hi = 0, len(arr) - 1
    found = -1

    while lo <= hi:
        mid = lo + (hi - lo) // 2

        if arr[mid] == want:
            found = mid
            hi = mid - 1   # a match is not the end - look further left
        elif arr[mid] < want:
            lo = mid + 1
        else:
            hi = mid - 1

    return found


def last_occurrence(arr, want):
    """Rightmost index holding want, or -1."""
    lo, hi = 0, len(arr) - 1
    found = -1

    while lo <= hi:
        mid = lo + (hi - lo) // 2

        if arr[mid] == want:
            found = mid
            lo = mid + 1   # mirror image: look further right
        elif arr[mid] < want:
            lo = mid + 1
        else:
            hi = mid - 1

    return found


print("array ->", ", ".join(str(v) for v in sorted_arr[:12]), "...")
print("search(" + str(target) + ")          ->", search(sorted_arr, target))
print("first_occurrence(22) ->", first_occurrence(sorted_arr, 22))
print("last_occurrence(22)  ->", last_occurrence(sorted_arr, 22))
print("count of 22          ->",
      last_occurrence(sorted_arr, 22) - first_occurrence(sorted_arr, 22) + 1)
print("worst case for n =", size, "->", math.ceil(math.log2(size + 1)), "probes")
`,
  },
  bench: {
    typescript: `breakstep.bench({
  input: (n) => Array.from({ length: n }, (_, i) => i),
  run: (arr: number[]) => search(arr, -1), // never found = worst case
});
`,
    python: `breakstep.bench(
    input=lambda n: list(range(n)),
    run=lambda arr: search(arr, -1),  # never found = worst case
)
`,
  },
  instrumented: {
    typescript: `// Binary search — the same solution, drawn explicitly.

const size = breakstep.param<number>('size', 32);
const target = breakstep.param<number>('target', 23);
const sorted = Array.from({ length: size }, (_, i) => i);

function search(arr: number[], want: number): number {
  let lo = 0;
  let hi = arr.length - 1;
  let steps = 0;

  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    steps++;

    breakstep.show(arr, () => {
      const highlight: Record<number, 'muted' | 'active' | 'compare'> = {};
      for (let i = 0; i < arr.length; i++) highlight[i] = i < lo || i > hi ? 'muted' : 'compare';
      highlight[mid] = 'active';
      return {
        label: \`step \${steps}: probe index \${mid} (value \${arr[mid]})\`,
        pointers: { lo, mid, hi },
        highlight,
        meta: { remaining: hi - lo + 1, steps },
      };
    });

    if (arr[mid] === want) {
      breakstep.show(arr, { label: \`Found at index \${mid}\`, highlight: { [mid]: 'match' } });
      return mid;
    }
    if (arr[mid] < want) lo = mid + 1;
    else hi = mid - 1;
  }

  breakstep.show(arr, { label: 'Not present' });
  return -1;
}

breakstep.log('index ->', search(sorted, target));

breakstep.bench({
  input: (n) => Array.from({ length: n }, (_, i) => i),
  run: (arr: number[]) => search(arr, -1),
});
`,
    python: `# Binary search - the same solution, drawn explicitly.

size = breakstep.param('size', 32)
target = breakstep.param('target', 23)
sorted_arr = list(range(size))


def search(arr, want):
    lo, hi = 0, len(arr) - 1
    steps = 0

    while lo <= hi:
        mid = lo + (hi - lo) // 2
        steps += 1

        def frame():
            highlight = {i: ("muted" if i < lo or i > hi else "compare")
                         for i in range(len(arr))}
            highlight[mid] = "active"
            return {
                "label": f"step {steps}: probe index {mid} (value {arr[mid]})",
                "pointers": {"lo": lo, "mid": mid, "hi": hi},
                "highlight": highlight,
                "meta": {"remaining": hi - lo + 1, "steps": steps},
            }

        breakstep.show(arr, frame)

        if arr[mid] == want:
            breakstep.show(arr, label=f"Found at index {mid}", highlight={mid: "match"})
            return mid
        if arr[mid] < want:
            lo = mid + 1
        else:
            hi = mid - 1

    breakstep.show(arr, label="Not present")
    return -1


breakstep.log("index ->", search(sorted_arr, target))

breakstep.bench(
    input=lambda n: list(range(n)),
    run=lambda arr: search(arr, -1),
)
`,
  },
};

export const sorting: Template = {
  id: 'sorting',
  title: 'Sorting — Merge vs Bubble',
  category: 'Patterns',
  blurb: 'Divide and conquer against adjacent swaps: watch O(n log n) pull away.',
  tags: ['sorting', 'divide-and-conquer', 'recursion', 'comparison'],
  expected: { time: 'O(n log n)', space: 'O(n)' },
  params: [
    { name: 'size', label: 'Array size', type: 'number', default: 14, min: 4, max: 40 },
    {
      name: 'algorithm',
      label: 'Benchmark which?',
      type: 'select',
      default: 'merge',
      options: [
        { label: 'Merge sort — O(n log n)', value: 'merge' },
        { label: 'Bubble sort — O(n²)', value: 'bubble' },
      ],
    },
  ],
  code: {
    typescript: `// PATTERN: divide and conquer  ·  PROBLEM: sort an array
//
// Two sorts, same input, wildly different growth.
//
// BUBBLE compares adjacent pairs and swaps until a full pass makes no change.
// Every pass fixes exactly one element, so it needs n passes over n elements.
//
// MERGE splits the array in half, sorts each half, then merges them in one
// linear pass. The recursion is only log₂(n) levels deep and each level does
// O(n) work — hence n log n.
//
// The lesson is the shape of the recursion, not the code: any time you can
// split a problem into equal halves and combine the answers cheaply, you have
// traded a quadratic algorithm for a linearithmic one.
//
// Switch \`algorithm\` and re-run Analyze to watch the fitted curve move.

const size = 14;
const algorithm = 'merge';

const data = [42, 17, 88, 5, 63, 29, 71, 12, 95, 34, 8, 56, 23, 77];

function bubbleSort(input: number[]): number[] {
  const a = [...input];

  for (let i = 0; i < a.length; i++) {
    let swapped = false;

    for (let j = 0; j < a.length - i - 1; j++) {
      if (a[j] > a[j + 1]) {
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
        swapped = true;
      }
    }

    if (!swapped) break; // already ordered — best case is O(n)
  }

  return a;
}

/** The combine step: two sorted halves in, one sorted whole out, in O(n). */
function merge(left: number[], right: number[]): number[] {
  const out: number[] = [];
  let i = 0;
  let j = 0;

  while (i < left.length && j < right.length) {
    out.push(left[i] <= right[j] ? left[i++] : right[j++]);
  }

  while (i < left.length) out.push(left[i++]);
  while (j < right.length) out.push(right[j++]);
  return out;
}

function mergeSort(a: number[]): number[] {
  if (a.length <= 1) return a; // a single element is already sorted

  const mid = Math.floor(a.length / 2);
  return merge(mergeSort(a.slice(0, mid)), mergeSort(a.slice(mid)));
}

const source = data.slice(0, size);
// Keyed by the option, so switching it cannot go stale or mistype.
const sorted = { merge: mergeSort, bubble: bubbleSort }[algorithm](source);

console.log('input  ->', source.join(', '));
console.log(algorithm + ' ->', sorted.join(', '));
console.log('best case for bubble (already sorted) ->', bubbleSort(sorted).join(', '));
`,
    python: `# PATTERN: divide and conquer  ·  PROBLEM: sort a list
#
# Two sorts, same input, wildly different growth.
#
# BUBBLE compares adjacent pairs and swaps until a full pass makes no change.
# Every pass fixes exactly one element, so it needs n passes over n elements.
#
# MERGE splits the list in half, sorts each half, then merges them in one
# linear pass. The recursion is only log2(n) levels deep and each level does
# O(n) work - hence n log n.
#
# The lesson is the shape of the recursion, not the code: any time you can
# split a problem into equal halves and combine the answers cheaply, you have
# traded a quadratic algorithm for a linearithmic one.
#
# Switch \`algorithm\` and re-run Analyze to watch the fitted curve move.

size = 14
algorithm = 'merge'

data = [42, 17, 88, 5, 63, 29, 71, 12, 95, 34, 8, 56, 23, 77]


def bubble_sort(arr):
    a = list(arr)

    for i in range(len(a)):
        swapped = False

        for j in range(len(a) - i - 1):
            if a[j] > a[j + 1]:
                a[j], a[j + 1] = a[j + 1], a[j]
                swapped = True

        if not swapped:
            break  # already ordered - best case is O(n)

    return a


def merge(left, right):
    """The combine step: two sorted halves in, one sorted whole out, in O(n)."""
    out = []
    i = j = 0

    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            out.append(left[i])
            i += 1
        else:
            out.append(right[j])
            j += 1

    out.extend(left[i:])
    out.extend(right[j:])
    return out


def merge_sort(a):
    if len(a) <= 1:
        return a  # a single element is already sorted

    mid = len(a) // 2
    return merge(merge_sort(a[:mid]), merge_sort(a[mid:]))


source = data[:size]
result = bubble_sort(source) if algorithm == "bubble" else merge_sort(source)

print("input  ->", ", ".join(str(v) for v in source))
print(algorithm + " ->", ", ".join(str(v) for v in result))
print("best case for bubble (already sorted) ->",
      ", ".join(str(v) for v in bubble_sort(result)))
`,
  },
  bench: {
    typescript: `breakstep.bench({
  input: (n) => breakstep.randomInts(n, 1000, 3),
  run: (arr: number[]) => ({ merge: mergeSort, bubble: bubbleSort })[algorithm](arr),
  // Bubble sort is quadratic, so it needs a shorter sweep to finish.
  sizes: { merge: [16, 64, 256, 1024, 4096, 16384], bubble: [16, 32, 64, 128, 256, 512] }[algorithm],
});
`,
    python: `breakstep.bench(
    input=lambda n: breakstep.random_ints(n, 1000, 3),
    run=lambda arr: bubble_sort(arr) if algorithm == "bubble" else merge_sort(arr),
    sizes=[16, 32, 64, 128, 256] if algorithm == "bubble" else [16, 64, 256, 1024, 4096],
)
`,
  },
  instrumented: {
    typescript: `// Sorting — the same solutions, drawn explicitly.

const size = breakstep.param<number>('size', 14);
const algorithm = breakstep.param<'merge' | 'bubble'>('algorithm', 'merge');
const data = breakstep.randomInts(size, 99, 7);

function sortedTail(len: number, done: number): Record<number, 'sorted'> {
  const out: Record<number, 'sorted'> = {};
  for (let k = len - done; k < len; k++) out[k] = 'sorted';
  return out;
}

function bubbleSort(input: number[]): number[] {
  const a = [...input];

  for (let i = 0; i < a.length; i++) {
    let swapped = false;

    for (let j = 0; j < a.length - i - 1; j++) {
      if (a[j] > a[j + 1]) {
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
        swapped = true;
      }

      // Factory form — \`sortedTail\` is O(n), and calling it eagerly from the
      // inner loop would make bubble sort measure O(n³) instead of O(n²).
      breakstep.show(a, () => ({
        label: \`compare \${a[j]} / \${a[j + 1]}\`,
        highlight: { [j]: 'compare' as const, [j + 1]: 'compare' as const, ...sortedTail(a.length, i) },
        pointers: { j },
      }));
    }

    if (!swapped) break;
  }

  return a;
}

function merge(left: number[], right: number[]): number[] {
  const out: number[] = [];
  let i = 0;
  let j = 0;

  while (i < left.length && j < right.length) out.push(left[i] <= right[j] ? left[i++] : right[j++]);
  while (i < left.length) out.push(left[i++]);
  while (j < right.length) out.push(right[j++]);

  breakstep.show(out, { label: \`merge [\${left.join(',')}] + [\${right.join(',')}]\`, meta: { width: out.length } });
  return out;
}

function mergeSort(a: number[]): number[] {
  if (a.length <= 1) return a;
  const mid = Math.floor(a.length / 2);
  return merge(mergeSort(a.slice(0, mid)), mergeSort(a.slice(mid)));
}

breakstep.show(data, { label: 'Unsorted input' });

const sorted = algorithm === 'bubble' ? bubbleSort(data) : mergeSort(data);
breakstep.show(sorted, { label: algorithm + ' sorted', highlight: sortedTail(sorted.length, sorted.length) });
breakstep.log(algorithm, '->', sorted.join(', '));

breakstep.bench({
  input: (n) => breakstep.randomInts(n, 1000, 3),
  run: (arr: number[]) => ({ merge: mergeSort, bubble: bubbleSort })[algorithm](arr),
  // Bubble sort is quadratic, so it needs a shorter sweep to finish.
  sizes: { merge: [16, 64, 256, 1024, 4096, 16384], bubble: [16, 32, 64, 128, 256, 512] }[algorithm],
});
`,
    python: `# Sorting - the same solutions, drawn explicitly.

size = breakstep.param('size', 14)
algorithm = breakstep.param('algorithm', 'merge')
data = breakstep.random_ints(size, 99, 7)


def sorted_tail(length, done):
    return {k: "sorted" for k in range(length - done, length)}


def bubble_sort(arr):
    a = list(arr)

    for i in range(len(a)):
        swapped = False

        for j in range(len(a) - i - 1):
            if a[j] > a[j + 1]:
                a[j], a[j + 1] = a[j + 1], a[j]
                swapped = True

            # Factory form - \`sorted_tail\` is O(n), and calling it eagerly from
            # the inner loop would make bubble sort measure O(n^3), not O(n^2).
            def frame(j=j, i=i):
                highlight = {j: "compare", j + 1: "compare"}
                highlight.update(sorted_tail(len(a), i))
                return {
                    "label": f"compare {a[j]} / {a[j + 1]}",
                    "highlight": highlight,
                    "pointers": {"j": j},
                }

            breakstep.show(a, frame)

        if not swapped:
            break

    return a


def merge(left, right):
    out = []
    i = j = 0

    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            out.append(left[i])
            i += 1
        else:
            out.append(right[j])
            j += 1

    out.extend(left[i:])
    out.extend(right[j:])

    breakstep.show(out, label="merge " + str(left) + " + " + str(right),
             meta={"width": len(out)})
    return out


def merge_sort(a):
    if len(a) <= 1:
        return a
    mid = len(a) // 2
    return merge(merge_sort(a[:mid]), merge_sort(a[mid:]))


breakstep.show(data, label="Unsorted input")

result = bubble_sort(data) if algorithm == "bubble" else merge_sort(data)
breakstep.show(result, label=algorithm + " sorted",
         highlight=sorted_tail(len(result), len(result)))
breakstep.log(algorithm, "->", ", ".join(str(v) for v in result))

breakstep.bench(
    input=lambda n: breakstep.random_ints(n, 1000, 3),
    run=lambda arr: bubble_sort(arr) if algorithm == "bubble" else merge_sort(arr),
    sizes=[16, 32, 64, 128, 256] if algorithm == "bubble" else [16, 64, 256, 1024, 4096],
)
`,
  },
};
