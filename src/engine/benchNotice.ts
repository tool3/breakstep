import type { Language } from '@/types';

export const NO_BENCHMARK = 'No benchmark registered.';

export const NO_BENCHMARK_MESSAGE =
  `${NO_BENCHMARK} Analyze grows the input and watches how the work grows with ` +
  'it, so it needs to know how to build a bigger input and what to run on it.';

function toSnakeCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

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
