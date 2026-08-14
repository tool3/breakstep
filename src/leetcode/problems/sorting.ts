import type { LeetProblem } from '../types';

// --- 75 · Sort Colors --------------------------------------------------------

const colorsDriver = {
  typescript: `
// --- examples ---------------------------------------------------------------
console.log('example 1 ->', sortColors([...nums]));
console.log('example 2 ->', sortColors([2, 0, 1]));
console.log('example 3 ->', sortColors([0]));
`,
  python: `
# --- examples ---------------------------------------------------------------
print('example 1 ->', sort_colors(list(nums)))
print('example 2 ->', sort_colors([2, 0, 1]))
print('example 3 ->', sort_colors([0]))
`,
};

export const sortColors: LeetProblem = {
  slug: 'sort-colors',
  number: 75,
  title: 'Sort Colors',
  difficulty: 'Medium',
  topics: ['array', 'two-pointers', 'sorting'],
  prompt:
    'The array holds only 0s, 1s and 2s — red, white and blue. Sort it in place so the colours are grouped in that order, without calling the library sort. The classic follow-up asks for one pass and constant extra space.',
  constraints: ['1 ≤ nums.length ≤ 300', 'nums[i] is 0, 1 or 2'],
  examples: [
    { input: 'nums = [2,0,2,1,1,0]', output: '[0,0,1,1,2,2]' },
    { input: 'nums = [2,0,1]', output: '[0,1,2]' },
    { input: 'nums = [0]', output: '[0]' },
  ],
  techniques: [
    {
      pattern: 'sorting',
      rank: 1,
      why: 'With only three possible values you can count each one and rewrite the array — two passes, no comparisons. That is counting sort, and it beats any comparison sort here because the value range is tiny.',
      complexity: { time: 'O(n)', space: 'O(1)' },
    },
    {
      pattern: 'two-pointers',
      rank: 2,
      why: 'The Dutch national flag partition: a low edge, a high edge and a scanner between them, each 0 swapped down and each 2 swapped up. One pass, and the trick generalises to quicksort partitioning.',
      complexity: { time: 'O(n)', space: 'O(1)' },
    },
  ],
  params: [
    { name: 'nums', label: 'Colours (0, 1, 2)', type: 'numberArray', default: [2, 0, 2, 1, 1, 0] },
  ],
  typescript: {
    starter: `const nums = [2, 0, 2, 1, 1, 0];

function sortColors(nums: number[]): number[] {
  // Dutch national flag: a low edge, a high edge and a scanner between them.
  // TODO
  return nums;
}
${colorsDriver.typescript}`,
    solution: `const nums = [2, 0, 2, 1, 1, 0];

function sortColors(nums: number[]): number[] {
  let low = 0;                 // everything before low is 0
  let high = nums.length - 1;  // everything after high is 2
  let i = 0;

  while (i <= high) {
    if (nums[i] === 0) {
      [nums[i], nums[low]] = [nums[low], nums[i]];
      low++;
      i++;
    } else if (nums[i] === 2) {
      [nums[i], nums[high]] = [nums[high], nums[i]];
      high--;
      // No i++ here: the value swapped in from the right is still unseen.
    } else {
      i++;
    }
  }

  return nums;
}
${colorsDriver.typescript}`,
  },
  python: {
    starter: `nums = [2, 0, 2, 1, 1, 0]


def sort_colors(nums):
    """Dutch national flag: a low edge, a high edge and a scanner between."""
    # TODO
    return nums
${colorsDriver.python}`,
    solution: `nums = [2, 0, 2, 1, 1, 0]


def sort_colors(nums):
    low = 0                 # everything before low is 0
    high = len(nums) - 1    # everything after high is 2
    i = 0

    while i <= high:
        if nums[i] == 0:
            nums[i], nums[low] = nums[low], nums[i]
            low += 1
            i += 1
        elif nums[i] == 2:
            nums[i], nums[high] = nums[high], nums[i]
            high -= 1
            # No i += 1 here: the value swapped in from the right is unseen.
        else:
            i += 1

    return nums
${colorsDriver.python}`,
  },
  expectedOutput: [
    'example 1 -> [0, 0, 1, 1, 2, 2]',
    'example 2 -> [0, 1, 2]',
    'example 3 -> [0]',
  ],
};

// --- 56 · Merge Intervals ----------------------------------------------------

const mergeDriver = {
  typescript: `
// --- examples ---------------------------------------------------------------
console.log('example 1 ->', merge([[1, 3], [2, 6], [8, 10], [15, 18]]));
console.log('example 2 ->', merge([[1, 4], [4, 5]]));
console.log('example 3 ->', merge([[1, 4], [0, 4]]));
`,
  python: `
# --- examples ---------------------------------------------------------------
print('example 1 ->', merge([[1, 3], [2, 6], [8, 10], [15, 18]]))
print('example 2 ->', merge([[1, 4], [4, 5]]))
print('example 3 ->', merge([[1, 4], [0, 4]]))
`,
};

export const mergeIntervals: LeetProblem = {
  slug: 'merge-intervals',
  number: 56,
  title: 'Merge Intervals',
  difficulty: 'Medium',
  topics: ['array', 'sorting'],
  prompt:
    'Given a list of [start, end] intervals in no particular order, merge every group that overlaps and return the non-overlapping intervals that cover exactly the same ground. Intervals that merely touch — [1,4] and [4,5] — count as overlapping.',
  constraints: ['1 ≤ intervals.length ≤ 10⁴', '0 ≤ start ≤ end ≤ 10⁴'],
  examples: [
    { input: 'intervals = [[1,3],[2,6],[8,10],[15,18]]', output: '[[1,6],[8,10],[15,18]]' },
    { input: 'intervals = [[1,4],[4,5]]', output: '[[1,5]]' },
    { input: 'intervals = [[1,4],[0,4]]', output: '[[0,4]]' },
  ],
  techniques: [
    {
      pattern: 'sorting',
      rank: 1,
      why: 'Sort by start time and the problem collapses: an interval can then only overlap the one immediately before it, so a single pass with one running interval is enough. Unsorted, every pair has to be compared.',
      complexity: { time: 'O(n log n)', space: 'O(n)' },
    },
  ],
  params: [],
  typescript: {
    starter: `function merge(intervals: number[][]): number[][] {
  // Sort by start, then extend one running interval as far as it reaches.
  // TODO
  return [];
}
${mergeDriver.typescript}`,
    solution: `function merge(intervals: number[][]): number[][] {
  if (intervals.length === 0) return [];

  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const out: number[][] = [sorted[0].slice()];

  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    const [start, end] = sorted[i];

    // Sorted by start, so an overlap can only be with the interval just kept.
    if (start <= last[1]) last[1] = Math.max(last[1], end);
    else out.push([start, end]);
  }

  return out;
}
${mergeDriver.typescript}`,
  },
  python: {
    starter: `def merge(intervals):
    """Sort by start, then extend one running interval as far as it reaches."""
    # TODO
    return []
${mergeDriver.python}`,
    solution: `def merge(intervals):
    if not intervals:
        return []

    ordered = sorted(intervals, key=lambda pair: pair[0])
    out = [list(ordered[0])]

    for start, end in ordered[1:]:
        last = out[-1]

        # Sorted by start, so an overlap can only be with the interval kept.
        if start <= last[1]:
            last[1] = max(last[1], end)
        else:
            out.append([start, end])

    return out
${mergeDriver.python}`,
  },
  expectedOutput: [
    'example 1 -> [[1, 6], [8, 10], [15, 18]]',
    'example 2 -> [[1, 5]]',
    'example 3 -> [[0, 4]]',
  ],
};

// --- 215 · Kth Largest Element in an Array -----------------------------------

const kthDriver = {
  typescript: `
// --- examples ---------------------------------------------------------------
console.log('example 1 ->', findKthLargest(nums, k));
console.log('example 2 ->', findKthLargest([3, 2, 3, 1, 2, 4, 5, 5, 6], 4));
console.log('example 3 ->', findKthLargest([1], 1));
`,
  python: `
# --- examples ---------------------------------------------------------------
print('example 1 ->', find_kth_largest(nums, k))
print('example 2 ->', find_kth_largest([3, 2, 3, 1, 2, 4, 5, 5, 6], 4))
print('example 3 ->', find_kth_largest([1], 1))
`,
};

export const kthLargest: LeetProblem = {
  slug: 'kth-largest-element-in-an-array',
  number: 215,
  title: 'Kth Largest Element in an Array',
  difficulty: 'Medium',
  topics: ['array', 'sorting', 'heap', 'divide-and-conquer'],
  prompt:
    'Return the kth largest element in the array. This is the kth largest by position in sorted order, not the kth distinct value — duplicates each take up a place.',
  constraints: ['1 ≤ k ≤ nums.length ≤ 10⁵', '-10⁴ ≤ nums[i] ≤ 10⁴'],
  examples: [
    { input: 'nums = [3,2,1,5,6,4], k = 2', output: '5' },
    { input: 'nums = [3,2,3,1,2,4,5,5,6], k = 4', output: '4' },
    { input: 'nums = [1], k = 1', output: '1' },
  ],
  techniques: [
    {
      pattern: 'sorting',
      rank: 1,
      why: 'Sort descending and index — the obvious answer, and a perfectly good one at these limits. The refinement below keeps only the k biggest in a size-k minimum heap, which is the same ordering idea done lazily: O(n log k) instead of O(n log n).',
      complexity: { time: 'O(n log n)', space: 'O(n)' },
    },
    {
      pattern: 'binary-search',
      rank: 2,
      why: 'Quickselect: partition around a pivot and recurse into the side that contains position k. It is binary search over a partition rather than a sorted array — linear on average, quadratic in the worst case.',
      complexity: { time: 'O(n)', space: 'O(1)' },
    },
  ],
  params: [
    { name: 'nums', label: 'Numbers', type: 'numberArray', default: [3, 2, 1, 5, 6, 4] },
    { name: 'k', label: 'k', type: 'number', default: 2, min: 1, max: 20 },
  ],
  typescript: {
    starter: `const nums = [3, 2, 1, 5, 6, 4];
const k = 2;

function findKthLargest(nums: number[], k: number): number {
  // A k-sized minimum heap keeps only the k biggest seen so far.
  // TODO
  return 0;
}
${kthDriver.typescript}`,
    solution: `const nums = [3, 2, 1, 5, 6, 4];
const k = 2;

function findKthLargest(nums: number[], k: number): number {
  // A minimum heap of size k: its root is the smallest of the k biggest
  // values, which is exactly the kth largest once every value has been seen.
  const heap: number[] = [];

  const push = (value: number) => {
    heap.push(value);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent] <= heap[i]) break;
      [heap[parent], heap[i]] = [heap[i], heap[parent]];
      i = parent;
    }
  };

  const pop = (): number => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let smallest = i;
        if (left < heap.length && heap[left] < heap[smallest]) smallest = left;
        if (right < heap.length && heap[right] < heap[smallest]) smallest = right;
        if (smallest === i) break;
        [heap[smallest], heap[i]] = [heap[i], heap[smallest]];
        i = smallest;
      }
    }
    return top;
  };

  for (const value of nums) {
    push(value);
    if (heap.length > k) pop();  // drop the smallest: it cannot be the answer
  }

  return heap[0];
}
${kthDriver.typescript}`,
  },
  python: {
    starter: `nums = [3, 2, 1, 5, 6, 4]
k = 2


def find_kth_largest(nums, k):
    """A k-sized minimum heap keeps only the k biggest seen so far."""
    # TODO
    return 0
${kthDriver.python}`,
    solution: `import heapq

nums = [3, 2, 1, 5, 6, 4]
k = 2


def find_kth_largest(nums, k):
    # A minimum heap of size k: its root is the smallest of the k biggest
    # values, which is exactly the kth largest once every value is in.
    heap = []

    for value in nums:
        heapq.heappush(heap, value)
        if len(heap) > k:
            heapq.heappop(heap)  # drop the smallest: it cannot be the answer

    return heap[0]
${kthDriver.python}`,
  },
  expectedOutput: ['example 1 -> 5', 'example 2 -> 4', 'example 3 -> 1'],
};

export const SORTING_PROBLEMS = [sortColors, mergeIntervals, kthLargest];
