import type { LeetProblem } from '../types';

// --- 704 · Binary Search -----------------------------------------------------

const searchDriver = {
  typescript: `
// --- examples ---------------------------------------------------------------
console.log('example 1 ->', search(nums, target));
console.log('example 2 ->', search([-1, 0, 3, 5, 9, 12], 2));
console.log('example 3 ->', search([5], 5));
`,
  python: `
# --- examples ---------------------------------------------------------------
print('example 1 ->', search(nums, target))
print('example 2 ->', search([-1, 0, 3, 5, 9, 12], 2))
print('example 3 ->', search([5], 5))
`,
};

export const binarySearchProblem: LeetProblem = {
  slug: 'binary-search',
  number: 704,
  title: 'Binary Search',
  difficulty: 'Easy',
  topics: ['array', 'binary-search'],
  prompt:
    'Given a sorted array of distinct integers and a target, return the index of the target, or -1 if it is not present. The search must run in logarithmic time.',
  constraints: [
    '1 ≤ nums.length ≤ 10⁴',
    '-10⁴ < nums[i], target < 10⁴',
    'All values are distinct and sorted ascending',
  ],
  examples: [
    { input: 'nums = [-1,0,3,5,9,12], target = 9', output: '4' },
    { input: 'nums = [-1,0,3,5,9,12], target = 2', output: '-1' },
    { input: 'nums = [5], target = 5', output: '0' },
  ],
  techniques: [
    {
      pattern: 'binary-search',
      rank: 1,
      why: 'The array is sorted, so one comparison against the middle rules out half of what is left. Twenty steps cover a million elements.',
      complexity: { time: 'O(log n)', space: 'O(1)' },
    },
  ],
  params: [
    { name: 'nums', label: 'Sorted array', type: 'numberArray', default: [-1, 0, 3, 5, 9, 12] },
    { name: 'target', label: 'Target', type: 'number', default: 9, min: -10000, max: 10000 },
  ],
  typescript: {
    starter: `const nums = [-1, 0, 3, 5, 9, 12];
const target = 9;

function search(nums: number[], target: number): number {
  // Halve the search space on every comparison.
  // TODO
  return -1;
}
${searchDriver.typescript}`,
    solution: `const nums = [-1, 0, 3, 5, 9, 12];
const target = 9;

function search(nums: number[], target: number): number {
  let lo = 0;
  let hi = nums.length - 1;

  while (lo <= hi) {
    // Written this way rather than (lo + hi) / 2, which can overflow in
    // languages with fixed-width integers. The habit is worth keeping.
    const mid = lo + Math.floor((hi - lo) / 2);

    if (nums[mid] === target) return mid;
    if (nums[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }

  return -1;
}
${searchDriver.typescript}`,
  },
  python: {
    starter: `nums = [-1, 0, 3, 5, 9, 12]
target = 9


def search(nums, target):
    """Halve the search space on every comparison."""
    # TODO
    return -1
${searchDriver.python}`,
    solution: `nums = [-1, 0, 3, 5, 9, 12]
target = 9


def search(nums, target):
    lo, hi = 0, len(nums) - 1

    while lo <= hi:
        mid = lo + (hi - lo) // 2

        if nums[mid] == target:
            return mid
        if nums[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1

    return -1
${searchDriver.python}`,
  },
  expectedOutput: ['example 1 -> 4', 'example 2 -> -1', 'example 3 -> 0'],
};

// --- 33 · Search in Rotated Sorted Array -------------------------------------

const rotatedDriver = {
  typescript: `
// --- examples ---------------------------------------------------------------
console.log('example 1 ->', searchRotated(nums, target));
console.log('example 2 ->', searchRotated([4, 5, 6, 7, 0, 1, 2], 3));
console.log('example 3 ->', searchRotated([1], 0));
`,
  python: `
# --- examples ---------------------------------------------------------------
print('example 1 ->', search_rotated(nums, target))
print('example 2 ->', search_rotated([4, 5, 6, 7, 0, 1, 2], 3))
print('example 3 ->', search_rotated([1], 0))
`,
};

export const searchRotatedArray: LeetProblem = {
  slug: 'search-in-rotated-sorted-array',
  number: 33,
  title: 'Search in Rotated Sorted Array',
  difficulty: 'Medium',
  topics: ['array', 'binary-search'],
  prompt:
    'A sorted array of distinct integers has been rotated left an unknown number of times — [0,1,2,4,5,6,7] might arrive as [4,5,6,7,0,1,2]. Find the index of a target, or -1. It still has to run in logarithmic time.',
  constraints: [
    '1 ≤ nums.length ≤ 5000',
    '-10⁴ ≤ nums[i], target ≤ 10⁴',
    'All values are distinct',
  ],
  examples: [
    { input: 'nums = [4,5,6,7,0,1,2], target = 0', output: '4' },
    { input: 'nums = [4,5,6,7,0,1,2], target = 3', output: '-1' },
    { input: 'nums = [1], target = 0', output: '-1' },
  ],
  techniques: [
    {
      pattern: 'binary-search',
      rank: 1,
      why: 'A rotation leaves one half of any split still perfectly sorted. Work out which half that is, and you can tell in one comparison whether the target lives there — so half still goes away each step.',
      complexity: { time: 'O(log n)', space: 'O(1)' },
    },
  ],
  params: [
    { name: 'nums', label: 'Rotated array', type: 'numberArray', default: [4, 5, 6, 7, 0, 1, 2] },
    { name: 'target', label: 'Target', type: 'number', default: 0, min: -10000, max: 10000 },
  ],
  typescript: {
    starter: `const nums = [4, 5, 6, 7, 0, 1, 2];
const target = 0;

function searchRotated(nums: number[], target: number): number {
  // One side of every split is still sorted — find out which.
  // TODO
  return -1;
}
${rotatedDriver.typescript}`,
    solution: `const nums = [4, 5, 6, 7, 0, 1, 2];
const target = 0;

function searchRotated(nums: number[], target: number): number {
  let lo = 0;
  let hi = nums.length - 1;

  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (nums[mid] === target) return mid;

    if (nums[lo] <= nums[mid]) {
      // The left half is sorted, so a range check settles it.
      if (nums[lo] <= target && target < nums[mid]) hi = mid - 1;
      else lo = mid + 1;
    } else {
      // Otherwise the right half is the sorted one.
      if (nums[mid] < target && target <= nums[hi]) lo = mid + 1;
      else hi = mid - 1;
    }
  }

  return -1;
}
${rotatedDriver.typescript}`,
  },
  python: {
    starter: `nums = [4, 5, 6, 7, 0, 1, 2]
target = 0


def search_rotated(nums, target):
    """One side of every split is still sorted - find out which."""
    # TODO
    return -1
${rotatedDriver.python}`,
    solution: `nums = [4, 5, 6, 7, 0, 1, 2]
target = 0


def search_rotated(nums, target):
    lo, hi = 0, len(nums) - 1

    while lo <= hi:
        mid = lo + (hi - lo) // 2
        if nums[mid] == target:
            return mid

        if nums[lo] <= nums[mid]:
            # The left half is sorted, so a range check settles it.
            if nums[lo] <= target < nums[mid]:
                hi = mid - 1
            else:
                lo = mid + 1
        else:
            # Otherwise the right half is the sorted one.
            if nums[mid] < target <= nums[hi]:
                lo = mid + 1
            else:
                hi = mid - 1

    return -1
${rotatedDriver.python}`,
  },
  expectedOutput: ['example 1 -> 4', 'example 2 -> -1', 'example 3 -> -1'],
};

// --- 875 · Koko Eating Bananas -----------------------------------------------

const kokoDriver = {
  typescript: `
// --- examples ---------------------------------------------------------------
console.log('example 1 ->', minEatingSpeed(piles, hours));
console.log('example 2 ->', minEatingSpeed([30, 11, 23, 4, 20], 5));
console.log('example 3 ->', minEatingSpeed([30, 11, 23, 4, 20], 6));
`,
  python: `
# --- examples ---------------------------------------------------------------
print('example 1 ->', min_eating_speed(piles, hours))
print('example 2 ->', min_eating_speed([30, 11, 23, 4, 20], 5))
print('example 3 ->', min_eating_speed([30, 11, 23, 4, 20], 6))
`,
};

export const kokoEatingBananas: LeetProblem = {
  slug: 'koko-eating-bananas',
  number: 875,
  title: 'Koko Eating Bananas',
  difficulty: 'Medium',
  topics: ['array', 'binary-search'],
  prompt:
    'There are n piles of bananas and h hours before the guards return. Koko picks an eating speed k and each hour eats k bananas from one pile — if the pile is smaller she finishes it and waits out the hour. Return the smallest k that clears every pile within h hours.',
  constraints: ['1 ≤ piles.length ≤ 10⁴', 'piles.length ≤ h ≤ 10⁹', '1 ≤ piles[i] ≤ 10⁹'],
  examples: [
    { input: 'piles = [3,6,7,11], h = 8', output: '4' },
    { input: 'piles = [30,11,23,4,20], h = 5', output: '30' },
    { input: 'piles = [30,11,23,4,20], h = 6', output: '23' },
  ],
  techniques: [
    {
      pattern: 'binary-search',
      rank: 1,
      why: 'Binary search on the answer, not the array. "Can she finish at speed k?" is monotone — false, false, …, true, true — so the boundary between the two can be found by halving the speed range.',
      complexity: { time: 'O(n log n)', space: 'O(1)' },
    },
  ],
  params: [
    { name: 'piles', label: 'Pile sizes', type: 'numberArray', default: [3, 6, 7, 11] },
    { name: 'hours', label: 'Hours available', type: 'number', default: 8, min: 1, max: 200 },
  ],
  typescript: {
    starter: `const piles = [3, 6, 7, 11];
const hours = 8;

function minEatingSpeed(piles: number[], h: number): number {
  // Binary search the SPEED, not the array: "finishes in time?" is monotone.
  // TODO
  return 1;
}
${kokoDriver.typescript}`,
    solution: `const piles = [3, 6, 7, 11];
const hours = 8;

function minEatingSpeed(piles: number[], h: number): number {
  const hoursNeeded = (speed: number): number => {
    let total = 0;
    for (const pile of piles) total += Math.ceil(pile / speed);
    return total;
  };

  let lo = 1;
  let hi = Math.max(...piles);  // no reason to ever eat faster than the biggest pile

  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    // Fast enough: mid might be the answer, so keep it in the range.
    if (hoursNeeded(mid) <= h) hi = mid;
    else lo = mid + 1;
  }

  return lo;
}
${kokoDriver.typescript}`,
  },
  python: {
    starter: `piles = [3, 6, 7, 11]
hours = 8


def min_eating_speed(piles, h):
    """Binary search the SPEED: "finishes in time?" is monotone."""
    # TODO
    return 1
${kokoDriver.python}`,
    solution: `piles = [3, 6, 7, 11]
hours = 8


def min_eating_speed(piles, h):
    def hours_needed(speed):
        total = 0
        for pile in piles:
            total += -(-pile // speed)  # ceiling division
        return total

    lo, hi = 1, max(piles)  # no reason to eat faster than the biggest pile

    while lo < hi:
        mid = lo + (hi - lo) // 2
        # Fast enough: mid might be the answer, so keep it in the range.
        if hours_needed(mid) <= h:
            hi = mid
        else:
            lo = mid + 1

    return lo
${kokoDriver.python}`,
  },
  expectedOutput: ['example 1 -> 4', 'example 2 -> 30', 'example 3 -> 23'],
};

export const BINARY_SEARCH_PROBLEMS = [
  binarySearchProblem,
  searchRotatedArray,
  kokoEatingBananas,
];
