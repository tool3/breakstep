import { useCallback, useEffect, useRef, useState } from 'react';
import { submissionStore } from '@/submissions/store';
import type { Submission, SubmissionDraft } from '@/submissions/types';

export interface Submissions {
  items: Submission[];
  latest: Submission | null;
  solved: Set<string>;
  loading: boolean;
  record: (draft: SubmissionDraft) => Promise<Submission>;
  remove: (id: string) => Promise<void>;
  clear: () => Promise<void>;
}

export function useSubmissions(problemSlug: string | null): Submissions {
  const [items, setItems] = useState<Submission[]>([]);
  const [solved, setSolved] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const mine = ++generation.current;
    const store = submissionStore();
    setLoading(true);

    const [list, solvedSlugs] = await Promise.all([
      problemSlug ? store.list({ problemSlug }) : Promise.resolve([]),
      store.solved(),
    ]);

    if (generation.current !== mine) return;
    setItems(list);
    setSolved(new Set(solvedSlugs));
    setLoading(false);
  }, [problemSlug]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const record = useCallback(
    async (draft: SubmissionDraft) => {
      const saved = await submissionStore().save(draft);
      await refresh();
      return saved;
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await submissionStore().remove(id);
      await refresh();
    },
    [refresh],
  );

  const clear = useCallback(async () => {
    if (!problemSlug) return;
    await submissionStore().clear({ problemSlug });
    await refresh();
  }, [problemSlug, refresh]);

  return { items, latest: items[0] ?? null, solved, loading, record, remove, clear };
}
