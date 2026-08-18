import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useSubmissions } from './useSubmissions';
import { createLocalSubmissionStore, setSubmissionStore, SUBMISSION_SCHEMA } from '@/submissions/store';
import type { SubmissionDraft } from '@/submissions/types';

function draft(overrides: Partial<SubmissionDraft> = {}): SubmissionDraft {
  return {
    schema: SUBMISSION_SCHEMA,
    owner: 'local',
    problemSlug: 'two-sum',
    problemNumber: 1,
    problemTitle: 'Two Sum',
    difficulty: 'Easy',
    language: 'typescript',
    submittedAt: new Date().toISOString(),
    verdict: 'accepted',
    passed: 2,
    total: 2,
    cases: [],
    runtimeMs: 1,
    totalMs: 2,
    complexity: { time: 'O(n)', space: 'O(n)', confidence: 0.8 },
    code: 'x',
    ...overrides,
  };
}

describe('useSubmissions', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setSubmissionStore(createLocalSubmissionStore());
  });

  it('has nothing to show without a problem', async () => {
    const { result } = renderHook(() => useSubmissions(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([]);
    expect(result.current.latest).toBeNull();
  });

  it('records an attempt and shows it as the latest', async () => {
    const { result } = renderHook(() => useSubmissions('two-sum'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.record(draft({ verdict: 'wrong-answer' }));
    });
    expect(result.current.latest?.verdict).toBe('wrong-answer');

    await act(async () => {
      await result.current.record(draft({ verdict: 'accepted' }));
    });
    expect(result.current.latest?.verdict).toBe('accepted');
    expect(result.current.items).toHaveLength(2);
    // Solved is about every problem, not just this one, so the drawer can tick.
    expect(result.current.solved.has('two-sum')).toBe(true);
  });

  it('shows only the problem it was asked about', async () => {
    const { result } = renderHook(() => useSubmissions('two-sum'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.record(draft({ problemSlug: 'subsets' }));
      await result.current.record(draft({ problemSlug: 'two-sum' }));
    });

    expect(result.current.items.map((s) => s.problemSlug)).toEqual(['two-sum']);
    expect(result.current.solved).toEqual(new Set(['subsets', 'two-sum']));
  });

  it('forgets an attempt, and the whole history', async () => {
    const { result } = renderHook(() => useSubmissions('two-sum'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let id = '';
    await act(async () => {
      id = (await result.current.record(draft())).id;
      await result.current.record(draft());
    });

    await act(async () => {
      await result.current.remove(id);
    });
    expect(result.current.items).toHaveLength(1);

    await act(async () => {
      await result.current.clear();
    });
    expect(result.current.items).toEqual([]);
    expect(result.current.solved.has('two-sum')).toBe(false);
  });
});
