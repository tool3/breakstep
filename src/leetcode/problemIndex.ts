
export interface IndexedProblem {
  number: number;
  slug: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  paidOnly: boolean;
  topics: string[];
}

export interface ProblemIndex {
  fetchedAt: string;
  size: number;
  get(slug: string): IndexedProblem | undefined;
  search(query: string, limit?: number): IndexedProblem[];
}

interface RawIndex {
  fetchedAt: string;
  count: number;
  topics: string[];
  rows: (number | string)[][];
}

const DIFFICULTY = ['Easy', 'Medium', 'Hard'] as const;

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

        let shared = 0;
        while (shared < needle.length && needle[shared] === problem.slug[shared]) shared++;
        score += shared * 3;

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

export function loadProblemIndex(): Promise<ProblemIndex> {
  if (!pending) {
    pending = import('./problemIndex.json')
      .then((mod) => decode((mod.default ?? mod) as unknown as RawIndex))
      .catch((error) => {
        pending = null;
        throw error;
      });
  }
  return pending;
}
