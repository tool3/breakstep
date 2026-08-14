import type { LeetProblem } from '../types';

/**
 * Two-pointer problems.
 *
 * Every problem restates the task in our own words and ships the exact example
 * datasets the site uses, so a run here answers the same question the judge asks.
 */

// --- 167 · Two Sum II --------------------------------------------------------

const twoSumDriver = {
  typescript: `
// --- examples ---------------------------------------------------------------
console.log('example 1 ->', twoSum(numbers, target));
console.log('example 2 ->', twoSum([2, 3, 4], 6));
console.log('example 3 ->', twoSum([-1, 0], -1));
`,
  python: `
# --- examples ---------------------------------------------------------------
print('example 1 ->', two_sum(numbers, target))
print('example 2 ->', two_sum([2, 3, 4], 6))
print('example 3 ->', two_sum([-1, 0], -1))
`,
};

export const twoSumII: LeetProblem = {
  slug: 'two-sum-ii-input-array-is-sorted',
  number: 167,
  title: 'Two Sum II — Input Array Is Sorted',
  difficulty: 'Medium',
  topics: ['array', 'two-pointers', 'binary-search'],
  prompt:
    'A 1-indexed array is sorted in non-decreasing order. Find the two numbers that add up to a target and return their 1-based positions. Exactly one such pair exists, and you may not use the same element twice. Solve it in constant extra space.',
  constraints: [
    '2 ≤ numbers.length ≤ 3·10⁴',
    '-1000 ≤ numbers[i] ≤ 1000',
    'numbers is sorted in non-decreasing order',
    'Exactly one valid answer exists',
  ],
  examples: [
    { input: 'numbers = [2,7,11,15], target = 9', output: '[1,2]', note: '2 + 7 = 9' },
    { input: 'numbers = [2,3,4], target = 6', output: '[1,3]', note: '2 + 4 = 6' },
    { input: 'numbers = [-1,0], target = -1', output: '[1,2]', note: '-1 + 0 = -1' },
  ],
  techniques: [
    {
      pattern: 'two-pointers',
      rank: 1,
      why: 'The array is sorted, so one comparison is decisive: if the ends sum too low, the left value cannot pair with anything smaller, and it is gone for good. Each step drops a whole row of the pair matrix.',
      complexity: { time: 'O(n)', space: 'O(1)' },
    },
    {
      pattern: 'binary-search',
      rank: 2,
      why: 'Fix one index and binary-search for its complement. It respects the constant-space rule too, but pays a log factor the two-pointer sweep does not.',
      complexity: { time: 'O(n log n)', space: 'O(1)' },
    },
  ],
  params: [
    {
      name: 'numbers',
      label: 'Sorted numbers',
      type: 'numberArray',
      default: [2, 7, 11, 15],
      help: 'Must stay sorted ascending — the two-pointer invariant depends on it.',
    },
    { name: 'target', label: 'Target', type: 'number', default: 9, min: -1000, max: 1000 },
  ],
  typescript: {
    starter: `const numbers = [2, 7, 11, 15];
const target = 9;

function twoSum(numbers: number[], target: number): number[] {
  // Two pointers: start at both ends and let the sum steer you.
  // TODO
  return [];
}
${twoSumDriver.typescript}`,
    solution: `const numbers = [2, 7, 11, 15];
const target = 9;

function twoSum(numbers: number[], target: number): number[] {
  let lo = 0;
  let hi = numbers.length - 1;

  while (lo < hi) {
    const sum = numbers[lo] + numbers[hi];
    if (sum === target) return [lo + 1, hi + 1];  // the answer is 1-indexed
    if (sum < target) lo++;   // too small: only a bigger left value can help
    else hi--;                // too big: only a smaller right value can help
  }

  return [];
}
${twoSumDriver.typescript}`,
  },
  python: {
    starter: `numbers = [2, 7, 11, 15]
target = 9


def two_sum(numbers, target):
    """Two pointers: start at both ends and let the sum steer you."""
    # TODO
    return []
${twoSumDriver.python}`,
    solution: `numbers = [2, 7, 11, 15]
target = 9


def two_sum(numbers, target):
    lo, hi = 0, len(numbers) - 1

    while lo < hi:
        total = numbers[lo] + numbers[hi]
        if total == target:
            return [lo + 1, hi + 1]  # the answer is 1-indexed
        if total < target:
            lo += 1   # too small: only a bigger left value can help
        else:
            hi -= 1   # too big: only a smaller right value can help

    return []
${twoSumDriver.python}`,
  },
  expectedOutput: ['example 1 -> [1, 2]', 'example 2 -> [1, 3]', 'example 3 -> [1, 2]'],
};

// --- 11 · Container With Most Water ------------------------------------------

const containerDriver = {
  typescript: `
// --- examples ---------------------------------------------------------------
console.log('example 1 ->', maxArea(height));
console.log('example 2 ->', maxArea([1, 1]));
console.log('example 3 ->', maxArea([4, 3, 2, 1, 4]));
`,
  python: `
# --- examples ---------------------------------------------------------------
print('example 1 ->', max_area(height))
print('example 2 ->', max_area([1, 1]))
print('example 3 ->', max_area([4, 3, 2, 1, 4]))
`,
};

export const containerWithMostWater: LeetProblem = {
  slug: 'container-with-most-water',
  number: 11,
  title: 'Container With Most Water',
  difficulty: 'Medium',
  topics: ['array', 'two-pointers', 'greedy'],
  prompt:
    'Each entry of the array is the height of a vertical line at that index. Pick two lines so that the container they form with the x-axis holds the most water, and return that area. The container cannot be tilted.',
  constraints: ['2 ≤ height.length ≤ 10⁵', '0 ≤ height[i] ≤ 10⁴'],
  examples: [
    { input: 'height = [1,8,6,2,5,4,8,3,7]', output: '49', note: 'lines at index 1 and 8: min(8,7) × 7' },
    { input: 'height = [1,1]', output: '1' },
    { input: 'height = [4,3,2,1,4]', output: '16', note: 'the two 4s, four apart' },
  ],
  techniques: [
    {
      pattern: 'two-pointers',
      rank: 1,
      why: 'Start at the widest pair. Moving the taller line in can only lose width without gaining height, so the shorter line is the one that must move — every step safely discards a whole set of pairs.',
      complexity: { time: 'O(n)', space: 'O(1)' },
    },
  ],
  params: [
    {
      name: 'height',
      label: 'Line heights',
      type: 'numberArray',
      default: [1, 8, 6, 2, 5, 4, 8, 3, 7],
    },
  ],
  typescript: {
    starter: `const height = [1, 8, 6, 2, 5, 4, 8, 3, 7];

function maxArea(height: number[]): number {
  // Widest first, then move the shorter side inwards.
  // TODO
  return 0;
}
${containerDriver.typescript}`,
    solution: `const height = [1, 8, 6, 2, 5, 4, 8, 3, 7];

function maxArea(height: number[]): number {
  let lo = 0;
  let hi = height.length - 1;
  let best = 0;

  while (lo < hi) {
    const area = Math.min(height[lo], height[hi]) * (hi - lo);
    if (area > best) best = area;

    // Only the shorter line limits the area, so it is the one worth replacing.
    if (height[lo] < height[hi]) lo++;
    else hi--;
  }

  return best;
}
${containerDriver.typescript}`,
  },
  python: {
    starter: `height = [1, 8, 6, 2, 5, 4, 8, 3, 7]


def max_area(height):
    """Widest first, then move the shorter side inwards."""
    # TODO
    return 0
${containerDriver.python}`,
    solution: `height = [1, 8, 6, 2, 5, 4, 8, 3, 7]


def max_area(height):
    lo, hi = 0, len(height) - 1
    best = 0

    while lo < hi:
        area = min(height[lo], height[hi]) * (hi - lo)
        if area > best:
            best = area

        # Only the shorter line limits the area, so it is the one to replace.
        if height[lo] < height[hi]:
            lo += 1
        else:
            hi -= 1

    return best
${containerDriver.python}`,
  },
  expectedOutput: ['example 1 -> 49', 'example 2 -> 1', 'example 3 -> 16'],
};

// --- 15 · 3Sum ---------------------------------------------------------------

const threeSumDriver = {
  typescript: `
// --- examples ---------------------------------------------------------------
console.log('example 1 ->', threeSum(nums));
console.log('example 2 ->', threeSum([0, 1, 1]));
console.log('example 3 ->', threeSum([0, 0, 0]));
`,
  python: `
# --- examples ---------------------------------------------------------------
print('example 1 ->', three_sum(nums))
print('example 2 ->', three_sum([0, 1, 1]))
print('example 3 ->', three_sum([0, 0, 0]))
`,
};

export const threeSum: LeetProblem = {
  slug: '3sum',
  number: 15,
  title: '3Sum',
  difficulty: 'Medium',
  topics: ['array', 'two-pointers', 'sorting'],
  prompt:
    'Return every distinct triple in the array that sums to zero. Two triples are the same if they contain the same three values, so the answer must not repeat a triple — but the order of the triples, and of the values inside them, does not matter.',
  constraints: ['3 ≤ nums.length ≤ 3000', '-10⁵ ≤ nums[i] ≤ 10⁵'],
  examples: [
    { input: 'nums = [-1,0,1,2,-1,-4]', output: '[[-1,-1,2],[-1,0,1]]' },
    { input: 'nums = [0,1,1]', output: '[]', note: 'no triple sums to zero' },
    { input: 'nums = [0,0,0]', output: '[[0,0,0]]' },
  ],
  techniques: [
    {
      pattern: 'sorting',
      rank: 1,
      why: 'Sorting first is what makes everything else work: it turns "find two numbers summing to -x" into a two-pointer sweep, and it puts duplicates next to each other so they can be skipped in one comparison.',
      complexity: { time: 'O(n log n)', space: 'O(1)' },
    },
    {
      pattern: 'two-pointers',
      rank: 2,
      why: 'With the array sorted, fix the first value and converge on the remaining pair. That is n sweeps of O(n) — quadratic overall, against the cubic brute force.',
      complexity: { time: 'O(n^2)', space: 'O(1)' },
    },
  ],
  params: [
    { name: 'nums', label: 'Numbers', type: 'numberArray', default: [-1, 0, 1, 2, -1, -4] },
  ],
  typescript: {
    starter: `const nums = [-1, 0, 1, 2, -1, -4];

function threeSum(nums: number[]): number[][] {
  // Sort, fix the first value, then two-pointer the rest.
  // TODO
  return [];
}
${threeSumDriver.typescript}`,
    solution: `const nums = [-1, 0, 1, 2, -1, -4];

function threeSum(nums: number[]): number[][] {
  const sorted = [...nums].sort((a, b) => a - b);
  const out: number[][] = [];

  for (let i = 0; i < sorted.length - 2; i++) {
    // Everything from here on is positive, so no triple can reach zero.
    if (sorted[i] > 0) break;
    // Skip a repeated first value: it would only rebuild the same triples.
    if (i > 0 && sorted[i] === sorted[i - 1]) continue;

    let lo = i + 1;
    let hi = sorted.length - 1;

    while (lo < hi) {
      const sum = sorted[i] + sorted[lo] + sorted[hi];

      if (sum < 0) {
        lo++;
      } else if (sum > 0) {
        hi--;
      } else {
        out.push([sorted[i], sorted[lo], sorted[hi]]);
        lo++;
        hi--;
        while (lo < hi && sorted[lo] === sorted[lo - 1]) lo++;
        while (lo < hi && sorted[hi] === sorted[hi + 1]) hi--;
      }
    }
  }

  return out;
}
${threeSumDriver.typescript}`,
  },
  python: {
    starter: `nums = [-1, 0, 1, 2, -1, -4]


def three_sum(nums):
    """Sort, fix the first value, then two-pointer the rest."""
    # TODO
    return []
${threeSumDriver.python}`,
    solution: `nums = [-1, 0, 1, 2, -1, -4]


def three_sum(nums):
    ordered = sorted(nums)
    out = []

    for i in range(len(ordered) - 2):
        # Everything from here on is positive, so no triple can reach zero.
        if ordered[i] > 0:
            break
        # Skip a repeated first value: it would only rebuild the same triples.
        if i > 0 and ordered[i] == ordered[i - 1]:
            continue

        lo, hi = i + 1, len(ordered) - 1
        while lo < hi:
            total = ordered[i] + ordered[lo] + ordered[hi]

            if total < 0:
                lo += 1
            elif total > 0:
                hi -= 1
            else:
                out.append([ordered[i], ordered[lo], ordered[hi]])
                lo += 1
                hi -= 1
                while lo < hi and ordered[lo] == ordered[lo - 1]:
                    lo += 1
                while lo < hi and ordered[hi] == ordered[hi + 1]:
                    hi -= 1

    return out
${threeSumDriver.python}`,
  },
  expectedOutput: [
    'example 1 -> [[-1, -1, 2], [-1, 0, 1]]',
    'example 2 -> []',
    'example 3 -> [[0, 0, 0]]',
  ],
};

export const TWO_POINTER_PROBLEMS = [twoSumII, containerWithMostWater, threeSum];
