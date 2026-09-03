import { describe, expect, it } from 'vitest';
import { runInSandbox } from './sandbox';
import type { Frame } from '@/types/viz';

const OPTS = { opLimit: 2_000_000, frameLimit: 60, autoTrace: true };

function statesOf(frames: Frame[]): string[] {
  const found = new Set<string>();

  const walk = (node: unknown, depth: number) => {
    if (node === null || typeof node !== 'object' || depth > 8) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'state' && typeof value === 'string') found.add(value);
      else walk(value, depth + 1);
    }
  };

  for (const frame of frames) walk(frame.view, 0);
  return [...found].sort();
}

describe('what auto-tracing says about a cell', () => {
  it('calls the other cursor a comparison', async () => {
    const result = await runInSandbox(
      `const nums = [2, 4, 7, 11, 15, 19, 24, 30];
let lo = 0;
let hi = nums.length - 1;
while (lo < hi) {
  const sum = nums[lo] + nums[hi];
  if (sum === 26) break;
  if (sum < 26) lo++;
  else hi--;
}
console.log(lo, hi);`,
      {},
      OPTS,
    );

    expect(statesOf(result.frames)).toEqual(['active', 'compare']);
  });

  it('marks the ground a single scan has already covered', async () => {
    const result = await runInSandbox(
      `const nums = [5, 3, 8, 1, 9, 2];
let best = 0;
for (let i = 0; i < nums.length; i++) {
  if (nums[i] > best) best = nums[i];
}
console.log(best);`,
      {},
      OPTS,
    );

    expect(statesOf(result.frames)).toEqual(['active', 'visited']);
  });

  it('uses all three when a nested loop sweeps repeatedly', async () => {
    const result = await runInSandbox(
      `const nums = [5, 3, 8, 1];
for (let i = 0; i < nums.length; i++) {
  for (let j = 0; j < nums.length - 1 - i; j++) {
    if (nums[j] > nums[j + 1]) {
      const swap = nums[j];
      nums[j] = nums[j + 1];
      nums[j + 1] = swap;
    }
  }
}
console.log(nums.join(','));`,
      {},
      OPTS,
    );

    expect(statesOf(result.frames)).toEqual(['active', 'compare', 'visited']);
  });

  it('does not let a repeated sweep paint everything as visited', async () => {
    const result = await runInSandbox(
      `const nums = [5, 3, 8, 1, 9, 2, 7];
for (let i = 0; i < nums.length; i++) {
  for (let j = 0; j < nums.length - 1 - i; j++) {
    if (nums[j] > nums[j + 1]) {
      const swap = nums[j];
      nums[j] = nums[j + 1];
      nums[j + 1] = swap;
    }
  }
}
console.log(nums.join(','));`,
      {},
      OPTS,
    );

    const arrays = result.frames.filter((f) => f.view.kind === 'array');
    expect(arrays.length).toBeGreaterThan(0);

    const saturated = arrays.filter((frame) => {
      const cells = (frame.view as { items: { state?: string }[] }).items;
      return cells.every((cell) => cell.state === 'visited');
    });
    expect(saturated).toHaveLength(0);
  });
});
