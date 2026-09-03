import type { BenchmarkSample, ComplexityClass, EmpiricalComplexity, FitScore } from '@/types';

export interface GrowthModel {
  cls: ComplexityClass;
  rank: number;
  fn: (n: number) => number;
}

export const GROWTH_MODELS: GrowthModel[] = [
  { cls: 'O(1)', rank: 0, fn: () => 1 },
  { cls: 'O(log n)', rank: 1, fn: (n) => Math.log2(Math.max(n, 2)) },
  { cls: 'O(sqrt n)', rank: 2, fn: (n) => Math.sqrt(n) },
  { cls: 'O(n)', rank: 3, fn: (n) => n },
  { cls: 'O(n log n)', rank: 4, fn: (n) => n * Math.log2(Math.max(n, 2)) },
  { cls: 'O(n^2)', rank: 5, fn: (n) => n * n },
  { cls: 'O(n^2 log n)', rank: 6, fn: (n) => n * n * Math.log2(Math.max(n, 2)) },
  { cls: 'O(n^3)', rank: 7, fn: (n) => n * n * n },
  { cls: 'O(2^n)', rank: 8, fn: (n) => Math.pow(2, Math.min(n, 60)) },
  { cls: 'O(n!)', rank: 9, fn: (n) => factorial(Math.min(n, 20)) },
];

function factorial(n: number): number {
  let out = 1;
  for (let i = 2; i <= n; i++) out *= i;
  return out;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function scoreModel(model: GrowthModel, samples: BenchmarkSample[]): FitScore {
  const usable = samples.filter((s) => Number.isFinite(s.operations) && s.n > 0);
  if (usable.length < 2) return { cls: model.cls, r2: 0, coefficient: 0 };

  const ratios = usable.map((s) => s.operations / model.fn(s.n));
  const coefficient = median(ratios.filter((r) => Number.isFinite(r)));
  if (!Number.isFinite(coefficient) || coefficient <= 0) {
    const allZero = usable.every((s) => s.operations === 0);
    return { cls: model.cls, r2: allZero && model.cls === 'O(1)' ? 1 : 0, coefficient: 0 };
  }

  let errorSum = 0;
  for (const s of usable) {
    const predicted = coefficient * model.fn(s.n);
    const denom = Math.max(s.operations, predicted, 1);
    errorSum += Math.abs(s.operations - predicted) / denom;
  }
  const quality = 1 - errorSum / usable.length;
  return { cls: model.cls, r2: clamp01(quality), coefficient };
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

export const TIE_TOLERANCE = 0.02;

export interface FitOutcome {
  ranking: FitScore[];
  best: ComplexityClass;
  confidence: number;
}

export function fitComplexity(samples: BenchmarkSample[]): FitOutcome {
  const usable = samples.filter((s) => Number.isFinite(s.operations) && s.n > 0);
  if (usable.length < 3) {
    return { ranking: [], best: 'unknown', confidence: 0 };
  }

  const scored = GROWTH_MODELS.map((m) => ({ model: m, score: scoreModel(m, usable) }));
  const ranking = [...scored]
    .sort((a, b) => b.score.r2 - a.score.r2 || a.model.rank - b.model.rank)
    .map((s) => s.score);

  const topQuality = ranking[0].r2;
  const contenders = scored
    .filter((s) => s.score.r2 >= topQuality - TIE_TOLERANCE)
    .sort((a, b) => a.model.rank - b.model.rank);

  const winner = contenders[0];
  const runnerUp = ranking.find((r) => r.cls !== winner.score.cls);

  const margin = runnerUp ? Math.abs(winner.score.r2 - runnerUp.r2) : 0.5;
  const confidence = clamp01(winner.score.r2 * 0.75 + Math.min(margin * 4, 1) * 0.25);

  return {
    ranking,
    best: winner.score.r2 < 0.5 ? 'unknown' : winner.score.cls,
    confidence: winner.score.r2 < 0.5 ? confidence * 0.5 : confidence,
  };
}

export function buildEmpiricalReport(samples: BenchmarkSample[], error?: string): EmpiricalComplexity {
  if (error) {
    return { samples, ranking: [], best: 'unknown', confidence: 0, error };
  }
  const { ranking, best, confidence } = fitComplexity(samples);
  return { samples, ranking, best, confidence };
}

export function project(fit: FitScore, n: number): number {
  const model = GROWTH_MODELS.find((m) => m.cls === fit.cls);
  if (!model) return NaN;
  return fit.coefficient * model.fn(n);
}
