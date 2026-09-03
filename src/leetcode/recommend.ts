import { getProblem } from './catalogue';
import { readTopics, tagLabel } from './topics';
import type { IndexedProblem, ProblemIndex } from './problemIndex';
import type { LeetProblem, PatternId, Technique } from './types';

export function parseSlug(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const fromUrl = trimmed.match(/\/problems\/([a-z0-9-]+)/i);
  if (fromUrl) return fromUrl[1].toLowerCase();

  if (/[/.]/.test(trimmed) && !/^[a-z0-9-]+$/i.test(trimmed)) return null;

  if (/^[a-z0-9-]+$/i.test(trimmed)) return trimmed.toLowerCase();

  const slug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || null;
}

const HINTS: { pattern: PatternId; words: string[]; weight: number }[] = [
  { pattern: 'two-pointers', words: ['two-sum', 'palindrome', 'reverse', 'container', 'sorted-array', 'partition', 'squares'], weight: 3 },
  { pattern: 'two-pointers', words: ['sorted', 'pair', 'trapping', 'water'], weight: 2 },

  { pattern: 'sliding-window', words: ['substring', 'window', 'subarray'], weight: 3 },
  { pattern: 'sliding-window', words: ['longest', 'consecutive', 'maximum-sum', 'anagrams'], weight: 2 },

  { pattern: 'binary-search', words: ['binary-search', 'rotated', 'peak', 'kth', 'median', 'sqrt', 'capacity', 'speed'], weight: 3 },
  { pattern: 'binary-search', words: ['minimum', 'search', 'first', 'last', 'position'], weight: 1 },

  { pattern: 'sorting', words: ['sort', 'intervals', 'merge', 'anagram', 'largest-number', 'meeting-rooms'], weight: 3 },
  { pattern: 'sorting', words: ['colors', 'frequent', 'top-k'], weight: 2 },

  { pattern: 'bfs', words: ['level-order', 'shortest', 'rotting', 'ladder', 'maze', 'orange'], weight: 3 },
  { pattern: 'bfs', words: ['grid', 'matrix', 'island', 'distance', 'zigzag', 'right-side'], weight: 2 },

  { pattern: 'dfs', words: ['clone', 'course-schedule', 'connected', 'topological', 'surrounded', 'pacific'], weight: 3 },
  { pattern: 'dfs', words: ['graph', 'island', 'region', 'area', 'path-sum', 'ancestor'], weight: 2 },

  { pattern: 'recursion', words: ['stairs', 'fibonacci', 'invert', 'same-tree', 'symmetric', 'merge-two-sorted'], weight: 3 },
  { pattern: 'recursion', words: ['tree', 'depth', 'linked-list', 'balanced', 'diameter'], weight: 2 },

  { pattern: 'backtracking', words: ['permutation', 'combination', 'subsets', 'n-queens', 'word-search', 'sudoku', 'parentheses'], weight: 3 },
  { pattern: 'backtracking', words: ['generate', 'partition', 'restore', 'letter'], weight: 2 },
];

const HEURISTIC_WHY: Record<PatternId, string> = {
  'two-pointers': 'The name suggests a sorted or symmetric scan, which is where two converging indices usually beat a nested loop.',
  'sliding-window': 'The name mentions a contiguous run — substring, subarray, window — which is what a sliding window is for.',
  'binary-search': 'The name suggests a sorted search space, or a "smallest value that works" question, both of which binary search answers in log time.',
  sorting: 'The name suggests the answer depends on order, and sorting first usually turns an all-pairs comparison into a single pass.',
  bfs: 'The name suggests shortest paths, levels or a grid, where breadth-first search reaches everything in distance order.',
  dfs: 'The name suggests exploring a graph or tree fully — connectivity, cycles, regions — which depth-first search does with the least bookkeeping.',
  recursion: 'The name suggests a structure defined in terms of itself, so a recurrence over the smaller case is likely the shortest route.',
  backtracking: 'The name suggests enumerating arrangements or combinations, which is the choose / explore / un-choose pattern.',
};

export function guessTechniques(slug: string): Technique[] {
  const scores = new Map<PatternId, number>();

  for (const hint of HINTS) {
    for (const word of hint.words) {
      if (slug.includes(word)) {
        scores.set(hint.pattern, (scores.get(hint.pattern) ?? 0) + hint.weight);
      }
    }
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  return ranked.map(([pattern], index) => ({
    pattern,
    rank: index + 1,
    why: HEURISTIC_WHY[pattern],
    complexity: { time: 'unknown' as const, space: 'unknown' as const },
  }));
}

export function techniquesFromTopics(topics: string[]): Technique[] {
  const { ranked } = readTopics(topics);

  return ranked.map((entry, index) => ({
    pattern: entry.pattern,
    rank: index + 1,
    why:
      entry.from.length === 1
        ? `LeetCode tags this problem ${tagLabel(entry.from[0])}.`
        : `LeetCode tags this problem ${entry.from.map(tagLabel).join(', ')}.`,
    complexity: { time: 'unknown' as const, space: 'unknown' as const },
  }));
}

export interface Recommendation {
  input: string;
  slug: string | null;
  problem?: LeetProblem;
  indexed?: IndexedProblem;
  techniques: Technique[];
  structures: string[];
  unmapped: string[];
  source: 'catalogue' | 'indexed' | 'guess' | 'unrecognised';
  note: string;
  suggestions: IndexedProblem[];
}

const EMPTY = { structures: [] as string[], unmapped: [] as string[], suggestions: [] as IndexedProblem[] };

export function recommend(input: string, index?: ProblemIndex | null): Recommendation {
  const slug = parseSlug(input);

  if (!slug) {
    return {
      input,
      slug: null,
      techniques: [],
      source: 'unrecognised',
      note: 'That does not look like a LeetCode problem link. Paste something like https://leetcode.com/problems/two-sum/.',
      ...EMPTY,
    };
  }

  const indexed = index?.get(slug);
  const problem = getProblem(slug);

  if (problem) {
    const topics = readTopics(indexed?.topics ?? problem.topics);
    return {
      input,
      slug,
      problem,
      indexed,
      techniques: [...problem.techniques].sort((a, b) => a.rank - b.rank),
      structures: topics.structures,
      unmapped: topics.unmapped,
      source: 'catalogue',
      note: 'Written out in full here — the problem, its example datasets, and a solution you can reveal.',
      suggestions: [],
    };
  }

  if (indexed) {
    const topics = readTopics(indexed.topics);
    const fromTags = techniquesFromTopics(indexed.topics);
    return {
      input,
      slug,
      indexed,
      techniques: fromTags.length > 0 ? fromTags : guessTechniques(slug),
      structures: topics.structures,
      unmapped: topics.unmapped,
      source: 'indexed',
      note: indexed.paidOnly
        ? 'A LeetCode Premium problem: the statement is behind their paywall, but the technique advice below comes from its published tags.'
        : 'Breakstep knows this problem but does not carry its statement — read it on LeetCode, then bring the technique back here.',
      suggestions: [],
    };
  }

  const guessed = guessTechniques(slug);
  return {
    input,
    slug,
    techniques: guessed,
    structures: [],
    unmapped: [],
    source: 'guess',
    note: guessed.length
      ? 'Not a slug Breakstep recognises, so this is inferred from the name alone — treat it as a hint, not an answer.'
      : 'Not a slug Breakstep recognises, and the name gives nothing away. Browse the patterns below and pick the one that fits the shape of the input.',
    suggestions: index?.search(slug) ?? [],
  };
}
