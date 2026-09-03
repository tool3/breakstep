import { techniquesFromTopics } from './recommend';
import { canGenerate, generateStarter } from './runnable';
import type { ProblemDetail } from './details';
import type { IndexedProblem } from './problemIndex';
import type { LeetProblem } from './types';

export const problemUrl = (slug: string) => `https://leetcode.com/problems/${slug}/`;

const MAX_CASES = 3;
const MAX_CASE_CHARS = 400;

function trimCases(detail: ProblemDetail): ProblemDetail {
  const kept = detail.cases
    .filter((c) => c.input.join(', ').length <= MAX_CASE_CHARS)
    .slice(0, MAX_CASES);
  return kept.length === detail.cases.length ? detail : { ...detail, cases: kept };
}

function describe(detail: ProblemDetail): string {
  const params = detail.params.map(([name, type]) => `${name}: ${type}`).join(', ');
  return `Write ${detail.fn}(${params}) returning ${detail.returns}. The statement is on LeetCode; the example inputs and their answers are below and already wired up to run.`;
}

export function synthesizeProblem(
  indexed: IndexedProblem,
  detail: ProblemDetail,
): LeetProblem | null {
  const trimmed = trimCases(detail);
  if (!canGenerate(trimmed)) return null;

  const source = generateStarter({
    detail: trimmed,
    number: indexed.number,
    title: indexed.title,
    difficulty: indexed.difficulty,
    url: problemUrl(indexed.slug),
  });

  const techniques = techniquesFromTopics(indexed.topics);

  return {
    slug: indexed.slug,
    number: indexed.number,
    title: indexed.title,
    difficulty: indexed.difficulty,
    topics: indexed.topics,
    origin: 'generated',

    prompt: describe(trimmed),
    constraints: [],
    examples: trimmed.cases.map((testCase) => ({
      input: trimmed.params
        .map(([name], index) => `${name} = ${testCase.input[index]}`)
        .join(', '),
      output: testCase.expected,
    })),

    techniques:
      techniques.length > 0
        ? techniques
        : [
            {
              pattern: 'recursion',
              rank: 1,
              why: 'LeetCode gives this problem no topic tags to go on, so treat the suggestion as a starting point rather than an answer.',
              complexity: { time: 'unknown', space: 'unknown' },
            },
          ],

    params: [],

    typescript: { starter: source.typescript, solution: source.typescript },
    python: { starter: source.python, solution: source.python },

    expectedOutput: [],
  };
}
