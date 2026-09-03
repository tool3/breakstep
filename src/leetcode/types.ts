import type { ComplexityClass, ParamSpec } from '@/types';

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

export interface LeetExample {
  input: string;
  output: string;
  note?: string;
}

export interface Technique {
  pattern: PatternId;
  rank: number;
  why: string;
  complexity: { time: ComplexityClass; space: ComplexityClass };
}

export interface ProblemSource {
  starter: string;
  solution: string;
}

export interface LeetProblem {
  slug: string;
  number: number;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  topics: string[];

  origin?: 'generated';

  prompt: string;
  constraints: string[];
  examples: LeetExample[];

  techniques: Technique[];

  params: ParamSpec[];

  typescript: ProblemSource;
  python: ProblemSource;

  expectedOutput: string[];
}
