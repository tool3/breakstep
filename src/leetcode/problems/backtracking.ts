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


// --- 79 · Word Search --------------------------------------------------------

const wordSearchDriver = {
  typescript: `
// --- examples ---------------------------------------------------------------
const board = [
  ['A', 'B', 'C', 'E'],
  ['S', 'F', 'C', 'S'],
  ['A', 'D', 'E', 'E'],
];
console.log('example 1 ->', exist(board, word) ? 'true' : 'false');
console.log('example 2 ->', exist(board, 'SEE') ? 'true' : 'false');
console.log('example 3 ->', exist(board, 'ABCB') ? 'true' : 'false');
`,
  python: `
# --- examples ---------------------------------------------------------------
board = [
    ['A', 'B', 'C', 'E'],
    ['S', 'F', 'C', 'S'],
    ['A', 'D', 'E', 'E'],
]
print('example 1 ->', 'true' if exist(board, word) else 'false')
print('example 2 ->', 'true' if exist(board, 'SEE') else 'false')
print('example 3 ->', 'true' if exist(board, 'ABCB') else 'false')
`,
};

export const wordSearch: LeetProblem = {
  slug: 'word-search',
  number: 79,
  title: 'Word Search',
  difficulty: 'Medium',
  topics: ['array', 'string', 'backtracking', 'depth-first-search', 'matrix'],
  prompt:
    'Decide whether a word can be spelled out in the grid by moving between cells that share an edge. A cell may not be used twice in the same word.',
  constraints: ['1 ≤ rows, cols ≤ 6', '1 ≤ word.length ≤ 15', 'Letters and digits only'],
  examples: [
    { input: 'board = [["A","B","C","E"],["S","F","C","S"],["A","D","E","E"]], word = "ABCCED"', output: 'true' },
    { input: 'same board, word = "SEE"', output: 'true' },
    { input: 'same board, word = "ABCB"', output: 'false', note: 'the B would have to be reused' },
  ],
  techniques: [
    {
      pattern: 'backtracking',
      rank: 1,
      why: '"May not be reused" is what makes this backtracking rather than a plain flood: a cell is marked on the way in and *unmarked on the way out*, so it is blocked for the current path but free for every other one. Forget the un-marking and the search quietly fails on words that double back.',
      complexity: { time: 'O(n)', space: 'O(n)' },
    },
    {
      pattern: 'dfs',
      rank: 2,
      why: 'The traversal underneath is an ordinary depth-first search from every starting cell; backtracking is the bookkeeping laid on top of it.',
      complexity: { time: 'O(n)', space: 'O(n)' },
    },
  ],
  params: [{ name: 'word', label: 'Word to find', type: 'string', default: 'ABCCED' }],
  typescript: {
    starter: `const word = 'ABCCED';

function exist(board: string[][], word: string): boolean {
  // Mark a cell on the way in, unmark it on the way out.
  // TODO
  return false;
}
${wordSearchDriver.typescript}`,
    solution: `const word = 'ABCCED';

function exist(board: string[][], word: string): boolean {
  const rows = board.length;
  const cols = board[0].length;

  const search = (r: number, c: number, at: number): boolean => {
    if (at === word.length) return true;
    if (r < 0 || c < 0 || r >= rows || c >= cols) return false;
    if (board[r][c] !== word[at]) return false;

    // Block this cell for the rest of *this* path only.
    const letter = board[r][c];
    board[r][c] = '#';

    const found =
      search(r + 1, c, at + 1) ||
      search(r - 1, c, at + 1) ||
      search(r, c + 1, at + 1) ||
      search(r, c - 1, at + 1);

    // Un-choose: other paths are still allowed to use it.
    board[r][c] = letter;
    return found;
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (search(r, c, 0)) return true;
    }
  }

  return false;
}
${wordSearchDriver.typescript}`,
  },
  python: {
    starter: `word = 'ABCCED'


def exist(board, word):
    """Mark a cell on the way in, unmark it on the way out."""
    # TODO
    return False
${wordSearchDriver.python}`,
    solution: `word = 'ABCCED'


def exist(board, word):
    rows, cols = len(board), len(board[0])

    def search(r, c, at):
        if at == len(word):
            return True
        if r < 0 or c < 0 or r >= rows or c >= cols:
            return False
        if board[r][c] != word[at]:
            return False

        # Block this cell for the rest of *this* path only.
        letter = board[r][c]
        board[r][c] = '#'

        found = (
            search(r + 1, c, at + 1)
            or search(r - 1, c, at + 1)
            or search(r, c + 1, at + 1)
            or search(r, c - 1, at + 1)
        )

        # Un-choose: other paths are still allowed to use it.
        board[r][c] = letter
        return found

    for r in range(rows):
        for c in range(cols):
            if search(r, c, 0):
                return True

    return False
${wordSearchDriver.python}`,
  },
  expectedOutput: ['example 1 -> true', 'example 2 -> true', 'example 3 -> false'],
};

// --- 17 · Letter Combinations of a Phone Number ------------------------------

const lettersDriver = {
  typescript: `
// --- examples ---------------------------------------------------------------
console.log('example 1 ->', letterCombinations(digits));
console.log('example 2 ->', letterCombinations(''));
console.log('example 3 ->', letterCombinations('2'));
`,
  python: `
# --- examples ---------------------------------------------------------------
print('example 1 ->', letter_combinations(digits))
print('example 2 ->', letter_combinations(''))
print('example 3 ->', letter_combinations('2'))
`,
};

export const letterCombinations: LeetProblem = {
  slug: 'letter-combinations-of-a-phone-number',
  number: 17,
  title: 'Letter Combinations of a Phone Number',
  difficulty: 'Medium',
  topics: ['hash-table', 'string', 'backtracking'],
  prompt:
    'Given a string of digits from 2 to 9, return every letter combination the number could spell on a telephone keypad. The combinations may come back in any order.',
  constraints: ['0 ≤ digits.length ≤ 4', 'digits[i] is between 2 and 9'],
  examples: [
    { input: 'digits = "23"', output: '["ad","ae","af","bd","be","bf","cd","ce","cf"]' },
    { input: 'digits = ""', output: '[]', note: 'no digits, no combinations' },
    { input: 'digits = "2"', output: '["a","b","c"]' },
  ],
  techniques: [
    {
      pattern: 'backtracking',
      rank: 1,
      why: 'One decision per digit, three or four ways to make it. The search tree is exactly as deep as the number is long, and every leaf is an answer — the simplest possible shape for choose / explore / un-choose.',
      complexity: { time: 'O(2^n)', space: 'O(n)' },
    },
    {
      pattern: 'recursion',
      rank: 2,
      why: 'Nothing is ever pruned here, so it can equally be read as plain recursive enumeration: the combinations for a number are its first digit’s letters glued onto the combinations for the rest.',
      complexity: { time: 'O(2^n)', space: 'O(n)' },
    },
  ],
  params: [{ name: 'digits', label: 'Digits', type: 'string', default: '23' }],
  typescript: {
    starter: `const digits = '23';

function letterCombinations(digits: string): string[] {
  // One decision per digit; every leaf of the tree is an answer.
  // TODO
  return [];
}
${lettersDriver.typescript}`,
    solution: `const digits = '23';

const KEYPAD: Record<string, string> = {
  '2': 'abc',
  '3': 'def',
  '4': 'ghi',
  '5': 'jkl',
  '6': 'mno',
  '7': 'pqrs',
  '8': 'tuv',
  '9': 'wxyz',
};

function letterCombinations(digits: string): string[] {
  // The empty string is not "one empty combination" — it is no combinations.
  if (digits.length === 0) return [];

  const out: string[] = [];
  const current: string[] = [];

  const explore = (at: number) => {
    if (at === digits.length) {
      out.push(current.join(''));
      return;
    }

    for (const letter of KEYPAD[digits[at]] ?? '') {
      current.push(letter);   // choose
      explore(at + 1);        // explore the rest of the number
      current.pop();          // un-choose
    }
  };

  explore(0);
  return out;
}
${lettersDriver.typescript}`,
  },
  python: {
    starter: `digits = '23'


def letter_combinations(digits):
    """One decision per digit; every leaf of the tree is an answer."""
    # TODO
    return []
${lettersDriver.python}`,
    solution: `digits = '23'

KEYPAD = {
    '2': 'abc',
    '3': 'def',
    '4': 'ghi',
    '5': 'jkl',
    '6': 'mno',
    '7': 'pqrs',
    '8': 'tuv',
    '9': 'wxyz',
}


def letter_combinations(digits):
    # The empty string is not "one empty combination" - it is no combinations.
    if not digits:
        return []

    out = []
    current = []

    def explore(at):
        if at == len(digits):
            out.append(''.join(current))
            return

        for letter in KEYPAD.get(digits[at], ''):
            current.append(letter)  # choose
            explore(at + 1)         # explore the rest of the number
            current.pop()           # un-choose

    explore(0)
    return out
${lettersDriver.python}`,
  },
  expectedOutput: [
    'example 1 -> ["ad", "ae", "af", "bd", "be", "bf", "cd", "ce", "cf"]',
    'example 2 -> []',
    'example 3 -> ["a", "b", "c"]',
  ],
};

export const BACKTRACKING_PROBLEMS = [
  subsetsProblem,
  permutationsProblem,
  combinationSum,
  wordSearch,
  letterCombinations,
];
