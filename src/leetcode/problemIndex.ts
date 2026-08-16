/**
 * The full public problem index.
 *
 * Every LeetCode problem — number, slug, title, difficulty, paid-only flag and
 * LeetCode's own topic tags — vendored from their public catalogue endpoint by
 * `scripts/fetch-problem-index.mjs` and committed. The app never calls
 * leetcode.com itself.
 *
 * Metadata only. Problem statements and solutions are LeetCode's content, so
 * they are neither fetched nor stored; the handful of problems that ship with a
 * dataset and a worked solution live in `catalogue.ts` and are written here.
 *
 * The file is ~300 kB, so it is imported dynamically: someone who never opens
 * the problem drawer never downloads it.
 */

export interface IndexedProblem {
  number: number;
  slug: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  /** Premium problems cannot be read without a subscription — say so up front. */
  paidOnly: boolean;
  /** LeetCode's own topic tags, e.g. `two-pointers`, `dynamic-programming`. */
  topics: string[];
}

export interface ProblemIndex {
  /** When the metadata was last refreshed, as YYYY-MM-DD. */
  fetchedAt: string;
  size: number;
  get(slug: string): IndexedProblem | undefined;
  /** Slug-prefix search, for the "did you mean" list. */
  search(query: string, limit?: number): IndexedProblem[];
}

interface RawIndex {
  fetchedAt: string;
  count: number;
  topics: string[];
  /** `[number, slug, title | 0, difficulty, paidOnly, ...topicIds]` */
  rows: (number | string)[][];
}

const DIFFICULTY = ['Easy', 'Medium', 'Hard'] as const;

/** Titles that are just the slug title-cased are stored as 0 and rebuilt here. */
function titleFromSlug(slug: string): string {
  return slug
    .split('-')
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

function decode(raw: RawIndex): ProblemIndex {
  const bySlug = new Map<string, IndexedProblem>();

  for (const row of raw.rows) {
    const slug = row[1] as string;
    bySlug.set(slug, {
      number: row[0] as number,
      slug,
      title: row[2] === 0 ? titleFromSlug(slug) : (row[2] as string),
      difficulty: DIFFICULTY[row[3] as number] ?? 'Medium',
      paidOnly: row[4] === 1,
      topics: (row.slice(5) as number[]).map((id) => raw.topics[id]).filter(Boolean),
    });
  }

  const all = [...bySlug.values()];

  return {
    fetchedAt: raw.fetchedAt,
    size: bySlug.size,
    get: (slug) => bySlug.get(slug),
    /**
     * Slug search, tolerant enough to be useful on a typo.
     *
     * A whole-slug match wins; failing that, problems are scored on how many of
     * the query's words appear in their slug, which is what rescues
     * `two-sum-iiii` → `two-sum-ii`. Shorter slugs break ties, so the plain
     * problem outranks its variants.
     */
    search(query, limit = 6) {
      const needle = query.trim().toLowerCase().replace(/\s+/g, '-');
      if (needle.length < 2) return [];

      const words = needle.split('-').filter((w) => w.length > 1);
      const scored: { problem: IndexedProblem; score: number }[] = [];

      for (const problem of all) {
        let score = 0;
        if (problem.slug === needle) score = 1000;
        else if (problem.slug.startsWith(needle) || needle.startsWith(problem.slug)) score = 100;
        else if (problem.slug.includes(needle)) score = 50;

        for (const word of words) {
          if (problem.slug.includes(word)) score += 10;
        }

        // How far the two slugs agree from the left. This is what separates a
        // typo from an unrelated problem that happens to share a word.
        let shared = 0;
        while (shared < needle.length && needle[shared] === problem.slug[shared]) shared++;
        score += shared * 3;

        // One incidental word in common is noise, not a suggestion.
        if (score >= 20) scored.push({ problem, score: score - problem.slug.length / 100 });
      }

      return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((s) => s.problem);
    },
  };
}

let pending: Promise<ProblemIndex> | null = null;

/**
 * Load the index, once per session.
 *
 * Callers can render without it — an uncatalogued problem still gets a
 * keyword-based guess — so this never blocks the drawer from opening.
 */
export function loadProblemIndex(): Promise<ProblemIndex> {
  if (!pending) {
    pending = import('./problemIndex.json')
      .then((mod) => decode((mod.default ?? mod) as unknown as RawIndex))
      .catch((error) => {
        // Let the next attempt try again rather than caching the failure.
        pending = null;
        throw error;
      });
  }
  return pending;
}
