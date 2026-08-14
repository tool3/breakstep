import type { LeetProblem } from '../types';

// --- 78 · Subsets ------------------------------------------------------------

const subsetsDriver = {
  typescript: `
// --- examples ---------------------------------------------------------------
console.log('example 1 ->', subsets(nums));
console.log('example 2 ->', subsets([0]));
console.log('count for [1,2,3,4] ->', subsets([1, 2, 3, 4]).length);
`,
  python: `
# --- examples ---------------------------------------------------------------
print('example 1 ->', subsets(nums))
print('example 2 ->', subsets([0]))
print('count for [1,2,3,4] ->', len(subsets([1, 2, 3, 4])))
`,
};

export const subsetsProblem: LeetProblem = {
  slug: 'subsets',
  number: 78,
  title: 'Subsets',
  difficulty: 'Medium',
  topics: ['array', 'backtracking', 'bit-manipulation'],
  prompt:
    'Return the power set of an array of distinct integers — every possible subset, including the empty one and the array itself. The subsets may come back in any order.',
  constraints: ['1 ≤ nums.length ≤ 10', '-10 ≤ nums[i] ≤ 10', 'All values are distinct'],
  examples: [
    { input: 'nums = [1,2,3]', output: '[[],[1],[1,2],[1,2,3],[1,3],[2],[2,3],[3]]' },
    { input: 'nums = [0]', output: '[[],[0]]' },
    { input: 'nums = [1,2,3,4]', output: '16 subsets', note: 'always 2ⁿ of them' },
  ],
  techniques: [
    {
      pattern: 'backtracking',
      rank: 1,
      why: 'Each element is a yes/no decision, so the search tree has 2ⁿ leaves and every node on the way down is itself a valid subset. Record on entry, recurse, then undo the choice — the classic choose/explore/un-choose loop.',
      complexity: { time: 'O(2^n)', space: 'O(n)' },
    },
    {
      pattern: 'recursion',
      rank: 2,
      why: 'Without any pruning this is plain recursive enumeration: the subsets of a list are the subsets of its tail, with and without the head.',
      complexity: { time: 'O(2^n)', space: 'O(n)' },
    },
  ],
  params: [{ name: 'nums', label: 'Distinct numbers', type: 'numberArray', default: [1, 2, 3] }],
  typescript: {
    starter: `const nums = [1, 2, 3];

function subsets(nums: number[]): number[][] {
  // Choose, explore, un-choose.
  // TODO
  return [];
}
${subsetsDriver.typescript}`,
    solution: `const nums = [1, 2, 3];

function subsets(nums: number[]): number[][] {
  const out: number[][] = [];
  const current: number[] = [];

  const explore = (start: number) => {
    // Every node of the search tree is a subset, not just the leaves.
    out.push([...current]);

    for (let i = start; i < nums.length; i++) {
      current.push(nums[i]);   // choose
      explore(i + 1);          // explore what follows it
      current.pop();           // un-choose, so the next branch starts clean
    }
  };

  explore(0);
  return out;
}
${subsetsDriver.typescript}`,
  },
  python: {
    starter: `nums = [1, 2, 3]


def subsets(nums):
    """Choose, explore, un-choose."""
    # TODO
    return []
${subsetsDriver.python}`,
    solution: `nums = [1, 2, 3]


def subsets(nums):
    out = []
    current = []

    def explore(start):
        # Every node of the search tree is a subset, not just the leaves.
        out.append(list(current))

        for i in range(start, len(nums)):
            current.append(nums[i])  # choose
            explore(i + 1)           # explore what follows it
            current.pop()            # un-choose, so the next branch is clean

    explore(0)
    return out
${subsetsDriver.python}`,
  },
  expectedOutput: [
    'example 1 -> [[], [1], [1, 2], [1, 2, 3], [1, 3], [2], [2, 3], [3]]',
    'example 2 -> [[], [0]]',
    'count for [1,2,3,4] -> 16',
  ],
};

// --- 46 · Permutations -------------------------------------------------------

const permutationsDriver = {
  typescript: `
// --- examples ---------------------------------------------------------------
console.log('example 1 ->', permute(nums));
console.log('example 2 ->', permute([0, 1]));
console.log('example 3 ->', permute([1]));
`,
  python: `
# --- examples ---------------------------------------------------------------
print('example 1 ->', permute(nums))
print('example 2 ->', permute([0, 1]))
print('example 3 ->', permute([1]))
`,
};

export const permutationsProblem: LeetProblem = {
  slug: 'permutations',
  number: 46,
  title: 'Permutations',
  difficulty: 'Medium',
  topics: ['array', 'backtracking'],
  prompt:
    'Return every ordering of an array of distinct integers. The orderings may come back in any order themselves.',
  constraints: ['1 ≤ nums.length ≤ 6', '-10 ≤ nums[i] ≤ 10', 'All values are distinct'],
  examples: [
    { input: 'nums = [1,2,3]', output: '[[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]]' },
    { input: 'nums = [0,1]', output: '[[0,1],[1,0]]' },
    { input: 'nums = [1]', output: '[[1]]' },
  ],
  techniques: [
    {
      pattern: 'backtracking',
      rank: 1,
      why: 'Pick an unused value for each position in turn. The "used" marks are the whole difference from subsets: they are what stops a value being placed twice, and undoing them on the way back out is what frees it for the next branch.',
      complexity: { time: 'O(n!)', space: 'O(n)' },
    },
  ],
  params: [{ name: 'nums', label: 'Distinct numbers', type: 'numberArray', default: [1, 2, 3] }],
  typescript: {
    starter: `const nums = [1, 2, 3];

function permute(nums: number[]): number[][] {
  // Fill each position with a value not already used.
  // TODO
  return [];
}
${permutationsDriver.typescript}`,
    solution: `const nums = [1, 2, 3];

function permute(nums: number[]): number[][] {
  const out: number[][] = [];
  const current: number[] = [];
  const used = new Array<boolean>(nums.length).fill(false);

  const explore = () => {
    // A full-length arrangement is a leaf — nothing left to decide.
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
      used[i] = false;  // released again for the sibling branches
    }
  };

  explore();
  return out;
}
${permutationsDriver.typescript}`,
  },
  python: {
    starter: `nums = [1, 2, 3]


def permute(nums):
    """Fill each position with a value not already used."""
    # TODO
    return []
${permutationsDriver.python}`,
    solution: `nums = [1, 2, 3]


def permute(nums):
    out = []
    current = []
    used = [False] * len(nums)

    def explore():
        # A full-length arrangement is a leaf - nothing left to decide.
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
            used[i] = False  # released again for the sibling branches

    explore()
    return out
${permutationsDriver.python}`,
  },
  expectedOutput: [
    'example 1 -> [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]]',
    'example 2 -> [[0, 1], [1, 0]]',
    'example 3 -> [[1]]',
  ],
};

// --- 39 · Combination Sum ----------------------------------------------------

const combinationDriver = {
  typescript: `
// --- examples ---------------------------------------------------------------
console.log('example 1 ->', combinationSum(candidates, target));
console.log('example 2 ->', combinationSum([2, 3, 5], 8));
console.log('example 3 ->', combinationSum([2], 1));
`,
  python: `
# --- examples ---------------------------------------------------------------
print('example 1 ->', combination_sum(candidates, target))
print('example 2 ->', combination_sum([2, 3, 5], 8))
print('example 3 ->', combination_sum([2], 1))
`,
};

export const combinationSum: LeetProblem = {
  slug: 'combination-sum',
  number: 39,
  title: 'Combination Sum',
  difficulty: 'Medium',
  topics: ['array', 'backtracking'],
  prompt:
    'Given distinct candidate numbers and a target, return every combination that sums to the target. A candidate may be reused as many times as you like, and two combinations differ only if the multiset of numbers differs — not the order.',
  constraints: [
    '1 ≤ candidates.length ≤ 30',
    '2 ≤ candidates[i] ≤ 40',
    'All candidates are distinct',
    '1 ≤ target ≤ 40',
  ],
  examples: [
    { input: 'candidates = [2,3,6,7], target = 7', output: '[[2,2,3],[7]]' },
    { input: 'candidates = [2,3,5], target = 8', output: '[[2,2,2,2],[2,3,3],[3,5]]' },
    { input: 'candidates = [2], target = 1', output: '[]' },
  ],
  techniques: [
    {
      pattern: 'backtracking',
      rank: 1,
      why: 'Recurse on the remaining target, subtracting a candidate each time. Two rules keep it finite and duplicate-free: never look back at an earlier candidate, and abandon a branch the moment the remainder goes negative.',
      complexity: { time: 'O(2^n)', space: 'O(n)' },
    },
  ],
  params: [
    { name: 'candidates', label: 'Candidates', type: 'numberArray', default: [2, 3, 6, 7] },
    { name: 'target', label: 'Target', type: 'number', default: 7, min: 1, max: 40 },
  ],
  typescript: {
    starter: `const candidates = [2, 3, 6, 7];
const target = 7;

function combinationSum(candidates: number[], target: number): number[][] {
  // Subtract a candidate, recurse, put it back. Never look backwards.
  // TODO
  return [];
}
${combinationDriver.typescript}`,
    solution: `const candidates = [2, 3, 6, 7];
const target = 7;

function combinationSum(candidates: number[], target: number): number[][] {
  const out: number[][] = [];
  const current: number[] = [];

  const explore = (start: number, remaining: number) => {
    if (remaining === 0) {
      out.push([...current]);
      return;
    }
    if (remaining < 0) return;  // overshot: this branch is dead

    for (let i = start; i < candidates.length; i++) {
      current.push(candidates[i]);
      // i, not i + 1: the same candidate may be used again. Never going
      // backwards is what keeps [2,3] and [3,2] from both appearing.
      explore(i, remaining - candidates[i]);
      current.pop();
    }
  };

  explore(0, target);
  return out;
}
${combinationDriver.typescript}`,
  },
  python: {
    starter: `candidates = [2, 3, 6, 7]
target = 7


def combination_sum(candidates, target):
    """Subtract a candidate, recurse, put it back. Never look backwards."""
    # TODO
    return []
${combinationDriver.python}`,
    solution: `candidates = [2, 3, 6, 7]
target = 7


def combination_sum(candidates, target):
    out = []
    current = []

    def explore(start, remaining):
        if remaining == 0:
            out.append(list(current))
            return
        if remaining < 0:
            return  # overshot: this branch is dead

        for i in range(start, len(candidates)):
            current.append(candidates[i])
            # i, not i + 1: the same candidate may be used again. Never going
            # backwards is what keeps [2,3] and [3,2] from both appearing.
            explore(i, remaining - candidates[i])
            current.pop()

    explore(0, target)
    return out
${combinationDriver.python}`,
  },
  expectedOutput: [
    'example 1 -> [[2, 2, 3], [7]]',
    'example 2 -> [[2, 2, 2, 2], [2, 3, 3], [3, 5]]',
    'example 3 -> []',
  ],
};

export const BACKTRACKING_PROBLEMS = [subsetsProblem, permutationsProblem, combinationSum];
