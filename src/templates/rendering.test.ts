/**
 * The structure templates rely on Breakstep reading their class name to pick a
 * renderer — a `Stack` and a `Queue` are both an array underneath, and only the
 * name says which way up to draw it. This holds that contract.
 */
import { describe, expect, it } from 'vitest';
import { runInSandbox } from '@/engine/sandbox';
import { assembleRunnable, defaultParams, getTemplate, templateSource } from './index';
import { stripTypes } from '@/engine/transpile';

describe('structure templates draw as their class name implies', () => {
  it.each([
    ['stack', 'stack'],
    ['queue', 'queue'],
  ])('%s renders with the %s variant', async (id, variant) => {
    const t = getTemplate(id);
    const code = stripTypes(
      assembleRunnable(t, 'typescript', 'clean', templateSource(t, 'typescript', 'clean')),
    ).code;
    const r = await runInSandbox(code, defaultParams(t), {
      opLimit: 5_000_000,
      frameLimit: 400,
      autoTrace: true,
    });
    const variants = r.frames
      .filter((f) => f.view.kind === 'array')
      .map((f) => (f.view as { variant?: string }).variant);
    expect(variants).toContain(variant);
  });

  it.each(['min-heap', 'max-heap', 'priority-queue'])('%s renders as a heap', async (id) => {
    const t = getTemplate(id);
    const code = stripTypes(
      assembleRunnable(t, 'typescript', 'clean', templateSource(t, 'typescript', 'clean')),
    ).code;
    const r = await runInSandbox(code, defaultParams(t), {
      opLimit: 5_000_000,
      frameLimit: 400,
      autoTrace: true,
    });
    const kinds = [...new Set(r.frames.map((f) => f.view.kind))];
    expect(kinds).toContain('heap');
  });
});
