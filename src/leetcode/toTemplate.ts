import { stripTypes } from '@/engine/transpile';
import type { Language, Template } from '@/types';
import type { LeetProblem } from './types';

export const LEETCODE_CATEGORY = 'LeetCode';

/** Template ids for problems are namespaced so nothing else can collide. */
export const LEETCODE_PREFIX = 'leetcode:';

/** The template id a problem occupies once it has been loaded. */
export const problemTemplateId = (slug: string) => `${LEETCODE_PREFIX}${slug}`;

/** The slug behind a template id, or null if the id is not a problem's. */
export function slugFromTemplateId(id: string): string | null {
  return id.startsWith(LEETCODE_PREFIX) ? id.slice(LEETCODE_PREFIX.length) : null;
}

/**
 * Wrap a problem as a template so the rest of the app can forget it is special.
 *
 * The editor shows the starter; the solution is handed over separately by the
 * Reveal button, which just replaces the buffer. That way revealing does not
 * throw away the user's own attempt — it is still in the undo stack, and
 * Reset code brings the starter back.
 */
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
    // Only claim a textbook answer when there is one. A generated problem's
    // technique comes from topic tags, which say nothing about cost.
    expected:
      problem.techniques[0]?.complexity?.time === 'unknown'
        ? undefined
        : problem.techniques[0]?.complexity,
    params: problem.params,
    code,
    // No breakstep.* variant: the point of a problem is the plain solution, and
    // the run is auto-traced anyway. Showing the same source twice is honest.
    instrumented: code,
    bench: { typescript: '', python: '' },
  };
}

/** The solution source for a language, ready to drop into the editor. */
export function solutionSource(problem: LeetProblem, language: Language): string {
  if (language === 'python') return problem.python.solution;
  if (language === 'javascript') {
    const stripped = stripTypes(problem.typescript.solution);
    return stripped.ok ? stripped.code : problem.typescript.solution;
  }
  return problem.typescript.solution;
}

/** The starter source for a language — what Reset code goes back to. */
export function starterSource(problem: LeetProblem, language: Language): string {
  if (language === 'python') return problem.python.starter;
  if (language === 'javascript') {
    const stripped = stripTypes(problem.typescript.starter);
    return stripped.ok ? stripped.code : problem.typescript.starter;
  }
  return problem.typescript.starter;
}
