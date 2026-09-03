import type { PatternId } from './types';

interface TagRule {
  pattern: PatternId;
  weight: number;
}

const TAG_PATTERNS: Record<string, TagRule[]> = {
  'two-pointers': [{ pattern: 'two-pointers', weight: 10 }],
  'sliding-window': [{ pattern: 'sliding-window', weight: 10 }],
  'binary-search': [{ pattern: 'binary-search', weight: 10 }],
  sorting: [{ pattern: 'sorting', weight: 10 }],
  'breadth-first-search': [{ pattern: 'bfs', weight: 10 }],
  'depth-first-search': [{ pattern: 'dfs', weight: 10 }],
  recursion: [{ pattern: 'recursion', weight: 10 }],
  backtracking: [{ pattern: 'backtracking', weight: 10 }],

  'divide-and-conquer': [
    { pattern: 'recursion', weight: 6 },
    { pattern: 'binary-search', weight: 3 },
  ],
  memoization: [{ pattern: 'recursion', weight: 6 }],
  'topological-sort': [
    { pattern: 'dfs', weight: 6 },
    { pattern: 'bfs', weight: 4 },
  ],
  'shortest-path': [{ pattern: 'bfs', weight: 6 }],
  'union-find': [{ pattern: 'dfs', weight: 4 }],
  trie: [{ pattern: 'dfs', weight: 3 }],
  graph: [
    { pattern: 'dfs', weight: 5 },
    { pattern: 'bfs', weight: 4 },
  ],
  matrix: [
    { pattern: 'bfs', weight: 3 },
    { pattern: 'dfs', weight: 3 },
  ],
  tree: [
    { pattern: 'recursion', weight: 5 },
    { pattern: 'dfs', weight: 4 },
  ],
  'binary-tree': [
    { pattern: 'recursion', weight: 5 },
    { pattern: 'dfs', weight: 4 },
  ],
  'binary-search-tree': [
    { pattern: 'recursion', weight: 4 },
    { pattern: 'binary-search', weight: 3 },
  ],
  'linked-list': [
    { pattern: 'two-pointers', weight: 4 },
    { pattern: 'recursion', weight: 3 },
  ],
  'heap-priority-queue': [{ pattern: 'sorting', weight: 4 }],
  greedy: [{ pattern: 'sorting', weight: 3 }],
  'prefix-sum': [{ pattern: 'sliding-window', weight: 3 }],
  counting: [{ pattern: 'sliding-window', weight: 2 }],
  'monotonic-stack': [{ pattern: 'two-pointers', weight: 2 }],
  'monotonic-queue': [{ pattern: 'sliding-window', weight: 3 }],
  'string-matching': [{ pattern: 'sliding-window', weight: 3 }],
  enumeration: [{ pattern: 'backtracking', weight: 2 }],
  combinatorics: [{ pattern: 'backtracking', weight: 3 }],
};

const DESCRIPTIVE = new Set([
  'array',
  'string',
  'matrix',
  'math',
  'simulation',
  'database',
  'design',
  'interactive',
  'concurrency',
  'shell',
  'iterator',
  'data-stream',
  'number-theory',
  'geometry',
  'randomized',
  'brainteaser',
]);

const TAG_STRUCTURES: Record<string, string> = {
  stack: 'stack',
  'monotonic-stack': 'stack',
  queue: 'queue',
  'monotonic-queue': 'queue',
  'heap-priority-queue': 'priority-queue',
  'hash-table': 'hashmap',
  'linked-list': 'linked-list',
  'doubly-linked-list': 'doubly-linked-list',
  'binary-search-tree': 'bst',
  tree: 'bst',
  'binary-tree': 'bst',
  trie: 'trie',
  graph: 'graph',
  'topological-sort': 'dag',
};

export function tagLabel(tag: string): string {
  return tag.replace(/-/g, ' ');
}

export interface TopicVerdict {
  ranked: { pattern: PatternId; score: number; from: string[] }[];
  structures: string[];
  unmapped: string[];
}

export function readTopics(topics: string[]): TopicVerdict {
  const scores = new Map<PatternId, { score: number; from: string[] }>();
  const structures: string[] = [];
  const unmapped: string[] = [];

  for (const tag of topics) {
    const rules = TAG_PATTERNS[tag];
    const structure = TAG_STRUCTURES[tag];

    if (structure && !structures.includes(structure)) structures.push(structure);

    if (!rules) {
      if (!structure && !DESCRIPTIVE.has(tag)) unmapped.push(tag);
      continue;
    }

    for (const rule of rules) {
      const current = scores.get(rule.pattern) ?? { score: 0, from: [] };
      current.score += rule.weight;
      current.from.push(tag);
      scores.set(rule.pattern, current);
    }
  }

  const ranked = [...scores.entries()]
    .map(([pattern, v]) => ({ pattern, score: v.score, from: v.from }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return { ranked, structures, unmapped };
}
