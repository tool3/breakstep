import { describe, expect, it } from 'vitest';
import { PROBLEMS, getProblem, problemsByPattern, problemsForPattern } from './catalogue';
import { problemTemplate, problemTemplateId, solutionSource, starterSource } from './toTemplate';
import { toRunnableJs } from '@/engine/transpile';
import { runInSandbox } from '@/engine/sandbox';
import { listFunctions } from '@/analysis/functions';
import type { LeetProblem } from './types';

const OPTS = { opLimit: 20_000_000, frameLimit: 60, autoTrace: false };

/** Run a TypeScript source the way the app would and collect its output. */
async function runTs(source: string) {
  const compiled = toRunnableJs(source, 'typescript');
  expect(compiled.ok, `${compiled.error} (line ${compiled.line})`).toBe(true);
  return runInSandbox(compiled.code, {}, OPTS);
}

describe('the problem catalogue', () => {
  it('covers every pattern with at least two problems', () => {
    for (const { pattern, problems } of problemsByPattern()) {
      expect(problems.length, pattern).toBeGreaterThanOrEqual(2);
    }
  });

  it('has no duplicate slugs or numbers', () => {
    expect(new Set(PROBLEMS.map((p) => p.slug)).size).toBe(PROBLEMS.length);
    expect(new Set(PROBLEMS.map((p) => p.number)).size).toBe(PROBLEMS.length);
  });

  it('looks a problem up by slug', () => {
    expect(getProblem('two-sum-ii-input-array-is-sorted')?.number).toBe(167);
    expect(getProblem('nope')).toBeUndefined();
  });

  it('files each problem under the pattern it recommends first', () => {
    expect(problemsForPattern('backtracking').map((p) => p.slug)).toContain('permutations');
    expect(problemsForPattern('bfs').map((p) => p.slug)).not.toContain('permutations');
  });

  it.each(PROBLEMS.map((p) => [p.slug, p] as [string, LeetProblem]))(
    '%s is fully described',
    (_slug, problem) => {
      expect(problem.title.length).toBeGreaterThan(0);
      expect(problem.prompt.length).toBeGreaterThan(40);
      expect(problem.constraints.length).toBeGreaterThan(0);
      expect(problem.examples.length).toBeGreaterThanOrEqual(2);
      expect(problem.techniques.length).toBeGreaterThan(0);
      expect(problem.expectedOutput.length).toBeGreaterThan(0);

      // Ranks start at 1 and increase without gaps.
      const ranks = problem.techniques.map((t) => t.rank).sort((a, b) => a - b);
      expect(ranks).toEqual(ranks.map((_, i) => i + 1));

      // The starter has to be a stub, and the solution must not be one.
      expect(problem.typescript.starter).toContain('TODO');
      expect(problem.python.starter).toContain('TODO');
      expect(problem.typescript.solution).not.toContain('TODO');
      expect(problem.python.solution).not.toContain('TODO');

      // Both languages define something to run.
      expect(listFunctions(problem.typescript.solution, 'typescript').length).toBeGreaterThan(0);
      expect(listFunctions(problem.python.solution, 'python').length).toBeGreaterThan(0);
    },
  );

  it.each(PROBLEMS.map((p) => [p.slug, p] as [string, LeetProblem]))(
    '%s solves its own examples',
    async (_slug, problem) => {
      const result = await runTs(problem.typescript.solution);
      expect(result.error?.message).toBeUndefined();
      expect(result.logs.map((l) => l.text)).toEqual(problem.expectedOutput);
    },
  );

  it.each(PROBLEMS.map((p) => [p.slug, p] as [string, LeetProblem]))(
    '%s starter compiles and runs without throwing',
    async (_slug, problem) => {
      const result = await runTs(problem.typescript.starter);
      expect(result.error?.message).toBeUndefined();
      // A stub still prints one line per example — it just prints the wrong one.
      expect(result.logs.length).toBe(problem.expectedOutput.length);
    },
  );
});

describe('problems as templates', () => {
  const problem = getProblem('subsets')!;
  const template = problemTemplate(problem);

  it('takes an id nothing else can collide with', () => {
    expect(template.id).toBe(problemTemplateId('subsets'));
    expect(template.category).toBe('LeetCode');
  });

  it('shows the starter, never the solution', () => {
    expect(template.code.typescript).toBe(problem.typescript.starter);
    expect(template.code.typescript).not.toContain('un-choose, so the next branch');
  });

  it('carries the recommended complexity as the expected answer', () => {
    expect(template.expected).toEqual(problem.techniques[0].complexity);
  });

  it('hands over source per language', () => {
    expect(solutionSource(problem, 'python')).toBe(problem.python.solution);
    expect(starterSource(problem, 'typescript')).toBe(problem.typescript.starter);
    // JavaScript is stripped from the TypeScript, so the annotations go away.
    expect(solutionSource(problem, 'javascript')).not.toContain(': number[][]');
    expect(solutionSource(problem, 'javascript')).toContain('function subsets');
  });

  it('appends no harness — a problem runs exactly as written', () => {
    expect(template.bench.typescript).toBe('');
    expect(template.bench.python).toBe('');
  });
});
