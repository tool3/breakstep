/**
 * The judge has to be right about every problem, or the verdict is worse than
 * no verdict at all.
 *
 * The load-bearing test is the first one: every written problem's own solution,
 * run through the generated harness and graded against the cases LeetCode
 * publishes. It covers the parts most likely to break quietly — a renamed
 * function, a tree rebuilt wrongly, an in-place problem judged on its return
 * value instead of its argument — because any of those turn an accepted answer
 * into a wrong one, which is the failure a learner would trust and be misled by.
 */
import { describe, expect, it } from 'vitest';
import {
  buildJudgePlan,
  compareAnswer,
  judgeResult,
  readReport,
  sameUnordered,
  sameValue,
  withoutJudgeLine,
  JUDGE_SENTINEL,
} from './judge';
import { PROBLEMS, getProblem } from '@/leetcode/catalogue';
import { loadDetail } from '@/leetcode/details';
import { synthesizeProblem } from '@/leetcode/synthesize';
import { runInSandbox } from '@/engine/sandbox';
import { toRunnableJs } from '@/engine/transpile';
import type { ProblemDetail } from '@/leetcode/details';
import type { LeetProblem } from '@/leetcode/types';
import type { RunResult } from '@/types';

const OPTS = { opLimit: 20_000_000, frameLimit: 10, autoTrace: false };

/** Run a source the way a submission runs it, and shape the result like the app's. */
async function runTs(source: string): Promise<RunResult> {
  const compiled = toRunnableJs(source, 'typescript');
  expect(compiled.ok, `${compiled.error} (line ${compiled.line})`).toBe(true);
  const res = await runInSandbox(compiled.code, {}, OPTS);
  return { ...res, status: res.error ? 'error' : 'done' } as RunResult;
}

/** Submit a source against a problem and get the verdict back. */
async function submit(problem: LeetProblem, source: string, override?: ProblemDetail) {
  const detail = override ?? (await loadDetail(problem.slug, problem.number));
  const plan = buildJudgePlan(problem, detail, 'typescript', source);
  const runnable = plan.kind === 'cases' ? `${source}\n\n${plan.harness}` : source;
  const result = await runTs(runnable);
  return { plan, result, judgement: judgeResult(plan, result) };
}

describe('judging a written problem', () => {
  it.each(PROBLEMS.map((p) => [p.slug, p] as [string, LeetProblem]))(
    '%s accepts its own solution',
    async (_slug, problem) => {
      const { plan, judgement } = await submit(problem, problem.typescript.solution);

      // Judged by calling the function, not by reading the console.
      expect(plan.kind).toBe('cases');
      expect(judgement.error).toBeUndefined();
      expect(
        judgement.verdict,
        judgement.cases
          .filter((c) => !c.passed)
          .map((c) => `${c.label} → expected ${c.expected}, got ${c.got}${c.error ? ` (${c.error})` : ''}`)
          .join('\n'),
      ).toBe('accepted');
      expect(judgement.passed).toBe(judgement.total);
      expect(judgement.total).toBeGreaterThan(0);
    },
    20_000,
  );

  it('rejects the starter it ships with', async () => {
    const problem = getProblem('two-sum-ii-input-array-is-sorted')!;
    const { judgement } = await submit(problem, problem.typescript.starter);

    expect(judgement.verdict).toBe('wrong-answer');
    expect(judgement.passed).toBe(0);
    // The failing case says what was asked and what came back, in that order.
    expect(judgement.cases[0].label).toBe('numbers = [2,7,11,15], target = 9');
    expect(judgement.cases[0].expected).toBe('[1,2]');
    expect(judgement.cases[0].got).toBe('[]');
  });

  it('judges an in-place problem on the argument it mutated', async () => {
    // `sortColors` returns nothing: LeetCode publishes the sorted array as the
    // answer, so the harness has to read the argument back after the call.
    const problem = getProblem('sort-colors')!;
    const detail = await loadDetail(problem.slug, problem.number);
    expect(detail?.returns).toBe('void');

    const accepted = await submit(problem, problem.typescript.solution);
    expect(accepted.judgement.verdict).toBe('accepted');

    const wrong = await submit(
      problem,
      'function sortColors(nums: number[]): void { nums.reverse(); }',
    );
    expect(wrong.judgement.verdict).toBe('wrong-answer');
  });

  it('reports a throw as a runtime error rather than a wrong answer', async () => {
    const problem = getProblem('valid-palindrome')!;
    const { judgement } = await submit(
      problem,
      'function isPalindrome(s: string): boolean { throw new Error("nope"); }',
    );

    // Every case threw, but the run itself finished, so the cases carry it.
    expect(judgement.verdict).toBe('wrong-answer');
    expect(judgement.cases.every((c) => c.error === 'nope')).toBe(true);
  });

  it('reports a file that cannot even start as a runtime error', async () => {
    const problem = getProblem('valid-palindrome')!;
    const { judgement } = await submit(problem, 'throw new Error("boom");');

    expect(judgement.verdict).toBe('runtime-error');
    expect(judgement.error).toContain('boom');
  });
});

describe('when the published interface is not the signature', () => {
  it('judges Clone Graph on its output, and says that is what it did', async () => {
    // LeetCode declares `cloneGraph(edges: integer[][]) -> boolean`, which is its
    // judge's shim: the function you write takes a node. Every call throws, so
    // the verdict comes from the output the file itself produced.
    const problem = getProblem('clone-graph')!;
    const { judgement } = await submit(problem, problem.typescript.solution);

    expect(judgement.verdict).toBe('accepted');
    expect(judgement.note).toMatch(/printed output/);
  });

  it('still fails broken code rather than rescuing it', async () => {
    const problem = getProblem('clone-graph')!;
    const broken = problem.typescript.solution.replace(
      'function cloneGraph',
      'function cloneGraphBroken',
    );
    const { judgement } = await submit(problem, broken);

    expect(judgement.verdict).not.toBe('accepted');
  });

  it('calls the function the file actually defines', async () => {
    // Written out here as `searchRotated`; LeetCode calls it `search`.
    const problem = getProblem('search-in-rotated-sorted-array')!;
    const { plan, judgement } = await submit(problem, problem.typescript.solution);

    expect(plan.kind === 'cases' && plan.entry).toBe('searchRotated');
    expect(judgement.verdict).toBe('accepted');
    expect(judgement.entry).toBe('searchRotated');
  });

  it('accepts a solution named however the solver liked', async () => {
    const problem = getProblem('valid-palindrome')!;
    const { plan, judgement } = await submit(
      problem,
      `function palindromeCheck(s: string): boolean {
        const cleaned = s.toLowerCase().replace(/[^a-z0-9]/g, '');
        return cleaned === [...cleaned].reverse().join('');
      }`,
    );

    expect(plan.kind === 'cases' && plan.entry).toBe('palindromeCheck');
    expect(judgement.verdict).toBe('accepted');
  });
});

describe('judging a generated problem', () => {
  const detail: ProblemDetail = {
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

  const problem = synthesizeProblem(
    {
      slug: 'two-sum',
      number: 1,
      title: 'Two Sum',
      difficulty: 'Easy',
      topics: ['array'],
      paidOnly: false,
    },
    detail,
  )!;

  it('accepts a correct answer even though nothing was written out here', async () => {
    const source = `function twoSum(nums: number[], target: number): number[] {
      const seen = new Map<number, number>();
      for (let i = 0; i < nums.length; i++) {
        const need = target - nums[i];
        if (seen.has(need)) return [seen.get(need)!, i];
        seen.set(nums[i], i);
      }
      return [];
    }`;

    const { plan, judgement } = await submit(problem, source, detail);
    expect(plan.kind).toBe('cases');
    expect(judgement.verdict).toBe('accepted');
    expect(judgement.total).toBe(2);
  });

  it('rejects the stub it opens with', async () => {
    const { judgement } = await submit(problem, problem.typescript.starter, detail);
    expect(judgement.verdict).toBe('wrong-answer');
  });
});

describe('the harness itself', () => {
  const problem = getProblem('valid-palindrome')!;

  it('keeps its report out of the log the user reads', async () => {
    const { result } = await submit(problem, problem.typescript.solution);

    const raw = result.logs.map((l) => l.text);
    expect(raw.some((text) => text.includes(JUDGE_SENTINEL))).toBe(true);
    expect(withoutJudgeLine(result.logs)).toEqual(
      result.logs.filter((l) => !l.text.includes(JUDGE_SENTINEL)),
    );

    // What is left is exactly what the file itself printed.
    expect(withoutJudgeLine(result.logs).map((l) => l.text)).toEqual(problem.expectedOutput);
  });

  it('measures the judged cases rather than the whole file', async () => {
    const { judgement, result } = await submit(problem, problem.typescript.solution);
    expect(judgement.runtimeMs).toBeGreaterThanOrEqual(0);
    expect(judgement.runtimeMs).toBeLessThanOrEqual(result.durationMs + 1);
  });

  it('builds Python out of the same interface', async () => {
    const tree = getProblem('maximum-depth-of-binary-tree')!;
    const detail = await loadDetail(tree.slug, tree.number);
    const plan = buildJudgePlan(tree, detail, 'python', tree.python.solution);

    expect(plan.kind).toBe('cases');
    if (plan.kind !== 'cases') return;

    // Snake case for the call, its own tree builder, and one def per case.
    expect(plan.harness).toContain('max_depth(__a0)');
    expect(plan.harness).toContain('__bs_to_tree(');
    expect(plan.harness).toContain('def __bs_case_0():');
    expect(plan.harness).toContain('__bs_json.dumps');
  });

  it('falls back to the printed output when nothing is published to call', () => {
    const problem = getProblem('two-sum-ii-input-array-is-sorted')!;
    const plan = buildJudgePlan(problem, null, 'typescript', problem.typescript.solution);
    expect(plan).toEqual({ kind: 'output', expected: problem.expectedOutput });
  });

  it('says so plainly when there is nothing at all to judge', () => {
    const generated = { ...getProblem('valid-palindrome')!, expectedOutput: [] };
    const plan = buildJudgePlan(generated, null, 'typescript', generated.typescript.solution);
    expect(plan.kind).toBe('none');
  });

  it('will not grade Python against a TypeScript driver expectation', () => {
    // The two languages print values differently, so the stored expectation is
    // not something a Python run can be held to.
    const problem = getProblem('two-sum-ii-input-array-is-sorted')!;
    expect(buildJudgePlan(problem, null, 'python', problem.python.solution).kind).toBe('none');
  });
});

describe('the same values in another order', () => {
  it('accepts them for a problem that returns a collection of answers', async () => {
    const problem = getProblem('subsets')!;
    const reversed = `${problem.typescript.solution.replace(
      'return out;',
      'return out.reverse();',
    )}`;
    const { judgement } = await submit(problem, reversed);
    expect(judgement.verdict).toBe('accepted');
  });

  it('counts them wrong for a flat answer, and explains why', async () => {
    const problem = getProblem('sort-colors')!;
    const { judgement } = await submit(
      problem,
      'function sortColors(nums: number[]): void { nums.reverse(); }',
    );

    expect(judgement.verdict).toBe('wrong-answer');
    expect(judgement.cases.some((c) => c.unordered && !c.passed)).toBe(true);
    expect(judgement.note).toMatch(/different order/);
  });
});

describe('comparing answers', () => {
  it('accepts an exact match', () => {
    expect(compareAnswer('[1,2]', '[1,2]')).toEqual({ passed: true });
  });

  it('accepts a float within LeetCode’s tolerance', () => {
    expect(sameValue(0.30000000000000004, 0.3)).toBe(true);
    expect(sameValue(0.3, 0.4)).toBe(false);
  });

  it('accepts a set-valued answer in another order, and says it did', () => {
    const got = '[[3],[1],[2],[1,2,3],[1,3],[2,3],[1,2],[]]';
    const expected = '[[],[1],[2],[1,2],[3],[1,3],[2,3],[1,2,3]]';
    expect(compareAnswer(got, expected)).toEqual({ passed: true, unordered: true });
  });

  it('does not confuse a different multiset for a reordering', () => {
    expect(sameUnordered([1, 2, 2], [1, 1, 2])).toBe(false);
    expect(compareAnswer('[[1],[2]]', '[[1],[3]]').passed).toBe(false);
  });

  it('compares a value nothing could parse as text', () => {
    expect(compareAnswer('undefined', '3').passed).toBe(false);
    expect(compareAnswer('undefined', 'undefined').passed).toBe(true);
  });

  it('reads the last report in the log, and nothing else', () => {
    const at = (text: string) => ({ level: 'log' as const, text, at: 0 });
    expect(
      readReport([
        at('example 1 -> 3'),
        at(`${JUDGE_SENTINEL}{"ms":1,"results":[{"text":"3"}]}`),
      ]),
    ).toEqual({ ms: 1, results: [{ text: '3' }] });

    expect(readReport([at('nothing here')])).toBeNull();
  });
});
