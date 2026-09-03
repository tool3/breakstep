import {
  baseOf,
  normalizeType,
  supportedType,
  toPythonLiteral,
  toSnakeCase,
} from '@/leetcode/runnable';
import { listFunctions } from '@/analysis/functions';
import type { ProblemDetail } from '@/leetcode/details';
import type { LeetProblem } from '@/leetcode/types';
import type { Language, LogEntry, RunResult } from '@/types';
import type { CaseOutcome, Verdict } from './types';

export const JUDGE_SENTINEL = '##breakstep-judge##';

export const JUDGE_BANNER = {
  typescript: '// ─── judge (added by Breakstep on submit) ───',
  python: '# --- judge (added by Breakstep on submit) ---',
} as const;

export const MAX_JUDGE_CASES = 8;
export const MAX_CASE_CHARS = 600;

const TOLERANCE = 1e-5;

const TS_HELPERS = {
  list: `function __bsToList(values) {
  let head = null;
  for (let i = values.length - 1; i >= 0; i--) head = { val: values[i], next: head };
  return head;
}
function __bsFromList(head) {
  const out = [];
  for (let node = head; node !== null && node !== undefined; node = node.next) out.push(node.val);
  return out;
}`,
  tree: `function __bsToTree(values) {
  if (!values.length || values[0] === null) return null;
  const root = { val: values[0], left: null, right: null };
  const queue = [root];
  let i = 1;
  while (i < values.length) {
    const node = queue.shift();
    if (i < values.length && values[i] !== null) {
      node.left = { val: values[i], left: null, right: null };
      queue.push(node.left);
    }
    i++;
    if (i < values.length && values[i] !== null) {
      node.right = { val: values[i], left: null, right: null };
      queue.push(node.right);
    }
    i++;
  }
  return root;
}
function __bsFromTree(root) {
  if (root === null || root === undefined) return [];
  const out = [];
  const queue = [root];
  while (queue.length) {
    const node = queue.shift();
    if (node === null || node === undefined) {
      out.push(null);
      continue;
    }
    out.push(node.val);
    queue.push(node.left, node.right);
  }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}`,
};

const PY_HELPERS = {
  list: `class __BsNode:
    def __init__(self, val):
        self.val = val
        self.next = None


def __bs_to_list(values):
    head = None
    for value in reversed(values):
        node = __BsNode(value)
        node.next = head
        head = node
    return head


def __bs_from_list(head):
    out = []
    node = head
    while node is not None:
        out.append(node.val)
        node = node.next
    return out`,
  tree: `class __BsTreeNode:
    def __init__(self, val):
        self.val = val
        self.left = None
        self.right = None


def __bs_to_tree(values):
    if not values or values[0] is None:
        return None
    root = __BsTreeNode(values[0])
    queue = [root]
    i = 1
    while i < len(values):
        node = queue.pop(0)
        if i < len(values) and values[i] is not None:
            node.left = __BsTreeNode(values[i])
            queue.append(node.left)
        i += 1
        if i < len(values) and values[i] is not None:
            node.right = __BsTreeNode(values[i])
            queue.append(node.right)
        i += 1
    return root


def __bs_from_tree(root):
    if root is None:
        return []
    out = []
    queue = [root]
    while queue:
        node = queue.pop(0)
        if node is None:
            out.append(None)
            continue
        out.append(node.val)
        queue.append(node.left)
        queue.append(node.right)
    while out and out[-1] is None:
        out.pop()
    return out`,
};

function helpersFor(detail: ProblemDetail): { list: boolean; tree: boolean } {
  const types = [...detail.params.map(([, t]) => t), detail.returns];
  return {
    list: types.some((t) => baseOf(t).base === 'ListNode'),
    tree: types.some((t) => baseOf(t).base === 'TreeNode'),
  };
}

function wrap(literal: string, type: string, python: boolean): string {
  const { base } = baseOf(type);
  const value = python ? toPythonLiteral(literal) : literal;
  if (base === 'ListNode') return python ? `__bs_to_list(${value})` : `__bsToList(${value})`;
  if (base === 'TreeNode') return python ? `__bs_to_tree(${value})` : `__bsToTree(${value})`;
  return value;
}

function unwrap(expression: string, type: string, python: boolean): string {
  const { base } = baseOf(type);
  if (base === 'ListNode') return python ? `__bs_from_list(${expression})` : `__bsFromList(${expression})`;
  if (base === 'TreeNode') return python ? `__bs_from_tree(${expression})` : `__bsFromTree(${expression})`;
  return expression;
}

function caseLabel(detail: ProblemDetail, input: string[]): string {
  return detail.params.map(([name], i) => `${name} = ${input[i]}`).join(', ');
}

export function judgeCases(detail: ProblemDetail): { cases: ProblemDetail['cases']; skipped: number } {
  const usable = detail.cases.filter(
    (c) => c.input.join(', ').length <= MAX_CASE_CHARS && c.input.length === detail.params.length,
  );
  const cases = usable.slice(0, MAX_JUDGE_CASES);
  return { cases, skipped: detail.cases.length - cases.length };
}

function tsThunk(detail: ProblemDetail, entry: string, input: string[]): string {
  const inPlace = normalizeType(detail.returns) === 'void';
  const args = detail.params.map((_, i) => `__a${i}`);
  const binds = detail.params
    .map(([, type], i) => `const __a${i} = ${wrap(input[i], type, false)};`)
    .join(' ');
  const call = `${entry}(${args.join(', ')})`;

  if (inPlace) return `() => { ${binds} ${call}; return __a0; }`;
  return `() => { ${binds} return ${unwrap(`${call}`, detail.returns, false)}; }`;
}

function pyThunk(detail: ProblemDetail, entry: string, input: string[], index: number): string {
  const inPlace = normalizeType(detail.returns) === 'void';
  const args = detail.params.map((_, i) => `__a${i}`);
  const binds = detail.params
    .map(([, type], i) => `    __a${i} = ${wrap(input[i], type, true)}`)
    .join('\n');
  const call = `${entry}(${args.join(', ')})`;
  const tail = inPlace
    ? `    ${call}\n    return __a0`
    : `    return ${unwrap(call, detail.returns, true)}`;

  return `def __bs_case_${index}():\n${binds ? `${binds}\n` : ''}${tail}`;
}

function tsHarness(detail: ProblemDetail, entry: string, cases: ProblemDetail['cases']): string {
  const needed = helpersFor(detail);
  const helpers = [needed.list ? TS_HELPERS.list : '', needed.tree ? TS_HELPERS.tree : '']
    .filter(Boolean)
    .join('\n\n');

  const thunks = cases.map((c) => `  ${tsThunk(detail, entry, c.input)},`).join('\n');

  return `${JUDGE_BANNER.typescript}
${helpers ? `${helpers}\n\n` : ''}const __bsCases = [
${thunks}
];

/** Values travel back as text: the caller parses and compares them. */
function __bsText(value) {
  if (value === undefined) return 'undefined';
  if (typeof value === 'number' && !isFinite(value)) return String(value);
  try {
    const json = JSON.stringify(value);
    return json === undefined ? String(value) : json;
  } catch (err) {
    return String(value);
  }
}

const __bsResults = [];
const __bsClock = typeof performance !== 'undefined' ? performance : Date;
const __bsStart = __bsClock.now();

for (let __bsI = 0; __bsI < __bsCases.length; __bsI++) {
  try {
    __bsResults.push({ text: __bsText(__bsCases[__bsI]()) });
  } catch (err) {
    __bsResults.push({ error: String((err && err.message) || err) });
  }
}

console.log(
  '${JUDGE_SENTINEL}' + JSON.stringify({ ms: __bsClock.now() - __bsStart, results: __bsResults }),
);
`;
}

function pyHarness(detail: ProblemDetail, entry: string, cases: ProblemDetail['cases']): string {
  const needed = helpersFor(detail);
  const helpers = [needed.list ? PY_HELPERS.list : '', needed.tree ? PY_HELPERS.tree : '']
    .filter(Boolean)
    .join('\n\n\n');

  const thunks = cases.map((c, i) => pyThunk(detail, entry, c.input, i)).join('\n\n\n');
  const names = cases.map((_, i) => `__bs_case_${i}`).join(', ');

  return `${JUDGE_BANNER.python}
import json as __bs_json
import time as __bs_time

${helpers ? `${helpers}\n\n\n` : ''}${thunks}


def __bs_text(value):
    """Values travel back as text: the caller parses and compares them."""
    try:
        return __bs_json.dumps(value, separators=(',', ':'))
    except Exception:
        return repr(value)


__bs_results = []
__bs_start = __bs_time.perf_counter()

for __bs_case in [${names}]:
    try:
        __bs_results.append({'text': __bs_text(__bs_case())})
    except Exception as __bs_err:
        __bs_results.append({'error': str(__bs_err) or type(__bs_err).__name__})

print('${JUDGE_SENTINEL}' + __bs_json.dumps({
    'ms': (__bs_time.perf_counter() - __bs_start) * 1000.0,
    'results': __bs_results,
}))
`;
}

export type JudgePlan =
  | {
      kind: 'cases';
      harness: string;
      entry: string;
      cases: { label: string; expected: string }[];
      skipped: number;
      fallback?: string[];
    }
  | { kind: 'output'; expected: string[] }
  | { kind: 'none'; reason: string };

function callable(detail: ProblemDetail): boolean {
  if (detail.params.length === 0 || detail.cases.length === 0) return false;
  if (!supportedType(detail.returns)) return false;
  return detail.params.every(([, type]) => supportedType(type));
}

const squash = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

export function resolveEntry(
  detail: ProblemDetail,
  code: string,
  language: Language,
): string | null {
  const published = language === 'python' ? toSnakeCase(detail.fn) : detail.fn;
  const names = listFunctions(code, language)
    .filter((fn) => !fn.qualified.includes('.'))
    .map((fn) => fn.name);

  if (names.length === 0) return null;
  if (names.includes(published)) return published;

  const target = squash(published);
  const related = names.find((name) => {
    const candidate = squash(name);
    return (
      (candidate.startsWith(target) || target.startsWith(candidate)) &&
      Math.min(candidate.length, target.length) >= 4
    );
  });
  if (related) return related;

  return names[0];
}

export function buildJudgePlan(
  problem: LeetProblem,
  detail: ProblemDetail | null,
  language: Language,
  code: string,
): JudgePlan {
  const printed = problem.expectedOutput.length > 0 && language !== 'python'
    ? problem.expectedOutput
    : undefined;

  if (detail && callable(detail)) {
    const { cases, skipped } = judgeCases(detail);
    const entry = resolveEntry(detail, code, language);

    if (cases.length > 0 && entry) {
      return {
        kind: 'cases',
        harness:
          language === 'python'
            ? pyHarness(detail, entry, cases)
            : tsHarness(detail, entry, cases),
        entry,
        cases: cases.map((c) => ({
          label: caseLabel(detail, c.input),
          expected: c.expected,
        })),
        skipped,
        fallback: printed,
      };
    }
  }

  if (printed) return { kind: 'output', expected: printed };

  return {
    kind: 'none',
    reason: detail
      ? 'This problem publishes nothing that can be turned into a call, so there is no answer to check against.'
      : 'LeetCode publishes no example cases for this problem, so there is nothing to check against.',
  };
}

function parse(text: string): { ok: boolean; value: unknown } {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, value: text };
  }
}

export function sameValue(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    return a === b || Math.abs(a - b) <= TOLERANCE;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => sameValue(item, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const left = a as Record<string, unknown>;
    const right = b as Record<string, unknown>;
    const keys = Object.keys(left);
    return (
      keys.length === Object.keys(right).length &&
      keys.every((key) => sameValue(left[key], right[key]))
    );
  }
  return a === b;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).sort().join(',')}]`;
  if (typeof value === 'number') return String(Math.round(value * 1e6) / 1e6);
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, inner]) => `${key}:${canonical(inner)}`)
      .sort();
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? String(value);
}

export function sameUnordered(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b);
}

function collectionOfAnswers(value: unknown): boolean {
  return Array.isArray(value) && value.some((item) => Array.isArray(item));
}

export function compareAnswer(
  got: string,
  expected: string,
): { passed: boolean; unordered?: boolean } {
  if (got === expected) return { passed: true };

  const left = parse(got);
  const right = parse(expected);
  if (!left.ok || !right.ok) return { passed: got.trim() === expected.trim() };

  if (sameValue(left.value, right.value)) return { passed: true };

  if (sameUnordered(left.value, right.value)) {
    const collection = collectionOfAnswers(right.value) && collectionOfAnswers(left.value);
    return { passed: collection, unordered: true };
  }

  return { passed: false };
}

interface HarnessReport {
  ms: number;
  results: { text?: string; error?: string }[];
}

export function readReport(logs: LogEntry[]): HarnessReport | null {
  for (let i = logs.length - 1; i >= 0; i--) {
    const at = logs[i].text.indexOf(JUDGE_SENTINEL);
    if (at === -1) continue;
    try {
      return JSON.parse(logs[i].text.slice(at + JUDGE_SENTINEL.length)) as HarnessReport;
    } catch {
      return null;
    }
  }
  return null;
}

export function withoutJudgeLine(logs: LogEntry[]): LogEntry[] {
  return logs.filter((entry) => !entry.text.includes(JUDGE_SENTINEL));
}

export interface Judgement {
  verdict: Verdict;
  passed: number;
  total: number;
  cases: CaseOutcome[];
  runtimeMs: number;
  entry?: string;
  error?: string;
  note?: string;
}

export function judgeResult(plan: JudgePlan, result: RunResult): Judgement {
  if (plan.kind === 'none') {
    return { verdict: 'unjudged', passed: 0, total: 0, cases: [], runtimeMs: 0, note: plan.reason };
  }

  if (result.error) {
    return {
      verdict: 'runtime-error',
      passed: 0,
      total: plan.kind === 'cases' ? plan.cases.length : plan.expected.length,
      cases: [],
      runtimeMs: 0,
      error: result.error.message,
    };
  }

  if (result.status === 'cancelled') {
    return {
      verdict: 'runtime-error',
      passed: 0,
      total: plan.kind === 'cases' ? plan.cases.length : plan.expected.length,
      cases: [],
      runtimeMs: 0,
      error: 'The run was stopped before it finished.',
    };
  }

  if (plan.kind === 'output') return judgeOutput(plan.expected, result);

  const report = readReport(result.logs);
  if (!report) {
    return {
      verdict: 'runtime-error',
      passed: 0,
      total: plan.cases.length,
      cases: [],
      runtimeMs: 0,
      error:
        'The judge never reported back — the run stopped early, or the operation guard cut it off.',
    };
  }

  const cases: CaseOutcome[] = plan.cases.map((expected, i) => {
    const outcome = report.results[i];
    if (!outcome) {
      return { ...expected, got: '—', passed: false, error: 'This case never ran.' };
    }
    if (outcome.error !== undefined) {
      return { ...expected, got: '—', passed: false, error: outcome.error };
    }

    const got = outcome.text ?? '—';
    const { passed, unordered } = compareAnswer(got, expected.expected);
    return { ...expected, got, passed, unordered };
  });

  if (cases.every((c) => c.error !== undefined) && plan.fallback) {
    const fallen = judgeOutput(plan.fallback, result);
    if (fallen.verdict === 'accepted') {
      return {
        ...fallen,
        note: 'Judged on printed output: this problem publishes its judge\u2019s interface, not a signature that can be called from a literal.',
      };
    }
  }

  const passed = cases.filter((c) => c.passed).length;
  const notes = [
    plan.skipped > 0
      ? `${plan.skipped} published case${plan.skipped === 1 ? '' : 's'} left out: too large to inline.`
      : '',
    cases.some((c) => c.unordered && !c.passed)
      ? 'One answer had the right values in a different order. Some problems accept that and some do not, so it is counted as wrong here rather than guessed at.'
      : '',
  ].filter(Boolean);

  return {
    verdict: passed === cases.length ? 'accepted' : 'wrong-answer',
    passed,
    total: cases.length,
    cases,
    runtimeMs: report.ms,
    entry: plan.entry,
    note: notes.length > 0 ? notes.join(' ') : undefined,
  };
}

function judgeOutput(expected: string[], result: RunResult): Judgement {
  const actual = withoutJudgeLine(result.logs).map((entry) => entry.text);

  const cases: CaseOutcome[] = expected.map((line, i) => {
    const got = actual[i] ?? '—';
    return { label: `output line ${i + 1}`, expected: line, got, passed: got === line };
  });

  const passed = cases.filter((c) => c.passed).length;
  const extra = actual.length - expected.length;

  return {
    verdict: passed === cases.length && extra <= 0 ? 'accepted' : 'wrong-answer',
    passed,
    total: cases.length,
    cases,
    runtimeMs: result.durationMs,
    note:
      extra > 0
        ? `Judged on printed output, and the run printed ${extra} line${extra === 1 ? '' : 's'} more than expected.`
        : 'Judged on printed output: this problem publishes no callable interface.',
  };
}
