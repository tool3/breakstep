/**
 * What to say when Analyze has nothing to measure.
 *
 * The empirical sweep works by running your code at growing input sizes, so it
 * needs two things it cannot guess: how to build an input of size `n`, and what
 * to call with it. The message used to be the type signature —
 * `input: n => …, run: data => …` — which says nothing to anyone who has not
 * already read the API. It is a sentence now, and the panel shows a worked
 * example beside it.
 */
import type { Language } from '@/types';

/**
 * Prefix of the error both runtimes report. The panel matches on it to swap the
 * bare warning for the example below, so it must stay in sync on both sides.
 */
export const NO_BENCHMARK = 'No benchmark registered.';

export const NO_BENCHMARK_MESSAGE =
  `${NO_BENCHMARK} Analyze grows the input and watches how the work grows with ` +
  'it, so it needs to know how to build a bigger input and what to run on it.';

/** `twoSum` → `two_sum`, matching how the same function is written in Python. */
function toSnakeCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

/**
 * A harness someone can read and adapt, in the language they are working in.
 *
 * `fn` is the name of a function in the current file when one can be found, so
 * the example refers to their code rather than an invented `solve`.
 */
export function benchExample(language: Language, fn = 'solve'): string {
  if (language === 'python') {
    return [
      'breakstep.bench(',
      '    # Build an input of size n. Building it is not measured.',
      '    input=lambda n: breakstep.random_ints(n),',
      '    # Call the code being measured. Add any other arguments it takes.',
      `    run=lambda data: ${toSnakeCase(fn)}(data),`,
      ')',
    ].join('\n');
  }

  return [
    'breakstep.bench({',
    '  // Build an input of size n. Building it is not measured.',
    '  input: (n) => breakstep.randomInts(n),',
    '  // Call the code being measured. Add any other arguments it takes.',
    `  run: (data) => ${fn}(data),`,
    '});',
  ].join('\n');
}
