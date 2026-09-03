import type { ComplexityClass, StaticComplexity } from '@/types';
import { compareComplexity, maxComplexity, polyClass, solveRecurrence } from './staticJs';

interface Line {
  code: string;
  indent: number;
  no: number;
}

export function stripPythonNoise(source: string): string {
  let out = source.replace(
    /'''[\s\S]*?'''|"""[\s\S]*?"""/g,
    (m) => '"' + ' '.repeat(Math.max(m.length - 2, 0)) + '"',
  );
  out = out.replace(/(['"])(?:\\.|(?!\1).)*\1/g, (m) => m[0] + ' '.repeat(Math.max(m.length - 2, 0)) + m[0]);
  out = out.replace(/#[^\n]*/g, '');
  return out;
}

function toLines(source: string): Line[] {
  return stripPythonNoise(source)
    .split('\n')
    .map((raw, i) => {
      const expanded = raw.replace(/\t/g, '    ');
      return {
        code: expanded.trim(),
        indent: expanded.length - expanded.trimStart().length,
        no: i + 1,
      };
    })
    .filter((l) => l.code.length > 0);
}

const LOOP_RE = /^(?:async\s+)?(?:for|while)\b/;
const DEF_RE = /^(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/;

function isConstantBoundLoop(code: string): boolean {
  const m = code.match(/for\s+.+?\s+in\s+range\(\s*(\d+)\s*[),]/);
  if (m) return Number(m[1]) <= 64;
  return /for\s+\w+\s+in\s+['"][^'"]{0,64}['"]\s*:/.test(code);
}

function isLogLoop(code: string, body: string): boolean {
  if (/^\s*while\b/.test(code)) {
    if (/(\w+)\s*(?:\/\/=|>>=|\/=)\s*(?:1|2|10)/.test(body)) return true;
    if (/(\w+)\s*=\s*\1\s*(?:\/\/|>>|\/)\s*(?:1|2|10)/.test(body)) return true;
    const mid = /\bmid\b\s*=/.test(body) && /\/\/\s*2|>>\s*1/.test(body);
    const shrink = /\b(?:lo|low|left|l)\b\s*=\s*[^\n]*\bmid\b|\b(?:hi|high|right|r)\b\s*=\s*[^\n]*\bmid\b/.test(body);
    if (mid && shrink) return true;
  }
  if (/for\s+\w+\s+in\s+range\([^)]*\)\s*:/.test(code) && /\*\s*2|<<\s*1/.test(body)) return true;
  return false;
}

export function comprehensionDepth(code: string): number {
  const withoutHeader = code.replace(/^\s*(?:async\s+)?(?:for|while)\b[^:]*:/, '');
  if (!/[[{(]/.test(withoutHeader)) return 0;
  const clauses = withoutHeader.match(/\bfor\b[^\n]*?\bin\b/g);
  return clauses ? clauses.length : 0;
}

function blockEnd(lines: Line[], headerIdx: number, limit: number): number {
  const indent = lines[headerIdx].indent;
  let i = headerIdx + 1;
  while (i < limit && lines[i].indent > indent) i++;
  return i;
}

interface Scope {
  name: string;
  ownLoopDepth: number;
  hasLogLoop: boolean;
  calls: { name: string; atDepth: number }[];
  pathSelfCalls: number;
  halving: boolean;
  memoized: boolean;
}

const CALL_RE = /\b([A-Za-z_]\w*)\s*\(/g;

const IGNORED_CALLS = new Set([
  'range', 'len', 'print', 'int', 'str', 'float', 'bool', 'list', 'dict', 'set',
  'tuple', 'enumerate', 'zip', 'min', 'max', 'sum', 'abs', 'round', 'sorted',
  'reversed', 'any', 'all', 'map', 'filter', 'isinstance', 'type', 'format',
  'deque', 'defaultdict', 'Counter', 'append', 'pop', 'get', 'add', 'show',
  'log', 'param', 'bench', 'super', 'iter', 'next', 'chr', 'ord', 'divmod',
]);

function scanScope(lines: Line[], from: number, to: number, self: string | null): Omit<Scope, 'name'> {
  let ownLoopDepth = 0;
  let hasLogLoop = false;
  const calls: { name: string; atDepth: number }[] = [];
  const openLoops: number[] = [];

  const selfCallLines: { count: number; isReturn: boolean }[] = [];
  let halving = false;
  let memoized = false;

  for (let i = from; i < to; i++) {
    const line = lines[i];
    while (openLoops.length && line.indent <= openLoops[openLoops.length - 1]) openLoops.pop();

    if (DEF_RE.test(line.code)) {
      i = blockEnd(lines, i, to) - 1;
      continue;
    }

    const comp = comprehensionDepth(line.code);
    const depthHere = openLoops.length + comp;
    ownLoopDepth = Math.max(ownLoopDepth, depthHere);

    CALL_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    let selfCount = 0;
    while ((m = CALL_RE.exec(line.code)) !== null) {
      const name = m[1];
      if (self && name === self) {
        selfCount++;
        continue;
      }
      if (IGNORED_CALLS.has(name)) continue;
      calls.push({ name, atDepth: openLoops.length });
    }

    if (selfCount > 0) {
      selfCallLines.push({ count: selfCount, isReturn: /^return\b/.test(line.code) });
      if (/\/\/\s*2|>>\s*1|\/\s*2|\bmid\b|\bmiddle\b|\[\s*:\s*mid|\[\s*mid\s*:/.test(line.code)) {
        halving = true;
      }
      if (openLoops.length > 0 || comp > 0) {
        selfCallLines.push({ count: Math.max(selfCount, 2), isReturn: false });
      }
    }

    if (/\bmemo\b|\bcache\b|\bdp\b/.test(line.code)) memoized = true;

    if (LOOP_RE.test(line.code)) {
      const end = blockEnd(lines, i, to);
      const body = lines.slice(i, end).map((l) => l.code).join('\n');
      if (isLogLoop(line.code, body)) hasLogLoop = true;
      else if (!isConstantBoundLoop(line.code)) {
        openLoops.push(line.indent);
        ownLoopDepth = Math.max(ownLoopDepth, openLoops.length);
      }
    }
  }

  return {
    ownLoopDepth,
    hasLogLoop,
    calls,
    pathSelfCalls: pathSelfCalls(selfCallLines),
    halving,
    memoized,
  };
}

function pathSelfCalls(sites: { count: number; isReturn: boolean }[]): number {
  if (sites.length === 0) return 0;
  if (sites.every((s) => s.isReturn)) return Math.max(...sites.map((s) => s.count));
  return sites.reduce((sum, s) => sum + s.count, 0);
}

function recursesInsideLoop(lines: Line[], from: number, to: number, self: string): boolean {
  const openLoops: number[] = [];
  const callRe = new RegExp(`\\b${self}\\s*\\(`);
  for (let i = from; i < to; i++) {
    const line = lines[i];
    while (openLoops.length && line.indent <= openLoops[openLoops.length - 1]) openLoops.pop();
    if (callRe.test(line.code) && (openLoops.length > 0 || comprehensionDepth(line.code) > 0)) {
      return true;
    }
    if (LOOP_RE.test(line.code) && !isConstantBoundLoop(line.code)) openLoops.push(line.indent);
  }
  return false;
}

interface Collected {
  root: Scope;
  functions: Map<string, Scope>;
  recursiveInLoop: Set<string>;
}

function collectScopes(lines: Line[]): Collected {
  const functions = new Map<string, Scope>();
  const recursiveInLoop = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].code.match(DEF_RE);
    if (!m) continue;
    const name = m[1];
    const end = blockEnd(lines, i, lines.length);
    if (!functions.has(name)) {
      functions.set(name, { name, ...scanScope(lines, i + 1, end, name) });
      if (recursesInsideLoop(lines, i + 1, end, name)) recursiveInLoop.add(name);
      if (i > 0 && /@(?:functools\.)?(?:lru_)?cache/.test(lines[i - 1].code)) {
        functions.get(name)!.memoized = true;
      }
    }
  }

  const root: Scope = { name: '(top level)', ...scanScope(lines, 0, lines.length, null) };
  return { root, functions, recursiveInLoop };
}

function effectiveDepth(scope: Scope, fns: Map<string, Scope>, visiting = new Set<string>()): number {
  if (visiting.has(scope.name)) return scope.ownLoopDepth;
  visiting.add(scope.name);
  let best = scope.ownLoopDepth;
  for (const call of scope.calls) {
    const callee = fns.get(call.name);
    if (!callee) continue;
    best = Math.max(best, call.atDepth + effectiveDepth(callee, fns, visiting));
  }
  visiting.delete(scope.name);
  return best;
}

function reachesLogLoop(scope: Scope, fns: Map<string, Scope>, visiting = new Set<string>()): boolean {
  if (scope.hasLogLoop) return true;
  if (visiting.has(scope.name)) return false;
  visiting.add(scope.name);
  return scope.calls.some((c) => {
    const callee = fns.get(c.name);
    return callee ? reachesLogLoop(callee, fns, visiting) : false;
  });
}

function estimateSpace(source: string, fns: Map<string, Scope>): { cls: ComplexityClass; note: string } {
  const recursive = [...fns.values()].filter((f) => f.pathSelfCalls > 0);
  let recursionSpace: ComplexityClass = 'O(1)';
  if (recursive.length > 0) {
    recursionSpace = recursive.every((f) => f.halving) ? 'O(log n)' : 'O(n)';
  }

  const clean = stripPythonNoise(source);
  let allocSpace: ComplexityClass = 'O(1)';
  let note = 'no growing allocations detected';

  const twoD =
    /\[\s*\[[^\]]*\]\s*(?:\*|for)/.test(clean) ||
    /\[\s*\[[^\]]*\]\s*\*/.test(clean) ||
    /\[\s*[^[\]\n]*\bfor\b[^\n]*\bfor\b/.test(clean) ||
    /\bdp\s*\[[^\]]+\]\s*\[[^\]]+\]\s*=/.test(clean) ||
    /\[[^\n\]]*\*\s*\w+\s*(?:for\s+\w+\s+in|\])\s*[^\n]*for\s+\w+\s+in/.test(clean);

  if (twoD) {
    allocSpace = 'O(n^2)';
    note = 'a 2-D table is allocated';
  } else if (/\.append\(|\.add\(|\bset\(|\bdict\(|\bdefaultdict\(|\bdeque\(|\[\s*0\s*\]\s*\*/.test(clean)) {
    allocSpace = 'O(n)';
    note = 'elements accumulate into a list/set/dict';
  }

  const cls = maxComplexity(allocSpace, recursionSpace);
  if (compareComplexity(recursionSpace, allocSpace) > 0) {
    note = `recursion depth dominates (${recursionSpace} call stack)`;
  }
  return { cls, note };
}

export function analyzePython(source: string): StaticComplexity {
  const lines = toLines(source);
  const notes: string[] = [];

  if (lines.length === 0) {
    return {
      time: 'O(1)',
      space: 'O(1)',
      confidence: 0.9,
      notes: ['Empty program.'],
      maxLoopDepth: 0,
      recursion: { detected: false, functions: [] },
    };
  }

  const { root, functions, recursiveInLoop } = collectScopes(lines);

  const reachable = root.calls.some((c) => functions.has(c.name));
  const depth = reachable
    ? effectiveDepth(root, functions)
    : Math.max(
        effectiveDepth(root, functions),
        ...[...functions.values()].map((f) => effectiveDepth(f, functions)),
        0,
      );
  const hasLog = reachable
    ? reachesLogLoop(root, functions)
    : reachesLogLoop(root, functions) || [...functions.values()].some((f) => reachesLogLoop(f, functions));

  let time: ComplexityClass = polyClass(depth);
  let confidence = 0.65;

  if (depth === 1) notes.push('one loop over the input');
  else if (depth > 1) notes.push(`${depth} nested loops over the input → n^${depth}`);

  if (hasLog) {
    if (depth === 0) {
      time = maxComplexity(time, 'O(log n)');
      notes.push('the loop halves its range each iteration → logarithmic');
      confidence = 0.75;
    } else if (depth === 1) {
      time = maxComplexity(time, 'O(n log n)');
      notes.push('a halving loop sits inside a linear loop → n log n');
    }
  }

  const recursive = [...functions.values()].filter((f) => f.pathSelfCalls > 0);

  for (const fn of recursive) {
    const inLoop = recursiveInLoop.has(fn.name);
    const branching = inLoop ? Math.max(fn.pathSelfCalls, 2) : fn.pathSelfCalls;
    const workDepth = effectiveDepth(fn, functions);
    let cls = solveRecurrence(branching, fn.halving, workDepth);

    if (inLoop && !fn.halving) {
      cls = maxComplexity(cls, 'O(2^n)');
      notes.push(`\`${fn.name}\` recurses from inside a loop → exponential unless pruned`);
      confidence = Math.min(confidence, 0.45);
    } else if (fn.halving && branching >= 2) {
      notes.push(`\`${fn.name}\` splits the input and recurses ${branching} ways → ${cls}`);
    } else if (fn.halving) {
      notes.push(`\`${fn.name}\` recurses on half the input each time → logarithmic depth`);
    } else if (branching >= 2) {
      notes.push(`\`${fn.name}\` branches ${branching} ways without shrinking the input → exponential`);
    } else {
      notes.push(`\`${fn.name}\` recurses linearly`);
    }

    if (fn.memoized && compareComplexity(cls, 'O(n^2)') > 0) {
      cls = 'O(n^2)';
      notes.push(`\`${fn.name}\` is memoized — the bound becomes the number of distinct states`);
      confidence = Math.min(confidence, 0.45);
    }

    time = maxComplexity(time, cls);
  }

  const clean = stripPythonNoise(source);
  if (/\.sort\(\)|\bsorted\(/.test(clean)) {
    notes.push('`sorted()` / `.sort()` is O(n log n) even though it reads as one call');
    time = maxComplexity(time, depth >= 1 ? 'O(n^2)' : 'O(n log n)');
  }

  if (depth === 0 && recursive.length === 0 && !hasLog) {
    notes.push('no loops or recursion — constant work');
    confidence = 0.8;
  }

  const space = estimateSpace(source, functions);
  notes.push(`Space: ${space.note}.`);

  return {
    time,
    space: space.cls,
    confidence,
    notes,
    maxLoopDepth: depth,
    recursion: {
      detected: recursive.length > 0,
      functions: recursive.map((f) => f.name),
      branching: recursive[0]?.pathSelfCalls,
      halving: recursive[0]?.halving,
    },
  };
}
