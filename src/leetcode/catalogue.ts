import { TWO_POINTER_PROBLEMS } from './problems/twoPointers';
import { SLIDING_WINDOW_PROBLEMS } from './problems/slidingWindow';
import { BINARY_SEARCH_PROBLEMS } from './problems/binarySearch';
import { SORTING_PROBLEMS } from './problems/sorting';
import { BFS_PROBLEMS } from './problems/bfs';
import { DFS_PROBLEMS } from './problems/dfs';
import { RECURSION_PROBLEMS } from './problems/recursion';
import { BACKTRACKING_PROBLEMS } from './problems/backtracking';
import type { LeetProblem, PatternId } from './types';

export const PROBLEMS: LeetProblem[] = [
  ...TWO_POINTER_PROBLEMS,
  ...SLIDING_WINDOW_PROBLEMS,
  ...BINARY_SEARCH_PROBLEMS,
  ...SORTING_PROBLEMS,
  ...BFS_PROBLEMS,
  ...DFS_PROBLEMS,
  ...RECURSION_PROBLEMS,
  ...BACKTRACKING_PROBLEMS,
];

export function getProblem(slug: string): LeetProblem | undefined {
  return PROBLEMS.find((p) => p.slug === slug);
}

export function problemsForPattern(pattern: PatternId): LeetProblem[] {
  return PROBLEMS.filter((p) => p.techniques.some((t) => t.pattern === pattern && t.rank === 1));
}

export function problemsByPattern(): { pattern: PatternId; problems: LeetProblem[] }[] {
  const order: PatternId[] = [
    'two-pointers',
    'sliding-window',
    'binary-search',
    'sorting',
    'bfs',
    'dfs',
    'recursion',
    'backtracking',
  ];
  return order.map((pattern) => ({ pattern, problems: problemsForPattern(pattern) }));
}
