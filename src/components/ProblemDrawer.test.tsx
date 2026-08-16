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
    onOpenTemplate: vi.fn(),
    ...overrides,
  };
  render(<ProblemDrawer {...props} />);
  return props;
}

/** Paste a URL and press Find. */
async function find(user: ReturnType<typeof userEvent.setup>, url: string) {
  await user.type(screen.getByLabelText('LeetCode problem URL'), url);
  await user.click(screen.getByRole('button', { name: 'Find' }));
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
    expect(props.onOpenTemplate).toHaveBeenCalledWith('backtracking');
  });

  it('identifies a problem it can recognise but not scaffold', async () => {
    const user = userEvent.setup();
    setup();
    // Premium: LeetCode publishes nothing about it to build from.
    await find(user, 'https://leetcode.com/problems/meeting-rooms-ii/');

    expect(
      await screen.findByText(/cannot build a runnable version/),
    ).toBeInTheDocument();
    // The real title, number and difficulty still come from the index.
    expect(screen.getByRole('heading', { name: 'Meeting Rooms II' })).toBeInTheDocument();
    // It still recommends a technique, and still links out.
    expect(screen.getByText('Recommended technique')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Load the problem/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Read it on LeetCode/ })).toHaveAttribute(
      'href',
      'https://leetcode.com/problems/meeting-rooms-ii/',
    );
  });

  it('makes a problem it does not carry runnable anyway', async () => {
    const user = userEvent.setup();
    const onLoad = vi.fn();
    setup({ onLoad });
    await find(user, 'https://leetcode.com/problems/two-sum/');

    expect(await screen.findByText('Ready to run — statement on LeetCode')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Two Sum' })).toBeInTheDocument();

    // LeetCode's own example inputs, with the answers they expect.
    expect(screen.getByText('nums = [2,7,11,15], target = 9')).toBeInTheDocument();
    expect(screen.getAllByText('→ [0,1]').length).toBeGreaterThan(0);

    // It loads, but there is no solution to reveal and it says why.
    await user.click(screen.getByRole('button', { name: /Load the problem/ }));
    expect(onLoad).toHaveBeenCalled();
    const loaded = onLoad.mock.calls[0][0];
    expect(loaded.slug).toBe('two-sum');
    expect(loaded.origin).toBe('generated');
    expect(loaded.typescript.starter).toContain('function twoSum(nums: number[], target: number)');

    expect(screen.queryByRole('button', { name: /Reveal the solution/ })).not.toBeInTheDocument();
    expect(screen.getByText(/No solution to reveal/)).toBeInTheDocument();
  });

  it('never offers a generated problem the statement it does not have', async () => {
    const user = userEvent.setup();
    setup();
    await find(user, 'https://leetcode.com/problems/two-sum/');

    await screen.findByText('Ready to run — statement on LeetCode');
    // The prompt describes the interface; it does not restate the problem.
    expect(screen.getByText(/Write twoSum\(/)).toBeInTheDocument();
    expect(screen.queryByText('Constraints')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Read it on LeetCode/ })).toHaveAttribute(
      'href',
      'https://leetcode.com/problems/two-sum/',
    );
  });

  it('says when a problem is behind LeetCode Premium', async () => {
    const user = userEvent.setup();
    setup();
    await find(user, 'https://leetcode.com/problems/meeting-rooms-ii/');

    expect(await screen.findByText('Premium')).toBeInTheDocument();
  });

  it('offers close matches for a slug nothing recognises', async () => {
    const user = userEvent.setup();
    setup();
    await find(user, 'two-sum-iiii');

    expect(await screen.findByText('Did you mean')).toBeInTheDocument();
  });

  it('reports how big the index is once it has loaded', async () => {
    setup();
    expect(await screen.findByText(/offline index of [\d,]+ problems/)).toBeInTheDocument();
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
