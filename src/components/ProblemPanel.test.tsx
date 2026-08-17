import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProblemPanel } from './ProblemPanel';
import { getProblem } from '@/leetcode/catalogue';
import { synthesizeProblem } from '@/leetcode/synthesize';
import type { LeetProblem } from '@/leetcode/types';

const written = getProblem('koko-eating-bananas')!;

const generated = synthesizeProblem(
  {
    number: 1,
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    paidOnly: false,
    topics: ['array', 'hash-table'],
  },
  {
    fn: 'twoSum',
    params: [
      ['nums', 'integer[]'],
      ['target', 'integer'],
    ],
    returns: 'integer[]',
    cases: [{ input: ['[2,7,11,15]', '9'], expected: '[0,1]' }],
  },
)!;

function setup(problem: LeetProblem | null) {
  const props = {
    problem,
    language: 'typescript' as const,
    onReveal: vi.fn(),
    onResetToStarter: vi.fn(),
    onOpenTemplate: vi.fn(),
    onFindProblem: vi.fn(),
  };
  render(<ProblemPanel {...props} />);
  return props;
}

describe('ProblemPanel', () => {
  it('offers a way in when nothing is loaded', async () => {
    const user = userEvent.setup();
    const props = setup(null);

    expect(screen.getByText(/No problem loaded/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Find a problem' }));
    expect(props.onFindProblem).toHaveBeenCalled();
  });

  it('shows the problem it is holding', () => {
    setup(written);

    expect(screen.getByRole('heading', { name: 'Koko Eating Bananas' })).toBeInTheDocument();
    expect(screen.getByText('875')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText(/Return the smallest k/)).toBeInTheDocument();
  });

  it('lists the examples with the answers they expect', () => {
    setup(written);
    expect(screen.getByText('piles = [3,6,7,11], h = 8')).toBeInTheDocument();
    expect(screen.getByText('→ 4')).toBeInTheDocument();
  });

  it('lists the constraints when it has them', () => {
    setup(written);
    expect(screen.getByText('Constraints')).toBeInTheDocument();
    expect(screen.getByText('1 ≤ piles.length ≤ 10⁴')).toBeInTheDocument();
  });

  it('recommends a technique, and opens the template behind it', async () => {
    const user = userEvent.setup();
    const props = setup(written);

    expect(screen.getByText('Recommended technique')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Open the binary search template/ }));
    expect(props.onOpenTemplate).toHaveBeenCalledWith('binary-search');
  });

  it('reveals the solution and resets to the starter', async () => {
    const user = userEvent.setup();
    const props = setup(written);

    await user.click(screen.getByRole('button', { name: /Reveal the solution/ }));
    expect(props.onReveal).toHaveBeenCalledWith(written);

    await user.click(screen.getByRole('button', { name: /Reset to starter/ }));
    expect(props.onResetToStarter).toHaveBeenCalled();
  });

  it('links out to the statement', () => {
    setup(written);
    expect(screen.getByRole('link', { name: /On LeetCode/ })).toHaveAttribute(
      'href',
      'https://leetcode.com/problems/koko-eating-bananas/',
    );
  });

  it('offers no solution for a problem assembled from metadata, and says why', () => {
    setup(generated);

    expect(screen.queryByRole('button', { name: /Reveal the solution/ })).not.toBeInTheDocument();
    expect(screen.getByText(/No solution to reveal/)).toBeInTheDocument();
    // And it is honest about where the statement is.
    expect(screen.getByText('statement on LeetCode')).toBeInTheDocument();
    expect(screen.queryByText('Constraints')).not.toBeInTheDocument();
  });

  it('still runs the examples for a generated problem', () => {
    setup(generated);
    expect(screen.getByText('nums = [2,7,11,15], target = 9')).toBeInTheDocument();
    expect(screen.getByText('→ [0,1]')).toBeInTheDocument();
  });
});
