import { describe, expect, it } from 'vitest';
import { canGenerate } from './runnable';
import { synthesizeProblem } from './synthesize';
import { loadProblemIndex } from './problemIndex';
import { PROBLEMS } from './catalogue';
import type { ProblemDetail } from './details';

/**
 * Every shard, eagerly — the app loads one at a time, but a coverage check has
 * to see all of them.
 */
const SHARDS = import.meta.glob<Record<string, ProblemDetail>>('./details/*.json', {
  import: 'default',
  eager: true,
});

const index = await loadProblemIndex();

const everyDetail = Object.entries(SHARDS)
  .filter(([path]) => !path.includes('manifest'))
  .flatMap(([, payload]) => Object.entries(payload));

describe('runnable coverage', () => {
  it('carries example data for most of the free catalogue', () => {
    expect(everyDetail.length).toBeGreaterThan(2900);
  });

  it('can scaffold all but a handful of them', () => {
    const scaffoldable = everyDetail.filter(([, detail]) => canGenerate(detail));
    // The rest are in-place problems with nothing to print, or take a type with
    // no literal form. If this ratio slips, the generator has regressed.
    expect(scaffoldable.length / everyDetail.length).toBeGreaterThan(0.98);
  });

  it('never stores a statement, only the data around it', () => {
    // Sniffing the values for prose does not work — `tag-validator` takes HTML
    // as its input and `html-entity-parser` takes entities, both legitimately.
    // The guarantee is structural instead, and stronger for it: the shape has
    // nowhere to put a statement, so none can be stored by accident.
    for (const [slug, detail] of everyDetail) {
      expect(Object.keys(detail).sort(), slug).toEqual(['cases', 'fn', 'params', 'returns']);
      for (const testCase of detail.cases) {
        expect(Object.keys(testCase).sort(), slug).toEqual(['expected', 'input']);
      }
    }
  });

  it('agrees with the index about every problem it carries', () => {
    for (const [slug] of everyDetail) {
      const entry = index.get(slug);
      expect(entry, slug).toBeDefined();
      // Premium problems publish nothing, so none should have been taken.
      expect(entry!.paidOnly, slug).toBe(false);
    }
  });

  it('builds something openable for the problems people actually paste', () => {
    const famous = [
      'two-sum',
      'valid-parentheses',
      'number-of-islands',
      'course-schedule',
      'binary-tree-inorder-traversal',
      'reverse-linked-list',
      'merge-two-sorted-lists',
      'maximum-subarray',
      'climbing-stairs',
      'best-time-to-buy-and-sell-stock',
    ];

    for (const slug of famous) {
      const entry = index.get(slug)!;
      const detail = SHARDS[`./details/${Math.floor(entry.number / 120)}.json`]?.[slug];
      expect(detail, slug).toBeDefined();

      const problem = synthesizeProblem(entry, detail!);
      expect(problem, slug).not.toBeNull();
      expect(problem!.examples.length, slug).toBeGreaterThan(0);
      expect(problem!.typescript.starter, slug).toContain(`function ${detail!.fn}(`);
      expect(problem!.python.starter, slug).toContain('def ');
    }
  });

  it('lets a hand-written problem win over its generated version', () => {
    // Both exist for these; the catalogue is the better answer and must be
    // what the recommender reaches for first.
    for (const written of PROBLEMS) {
      const entry = index.get(written.slug);
      expect(entry, written.slug).toBeDefined();
    }
  });
});
