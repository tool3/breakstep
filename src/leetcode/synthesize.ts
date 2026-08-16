/**
 * Build a working problem out of what LeetCode publishes about it.
 *
 * The forty problems in `catalogue.ts` are written by hand: restated prompt,
 * chosen datasets, a solution. Every other free problem gets this instead —
 * assembled from its interface and its example cases, so it still opens in the
 * editor, still runs, and still shows the answers it is supposed to produce.
 *
 * What it cannot have is the statement (LeetCode's writing, linked instead) and
 * a solution (they publish none to take). The `origin` field says so, and the
 * UI reads it rather than guessing.
 */
import { techniquesFromTopics } from './recommend';
import { canGenerate, generateStarter } from './runnable';
import type { ProblemDetail } from './details';
import type { IndexedProblem } from './problemIndex';
import type { LeetProblem } from './types';

export const problemUrl = (slug: string) => `https://leetcode.com/problems/${slug}/`;

/** At most this many examples, and none whose literals dwarf the code. */
const MAX_CASES = 3;
const MAX_CASE_CHARS = 400;

/**
 * Keep the examples that are worth reading.
 *
 * Some problems publish an example with ten thousand elements in it. Pasting
 * that into the editor buries the exercise, so the long ones are dropped and
 * the link to the statement carries them instead.
 */
function trimCases(detail: ProblemDetail): ProblemDetail {
  const kept = detail.cases
    .filter((c) => c.input.join(', ').length <= MAX_CASE_CHARS)
    .slice(0, MAX_CASES);
  return kept.length === detail.cases.length ? detail : { ...detail, cases: kept };
}

/** A one-line, factual description of the interface — not a restated prompt. */
function describe(detail: ProblemDetail): string {
  const params = detail.params.map(([name, type]) => `${name}: ${type}`).join(', ');
  return `Write ${detail.fn}(${params}) returning ${detail.returns}. The statement is on LeetCode; the example inputs and their answers are below and already wired up to run.`;
}

/**
 * Assemble the problem, or return null when there is nothing runnable to build
 * — a design problem, an exotic parameter type, or examples nothing could parse.
 */
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
    // Constraints live in the statement, which is not taken.
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

    // Parameters are bound to literals in hand-written problems; a generated
    // driver passes each example inline, so there is nothing to bind.
    params: [],

    typescript: { starter: source.typescript, solution: source.typescript },
    python: { starter: source.python, solution: source.python },

    // Nothing to assert against: the expected answers ride along as comments in
    // the generated driver instead.
    expectedOutput: [],
  };
}
