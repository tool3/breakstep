import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProblemDrawer } from './ProblemDrawer';
import { getProblem } from '@/leetcode/catalogue';

function setup(overrides: Partial<Parameters<typeof ProblemDrawer>[0]> = {}) {
  const props = {
    open: true,
    language: 'typescript' as const,
    currentSlug: null,
    onClose: vi.fn(),
    onLoad: vi.fn(),
    onReveal: vi.fn(),
    onOpenPattern: vi.fn(),
    ...overrides,
  };
  render(<ProblemDrawer {...props} />);
  return props;
}

/** Paste a URL and press Find. */
async function find(user: ReturnType<typeof userEvent.setup>, url: string) {
  await user.type(screen.getByLabelText('LeetCode problem URL'), url);
  await user.click(screen.getByRole('button', { name: /find/i }));
}

describe('ProblemDrawer', () => {
  it('says up front that nothing is sent anywhere', () => {
    setup();
    expect(screen.getByText(/Nothing leaves your browser/)).toBeInTheDocument();
  });

  it('lets you browse by technique without pasting anything', () => {
    setup();
    expect(screen.getByText('Two pointers')).toBeInTheDocument();
    expect(screen.getByText('Backtracking')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rotting Oranges/ })).toBeInTheDocument();
  });

  it('resolves a pasted URL into the full problem', async () => {
    const user = userEvent.setup();
    setup();
    await find(user, 'https://leetcode.com/problems/koko-eating-bananas/');

    expect(await screen.findByRole('heading', { name: 'Koko Eating Bananas' })).toBeInTheDocument();
    // The exact example datasets, as the site states them.
    expect(screen.getByText('piles = [3,6,7,11], h = 8')).toBeInTheDocument();
    expect(screen.getByText('→ 4')).toBeInTheDocument();
    // And its constraints.
    expect(screen.getByText('1 ≤ piles.length ≤ 10⁴')).toBeInTheDocument();
  });

  it('recommends the technique, with the reason and the cost', async () => {
    const user = userEvent.setup();
    setup();
    await find(user, 'https://leetcode.com/problems/koko-eating-bananas/');

    expect(
      await screen.findByRole('button', { name: /Open the binary search template/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('reach for')).toBeInTheDocument();
    expect(screen.getByText(/Binary search on the answer/)).toBeInTheDocument();
    expect(screen.getByText(/O\(n log n\) time/)).toBeInTheDocument();
  });

  it('ranks several techniques when there really are several', async () => {
    const user = userEvent.setup();
    setup();
    await find(user, 'number-of-islands');

    expect(await screen.findByText('reach for')).toBeInTheDocument();
    expect(screen.getByText('also works')).toBeInTheDocument();
  });

  it('loads the starter and reveals the solution', async () => {
    const user = userEvent.setup();
    const props = setup();
    await find(user, 'subsets');

    await user.click(await screen.findByRole('button', { name: /Load the problem/ }));
    expect(props.onLoad).toHaveBeenCalledWith(getProblem('subsets'));

    await user.click(screen.getByRole('button', { name: /Reveal the solution/ }));
    expect(props.onReveal).toHaveBeenCalledWith(getProblem('subsets'));
  });

  it('opens the pattern behind a recommendation', async () => {
    const user = userEvent.setup();
    const props = setup();
    await find(user, 'subsets');

    await user.click(await screen.findByRole('button', { name: /Open the backtracking template/ }));
    expect(props.onOpenPattern).toHaveBeenCalledWith('backtracking');
  });

  it('is honest when a problem is not in the catalogue', async () => {
    const user = userEvent.setup();
    setup();
    await find(user, 'https://leetcode.com/problems/longest-palindromic-substring/');

    expect(
      await screen.findByText(/Not in the catalogue: longest-palindromic-substring/),
    ).toBeInTheDocument();
    // It still recommends something, and still lets you open the pattern.
    expect(screen.getByText('Likely technique')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reveal the solution/ })).not.toBeInTheDocument();
  });

  it('rejects a link that is not a problem link', async () => {
    const user = userEvent.setup();
    setup();
    await find(user, 'https://example.com/blog');

    expect(await screen.findByText('That link was not a problem link')).toBeInTheDocument();
  });

  it('shows a browsed problem without any URL at all', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: /Merge Intervals/ }));

    expect(await screen.findByText(/merge every group that overlaps/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Load the problem/ })).toBeInTheDocument();
  });

  it('marks the problem already in the editor', () => {
    setup({ currentSlug: 'permutations' });
    const row = screen.getByRole('button', { name: /Permutations/ });
    expect(row.querySelector('[aria-label="loaded"]')).not.toBeNull();
  });

  it('names the language the solution will arrive in', async () => {
    const user = userEvent.setup();
    setup({ language: 'python' });
    await user.click(screen.getByRole('button', { name: /Climbing Stairs/ }));
    expect(await screen.findByText('in python')).toBeInTheDocument();
  });
});
