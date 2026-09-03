import { stripTypes } from '@/engine/transpile';
import { entryCall } from './entryCall';
import type { Language, Template } from '@/types';
import type { LeetProblem } from './types';

export const LEETCODE_CATEGORY = 'LeetCode';

export const LEETCODE_PREFIX = 'leetcode:';

export const problemTemplateId = (slug: string) => `${LEETCODE_PREFIX}${slug}`;

export function slugFromTemplateId(id: string): string | null {
  return id.startsWith(LEETCODE_PREFIX) ? id.slice(LEETCODE_PREFIX.length) : null;
}

export function problemTemplate(problem: LeetProblem): Template {
  const code = {
    typescript: problem.typescript.starter,
    python: problem.python.starter,
  };

  return {
    id: problemTemplateId(problem.slug),
    title: `${problem.number}. ${problem.title}`,
    category: LEETCODE_CATEGORY,
    blurb: problem.prompt,
    tags: [problem.difficulty.toLowerCase(), ...problem.topics],
    expected:
      problem.techniques[0]?.complexity?.time === 'unknown'
        ? undefined
        : problem.techniques[0]?.complexity,
    params: problem.params,
    code,
    instrumented: code,
    bench: { typescript: '', python: '' },
    entry: {
      typescript: entryCall(problem.typescript.starter, 'typescript'),
      python: entryCall(problem.python.starter, 'python'),
    },
  };
}

export function solutionSource(problem: LeetProblem, language: Language): string {
  if (language === 'python') return problem.python.solution;
  if (language === 'javascript') {
    const stripped = stripTypes(problem.typescript.solution);
    return stripped.ok ? stripped.code : problem.typescript.solution;
  }
  return problem.typescript.solution;
}

export function starterSource(problem: LeetProblem, language: Language): string {
  if (language === 'python') return problem.python.starter;
  if (language === 'javascript') {
    const stripped = stripTypes(problem.typescript.starter);
    return stripped.ok ? stripped.code : problem.typescript.starter;
  }
  return problem.typescript.starter;
}
