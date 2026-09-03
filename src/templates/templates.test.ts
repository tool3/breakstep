import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TEMPLATE_ID,
  TEMPLATES,
  assembleRunnable,
  defaultParams,
  getTemplate,
  templateBench,
  templateSource,
  templatesByCategory,
} from './index';
import { benchInSandbox, runInSandbox } from '@/engine/sandbox';
import { fitComplexity } from '@/analysis/fit';
import { analyzeStatic } from '@/analysis';
import { stripTypes } from '@/engine/transpile';
import { boundParams, readParamsFromSource, writeParamToSource } from '@/engine/paramBinding';
import type { Language, Template } from '@/types';

const RUN_OPTS = { opLimit: 8_000_000, frameLimit: 500, autoTrace: true };

function compile(template: Template, language: Language, mode: 'clean' | 'instrumented') {
  const source = templateSource(template, language, mode);
  const assembled = assembleRunnable(template, language, mode, source);
  if (language === 'python') return assembled;
  const stripped = stripTypes(assembled);
  expect(stripped.ok, `${template.id} (${language}/${mode}): ${stripped.error}`).toBe(true);
  return stripped.code;
}

describe('template catalogue', () => {
  it('ships a usable set', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(12);
  });

  it('has unique ids', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resolves the default template', () => {
    expect(getTemplate(DEFAULT_TEMPLATE_ID).id).toBe(DEFAULT_TEMPLATE_ID);
  });

  it('falls back to the first template for an unknown id', () => {
    expect(getTemplate('does-not-exist')).toBe(TEMPLATES[0]);
  });

  it('groups every template into a category', () => {
    const grouped = templatesByCategory().flatMap((g) => g.items);
    expect(grouped).toHaveLength(TEMPLATES.length);
  });

  it('gives every parameter a default matching its declared type', () => {
    for (const t of TEMPLATES) {
      for (const p of t.params) {
        const value = p.default;
        switch (p.type) {
          case 'number':
            expect(typeof value, `${t.id}.${p.name}`).toBe('number');
            break;
          case 'string':
            expect(typeof value, `${t.id}.${p.name}`).toBe('string');
            break;
          case 'boolean':
            expect(typeof value, `${t.id}.${p.name}`).toBe('boolean');
            break;
          case 'numberArray':
            expect(Array.isArray(value), `${t.id}.${p.name}`).toBe(true);
            expect((value as unknown[]).every((v) => typeof v === 'number')).toBe(true);
            break;
          case 'stringArray':
            expect(Array.isArray(value), `${t.id}.${p.name}`).toBe(true);
            break;
          case 'select':
            expect(p.options?.some((o) => o.value === value), `${t.id}.${p.name}`).toBe(true);
            break;
        }
      }
    }
  });
});

describe.each(TEMPLATES.map((t) => [t.id, t] as [string, Template]))('template: %s', (_id, template) => {
  const params = defaultParams(template);

  it('clean source contains no breakstep API at all', () => {
    for (const language of ['typescript', 'python'] as const) {
      const source = templateSource(template, language, 'clean');
      expect(source, `${template.id} (${language})`).not.toMatch(/\bbreakstep\s*\./);
    }
  });

  it('clean source compiles from TypeScript to JavaScript', () => {
    expect(stripTypes(templateSource(template, 'typescript', 'clean')).ok).toBe(true);
  });

  it('clean source runs, logs, and auto-traces frames without any breakstep.show', async () => {
    const result = await runInSandbox(compile(template, 'typescript', 'clean'), params, RUN_OPTS);

    expect(result.error, `${template.id}: ${result.error?.message}`).toBeUndefined();
    expect(result.traced, `${template.id} was not auto-traced`).toBe(true);
    expect(result.frames.length, `${template.id} captured no frames`).toBeGreaterThan(0);
    expect(result.logs.length, `${template.id} logged nothing`).toBeGreaterThan(0);
  });

  it('clean source works through the derived JavaScript too', async () => {
    const result = await runInSandbox(compile(template, 'javascript', 'clean'), params, RUN_OPTS);
    expect(result.error, `${template.id}: ${result.error?.message}`).toBeUndefined();
    expect(result.frames.length).toBeGreaterThan(0);
  });

  it('the appended harness registers a benchmark', async () => {
    const result = await runInSandbox(compile(template, 'typescript', 'clean'), params, RUN_OPTS);
    expect(result.bench).toBeDefined();
  });

  it('every auto-traced frame normalizes to a renderable view', async () => {
    const result = await runInSandbox(compile(template, 'typescript', 'clean'), params, RUN_OPTS);
    for (const frame of result.frames) {
      expect(frame.view.kind).toBeTruthy();
      expect(typeof frame.label).toBe('string');
      expect(frame.label.length).toBeGreaterThan(0);
    }
  });

  it('instrumented source runs and captures its own frames', async () => {
    const result = await runInSandbox(
      compile(template, 'typescript', 'instrumented'),
      defaultParams(template, 'typescript', 'instrumented'),
      RUN_OPTS,
    );

    expect(result.error, `${template.id}: ${result.error?.message}`).toBeUndefined();
    expect(result.traced).toBe(false);
    expect(result.frames.length).toBeGreaterThan(0);
    expect(result.bench).toBeDefined();
  });

  it('instrumented source uses the breakstep API', () => {
    for (const language of ['typescript', 'python'] as const) {
      const source = templateSource(template, language, 'instrumented');
      expect(source).toMatch(/\bbreakstep\.(show|bench|param)/);
    }
  });

  it('every parameter binds to a constant in the clean source', () => {
    for (const language of ['typescript', 'python'] as const) {
      const source = templateSource(template, language, 'clean');
      const bound = boundParams(source, template.params, language);
      for (const spec of template.params) {
        expect(bound.has(spec.name), `${template.id}.${spec.name} (${language}) is unbound`).toBe(
          true,
        );
      }
    }
  });

  it('reading the bound literals reproduces the declared defaults', () => {
    for (const language of ['typescript', 'python'] as const) {
      const source = templateSource(template, language, 'clean');
      const read = readParamsFromSource(source, template.params, language);
      for (const spec of template.params) {
        expect(read[spec.name], `${template.id}.${spec.name} (${language})`).toEqual(spec.default);
      }
    }
  });

  it('writing a parameter changes the source and survives a round trip', () => {
    const source = templateSource(template, 'typescript', 'clean');
    for (const spec of template.params) {
      const next =
        spec.type === 'number'
          ? Number(spec.default) + 1
          : spec.type === 'numberArray'
            ? [...(spec.default as number[]), 99]
            : spec.default;
      if (next === spec.default) continue;

      const { code, bound } = writeParamToSource(source, spec, next, 'typescript');
      expect(bound).toBe(true);
      expect(code).not.toBe(source);
      expect(readParamsFromSource(code, [spec], 'typescript')[spec.name]).toEqual(next);
    }
  });

  it('ships a Python variant of both faces', () => {
    expect(template.code.python.length).toBeGreaterThan(50);
    expect(template.instrumented.python).toMatch(/breakstep\.bench\(/);
    expect(templateBench(template, 'python')).toMatch(/breakstep\.bench\(/);
    expect(template.instrumented.python).not.toMatch(/\bas\s*=/);
  });

  it('static analysis reaches a verdict for every language and mode', () => {
    for (const mode of ['clean', 'instrumented'] as const) {
      for (const language of ['typescript', 'javascript', 'python'] as const) {
        const report = analyzeStatic(templateSource(template, language, mode), language);
        expect(report.time, `${template.id} / ${language} / ${mode}`).not.toBe('unknown');
        expect(report.notes.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('empirical complexity matches the documented expectation', () => {
  const expectations = TEMPLATES.filter((t) => t.expected);

  it.each(expectations.map((t) => [t.id, t] as [string, Template]))(
    '%s',
    async (_id, template) => {
      const { samples, error } = await benchInSandbox(
        compile(template, 'typescript', 'clean'),
        defaultParams(template),
        [16, 32, 64, 128, 256, 512],
        8_000_000,
      );

      expect(error, `${template.id}: ${error}`).toBeUndefined();
      expect(samples.length).toBeGreaterThanOrEqual(3);

      const fit = fitComplexity(samples);
      expect(fit.best, `${template.id} measured ${fit.best}, expected ${template.expected!.time}`).toBe(
        template.expected!.time,
      );
    },
    30_000,
  );

  it.each([
    ['merge', 'O(n log n)'],
    ['bubble', 'O(n^2)'],
  ] as const)('sorting with algorithm=%s measures %s', async (algorithm, expected) => {
    const template = getTemplate('sorting');
    const spec = template.params.find((p) => p.name === 'algorithm')!;
    const source = templateSource(template, 'typescript', 'clean');
    const { code } = writeParamToSource(source, spec, algorithm, 'typescript');

    const assembled = assembleRunnable(template, 'typescript', 'clean', code);
    const { samples, error } = await benchInSandbox(
      stripTypes(assembled).code,
      {},
      [16, 32, 64, 128, 256],
      8_000_000,
    );

    expect(error).toBeUndefined();
    expect(fitComplexity(samples).best).toBe(expected);
  }, 30_000);
});
