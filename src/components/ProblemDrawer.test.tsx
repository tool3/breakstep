import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProblemDrawer } from './ProblemDrawer';
import { getProblem } from '@/leetcode/catalogue';

function setup(overrides: Partial<Parameters<typeof ProblemDrawer>[0]> = {}) {
  // Typed as mocks rather than as the prop signatures, so assertions can read
  // what they were called with.
  const props = {
    open: true,
    currentSlug: null as string | null,
    onClose: vi.fn(),
    onLoad: vi.fn(),
    onOpenTemplate: vi.fn(),
  };
  render(<ProblemDrawer {...props} {...overrides} />);
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

  it('reports how big the index is once it has loaded', async () => {
    setup();
    expect(await screen.findByText(/offline index of [\d,]+ problems/)).toBeInTheDocument();
  });

  it('lets you browse by technique without pasting anything', () => {
    setup();
    expect(screen.getByText('Two pointers')).toBeInTheDocument();
    expect(screen.getByText('Backtracking')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rotting Oranges/ })).toBeInTheDocument();
  });

  it('opens a problem in the editor when its row is clicked', async () => {
    const user = userEvent.setup();
    const props = setup();

    await user.click(screen.getByRole('button', { name: /Merge Intervals/ }));

    expect(props.onLoad).toHaveBeenCalledTimes(1);
    expect(props.onLoad.mock.calls[0][0].slug).toBe('merge-intervals');
    // The problem panel takes over from here, so the finder gets out of the way.
    expect(props.onClose).toHaveBeenCalled();
  });

  it('opens a written-out problem straight from a pasted link', async () => {
    const user = userEvent.setup();
    const props = setup();
    await find(user, 'https://leetcode.com/problems/koko-eating-bananas/');

    await waitFor(() => expect(props.onLoad).toHaveBeenCalled());
    expect(props.onLoad.mock.calls[0][0]).toEqual(getProblem('koko-eating-bananas'));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('opens a problem it does not carry by building one from the metadata', async () => {
    const user = userEvent.setup();
    const props = setup();
    await find(user, 'https://leetcode.com/problems/two-sum/');

    await waitFor(() => expect(props.onLoad).toHaveBeenCalled());
    const loaded = props.onLoad.mock.calls[0][0];
    expect(loaded.slug).toBe('two-sum');
    expect(loaded.origin).toBe('generated');
    expect(loaded.typescript.starter).toContain('function twoSum(nums: number[], target: number)');
  });

  it('says so, and stops, when it cannot build a runnable version', async () => {
    const user = userEvent.setup();
    const props = setup();
    // Premium: LeetCode publishes nothing about it to build from.
    await find(user, 'https://leetcode.com/problems/meeting-rooms-ii/');

    expect(await screen.findByText(/cannot open it/)).toBeInTheDocument();
    // The real title, number and difficulty still come from the index.
    expect(screen.getByRole('heading', { name: 'Meeting Rooms II' })).toBeInTheDocument();
    expect(screen.getByText('Premium')).toBeInTheDocument();
    // A technique to try, and somewhere to read it — but nothing was opened.
    expect(screen.getByText('Recommended technique')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Read it on LeetCode/ })).toHaveAttribute(
      'href',
      'https://leetcode.com/problems/meeting-rooms-ii/',
    );
    expect(props.onLoad).not.toHaveBeenCalled();
  });

  it('opens the pattern behind a recommendation', async () => {
    const user = userEvent.setup();
    const props = setup();
    await find(user, 'https://leetcode.com/problems/meeting-rooms-ii/');

    await user.click(await screen.findByRole('button', { name: /Open the sorting template/ }));
    expect(props.onOpenTemplate).toHaveBeenCalledWith('sorting');
  });

  it('offers close matches for a slug nothing recognises', async () => {
    const user = userEvent.setup();
    setup();
    await find(user, 'two-sum-iiii');

    expect(await screen.findByText('Did you mean')).toBeInTheDocument();
  });

  it('rejects a link that is not a problem link', async () => {
    const user = userEvent.setup();
    const props = setup();
    await find(user, 'https://example.com/blog');

    expect(await screen.findByText('That link was not a problem link')).toBeInTheDocument();
    expect(props.onLoad).not.toHaveBeenCalled();
  });

  it('marks the problem already in the editor', () => {
    setup({ currentSlug: 'permutations' });
    const row = screen.getByRole('button', { name: /Permutations/ });
    expect(row.querySelector('[aria-label="loaded"]')).not.toBeNull();
  });
});
