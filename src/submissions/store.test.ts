/**
 * The store is the piece most likely to be replaced, so what is pinned here is
 * the *contract* — ids assigned on save, newest first, queries by problem — not
 * how `localStorage` happens to hold it. A service-backed implementation has to
 * pass the same expectations.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_CODE_CHARS,
  MAX_PER_PROBLEM,
  MAX_TOTAL,
  SUBMISSION_SCHEMA,
  applyCaps,
  createLocalSubmissionStore,
  setSubmissionStore,
  submissionStore,
} from './store';
import { STORAGE_PREFIX } from '@/hooks/useLocalStorage';
import type { Submission, SubmissionDraft } from './types';

function draft(overrides: Partial<SubmissionDraft> = {}): SubmissionDraft {
  return {
    schema: SUBMISSION_SCHEMA,
    owner: 'local',
    problemSlug: 'two-sum',
    problemNumber: 1,
    problemTitle: 'Two Sum',
    difficulty: 'Easy',
    language: 'typescript',
    submittedAt: '2026-08-18T10:00:00.000Z',
    verdict: 'accepted',
    passed: 3,
    total: 3,
    cases: [],
    runtimeMs: 0.4,
    totalMs: 2.1,
    operations: 128,
    complexity: { time: 'O(n)', space: 'O(n)', confidence: 0.8 },
    code: 'function twoSum() {}',
    ...overrides,
  };
}

/** A stored record, for the cap helper, which never touches storage. */
function record(slug: string, id: string, verdict: Submission['verdict'] = 'accepted'): Submission {
  return { ...draft({ problemSlug: slug, verdict }), id };
}

describe('the local submission store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setSubmissionStore(createLocalSubmissionStore());
  });

  it('assigns the id, and hands the record back', async () => {
    const saved = await submissionStore().save(draft());
    expect(saved.id).toBeTruthy();
    expect(saved.schema).toBe(SUBMISSION_SCHEMA);
    expect(saved.verdict).toBe('accepted');
  });

  it('lists newest first', async () => {
    const store = submissionStore();
    await store.save(draft({ submittedAt: '2026-08-18T10:00:00.000Z', passed: 1 }));
    await store.save(draft({ submittedAt: '2026-08-18T11:00:00.000Z', passed: 2 }));

    expect((await store.list()).map((s) => s.passed)).toEqual([2, 1]);
  });

  it('lists one problem at a time', async () => {
    const store = submissionStore();
    await store.save(draft({ problemSlug: 'two-sum' }));
    await store.save(draft({ problemSlug: 'valid-palindrome' }));

    expect(await store.list({ problemSlug: 'two-sum' })).toHaveLength(1);
    expect(await store.list({ problemSlug: 'nope' })).toHaveLength(0);
    expect(await store.list()).toHaveLength(2);
    expect(await store.list({ limit: 1 })).toHaveLength(1);
  });

  it('reports which problems have been solved, and only those', async () => {
    const store = submissionStore();
    await store.save(draft({ problemSlug: 'two-sum', verdict: 'accepted' }));
    await store.save(draft({ problemSlug: 'valid-palindrome', verdict: 'wrong-answer' }));

    expect(await store.solved()).toEqual(['two-sum']);
  });

  it('forgets one attempt, or every attempt at one problem', async () => {
    const store = submissionStore();
    const first = await store.save(draft());
    await store.save(draft({ passed: 1 }));
    await store.save(draft({ problemSlug: 'valid-palindrome' }));

    await store.remove(first.id);
    expect(await store.list({ problemSlug: 'two-sum' })).toHaveLength(1);

    await store.clear({ problemSlug: 'two-sum' });
    expect(await store.list({ problemSlug: 'two-sum' })).toHaveLength(0);
    // Clearing one problem leaves the others alone.
    expect(await store.list({ problemSlug: 'valid-palindrome' })).toHaveLength(1);

    await store.clear();
    expect(await store.list()).toHaveLength(0);
  });

  it('survives a record written by a different version', async () => {
    window.localStorage.setItem(
      `${STORAGE_PREFIX}submissions`,
      JSON.stringify({ version: SUBMISSION_SCHEMA + 1, items: [record('two-sum', 'x')] }),
    );
    // Reading a shape this build does not understand is not an error; it is a
    // history that no longer means anything, so it goes.
    expect(await submissionStore().list()).toEqual([]);
  });

  it('survives corrupted storage', async () => {
    window.localStorage.setItem(`${STORAGE_PREFIX}submissions`, '{not json');
    expect(await submissionStore().list()).toEqual([]);
  });

  it('will not store an unbounded amount of code', async () => {
    const saved = await submissionStore().save(draft({ code: 'x'.repeat(MAX_CODE_CHARS + 500) }));
    expect(saved.code.length).toBe(MAX_CODE_CHARS);
  });
});

describe('retention', () => {
  it('keeps the newest attempts at each problem', () => {
    const items = Array.from({ length: MAX_PER_PROBLEM + 5 }, (_, i) =>
      record('two-sum', `s${i}`),
    );
    const kept = applyCaps(items);

    expect(kept).toHaveLength(MAX_PER_PROBLEM);
    // Newest first in, newest first kept.
    expect(kept[0].id).toBe('s0');
  });

  it('will not let one problem evict the record of every other', () => {
    const hammered = Array.from({ length: 200 }, (_, i) => record('two-sum', `a${i}`));
    const others = ['valid-palindrome', 'subsets', 'sort-colors'].map((slug) =>
      record(slug, `b-${slug}`),
    );
    const kept = applyCaps([...hammered, ...others]);

    expect(kept.filter((s) => s.problemSlug === 'two-sum')).toHaveLength(MAX_PER_PROBLEM);
    for (const slug of ['valid-palindrome', 'subsets', 'sort-colors']) {
      expect(kept.some((s) => s.problemSlug === slug), slug).toBe(true);
    }
  });

  it('caps the whole history too', () => {
    const many = Array.from({ length: MAX_TOTAL + 50 }, (_, i) => record(`problem-${i}`, `s${i}`));
    expect(applyCaps(many)).toHaveLength(MAX_TOTAL);
  });
});

describe('swapping the store out', () => {
  it('is one call, and nothing else has to know', async () => {
    const remote: Submission[] = [record('subsets', 'remote-1')];
    setSubmissionStore({
      list: async () => remote,
      save: async (d) => ({ ...d, id: 'remote-2' }),
      remove: async () => undefined,
      clear: async () => undefined,
      solved: async () => ['subsets'],
    });

    expect(await submissionStore().list()).toEqual(remote);
    expect((await submissionStore().save(draft())).id).toBe('remote-2');

    setSubmissionStore(createLocalSubmissionStore());
  });
});
