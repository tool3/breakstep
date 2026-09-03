import { describe, expect, it } from 'vitest';
import { loadProblemIndex } from './problemIndex';
import { PROBLEMS } from './catalogue';
import { recommend } from './recommend';
import { readTopics } from './topics';

const index = await loadProblemIndex();

describe('the public problem index', () => {
  it('covers the whole published catalogue', () => {
    expect(index.size).toBeGreaterThan(3000);
    expect(index.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('knows the problems everyone starts with', () => {
    const twoSum = index.get('two-sum')!;
    expect(twoSum.number).toBe(1);
    expect(twoSum.title).toBe('Two Sum');
    expect(twoSum.difficulty).toBe('Easy');
    expect(twoSum.paidOnly).toBe(false);
    expect(twoSum.topics).toContain('hash-table');
  });

  it('rebuilds titles that the file stores as a slug', () => {
    expect(index.get('merge-intervals')!.title).toBe('Merge Intervals');
    expect(index.get('3sum')!.title).toBe('3Sum');
  });

  it('flags premium problems rather than pretending they are readable', () => {
    expect(index.get('meeting-rooms-ii')!.paidOnly).toBe(true);
  });

  it('returns nothing for a slug that does not exist', () => {
    expect(index.get('not-a-real-problem-at-all')).toBeUndefined();
  });

  it('finds a near miss', () => {
    const near = index.search('two-sum-iiii').map((p) => p.slug);
    expect(near.some((slug) => slug.startsWith('two-sum-ii'))).toBe(true);
    expect(index.search('valid paren')[0].slug).toContain('paren');
  });

  it('ignores a query too short to mean anything', () => {
    expect(index.search('a')).toEqual([]);
  });

  it('agrees with every problem written out in full', () => {
    for (const problem of PROBLEMS) {
      const entry = index.get(problem.slug);
      expect(entry, problem.slug).toBeDefined();
      expect(entry!.number, problem.slug).toBe(problem.number);
      expect(entry!.difficulty, problem.slug).toBe(problem.difficulty);
      expect(entry!.paidOnly, problem.slug).toBe(false);
    }
  });
});

describe('recommendations from the index', () => {
  it('identifies a problem it does not carry, from real tags', () => {
    const result = recommend('https://leetcode.com/problems/word-ladder/', index);
    expect(result.source).toBe('indexed');
    expect(result.indexed?.number).toBe(127);
    expect(result.indexed?.difficulty).toBe('Hard');
    expect(result.techniques.map((t) => t.pattern)).toContain('bfs');
    expect(result.techniques[0].why).toMatch(/LeetCode tags this problem/);
  });

  it('still prefers the written catalogue when it has the problem', () => {
    const result = recommend('koko-eating-bananas', index);
    expect(result.source).toBe('catalogue');
    expect(result.problem).toBeDefined();
    expect(result.techniques[0].why).toMatch(/Binary search on the answer/);
  });

  it('warns that a premium problem cannot be read', () => {
    const result = recommend('meeting-rooms-ii', index);
    expect(result.note).toMatch(/Premium/);
  });

  it('suggests close matches for a slug that does not exist', () => {
    const result = recommend('https://leetcode.com/problems/two-sum-iiii/', index);
    expect(result.source).toBe('guess');
    expect(result.suggestions.some((p) => p.slug.startsWith('two-sum-ii'))).toBe(true);
  });

  it('names its structures and admits what it cannot teach', () => {
    const result = recommend('lru-cache', index);
    expect(result.structures).toContain('hashmap');
    expect(result.structures).toContain('doubly-linked-list');
  });

  it('says which tags have no Breakstep template', () => {
    const result = recommend('climbing-stairs', index);
    expect(result.unmapped).toContain('dynamic-programming');
  });
});

describe('reading LeetCode topic tags', () => {
  it('lets a tag that names a technique win', () => {
    const { ranked } = readTopics(['array', 'binary-search', 'matrix']);
    expect(ranked[0].pattern).toBe('binary-search');
    expect(ranked[0].from).toEqual(['binary-search']);
  });

  it('adds up the hints when no tag names one outright', () => {
    const { ranked } = readTopics(['tree', 'binary-tree']);
    expect(ranked[0].pattern).toBe('recursion');
  });

  it('points at the structures a problem leans on', () => {
    expect(readTopics(['trie', 'string']).structures).toEqual(['trie']);
    expect(readTopics(['heap-priority-queue']).structures).toEqual(['priority-queue']);
  });

  it('reports tags it cannot map, and stays quiet about ones it can', () => {
    const verdict = readTopics(['bit-manipulation', 'depth-first-search', 'trie']);
    expect(verdict.unmapped).toEqual(['bit-manipulation']);
  });

  it('does not call a description of the input a missing template', () => {
    const verdict = readTopics(['array', 'string', 'math', 'two-pointers']);
    expect(verdict.unmapped).toEqual([]);
  });

  it('returns nothing at all for an untagged problem', () => {
    expect(readTopics([])).toEqual({ ranked: [], structures: [], unmapped: [] });
  });

  it('never recommends more than three techniques', () => {
    const verdict = readTopics([
      'two-pointers', 'sliding-window', 'binary-search', 'sorting',
      'breadth-first-search', 'depth-first-search', 'recursion', 'backtracking',
    ]);
    expect(verdict.ranked.length).toBe(3);
  });
});
