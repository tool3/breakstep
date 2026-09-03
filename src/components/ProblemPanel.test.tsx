import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProblemPanel } from './ProblemPanel';
import { getProblem } from '@/leetcode/catalogue';
import { synthesizeProblem } from '@/leetcode/synthesize';
import type { LeetProblem } from '@/leetcode/types';
import type { Verdict } from '@/submissions/types';

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

function setup(problem: LeetProblem | null, verdict: Verdict | null = null) {
  const props = {
    problem,
    language: 'typescript' as const,
    verdict,
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
    expect(screen.getByText('statement on LeetCode')).toBeInTheDocument();
    expect(screen.queryByText('Constraints')).not.toBeInTheDocument();
  });

  it('still runs the examples for a generated problem', () => {
    setup(generated);
    expect(screen.getByText('nums = [2,7,11,15], target = 9')).toBeInTheDocument();
    expect(screen.getByText('→ [0,1]')).toBeInTheDocument();
  });
});

describe('the verdict beside the problem', () => {
  it('says a problem is solved without opening the history', () => {
    setup(written, 'accepted');
    expect(screen.getByText('Accepted')).toBeInTheDocument();
  });

  it('says when the last attempt was wrong', () => {
    setup(written, 'wrong-answer');
    expect(screen.getByText('Wrong answer')).toBeInTheDocument();
  });

  it('says nothing at all before there has been an attempt', () => {
    setup(written);
    expect(screen.queryByText('Accepted')).not.toBeInTheDocument();
    expect(screen.queryByText('Wrong answer')).not.toBeInTheDocument();
  });
});

describe('where the parts of a problem came from', () => {
  it('credits the data and disclaims the association, for a written problem', () => {
    setup(written);
    expect(screen.getByText(/Task restated and solved here/)).toBeInTheDocument();
    expect(screen.getByText(/not affiliated with or endorsed by LeetCode/)).toBeInTheDocument();
  });

  it('says an assembled problem is assembled, and where to read it', () => {
    setup(generated);
    expect(screen.getByText(/Assembled from the interface and example cases/)).toBeInTheDocument();
    expect(screen.getByText(/is not reproduced/)).toBeInTheDocument();
  });
});

