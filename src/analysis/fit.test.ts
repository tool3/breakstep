import { describe, expect, it } from 'vitest';
import { buildEmpiricalReport, fitComplexity, GROWTH_MODELS, project, scoreModel } from './fit';
import type { BenchmarkSample, ComplexityClass } from '@/types';

function sweep(fn: (n: number) => number, sizes = [16, 32, 64, 128, 256, 512], noise = 0): BenchmarkSample[] {
  return sizes.map((n, i) => ({
    n,
    operations: Math.round(fn(n) * (1 + (noise ? ((i % 3) - 1) * noise : 0))),
    ms: 0,
  }));
}

describe('fitComplexity', () => {
  const cases: [ComplexityClass, (n: number) => number][] = [
    ['O(1)', () => 40],
    ['O(log n)', (n) => 12 * Math.log2(n)],
    ['O(n)', (n) => 3 * n],
    ['O(n log n)', (n) => 2 * n * Math.log2(n)],
    ['O(n^2)', (n) => 0.5 * n * n],
    ['O(n^3)', (n) => n * n * n],
  ];

  for (const [expected, fn] of cases) {
    it(`recovers ${expected} from a clean sweep`, () => {
      expect(fitComplexity(sweep(fn)).best).toBe(expected);
    });
  }

  it('recovers O(2^n) from an exponential sweep', () => {
    expect(fitComplexity(sweep((n) => Math.pow(2, n), [4, 6, 8, 10, 12, 14])).best).toBe('O(2^n)');
  });

  it('tolerates measurement noise', () => {
    const result = fitComplexity(sweep((n) => 3 * n, undefined, 0.06));
    expect(result.best).toBe('O(n)');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('prefers the simpler class when two fit equally well', () => {
    const result = fitComplexity(sweep((n) => n));
    expect(result.best).toBe('O(n)');
  });

  it('does not overfit quadratic data as cubic', () => {
    expect(fitComplexity(sweep((n) => n * n)).best).toBe('O(n^2)');
  });

  it('refuses to guess from too few samples', () => {
    expect(fitComplexity([{ n: 10, operations: 10, ms: 0 }]).best).toBe('unknown');
    expect(fitComplexity([]).confidence).toBe(0);
  });

  it('reports unknown for data that follows no modelled curve', () => {
    const chaotic: BenchmarkSample[] = [
      { n: 16, operations: 5000, ms: 0 },
      { n: 32, operations: 40, ms: 0 },
      { n: 64, operations: 900000, ms: 0 },
      { n: 128, operations: 12, ms: 0 },
      { n: 256, operations: 3, ms: 0 },
    ];
    expect(fitComplexity(chaotic).best).toBe('unknown');
  });

  it('ranks every modelled class', () => {
    const { ranking } = fitComplexity(sweep((n) => n));
    expect(ranking).toHaveLength(GROWTH_MODELS.length);
    expect(ranking[0].r2).toBeGreaterThanOrEqual(ranking.at(-1)!.r2);
  });
});

describe('scoreModel', () => {
  it('scores a perfect match at 1', () => {
    const model = GROWTH_MODELS.find((m) => m.cls === 'O(n)')!;
    const score = scoreModel(model, sweep((n) => 7 * n));
    expect(score.r2).toBeCloseTo(1, 5);
    expect(score.coefficient).toBeCloseTo(7, 5);
  });

  it('scores a mismatched model well below 1', () => {
    const model = GROWTH_MODELS.find((m) => m.cls === 'O(1)')!;
    expect(scoreModel(model, sweep((n) => n * n)).r2).toBeLessThan(0.5);
  });

  it('credits O(1) when nothing was counted at all', () => {
    const flat = sweep(() => 0);
    expect(scoreModel(GROWTH_MODELS[0], flat).r2).toBe(1);
  });
});

describe('project', () => {
  it('extrapolates using the fitted coefficient', () => {
    const { ranking } = fitComplexity(sweep((n) => 3 * n));
    const linear = ranking.find((r) => r.cls === 'O(n)')!;
    expect(project(linear, 1_000_000)).toBeCloseTo(3_000_000, -2);
  });
});

describe('buildEmpiricalReport', () => {
  it('passes an error through without attempting a fit', () => {
    const report = buildEmpiricalReport([], 'nothing registered');
    expect(report.error).toBe('nothing registered');
    expect(report.best).toBe('unknown');
  });

  it('fits when samples are present', () => {
    expect(buildEmpiricalReport(sweep((n) => n * n)).best).toBe('O(n^2)');
  });
});
