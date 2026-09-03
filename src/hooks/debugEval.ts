import type { EvalResult } from '@/types/debug';

type Compiled = (scope: Record<string, unknown>) => unknown;

const cache = new Map<string, Compiled | null>();

function compile(expression: string): Compiled | null {
  if (cache.has(expression)) return cache.get(expression) ?? null;

  let compiled: Compiled | null = null;
  try {
    // eslint-disable-next-line no-new-func
    compiled = new Function('scope', `with (scope) { return (${expression}); }`) as Compiled;
  } catch {
    compiled = null;
  }
  cache.set(expression, compiled);
  return compiled;
}

export function evaluateIn(expression: string, scope: Record<string, unknown> | null): EvalResult {
  const trimmed = expression.trim();
  if (!trimmed) return { error: 'empty' };

  const compiled = compile(trimmed);
  if (!compiled) return { error: 'not a valid expression' };
  if (!scope) return { error: 'nothing in scope' };

  try {
    return { value: compiled(scope) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export function conditionHolds(
  condition: string,
  scope: Record<string, unknown> | null,
): boolean {
  const { value, error } = evaluateIn(condition, scope);
  return error === undefined && Boolean(value);
}
