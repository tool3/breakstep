import type { Template } from '@/types';

export const twoPointers: Template = {
  id: 'example-two-pointers',
  title: 'Two Pointers',
  category: 'Worked examples',
  blurb: 'Converge from both ends of a sorted array to find a target pair.',
  tags: ['array', 'linear', 'sorted'],
  expected: { time: 'O(n)', space: 'O(1)' },
  params: [
    {
      name: 'nums',
      label: 'Sorted array',
      type: 'numberArray',
      default: [2, 4, 7, 11, 15, 19, 24, 30],
      help: 'Must be sorted ascending for the two-pointer invariant to hold.',
    },
    { name: 'target', label: 'Target sum', type: 'number', default: 26, min: -1000, max: 1000 },
  ],
  code: {
    typescript: `// Two Pointers - find a pair summing to \`target\` in a SORTED array.
//
// The invariant: if nums[lo] + nums[hi] is too small, no smaller index can
// help, so lo must move right. Each step discards a whole row of the
// comparison matrix - that is why this is O(n) and not O(n^2).

const nums = [2, 4, 7, 11, 15, 19, 24, 30];
const target = 26;

function twoSumSorted(arr: number[], want: number): [number, number] | null {
  let lo = 0;
  let hi = arr.length - 1;

  while (lo < hi) {
    const sum = arr[lo] + arr[hi];
    if (sum === want) return [lo, hi];

    // Too small -> the only way up is a bigger left value.
    if (sum < want) lo++;
    else hi--;
  }

  return null;
}

const result = twoSumSorted(nums, target);
console.log('indices:', result);
if (result) console.log('values:', nums[result[0]], '+', nums[result[1]]);
`,
    python: `# Two Pointers - find a pair summing to \`target\` in a SORTED list.
#
# The invariant: if nums[lo] + nums[hi] is too small, no smaller index can
# help, so lo must move right. Each step discards a whole row of the
# comparison matrix - that is why this is O(n) and not O(n^2).

nums = [2, 4, 7, 11, 15, 19, 24, 30]
target = 26


def two_sum_sorted(arr, want):
    lo, hi = 0, len(arr) - 1

    while lo < hi:
        total = arr[lo] + arr[hi]
        if total == want:
            return (lo, hi)

        # Too small -> the only way up is a bigger left value.
        if total < want:
            lo += 1
        else:
            hi -= 1

    return None


result = two_sum_sorted(nums, target)
print("indices:", result)
if result:
    print("values:", nums[result[0]], "+", nums[result[1]])
`,
  },
  bench: {
    typescript: `breakstep.bench({
  input: (n) => Array.from({ length: n }, (_, i) => i * 2),
  run: (arr: number[]) => twoSumSorted(arr, -1), // worst case: never found
});
`,
    python: `breakstep.bench(
    input=lambda n: [i * 2 for i in range(n)],
    run=lambda arr: two_sum_sorted(arr, -1),  # worst case: never found
)
`,
  },
  instrumented: {
    typescript: `// Two Pointers — find a pair summing to \`target\` in a SORTED array.
//
// The invariant: if nums[lo] + nums[hi] is too small, no smaller index can
// help, so lo must move right. Each step discards a whole row of the
// comparison matrix — that is why this is O(n) and not O(n²).

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

    // Too small → the only way up is a bigger left value.
    if (sum < want) lo++;
    else hi--;
  }

  breakstep.show(arr, { label: 'No pair sums to the target' });
  return null;
}

const result = twoSumSorted(nums, target);
breakstep.log('indices:', result);
if (result) breakstep.log('values: ', nums[result[0]], '+', nums[result[1]]);

// The benchmark harness: Breakstep runs \`run\` at growing \`n\` and fits the curve.
breakstep.bench({
  input: (n) => Array.from({ length: n }, (_, i) => i * 2),
  run: (arr: number[]) => twoSumSorted(arr, -1), // worst case: never found
});
`,
    python: `# Two Pointers - find a pair summing to \`target\` in a SORTED array.
#
# The invariant: if nums[lo] + nums[hi] is too small, no smaller index can
# help, so lo must move right. Each step discards a whole row of the
# comparison matrix - that is why this is O(n) and not O(n^2).

nums = breakstep.param('nums', [2, 4, 7, 11, 15])
target = breakstep.param('target', 26)


def two_sum_sorted(arr, want):
    lo, hi = 0, len(arr) - 1

    while lo < hi:
        total = arr[lo] + arr[hi]

        breakstep.show(
            arr,
            label=f"{arr[lo]} + {arr[hi]} = {total}",
            pointers={"lo": lo, "hi": hi},
            highlight={lo: "active", hi: "active"},
            meta={"sum": total, "target": want, "need": want - total},
        )

        if total == want:
            breakstep.show(arr, label="Found the pair",
                     highlight={lo: "match", hi: "match"},
                     pointers={"lo": lo, "hi": hi})
            return (lo, hi)

        # Too small -> the only way up is a bigger left value.
        if total < want:
            lo += 1
        else:
            hi -= 1

    breakstep.show(arr, label="No pair sums to the target")
    return None


result = two_sum_sorted(nums, target)
print("indices:", result)
if result:
    print("values:", nums[result[0]], "+", nums[result[1]])

# The benchmark harness: Breakstep runs \`run\` at growing \`n\` and fits the curve.
breakstep.bench(
    input=lambda n: [i * 2 for i in range(n)],
    run=lambda arr: two_sum_sorted(arr, -1),  # worst case: never found
)
`,
  },
};

export const slidingWindow: Template = {
  id: 'example-sliding-window',
  title: 'Sliding Window',
  category: 'Worked examples',
  blurb: 'Longest substring with no repeated character, in one pass.',
  tags: ['array', 'string', 'hashmap'],
  // Space is O(k) for an alphabet of size k — bounded, hence O(1) here.
  expected: { time: 'O(n)', space: 'O(1)' },
  params: [
    { name: 'text', label: 'Input string', type: 'string', default: 'abcabcbbxyzzyx' },
  ],
  code: {
    typescript: `// Sliding Window - longest substring without repeating characters.
//
// Both pointers only ever move right, so despite the nested-looking logic
// every index is visited at most twice. That is the whole trick: amortised
// O(n), not O(n^2).

const text = 'abcabcbbxyzzyx';

function longestUnique(s: string[]): { length: number; start: number } {
  const lastSeen = new Map<string, number>();
  let left = 0;
  let best = 0;
  let bestStart = 0;

  for (let right = 0; right < s.length; right++) {
    const seenAt = lastSeen.get(s[right]);

    // Only jump forward - never let \`left\` walk backwards.
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

const chars = text.split('');
const { length: width, start } = longestUnique(chars);
console.log('longest:', text.slice(start, start + width), '->', width);
`,
    python: `# Sliding Window - longest substring without repeating characters.
#
# Both pointers only ever move right, so despite the nested-looking logic
# every index is visited at most twice. That is the whole trick: amortised
# O(n), not O(n^2).

text = 'abcabcbbxyzzyx'


def longest_unique(s):
    last_seen = {}
    left = 0
    best = 0
    best_start = 0

    for right, ch in enumerate(s):
        seen_at = last_seen.get(ch)

        # Only jump forward - never let \`left\` walk backwards.
        if seen_at is not None and seen_at >= left:
            left = seen_at + 1
        last_seen[ch] = right

        width = right - left + 1
        if width > best:
            best = width
            best_start = left

    return best, best_start


chars = list(text)
length, start = longest_unique(chars)
print("longest:", text[start:start + length], "->", length)
`,
  },
  bench: {
    typescript: `breakstep.bench({
  input: (n) => breakstep.randomInts(n, 26).map((v) => String.fromCharCode(97 + v)),
  run: (arr: string[]) => longestUnique(arr),
});
`,
    python: `breakstep.bench(
    input=lambda n: [chr(97 + v) for v in breakstep.random_ints(n, 26)],
    run=longest_unique,
)
`,
  },
  instrumented: {
    typescript: `// Sliding Window — longest substring without repeating characters.
//
// Both pointers only ever move right, so despite the nested-looking logic
// every index is visited at most twice. That is the whole trick: amortised
// O(n), not O(n²).

const text = breakstep.param<string>('text', 'abcabcbb');
const chars = text.split('');

function longestUnique(s: string[]): { length: number; start: number } {
  const lastSeen = new Map<string, number>();
  let left = 0;
  let best = 0;
  let bestStart = 0;

  for (let right = 0; right < s.length; right++) {
    const ch = s[right];
    const seenAt = lastSeen.get(ch);

    // Only jump forward — never let \`left\` walk backwards.
    if (seenAt !== undefined && seenAt >= left) {
      left = seenAt + 1;
    }
    lastSeen.set(ch, right);

    const width = right - left + 1;
    if (width > best) {
      best = width;
      bestStart = left;
    }

    // Factory form: shading the whole array costs O(n) per step, which would
    // turn this O(n) algorithm into O(n²) on the Analyze tab. It only runs
    // while frames are being captured.
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
breakstep.log('longest:', text.slice(start, start + width), '→', width);

breakstep.show(chars, {
  label: 'Best window',
  highlight: Object.fromEntries(
    Array.from({ length: width }, (_, i) => [start + i, 'match' as const]),
  ),
});

breakstep.bench({
  input: (n) => breakstep.randomInts(n, 26).map((v) => String.fromCharCode(97 + v)),
  run: (arr: string[]) => longestUnique(arr),
});
`,
    python: `# Sliding Window - longest substring without repeating characters.
#
# Both pointers only ever move right, so despite the nested-looking logic
# every index is visited at most twice. That is the whole trick: amortised
# O(n), not O(n^2).

text = breakstep.param('text', 'abcabcbb')
chars = list(text)


def longest_unique(s):
    last_seen = {}
    left = 0
    best = 0
    best_start = 0

    for right, ch in enumerate(s):
        seen_at = last_seen.get(ch)

        # Only jump forward - never let \`left\` walk backwards.
        if seen_at is not None and seen_at >= left:
            left = seen_at + 1
        last_seen[ch] = right

        width = right - left + 1
        if width > best:
            best = width
            best_start = left

        # Factory form: shading the whole list costs O(n) per step, which would
        # turn this O(n) algorithm into O(n^2) on the Analyze tab. It only runs
        # while frames are being captured.
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
print("longest:", text[start:start + length], "->", length)

breakstep.show(chars, label="Best window",
         highlight={start + i: "match" for i in range(length)})

breakstep.bench(
    input=lambda n: [chr(97 + v) for v in breakstep.random_ints(n, 26)],
    run=longest_unique,
)
`,
  },
};

export const binarySearch: Template = {
  id: 'example-binary-search',
  title: 'Binary Search',
  category: 'Worked examples',
  blurb: 'Halve the search space every step — the canonical O(log n).',
  tags: ['array', 'search', 'logarithmic'],
  expected: { time: 'O(log n)', space: 'O(1)' },
  params: [
    { name: 'size', label: 'Array size', type: 'number', default: 32, min: 4, max: 256, step: 4 },
    { name: 'target', label: 'Target value', type: 'number', default: 23, min: 0, max: 512 },
  ],
  code: {
    typescript: `// Binary Search - the discipline is in the boundaries.
//
// Every comparison eliminates half of what is left, so 1,000,000 elements
// take at most 20 steps. Watch \`lo\` and \`hi\` close in on each other.

const size = 32;
const target = 23;

const sorted = Array.from({ length: size }, (_, i) => i);

function binarySearch(arr: number[], want: number): number {
  let lo = 0;
  let hi = arr.length - 1;

  while (lo <= hi) {
    // \`lo + (hi - lo) / 2\` instead of \`(lo + hi) / 2\` - overflow-safe habit.
    const mid = lo + Math.floor((hi - lo) / 2);

    if (arr[mid] === want) return mid;
    if (arr[mid] < want) lo = mid + 1;
    else hi = mid - 1;
  }

  return -1;
}

console.log('index:', binarySearch(sorted, target));
console.log('worst case for n =', size, '->', Math.ceil(Math.log2(size + 1)), 'probes');
`,
    python: `# Binary Search - the discipline is in the boundaries.
#
# Every comparison eliminates half of what is left, so 1,000,000 elements
# take at most 20 steps. Watch \`lo\` and \`hi\` close in on each other.

import math

size = 32
target = 23

sorted_arr = list(range(size))


def binary_search(arr, want):
    lo, hi = 0, len(arr) - 1

    while lo <= hi:
        # \`lo + (hi - lo) // 2\` instead of \`(lo + hi) // 2\` - overflow-safe habit.
        mid = lo + (hi - lo) // 2

        if arr[mid] == want:
            return mid
        if arr[mid] < want:
            lo = mid + 1
        else:
            hi = mid - 1

    return -1


print("index:", binary_search(sorted_arr, target))
print("worst case for n =", size, "->", math.ceil(math.log2(size + 1)), "probes")
`,
  },
  bench: {
    typescript: `breakstep.bench({
  input: (n) => Array.from({ length: n }, (_, i) => i),
  run: (arr: number[]) => binarySearch(arr, -1), // never found = worst case
});
`,
    python: `breakstep.bench(
    input=lambda n: list(range(n)),
    run=lambda arr: binary_search(arr, -1),  # never found = worst case
)
`,
  },
  instrumented: {
    typescript: `// Binary Search — the discipline is in the boundaries.
//
// Watch the greyed-out region grow: every comparison eliminates half of what
// is left, so 1,000,000 elements take at most 20 steps.

const size = breakstep.param<number>('size', 32);
const target = breakstep.param<number>('target', 23);
const sorted = Array.from({ length: size }, (_, i) => i);

function binarySearch(arr: number[], want: number): number {
  let lo = 0;
  let hi = arr.length - 1;
  let steps = 0;

  while (lo <= hi) {
    // \`lo + (hi - lo) / 2\` instead of \`(lo + hi) / 2\` — overflow-safe habit.
    const mid = lo + Math.floor((hi - lo) / 2);
    steps++;

    // Passing a FACTORY instead of an object matters here: painting the whole
    // array is O(n) per probe, which would swamp the O(log n) search during
    // Analyze. The factory only runs while frames are being captured.
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

breakstep.log('index:', binarySearch(sorted, target));
breakstep.log('worst case for n =', size, '→', Math.ceil(Math.log2(size + 1)), 'probes');

breakstep.bench({
  input: (n) => Array.from({ length: n }, (_, i) => i),
  run: (arr: number[]) => binarySearch(arr, -1), // never found = worst case
});
`,
    python: `# Binary Search - the discipline is in the boundaries.
#
# Watch the greyed-out region grow: every comparison eliminates half of what
# is left, so 1,000,000 elements take at most 20 steps.

import math

size = breakstep.param('size', 32)
target = breakstep.param('target', 23)
sorted_arr = list(range(size))


def binary_search(arr, want):
    lo, hi = 0, len(arr) - 1
    steps = 0

    while lo <= hi:
        # \`lo + (hi - lo) // 2\` instead of \`(lo + hi) // 2\` - overflow-safe habit.
        mid = lo + (hi - lo) // 2
        steps += 1

        # Passing a FACTORY instead of keyword options matters here: painting
        # the whole array is O(n) per probe, which would swamp the O(log n)
        # search during Analyze. The lambda only runs while capturing frames.
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


print("index:", binary_search(sorted_arr, target))
print("worst case for n =", size, "->", math.ceil(math.log2(size + 1)), "probes")

breakstep.bench(
    input=lambda n: list(range(n)),
    run=lambda arr: binary_search(arr, -1),  # never found = worst case
)
`,
  },
};

export const sorting: Template = {
  id: 'example-sorting',
  title: 'Merge Sort vs Bubble Sort',
  category: 'Worked examples',
  blurb: 'Run both on the same data and watch O(n log n) pull away from O(n²).',
  tags: ['sorting', 'divide-and-conquer', 'recursion'],
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
    typescript: `// Two sorts, same input. Switch \`algorithm\` and re-run Analyze to see the
// fitter move between O(n log n) and O(n^2).

const size = 14;
const algorithm = 'merge';

const data = [42, 17, 88, 5, 63, 29, 71, 12, 95, 34, 8, 56, 23, 77];

// --- Bubble sort: adjacent swaps until nothing moves -----------------------
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
    if (!swapped) break; // already ordered - bail out early
  }

  return a;
}

// --- Merge sort: split, sort halves, merge --------------------------------
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
  if (a.length <= 1) return a;
  const mid = Math.floor(a.length / 2);
  return merge(mergeSort(a.slice(0, mid)), mergeSort(a.slice(mid)));
}

const source = data.slice(0, size);
// Keyed by the option, so switching it cannot go stale or mistype.
const sorted = { merge: mergeSort, bubble: bubbleSort }[algorithm](source);
console.log(algorithm, '->', sorted.join(', '));
`,
    python: `# Two sorts, same input. Switch \`algorithm\` and re-run Analyze to see the
# fitter move between O(n log n) and O(n^2).

size = 14
algorithm = 'merge'

data = [42, 17, 88, 5, 63, 29, 71, 12, 95, 34, 8, 56, 23, 77]


# --- Bubble sort: adjacent swaps until nothing moves -----------------------
def bubble_sort(arr):
    a = list(arr)

    for i in range(len(a)):
        swapped = False
        for j in range(len(a) - i - 1):
            if a[j] > a[j + 1]:
                a[j], a[j + 1] = a[j + 1], a[j]
                swapped = True
        if not swapped:
            break  # already ordered - bail out early

    return a


# --- Merge sort: split, sort halves, merge --------------------------------
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
    return out


def merge_sort(a):
    if len(a) <= 1:
        return a
    mid = len(a) // 2
    return merge(merge_sort(a[:mid]), merge_sort(a[mid:]))


source = data[:size]
result = bubble_sort(source) if algorithm == "bubble" else merge_sort(source)
print(algorithm, "->", ", ".join(str(v) for v in result))
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
    typescript: `// Two sorts, same input. Switch the "Benchmark which?" parameter and re-run
// Analyze to see the fitter move between O(n log n) and O(n²).

const size = breakstep.param<number>('size', 14);
const algorithm = breakstep.param<'merge' | 'bubble'>('algorithm', 'merge');
const data = breakstep.randomInts(size, 99, 7);

// --- Bubble sort: adjacent swaps until nothing moves -----------------------
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
        highlight: {
          [j]: 'compare' as const,
          [j + 1]: 'compare' as const,
          ...sortedTail(a.length, i),
        },
        pointers: { j },
      }));
    }
    if (!swapped) break; // already ordered — bail out early
  }
  return a;
}

function sortedTail(len: number, done: number): Record<number, 'sorted'> {
  const out: Record<number, 'sorted'> = {};
  for (let k = len - done; k < len; k++) out[k] = 'sorted';
  return out;
}

// --- Merge sort: split, sort halves, merge --------------------------------
function mergeSort(a: number[]): number[] {
  if (a.length <= 1) return a;
  const mid = Math.floor(a.length / 2);
  const left = mergeSort(a.slice(0, mid));
  const right = mergeSort(a.slice(mid));
  return merge(left, right);
}

function merge(left: number[], right: number[]): number[] {
  const out: number[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    out.push(left[i] <= right[j] ? left[i++] : right[j++]);
  }
  while (i < left.length) out.push(left[i++]);
  while (j < right.length) out.push(right[j++]);

  breakstep.show(out, {
    label: \`merge [\${left.join(',')}] + [\${right.join(',')}]\`,
    meta: { width: out.length },
  });
  return out;
}

breakstep.show(data, { label: 'Unsorted input' });

if (algorithm === 'bubble') {
  const result = bubbleSort(data);
  breakstep.show(result, { label: 'Bubble sorted', highlight: sortedTail(result.length, result.length) });
  breakstep.log('bubble →', result.join(', '));
} else {
  const result = mergeSort(data);
  breakstep.show(result, { label: 'Merge sorted', highlight: sortedTail(result.length, result.length) });
  breakstep.log('merge →', result.join(', '));
}

breakstep.bench({
  input: (n) => breakstep.randomInts(n, 1000, 3),
  run: (arr: number[]) => ({ merge: mergeSort, bubble: bubbleSort })[algorithm](arr),
  // Bubble sort is quadratic — cap the sweep so the run stays interactive.
  // Bubble sort is quadratic, so it needs a shorter sweep to finish.
  sizes: { merge: [16, 64, 256, 1024, 4096, 16384], bubble: [16, 32, 64, 128, 256, 512] }[algorithm],
});
`,
    python: `# Two sorts, same input. Switch the "Benchmark which?" parameter and re-run
# Analyze to see the fitter move between O(n log n) and O(n^2).

size = breakstep.param('size', 14)
algorithm = breakstep.param('algorithm', 'merge')
data = breakstep.random_ints(size, 99, 7)


def sorted_tail(length, done):
    return {k: "sorted" for k in range(length - done, length)}


# --- Bubble sort: adjacent swaps until nothing moves -----------------------
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
            break  # already ordered - bail out early
    return a


# --- Merge sort: split, sort halves, merge --------------------------------
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

if algorithm == "bubble":
    result = bubble_sort(data)
    breakstep.show(result, label="Bubble sorted", highlight=sorted_tail(len(result), len(result)))
    print("bubble ->", result)
else:
    result = merge_sort(data)
    breakstep.show(result, label="Merge sorted", highlight=sorted_tail(len(result), len(result)))
    print("merge ->", result)

breakstep.bench(
    input=lambda n: breakstep.random_ints(n, 1000, 3),
    run=lambda arr: bubble_sort(arr) if algorithm == "bubble" else merge_sort(arr),
    # Bubble sort is quadratic - cap the sweep so the run stays interactive.
    sizes=[16, 32, 64, 128, 256] if algorithm == "bubble" else [16, 64, 256, 1024, 4096],
)
`,
  },
};
