import { describe, expect, it } from 'vitest';
import { guessTechniques, parseSlug, recommend } from './recommend';

describe('parseSlug', () => {
  it('reads the slug out of a normal problem URL', () => {
    expect(parseSlug('https://leetcode.com/problems/two-sum/')).toBe('two-sum');
  });

  it('survives the shapes LeetCode actually hands out', () => {
    const cases = [
      'https://leetcode.com/problems/3sum/description/',
      'http://leetcode.com/problems/3sum',
      'leetcode.com/problems/3sum/',
      'https://leetcode.cn/problems/3sum/solutions/',
      'https://leetcode.com/problems/3sum/?envType=study-plan',
      'https://leetcode.com/problems/3sum/submissions/1234567/',
    ];
    for (const url of cases) expect(parseSlug(url), url).toBe('3sum');
  });

  it('takes a bare slug', () => {
    expect(parseSlug('  merge-intervals ')).toBe('merge-intervals');
  });

  it('slugifies a pasted title', () => {
    expect(parseSlug('Two Sum II - Input Array Is Sorted')).toBe(
      'two-sum-ii-input-array-is-sorted',
    );
  });

  it('refuses an empty string and an unrelated link', () => {
    expect(parseSlug('')).toBeNull();
    expect(parseSlug('   ')).toBeNull();
    expect(parseSlug('https://example.com/blog/post')).toBeNull();
  });
});

describe('recommend', () => {
  it('returns the whole problem when the catalogue has it', () => {
    const result = recommend('https://leetcode.com/problems/rotting-oranges/');
    expect(result.source).toBe('catalogue');
    expect(result.problem?.number).toBe(994);
    expect(result.techniques[0].pattern).toBe('bfs');
  });

  it('orders the techniques by rank', () => {
    const result = recommend('number-of-islands');
    expect(result.techniques.map((t) => t.rank)).toEqual([1, 2]);
    expect(result.techniques[0].pattern).toBe('bfs');
    expect(result.techniques[1].pattern).toBe('dfs');
  });

  it('guesses from the name for a problem it does not have', () => {
    const result = recommend('https://leetcode.com/problems/longest-palindromic-substring/');
    expect(result.source).toBe('guess');
    expect(result.problem).toBeUndefined();
    expect(result.techniques.map((t) => t.pattern)).toContain('sliding-window');
    expect(result.note).toMatch(/not in the offline catalogue/i);
  });

  it('says so plainly when the input is not a problem link', () => {
    const result = recommend('https://example.com/');
    expect(result.source).toBe('unrecognised');
    expect(result.techniques).toEqual([]);
    expect(result.slug).toBeNull();
  });

  it('admits when a name gives nothing away', () => {
    const result = recommend('https://leetcode.com/problems/zzzz/');
    expect(result.source).toBe('guess');
    expect(result.techniques).toEqual([]);
    expect(result.note).toMatch(/gives nothing away/i);
  });
});

describe('guessTechniques', () => {
  it.each([
    ['valid-palindrome', 'two-pointers'],
    ['minimum-size-subarray-sum', 'sliding-window'],
    ['find-peak-element', 'binary-search'],
    ['meeting-rooms-ii', 'sorting'],
    ['word-ladder', 'bfs'],
    ['pacific-atlantic-water-flow', 'dfs'],
    ['balanced-binary-tree', 'recursion'],
    ['generate-parentheses', 'backtracking'],
  ])('puts %s under %s', (slug, pattern) => {
    expect(guessTechniques(slug)[0].pattern).toBe(pattern);
  });

  it('never returns more than three suggestions', () => {
    expect(guessTechniques('sorted-tree-substring-permutation-island-search').length)
      .toBeLessThanOrEqual(3);
  });

  it('marks every guess as unknown complexity rather than inventing one', () => {
    for (const technique of guessTechniques('word-search-ii')) {
      expect(technique.complexity).toEqual({ time: 'unknown', space: 'unknown' });
    }
  });
});
