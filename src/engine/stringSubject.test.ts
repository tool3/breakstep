/**
 * When a string is the thing on screen, and when it is not.
 *
 * Subject selection is a heuristic, and the two failure modes are opposite:
 * a palindrome check with nothing on screen at all, and a hash map hijacked by
 * the four-letter key it happens to be inserting. Both are pinned here.
 */
import { describe, expect, it } from 'vitest';
import { runInSandbox } from './sandbox';
import type { ArrayView, Frame } from '@/types/viz';

const OPTS = { opLimit: 3_000_000, frameLimit: 60, autoTrace: true };

const kinds = (frames: Frame[]) => [...new Set(frames.map((f) => f.view.kind))];
const subjects = (frames: Frame[]) =>
  new Set(frames.map((f) => f.label.split(' · ')[0]).filter((s) => !s.includes('=')));

describe('a string as the subject', () => {
  it('draws the string a converging pair is walking', async () => {
    const result = await runInSandbox(
      `const s = 'A man, a plan, a canal: Panama';
const ok = (ch) => /[a-z0-9]/i.test(ch);
let lo = 0;
let hi = s.length - 1;
while (lo < hi) {
  while (lo < hi && !ok(s[lo])) lo++;
  while (lo < hi && !ok(s[hi])) hi--;
  if (s[lo].toLowerCase() !== s[hi].toLowerCase()) break;
  lo++;
  hi--;
}
console.log(lo, hi);`,
      {},
      OPTS,
    );

    expect(result.error).toBeUndefined();
    expect(result.frames.length).toBeGreaterThan(0);
    expect(kinds(result.frames)).toEqual(['array']);

    const view = result.frames[0].view as ArrayView;
    // One cell per character, indexed, with both ends marked.
    expect(view.items.length).toBe(30);
    expect(view.showIndices).toBe(true);
    expect(view.pointers?.map((p) => p.name).sort()).toEqual(['hi', 'lo']);
  });

  it('draws the window rather than the map kept beside it', async () => {
    const result = await runInSandbox(
      `const s = 'abcabcbb';
const lastSeen = new Map();
let start = 0;
let best = 0;
for (let end = 0; end < s.length; end++) {
  const previous = lastSeen.get(s[end]);
  if (previous !== undefined && previous >= start) start = previous + 1;
  lastSeen.set(s[end], end);
  best = Math.max(best, end - start + 1);
}
console.log(best);`,
      {},
      OPTS,
    );

    // The map is bookkeeping; the string is the lesson.
    expect(subjects(result.frames)).toContain('s');
  });

  it('leaves a value in flight alone, however small the loop counter is', async () => {
    // `key` changes every iteration, so it is something being processed rather
    // than something being traversed — the map has to stay on screen.
    const result = await runInSandbox(
      `const keys = ['cyan', 'gold', 'teal'];
const table = new Map();
for (let i = 0; i < keys.length; i++) {
  const key = keys[i];
  table.set(key, key.length);
}
console.log(table.size);`,
      {},
      OPTS,
    );

    expect(subjects(result.frames)).not.toContain('key');
  });

  it('does not promote a constant label with one counter in scope', async () => {
    const result = await runInSandbox(
      `const title = 'Demo run';
const nums = [5, 3, 8, 1, 9, 2, 7, 4];
let total = 0;
for (let i = 0; i < nums.length; i++) total += nums[i];
console.log(title, total);`,
      {},
      OPTS,
    );

    expect(subjects(result.frames)).toContain('nums');
    expect(subjects(result.frames)).not.toContain('title');
  });

  it('ignores a single character, which has no position to point at', async () => {
    const result = await runInSandbox(
      `const ch = 'x';
const seen = [];
for (let i = 0; i < 4; i++) seen.push(ch + i);
console.log(seen.join(','));`,
      {},
      OPTS,
    );

    expect(subjects(result.frames)).not.toContain('ch');
  });
});
