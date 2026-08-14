import type { EditorMode, Language, ParamValues, SourceSet, Template } from '@/types';
import { stripTypes } from '@/engine/transpile';
import { readParamsFromSource } from '@/engine/paramBinding';

// --- Data structures --------------------------------------------------------
import { doublyLinkedList, linkedList, queue, stack } from './structures/linear';
import { maxHeap, minHeap, priorityQueue } from './structures/heaps';
import { binarySearchTree, trie } from './structures/trees';
import { hashMap } from './structures/maps';
import { dag, graph } from './structures/graphs';

// --- Patterns ---------------------------------------------------------------
import { binarySearch, slidingWindow, sorting, twoPointers } from './patterns/arrays';
import { bfs, dfs } from './patterns/graphs';
import { backtracking, recursion } from './patterns/recursion';

// --- Worked examples (the original catalogue, preserved) ---------------------
import * as exampleArrays from './examples/arrays';
import * as exampleLinear from './examples/linear';
import * as exampleTrees from './examples/trees';
import * as exampleGraphs from './examples/graphs';
import * as exampleAdvanced from './examples/advanced';

/**
 * The twelve classic structures. Each is a full implementation plus a driver
 * that exercises the whole API, so the output shows what every method returns.
 */
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

/**
 * The eight classic techniques, each shown solving a named problem — a pattern
 * is only meaningful attached to something it is good at.
 */
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

/** The original catalogue, kept intact and still runnable. */
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

/** Category order in the picker; anything unlisted sorts to the end. */
export const CATEGORY_ORDER = [
  'LeetCode',
  'Data structures',
  'Patterns',
  'Worked examples',
  'Scratch',
];

export const DEFAULT_TEMPLATE_ID = 'linked-list';

/**
 * Templates added at runtime — currently the LeetCode problems, which only
 * exist once someone loads one. They behave exactly like built-in templates
 * from here on: the picker lists them, edits are stored per id, and Reset code
 * goes back to the starter.
 */
const registered = new Map<string, Template>();

export function registerTemplate(template: Template): Template {
  registered.set(template.id, template);
  return template;
}

/** Every template, built-in and registered, in picker order. */
export function allTemplates(): Template[] {
  return [...TEMPLATES, ...registered.values()];
}

export function getTemplate(id: string): Template {
  return TEMPLATES.find((t) => t.id === id) ?? registered.get(id) ?? TEMPLATES[0];
}

/** Category → templates, preserving the declaration order within each group. */
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

/**
 * Pick a language out of a source set.
 * JavaScript is derived from TypeScript so the two can never drift apart.
 */
function pick(set: SourceSet, language: Language): string {
  if (language === 'python') return set.python;
  if (language === 'javascript') {
    if (set.javascript) return set.javascript;
    const stripped = stripTypes(set.typescript);
    return stripped.ok ? stripped.code : set.typescript;
  }
  return set.typescript;
}

/** The source the editor shows for a template, in a given language and mode. */
export function templateSource(
  template: Template,
  language: Language,
  mode: EditorMode = 'clean',
): string {
  return pick(mode === 'instrumented' ? template.instrumented : template.code, language);
}

/**
 * The benchmark harness appended when running the clean variant.
 *
 * Clean code contains no Breakstep API at all, so the Analyze tab would have nothing
 * to sweep. This is the one piece the runner adds on the user's behalf — and it
 * is right there in the instrumented view, not hidden.
 */
export function templateBench(template: Template, language: Language): string {
  if (language === 'python') return template.bench.python;
  if (language === 'javascript') {
    const stripped = stripTypes(template.bench.typescript);
    return stripped.ok ? stripped.code : template.bench.typescript;
  }
  return template.bench.typescript;
}

/** Marks the boundary between the user's code and the appended harness. */
export const BENCH_BANNER = {
  typescript: '// ─── benchmark harness (added by Breakstep in clean mode) ───',
  python: '# --- benchmark harness (added by Breakstep in clean mode) ---',
} as const;

/** Assemble what actually executes: the editor buffer, plus the harness in clean mode. */
export function assembleRunnable(
  template: Template,
  language: Language,
  mode: EditorMode,
  code: string,
): string {
  if (mode === 'instrumented') return code;

  const harness = templateBench(template, language);
  if (!harness.trim()) return code;

  const banner = language === 'python' ? BENCH_BANNER.python : BENCH_BANNER.typescript;
  return `${code}\n\n${banner}\n${harness}`;
}

/**
 * Starting parameter values.
 *
 * In clean mode the panel mirrors the literals in the source, so it is read
 * from the code rather than from the spec defaults — otherwise editing a
 * constant by hand would leave the sliders lying.
 */
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
