import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SubmissionsPanel, formatMs, formatWhen } from './SubmissionsPanel';
import { getProblem } from '@/leetcode/catalogue';
import type { Submission } from '@/submissions/types';

const problem = getProblem('two-sum-ii-input-array-is-sorted')!;

function submission(overrides: Partial<Submission> = {}): Submission {
  return {
    id: 'a',
    schema: 1,
    owner: 'local',
    problemSlug: problem.slug,
    problemNumber: problem.number,
    problemTitle: problem.title,
    difficulty: 'Medium',
    language: 'typescript',
    submittedAt: new Date().toISOString(),
    verdict: 'accepted',
    passed: 3,
    total: 3,
    cases: [{ label: 'numbers = [2,7,11,15], target = 9', expected: '[1,2]', got: '[1,2]', passed: true }],
    runtimeMs: 0.42,
    totalMs: 3.1,
    operations: 214,
    complexity: { time: 'O(n)', space: 'O(1)', confidence: 0.9 },
    code: 'function twoSum() {}',
    ...overrides,
  };
}

function setup(items: Submission[], overrides: Partial<Parameters<typeof SubmissionsPanel>[0]> = {}) {
  const props = {
    problem,
    items,
    loading: false,
    judging: false,
    onSubmit: vi.fn(),
    onRestore: vi.fn(),
    onRemove: vi.fn(),
    onClear: vi.fn(),
    onFindProblem: vi.fn(),
    ...overrides,
  };
  render(<SubmissionsPanel {...props} />);
  return props;
}

describe('SubmissionsPanel', () => {
  it('sends you to find a problem when there is none', async () => {
    const user = userEvent.setup();
    const props = setup([], { problem: null });

    expect(screen.getByText(/Submissions belong to a problem/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Find a problem' }));
    expect(props.onFindProblem).toHaveBeenCalled();
  });

  it('says what Submit will do before anything has been submitted', () => {
    setup([]);
    expect(screen.getByText('Nothing submitted yet.')).toBeInTheDocument();
    expect(screen.getByText(/no attempts yet/)).toBeInTheDocument();
  });

  it('submits on request', async () => {
    const user = userEvent.setup();
    const props = setup([]);
    await user.click(screen.getByRole('button', { name: /Submit/ }));
    expect(props.onSubmit).toHaveBeenCalled();
  });

  it('says it is judging, and will not take a second submission meanwhile', () => {
    setup([], { judging: true });
    const button = screen.getByRole('button', { name: /Judging/ });
    expect(button).toBeDisabled();
  });

  it('leads with the verdict and the numbers behind it', () => {
    setup([submission()]);

    expect(screen.getByRole('heading', { name: 'Accepted' })).toBeInTheDocument();
    expect(screen.getByText('3/3 cases')).toBeInTheDocument();
    // The metric and the history row both carry it, which is the point.
    expect(screen.getAllByText('0.42 ms').length).toBeGreaterThan(0);
    expect(screen.getByText('214')).toBeInTheDocument();
    expect(screen.getAllByText('O(n)').length).toBeGreaterThan(0);
    expect(screen.getByText('O(1)')).toBeInTheDocument();
  });

  it('shows the failing case with both answers', () => {
    setup([
      submission({
        verdict: 'wrong-answer',
        passed: 0,
        total: 1,
        cases: [
          {
            label: 'numbers = [2,3,4], target = 6',
            expected: '[1,3]',
            got: '[1,2]',
            passed: false,
          },
        ],
      }),
    ]);

    expect(screen.getByRole('heading', { name: 'Wrong answer' })).toBeInTheDocument();
    expect(screen.getByText('numbers = [2,3,4], target = 6')).toBeInTheDocument();
    expect(screen.getByText('expected [1,3]')).toBeInTheDocument();
    expect(screen.getByText('got [1,2]')).toBeInTheDocument();
  });

  it('shows the measured growth curve only when one was measured', () => {
    setup([submission({ empirical: { time: 'O(n log n)', confidence: 0.9 } })]);
    expect(screen.getByText('measured')).toBeInTheDocument();
    expect(screen.getByText('O(n log n)')).toBeInTheDocument();
  });

  it('reports a run that never got as far as an answer', () => {
    setup([
      submission({ verdict: 'runtime-error', passed: 0, total: 3, cases: [], error: 'nums is not defined' }),
    ]);

    expect(screen.getByRole('heading', { name: 'Runtime error' })).toBeInTheDocument();
    expect(screen.getByText('nums is not defined')).toBeInTheDocument();
  });

  it('flags an answer that matched only once order was ignored', () => {
    setup([
      submission({
        cases: [{ label: 'nums = [1,2,3]', expected: '[[1],[2]]', got: '[[2],[1]]', passed: true, unordered: true }],
      }),
    ]);
    expect(screen.getByText('matched once order was ignored')).toBeInTheDocument();
  });

  it('lists the history, and shows whichever attempt you pick', async () => {
    const user = userEvent.setup();
    setup([
      submission({ id: 'new', verdict: 'wrong-answer', passed: 1, total: 3 }),
      submission({ id: 'old', verdict: 'accepted', passed: 3, total: 3 }),
    ]);

    // The newest is the one on show.
    expect(screen.getByRole('heading', { name: 'Wrong answer' })).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /Accepted/ })[0]);
    expect(screen.getByRole('heading', { name: 'Accepted' })).toBeInTheDocument();
  });

  it('puts a past attempt back in the editor, or forgets it', async () => {
    const user = userEvent.setup();
    const props = setup([submission({ id: 'only' })]);

    await user.click(screen.getByRole('button', { name: /Restore the code/ }));
    expect(props.onRestore).toHaveBeenCalledWith(expect.objectContaining({ id: 'only' }));

    await user.click(screen.getByRole('button', { name: 'Delete this attempt' }));
    expect(props.onRemove).toHaveBeenCalledWith('only');
  });

  it('asks before forgetting the whole history', async () => {
    const user = userEvent.setup();
    const props = setup([submission()]);

    await user.click(screen.getByRole('button', { name: /Clear/ }));
    await user.click(await screen.findByRole('button', { name: 'Forget them' }));
    expect(props.onClear).toHaveBeenCalled();
  });
});

describe('formatting', () => {
  it('keeps precision only where it means something', () => {
    expect(formatMs(0.004)).toBe('4.0 µs');
    expect(formatMs(0)).toBe('0 ms');
    expect(formatMs(0.418)).toBe('0.42 ms');
    expect(formatMs(13.4)).toBe('13 ms');
    expect(formatMs(2400)).toBe('2.40 s');
    expect(formatMs(-1)).toBe('—');
  });

  it('reads a timestamp the way a person would say it', () => {
    const now = Date.parse('2026-08-18T12:00:00.000Z');
    expect(formatWhen('2026-08-18T11:59:50.000Z', now)).toBe('just now');
    expect(formatWhen('2026-08-18T11:30:00.000Z', now)).toMatch(/30/);
    // Old enough that a relative phrase stops helping.
    expect(formatWhen('2026-08-01T12:00:00.000Z', now)).toMatch(/Aug/);
  });
});
