import { describe, expect, it } from 'vitest';
import { callsAtTopLevel, entryCall } from './entryCall';
import { PROBLEMS, getProblem } from './catalogue';
import { loadDetail } from './details';
import { toSnakeCase } from './runnable';
import { problemTemplate } from './toTemplate';
import { assembleRunnable } from '@/templates';
import { runInSandbox } from '@/engine/sandbox';
import { toRunnableJs } from '@/engine/transpile';
import type { LeetProblem } from './types';

const squash = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
const related = (a: string, b: string) => {
  const [x, y] = [squash(a), squash(b)];
  return (x.startsWith(y) || y.startsWith(x)) && Math.min(x.length, y.length) >= 4;
};

const cases = PROBLEMS.map((problem) => [problem.slug, problem] as [string, LeetProblem]);

describe('finding what Run should invoke', () => {
  it.each(cases)('%s — TypeScript', async (_slug, problem) => {
    const call = entryCall(problem.typescript.starter, 'typescript');
    expect(call, 'no top-level call found').not.toBeNull();

    const detail = await loadDetail(problem.slug, problem.number);
    if (detail) {
      expect(
        related(call!.name, detail.fn),
        `found ${call!.name}, LeetCode calls it ${detail.fn}`,
      ).toBe(true);
    }
    expect(call!.expression.startsWith(`${call!.name}(`)).toBe(true);
    expect(call!.expression.endsWith(')')).toBe(true);
  });

  it.each(cases)('%s — Python', async (_slug, problem) => {
    const call = entryCall(problem.python.starter, 'python');
    expect(call, 'no top-level call found').not.toBeNull();

    const detail = await loadDetail(problem.slug, problem.number);
    if (detail) {
      expect(
        related(call!.name, toSnakeCase(detail.fn)),
        `found ${call!.name}, LeetCode calls it ${toSnakeCase(detail.fn)}`,
      ).toBe(true);
    }
  });
});

describe('knowing whether the buffer still calls it', () => {
  const problem = PROBLEMS.find((p) => p.slug === 'valid-palindrome')!;

  it('sees the driver while it is there', () => {
    const call = entryCall(problem.typescript.starter, 'typescript')!;
    expect(callsAtTopLevel(problem.typescript.starter, call.name, 'typescript')).toBe(true);
    expect(callsAtTopLevel(problem.python.starter, 'is_palindrome', 'python')).toBe(true);
  });

  it('sees that a commented-out driver is not a call', () => {
    const commented = problem.typescript.starter
      .split('\n')
      .map((line) => (line.startsWith('console.log') ? `// ${line}` : line))
      .join('\n');
    expect(callsAtTopLevel(commented, 'isPalindrome', 'typescript')).toBe(false);

    const py = problem.python.starter
      .split('\n')
      .map((line) => (line.startsWith('print(') ? `# ${line}` : line))
      .join('\n');
    expect(callsAtTopLevel(py, 'is_palindrome', 'python')).toBe(false);
  });

  it('does not mistake a recursive call for the program calling it', () => {
    const source = [
      'const root = null;',
      'function maxDepth(node) {',
      '  if (!node) return 0;',
      '  return 1 + Math.max(maxDepth(node.left), maxDepth(node.right));',
      '}',
    ].join('\n');
    expect(callsAtTopLevel(source, 'maxDepth', 'typescript')).toBe(false);
  });

  it('leaves half-typed code alone rather than bolting a call onto it', () => {
    expect(callsAtTopLevel('function broken( {', 'broken', 'typescript')).toBe(true);
  });
});

describe('a problem runs from its parameters, not from its driver', () => {
  const problem = getProblem('valid-palindrome')!;
  const template = problemTemplate(problem);

  const withoutDriver = problem.typescript.solution
    .split('\n')
    .map((line) => (line.startsWith('console.log') ? `// ${line}` : line))
    .join('\n');

  async function run(source: string) {
    const assembled = assembleRunnable(template, 'typescript', 'clean', source);
    const compiled = toRunnableJs(assembled, 'typescript');
    expect(compiled.ok, compiled.error).toBe(true);
    return runInSandbox(compiled.code, {}, { opLimit: 5_000_000, frameLimit: 60, autoTrace: true });
  }

  it('still runs, draws and answers with the driver commented out', async () => {
    const result = await run(withoutDriver);

    expect(result.error?.message).toBeUndefined();
    expect(result.frames.length).toBeGreaterThan(0);
    expect(result.logs.map((entry) => entry.text)).toContain('-> true');
  });

  it('answers with whatever the parameter now holds', async () => {
    const notAPalindrome = withoutDriver.replace(
      "const s = 'A man, a plan, a canal: Panama';",
      "const s = 'race a car';",
    );
    const result = await run(notAPalindrome);
    expect(result.logs.map((entry) => entry.text)).toContain('-> false');
  });

  it('does not call the solution twice while the driver is still there', async () => {
    const result = await run(problem.typescript.solution);

    expect(result.logs.map((entry) => entry.text)).toEqual(problem.expectedOutput);
    expect(result.logs.some((entry) => entry.text.startsWith('->'))).toBe(false);
  });

  it('leaves an ordinary template alone — it has no declared invocation', () => {
    const assembled = assembleRunnable(template, 'typescript', 'clean', withoutDriver);
    expect(assembled).toContain('Parameters panel');

    expect(template.entry?.typescript?.name).toBe('isPalindrome');
  });
});
