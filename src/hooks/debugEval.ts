/**
 * Evaluating an expression against a recorded scope.
 *
 * Breakpoint conditions and watch expressions are the same problem: take a
 * fragment of the user's own language and answer it against the variables that
 * were in scope at one recorded step. Because the run is already over there is
 * nothing to ask a paused runtime — the scope is a plain object, and the
 * expression is compiled against it once and reused for every step it is tested
 * on, which is what makes checking a condition across twenty thousand steps
 * free.
 *
 * `with` is what makes `lo > 4` work without knowing the variable names in
 * advance. It is unavailable in strict mode, but a function built by `new
 * Function` is not strict unless its body says so, which is exactly the loophole
 * this needs. The expression is the user's own, running in their own browser,
 * against their own data — the same trust boundary as the code they just ran.
 */
import type { EvalResult } from '@/types/debug';

type Compiled = (scope: Record<string, unknown>) => unknown;

/** Compiled expressions, keyed by source. Bad syntax compiles to null once. */
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

/**
 * Answer `expression` in `scope`.
 *
 * Never throws: a reference to something not in scope here, or an expression
 * that cannot be parsed at all, comes back as an error for the panel to show
 * rather than as an exception for a step command to trip over.
 */
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

/** Whether a condition should stop the debugger. An error never stops it. */
export function conditionHolds(
  condition: string,
  scope: Record<string, unknown> | null,
): boolean {
  const { value, error } = evaluateIn(condition, scope);
  return error === undefined && Boolean(value);
}
