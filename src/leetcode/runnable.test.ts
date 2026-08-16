import { describe, expect, it } from 'vitest';
import { canGenerate, generateStarter, toPythonLiteral, toSnakeCase } from './runnable';
import { synthesizeProblem } from './synthesize';
import { toRunnableJs } from '@/engine/transpile';
import { runInSandbox } from '@/engine/sandbox';
import type { ProblemDetail } from './details';
import type { IndexedProblem } from './problemIndex';

const OPTS = { opLimit: 5_000_000, frameLimit: 40, autoTrace: false };

const twoSum: ProblemDetail = {
  fn: 'twoSum',
  params: [
    ['nums', 'integer[]'],
    ['target', 'integer'],
  ],
  returns: 'integer[]',
  cases: [
    { input: ['[2,7,11,15]', '9'], expected: '[0,1]' },
    { input: ['[3,2,4]', '6'], expected: '[1,2]' },
  ],
};

const mergeLists: ProblemDetail = {
  fn: 'mergeTwoLists',
  params: [
    ['list1', 'ListNode'],
    ['list2', 'ListNode'],
  ],
  returns: 'ListNode',
  cases: [{ input: ['[1,2,4]', '[1,3,4]'], expected: '[1,1,2,3,4,4]' }],
};

const inorder: ProblemDetail = {
  fn: 'inorderTraversal',
  params: [['root', 'TreeNode']],
  returns: 'list<integer>',
  cases: [{ input: ['[1,null,2,3]'], expected: '[1,3,2]' }],
};

const generate = (detail: ProblemDetail) =>
  generateStarter({
    detail,
    number: 1,
    title: 'A Problem',
    difficulty: 'Easy',
    url: 'https://leetcode.com/problems/a-problem/',
  });

describe('toSnakeCase', () => {
  it.each([
    ['twoSum', 'two_sum'],
    ['lengthOfLongestSubstring', 'length_of_longest_substring'],
    ['maxAreaOfIsland', 'max_area_of_island'],
    ['isBST', 'is_bst'],
    ['numIslands', 'num_islands'],
  ])('%s → %s', (input, expected) => {
    expect(toSnakeCase(input)).toBe(expected);
  });
});

describe('toPythonLiteral', () => {
  it('rewrites the three keywords JSON and Python disagree on', () => {
    expect(toPythonLiteral('[true,false,null]')).toBe('[True,False,None]');
  });

  it('leaves them alone inside a string', () => {
    expect(toPythonLiteral('"true is null"')).toBe('"true is null"');
    expect(toPythonLiteral('["null",null]')).toBe('["null",None]');
  });

  it('survives an escaped quote', () => {
    expect(toPythonLiteral('"a\\"true",true')).toBe('"a\\"true",True');
  });

  it('leaves ordinary values untouched', () => {
    expect(toPythonLiteral('[[1,2],[3,4]]')).toBe('[[1,2],[3,4]]');
  });
});

describe('canGenerate', () => {
  it('accepts primitives, arrays and node types', () => {
    expect(canGenerate(twoSum)).toBe(true);
    expect(canGenerate(mergeLists)).toBe(true);
    expect(canGenerate(inorder)).toBe(true);
  });

  it('refuses an in-place problem, which has nothing to print', () => {
    expect(canGenerate({ ...twoSum, returns: 'void' })).toBe(false);
  });

  it('refuses a type it has no literal for', () => {
    expect(canGenerate({ ...twoSum, params: [['n', 'NestedInteger']] })).toBe(false);
    expect(canGenerate({ ...twoSum, returns: 'Node' })).toBe(false);
  });

  it('refuses a problem with no example to run', () => {
    expect(canGenerate({ ...twoSum, cases: [] })).toBe(false);
  });
});

describe('generateStarter', () => {
  it('writes a correctly typed signature in both languages', () => {
    const source = generate(twoSum);
    expect(source.typescript).toContain('function twoSum(nums: number[], target: number): number[]');
    expect(source.python).toContain('def two_sum(nums, target):');
    expect(source.python).toContain('nums: list[int], target: int -> list[int]');
  });

  it('links the statement instead of reproducing it', () => {
    const source = generate(twoSum);
    expect(source.typescript).toContain('https://leetcode.com/problems/a-problem/');
    expect(source.typescript).toMatch(/statement is LeetCode's/);
  });

  it('passes each example inline and notes the expected answer', () => {
    const source = generate(twoSum);
    expect(source.typescript).toContain(
      "console.log('example 1 ->', twoSum([2,7,11,15], 9));  // expected [0,1]",
    );
    expect(source.python).toContain("print('example 2 ->', two_sum([3,2,4], 6))  # expected [1,2]");
  });

  it('brings in list helpers only when a list is involved', () => {
    expect(generate(twoSum).typescript).not.toContain('class ListNode');
    const source = generate(mergeLists);
    expect(source.typescript).toContain('class ListNode');
    expect(source.typescript).toContain('fromList(mergeTwoLists(toList([1,2,4]), toList([1,3,4])))');
    expect(source.python).toContain('from_list(merge_two_lists(to_list([1,2,4]), to_list([1,3,4])))');
  });

  it('brings in tree helpers, and rewrites the nulls for Python', () => {
    const source = generate(inorder);
    expect(source.typescript).toContain('class TreeNode');
    expect(source.typescript).toContain('inorderTraversal(toTree([1,null,2,3]))');
    expect(source.python).toContain('inorder_traversal(to_tree([1,None,2,3]))');
  });

  it('stubs a return value so the file runs before anything is written', async () => {
    const compiled = toRunnableJs(generate(twoSum).typescript, 'typescript');
    expect(compiled.ok, compiled.error).toBe(true);

    const result = await runInSandbox(compiled.code, {}, OPTS);
    expect(result.error?.message).toBeUndefined();
    expect(result.logs.map((l) => l.text)).toEqual(['example 1 -> []', 'example 2 -> []']);
  });

  it('produces the published answers once the stub is filled in', async () => {
    // The whole point of the generated driver: swap in a real body and the
    // examples should agree with what LeetCode says they are.
    const solved = generate(twoSum).typescript.replace(
      '  // TODO\n  return [];',
      `  const seen = new Map<number, number>();
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) return [seen.get(need)!, i];
    seen.set(nums[i], i);
  }
  return [];`,
    );

    const compiled = toRunnableJs(solved, 'typescript');
    expect(compiled.ok, compiled.error).toBe(true);

    const result = await runInSandbox(compiled.code, {}, OPTS);
    expect(result.error?.message).toBeUndefined();
    expect(result.logs.map((l) => l.text)).toEqual(['example 1 -> [0, 1]', 'example 2 -> [1, 2]']);
  });

  it('runs a tree problem end to end', async () => {
    const solved = generate(inorder).typescript.replace(
      '  // TODO\n  return [];',
      `  const out: number[] = [];
  const walk = (node: TreeNode | null) => {
    if (node === null) return;
    walk(node.left);
    out.push(node.val);
    walk(node.right);
  };
  walk(root);
  return out;`,
    );

    const compiled = toRunnableJs(solved, 'typescript');
    expect(compiled.ok, compiled.error).toBe(true);

    const result = await runInSandbox(compiled.code, {}, OPTS);
    expect(result.error?.message).toBeUndefined();
    expect(result.logs[0].text).toBe('example 1 -> [1, 3, 2]');
  });
});

describe('synthesizeProblem', () => {
  const indexed: IndexedProblem = {
    number: 1,
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    paidOnly: false,
    topics: ['array', 'hash-table'],
  };

  it('assembles a problem that behaves like any other', () => {
    const problem = synthesizeProblem(indexed, twoSum)!;
    expect(problem.slug).toBe('two-sum');
    expect(problem.number).toBe(1);
    expect(problem.difficulty).toBe('Easy');
    expect(problem.examples).toEqual([
      { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', note: undefined },
      { input: 'nums = [3,2,4], target = 6', output: '[1,2]', note: undefined },
    ]);
  });

  it('marks itself as generated, so nothing offers a solution for it', () => {
    const problem = synthesizeProblem(indexed, twoSum)!;
    expect(problem.origin).toBe('generated');
    expect(problem.constraints).toEqual([]);
    expect(problem.expectedOutput).toEqual([]);
  });

  it('describes the interface rather than restating the problem', () => {
    const problem = synthesizeProblem(indexed, twoSum)!;
    expect(problem.prompt).toContain('twoSum(nums: integer[], target: integer)');
    expect(problem.prompt).toContain('statement is on LeetCode');
  });

  it('still recommends a technique from the tags', () => {
    const problem = synthesizeProblem(indexed, twoSum)!;
    expect(problem.techniques.length).toBeGreaterThan(0);
    expect(problem.techniques[0].rank).toBe(1);
  });

  it('returns nothing when there is nothing runnable to build', () => {
    expect(synthesizeProblem(indexed, { ...twoSum, returns: 'void' })).toBeNull();
  });
});
