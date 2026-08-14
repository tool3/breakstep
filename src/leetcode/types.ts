import type { ComplexityClass, ParamSpec } from '@/types';

/**
 * The eight techniques the catalogue recommends from.
 *
 * These are exactly the ids of the pattern templates, so a recommendation can
 * always offer "open the pattern" as well as "open the problem".
 */
export type PatternId =
  | 'two-pointers'
  | 'sliding-window'
  | 'binary-search'
  | 'sorting'
  | 'bfs'
  | 'dfs'
  | 'recursion'
  | 'backtracking';

export const PATTERN_LABEL: Record<PatternId, string> = {
  'two-pointers': 'Two pointers',
  'sliding-window': 'Sliding window',
  'binary-search': 'Binary search',
  sorting: 'Sorting',
  bfs: 'Breadth-first search',
  dfs: 'Depth-first search',
  recursion: 'Recursion',
  backtracking: 'Backtracking',
};

/** One worked example, exactly as the problem states it. */
export interface LeetExample {
  input: string;
  output: string;
  note?: string;
}

/**
 * A recommended technique.
 *
 * `rank` orders them: 1 is what to reach for first, 2 and 3 are the honest
 * alternatives — several problems really do have two good answers, and saying
 * so is more useful than pretending there is one.
 */
export interface Technique {
  pattern: PatternId;
  rank: number;
  /** Why this technique fits *this* problem, not what the technique is. */
  why: string;
  complexity: { time: ComplexityClass; space: ComplexityClass };
}

/** Source for one language: the stub the user starts from and the answer. */
export interface ProblemSource {
  starter: string;
  solution: string;
}

export interface LeetProblem {
  /** LeetCode's URL slug — the key everything looks up by. */
  slug: string;
  number: number;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  /** LeetCode's own topic tags, used by the recommender for unknown slugs. */
  topics: string[];

  /** The task, restated. Never a copy of the site's wording. */
  prompt: string;
  constraints: string[];
  examples: LeetExample[];

  techniques: Technique[];

  /** Editable inputs, bound to literals in the driver at the bottom of the code. */
  params: ParamSpec[];

  typescript: ProblemSource;
  python: ProblemSource;

  /** Exactly what the solution prints, in order — the contract the tests check. */
  expectedOutput: string[];
}
