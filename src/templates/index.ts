import type { EditorMode, Language, ParamValues, SourceSet, Template } from '@/types';
import { stripTypes } from '@/engine/transpile';
import { readParamsFromSource } from '@/engine/paramBinding';
import { callsAtTopLevel } from '@/leetcode/entryCall';

import { doublyLinkedList, linkedList, queue, stack } from './structures/linear';
import { maxHeap, minHeap, priorityQueue } from './structures/heaps';
import { binarySearchTree, trie } from './structures/trees';
import { hashMap } from './structures/maps';
import { dag, graph } from './structures/graphs';

import { binarySearch, slidingWindow, sorting, twoPointers } from './patterns/arrays';
import { bfs, dfs } from './patterns/graphs';
import { backtracking, recursion } from './patterns/recursion';

import * as exampleArrays from './examples/arrays';
import * as exampleLinear from './examples/linear';
import * as exampleTrees from './examples/trees';
import * as exampleGraphs from './examples/graphs';
import * as exampleAdvanced from './examples/advanced';

export const STRUCTURE_TEMPLATES: Template[] = [
  stack,
  queue,
  linkedList,
  doublyLinkedList,
  minHeap,
  maxHeap,
  priorityQueue,
  binarySearchTree,
  trie,
  hashMap,
  graph,
  dag,
];

export const PATTERN_TEMPLATES: Template[] = [
  twoPointers,
  slidingWindow,
  binarySearch,
  sorting,
  bfs,
  dfs,
  recursion,
  backtracking,
];

export const EXAMPLE_TEMPLATES: Template[] = [
  exampleArrays.twoPointers,
  exampleArrays.slidingWindow,
  exampleArrays.binarySearch,
  exampleArrays.sorting,
  exampleLinear.linkedListReverse,
  exampleLinear.linkedListCycle,
  exampleLinear.stackQueue,
  exampleLinear.hashMap,
  exampleTrees.binarySearchTree,
  exampleTrees.trie,
  exampleTrees.heap,
  exampleGraphs.graphTraversal,
  exampleGraphs.gridIslands,
  exampleAdvanced.backtracking,
  exampleAdvanced.dynamicProgramming,
];

export const SCRATCH_TEMPLATES: Template[] = [exampleAdvanced.blank];

export const TEMPLATES: Template[] = [
  ...STRUCTURE_TEMPLATES,
  ...PATTERN_TEMPLATES,
  ...EXAMPLE_TEMPLATES,
  ...SCRATCH_TEMPLATES,
];

export const CATEGORY_ORDER = [
  'LeetCode',
  'Data structures',
  'Patterns',
  'Worked examples',
  'Scratch',
];

export const DEFAULT_TEMPLATE_ID = 'linked-list';

const registered = new Map<string, Template>();

export function registerTemplate(template: Template): Template {
  registered.set(template.id, template);
  return template;
}

export function allTemplates(): Template[] {
  return [...TEMPLATES, ...registered.values()];
}

export function getTemplate(id: string): Template {
  return TEMPLATES.find((t) => t.id === id) ?? registered.get(id) ?? TEMPLATES[0];
}

export function templatesByCategory(): { category: string; items: Template[] }[] {
  const groups = new Map<string, Template[]>();
  for (const t of allTemplates()) {
    if (!groups.has(t.category)) groups.set(t.category, []);
    groups.get(t.category)!.push(t);
  }

  const rank = (category: string) => {
    const index = CATEGORY_ORDER.indexOf(category);
    return index === -1 ? CATEGORY_ORDER.length : index;
  };

  return [...groups.entries()]
    .map(([category, items]) => ({ category, items }))
    .sort((a, b) => rank(a.category) - rank(b.category));
}

function pick(set: SourceSet, language: Language): string {
  if (language === 'python') return set.python;
  if (language === 'javascript') {
    if (set.javascript) return set.javascript;
    const stripped = stripTypes(set.typescript);
    return stripped.ok ? stripped.code : set.typescript;
  }
  return set.typescript;
}

export function templateSource(
  template: Template,
  language: Language,
  mode: EditorMode = 'clean',
): string {
  return pick(mode === 'instrumented' ? template.instrumented : template.code, language);
}

export function templateBench(template: Template, language: Language): string {
  if (language === 'python') return template.bench.python;
  if (language === 'javascript') {
    const stripped = stripTypes(template.bench.typescript);
    return stripped.ok ? stripped.code : template.bench.typescript;
  }
  return template.bench.typescript;
}

export const BENCH_BANNER = {
  typescript: '// ─── benchmark harness (added by Breakstep in clean mode) ───',
  python: '# --- benchmark harness (added by Breakstep in clean mode) ---',
} as const;

function runHarness(expression: string, language: Language): string {
  if (language === 'python') {
    return [
      '# --- run (Breakstep calls your solution with the values in the Parameters panel) ---',
      `__bs_answer = ${expression}`,
      'if __bs_answer is not None:',
      "    print('->', __bs_answer)",
    ].join('\n');
  }

  return [
    '// ─── run (Breakstep calls your solution with the values in the Parameters panel) ───',
    `const __bsAnswer = ${expression};`,
    "if (__bsAnswer !== undefined) console.log('->', __bsAnswer);",
  ].join('\n');
}

export function templateEntry(template: Template, language: Language) {
  return template.entry?.[language === 'python' ? 'python' : 'typescript'] ?? null;
}

export function assembleRunnable(
  template: Template,
  language: Language,
  mode: EditorMode,
  code: string,
): string {
  if (mode === 'instrumented') return code;

  let out = code;

  const entry = templateEntry(template, language);
  if (entry && !callsAtTopLevel(code, entry.name, language)) {
    out = `${out}\n\n${runHarness(entry.expression, language)}`;
  }

  const harness = templateBench(template, language);
  if (harness.trim()) {
    const banner = language === 'python' ? BENCH_BANNER.python : BENCH_BANNER.typescript;
    out = `${out}\n\n${banner}\n${harness}`;
  }

  return out;
}

export function defaultParams(
  template: Template,
  language: Language = 'typescript',
  mode: EditorMode = 'clean',
  source?: string,
): ParamValues {
  if (mode === 'clean') {
    const text = source ?? templateSource(template, language, mode);
    return readParamsFromSource(text, template.params, language);
  }
  return Object.fromEntries(template.params.map((p) => [p.name, p.default]));
}
