import type { ComplexityClass, StaticComplexity } from '@/types';
import { parseJs, walkAst } from './instrument';

interface AnyNode {
  type: string;
  [key: string]: unknown;
}

const LOOP_TYPES = new Set([
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
]);

const FUNC_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

const ITERATING_METHODS = new Set([
  'map',
  'filter',
  'forEach',
  'reduce',
  'reduceRight',
  'some',
  'every',
  'find',
  'findIndex',
  'flatMap',
]);

const HIDDEN_COST: Record<string, string> = {
  sort: '`.sort()` is O(n log n) even though it reads as one call',
  toSorted: '`.toSorted()` is O(n log n)',
  includes: '`.includes()` on an array scans linearly',
  indexOf: '`.indexOf()` on an array scans linearly',
  slice: '`.slice()` copies — O(n), not free',
  concat: '`.concat()` copies both operands',
  shift: '`.shift()` re-indexes the array — O(n) per call',
  unshift: '`.unshift()` re-indexes the array — O(n) per call',
  splice: '`.splice()` shifts the tail — O(n)',
};

const CLASS_ORDER: ComplexityClass[] = [
  'O(1)',
  'O(log n)',
  'O(sqrt n)',
  'O(n)',
  'O(n log n)',
  'O(n^2)',
  'O(n^2 log n)',
  'O(n^3)',
  'O(2^n)',
  'O(n!)',
];

export function compareComplexity(a: ComplexityClass, b: ComplexityClass): number {
  return CLASS_ORDER.indexOf(a) - CLASS_ORDER.indexOf(b);
}

export function maxComplexity(a: ComplexityClass, b: ComplexityClass): ComplexityClass {
  if (a === 'unknown') return b;
  if (b === 'unknown') return a;
  return compareComplexity(a, b) >= 0 ? a : b;
}

export function polyClass(depth: number): ComplexityClass {
  if (depth <= 0) return 'O(1)';
  if (depth === 1) return 'O(n)';
  if (depth === 2) return 'O(n^2)';
  return 'O(n^3)';
}

function src(source: string, node: AnyNode): string {
  const start = node.start as number;
  const end = node.end as number;
  if (typeof start !== 'number' || typeof end !== 'number') return '';
  return source.slice(start, end);
}

function childNodes(node: AnyNode): AnyNode[] {
  const out: AnyNode[] = [];
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end' || key === 'loc') continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const c of child) if (c && typeof (c as AnyNode).type === 'string') out.push(c as AnyNode);
    } else if (child && typeof (child as AnyNode).type === 'string') {
      out.push(child as AnyNode);
    }
  }
  return out;
}

function isLogarithmicLoop(node: AnyNode, source: string): boolean {
  if (node.type === 'ForStatement' && node.update) {
    const text = src(source, node.update as AnyNode).replace(/\s/g, '');
    if (/[*/]=2|<<=1|>>=1|>>>=1|=\w+[*/]2/.test(text)) return true;
  }
  if (node.type === 'WhileStatement' || node.type === 'ForStatement') {
    const body = src(source, node);
    const hasMid = /\b(mid|middle|midpoint)\b\s*=/.test(body);
    const halves = /\/\s*2|>>\s*1/.test(body);
    const shrinks =
      /\b(lo|low|left|l)\b\s*=\s*[^;\n]*\b(mid|middle)\b|\b(hi|high|right|r)\b\s*=\s*[^;\n]*\b(mid|middle)\b/.test(
        body,
      );
    if (hasMid && halves && shrinks) return true;
    if (/(\w+)\s*=\s*(?:Math\.floor\()?\s*\1\s*\/\s*(?:2|10)/.test(body)) return true;
    if (/(\w+)\s*(?:>>>?=|\/=)\s*(?:1|2|10)/.test(body)) return true;
  }
  return false;
}

function isConstantBoundLoop(node: AnyNode): boolean {
  if (node.type !== 'ForStatement' || !node.test) return false;
  const test = node.test as AnyNode;
  if (test.type !== 'BinaryExpression') return false;
  const right = test.right as AnyNode | undefined;
  if (right?.type === 'Literal' && typeof (right as { value?: unknown }).value === 'number') {
    return ((right as { value?: unknown }).value as number) <= 64;
  }
  return false;
}

function isIteratingCall(node: AnyNode): boolean {
  if (node.type !== 'CallExpression') return false;
  const callee = node.callee as AnyNode | undefined;
  if (callee?.type !== 'MemberExpression') return false;
  const name = ((callee.property as AnyNode) as { name?: string })?.name;
  if (!name || !ITERATING_METHODS.has(name)) return false;
  return Array.isArray(node.arguments) && (node.arguments as AnyNode[]).length > 0;
}

function calleeName(node: AnyNode): string | null {
  const callee = node.callee as AnyNode | undefined;
  if (!callee) return null;
  if (callee.type === 'Identifier') return (callee as { name?: string }).name ?? null;
  if (callee.type === 'MemberExpression') {
    const prop = callee.property as AnyNode | undefined;
    return (prop as { name?: string })?.name ?? null;
  }
  return null;
}

interface Scope {
  name: string;
  ownLoopDepth: number;
  hasLogLoop: boolean;
  calls: { name: string; atDepth: number }[];
  pathSelfCalls: number;
  halving: boolean;
  memoized: boolean;
  bodyText: string;
}

function functionName(node: AnyNode, parent: AnyNode | null): string | null {
  const id = node.id as AnyNode | undefined;
  if (id && typeof (id as { name?: string }).name === 'string') return (id as { name?: string }).name as string;
  if (parent?.type === 'VariableDeclarator') {
    const pid = parent.id as AnyNode;
    if (pid && typeof (pid as { name?: string }).name === 'string') {
      return (pid as { name?: string }).name as string;
    }
  }
  if (parent?.type === 'Property' || parent?.type === 'MethodDefinition') {
    const key = parent.key as AnyNode | undefined;
    const name = (key as { name?: string })?.name;
    if (typeof name === 'string') return name;
  }
  return null;
}

function pathSelfCallCount(node: AnyNode, self: string, stopAtFunctions: boolean): number {
  const visit = (cur: AnyNode): number => {
    if (stopAtFunctions && cur !== node && FUNC_TYPES.has(cur.type)) return 0;

    let own = 0;
    if (cur.type === 'CallExpression' && calleeName(cur) === self) own = 1;

    switch (cur.type) {
      case 'IfStatement':
        return (
          own +
          visit(cur.test as AnyNode) +
          Math.max(
            cur.consequent ? visit(cur.consequent as AnyNode) : 0,
            cur.alternate ? visit(cur.alternate as AnyNode) : 0,
          )
        );
      case 'ConditionalExpression':
        return (
          own +
          visit(cur.test as AnyNode) +
          Math.max(visit(cur.consequent as AnyNode), visit(cur.alternate as AnyNode))
        );
      case 'LogicalExpression':
        return own + Math.max(visit(cur.left as AnyNode), visit(cur.right as AnyNode));
      case 'SwitchStatement':
        return (
          own +
          visit(cur.discriminant as AnyNode) +
          Math.max(0, ...((cur.cases as AnyNode[]) ?? []).map(visit))
        );
      default:
        return own + childNodes(cur).reduce((sum, c) => sum + visit(c), 0);
    }
  };
  return visit(node);
}

function scanScope(root: AnyNode, source: string, self: string | null): Omit<Scope, 'name' | 'bodyText'> {
  let ownLoopDepth = 0;
  let hasLogLoop = false;
  const calls: { name: string; atDepth: number }[] = [];

  const walk = (node: AnyNode, depth: number) => {
    for (const child of childNodes(node)) {
      if (FUNC_TYPES.has(child.type)) continue;

      let next = depth;
      if (LOOP_TYPES.has(child.type)) {
        if (isLogarithmicLoop(child, source)) hasLogLoop = true;
        else if (!isConstantBoundLoop(child)) next = depth + 1;
      } else if (isIteratingCall(child)) {
        next = depth + 1;
      }

      if (child.type === 'CallExpression') {
        const name = calleeName(child);
        if (name && name !== self) calls.push({ name, atDepth: depth });
      }

      ownLoopDepth = Math.max(ownLoopDepth, next);
      walk(child, next);
    }
  };

  walk(root, 0);

  const bodyText = src(source, root);
  return {
    ownLoopDepth,
    hasLogLoop,
    calls,
    pathSelfCalls: self ? pathSelfCallCount(root, self, true) : 0,
    halving: self ? isHalvingRecursion(root, source, self) : false,
    memoized: Boolean(self) && /\bmemo\b|\bcache\b|\bseen\b|\bdp\b/.test(bodyText),
  };
}

function isHalvingRecursion(root: AnyNode, source: string, self: string): boolean {
  let halving = false;
  walkAst(root as never, (node) => {
    const n = node as unknown as AnyNode;
    if (n.type !== 'CallExpression' || calleeName(n) !== self) return;
    const argText = ((n.arguments as AnyNode[]) ?? [])
      .map((a) => src(source, a))
      .join(',')
      .replace(/\s/g, '');
    if (/\/2|>>1|\*0\.5|\bmid\b|\bmiddle\b|\.slice\(/.test(argText)) halving = true;
  });
  return halving;
}

function collectScopes(ast: AnyNode, source: string): { root: Scope; functions: Map<string, Scope> } {
  const functions = new Map<string, Scope>();

  walkAst(ast as never, (node, parent) => {
    const n = node as unknown as AnyNode;
    if (!FUNC_TYPES.has(n.type)) return;
    const name = functionName(n, parent as unknown as AnyNode | null);
    if (!name || functions.has(name)) return;
    functions.set(name, {
      name,
      bodyText: src(source, n),
      ...scanScope(n, source, name),
    });
  });

  const root: Scope = { name: '(top level)', bodyText: source, ...scanScope(ast, source, null) };
  return { root, functions };
}

function effectiveDepth(
  scope: Scope,
  functions: Map<string, Scope>,
  visiting: Set<string> = new Set(),
): number {
  if (visiting.has(scope.name)) return scope.ownLoopDepth;
  visiting.add(scope.name);

  let best = scope.ownLoopDepth;
  for (const call of scope.calls) {
    const callee = functions.get(call.name);
    if (!callee) continue;
    best = Math.max(best, call.atDepth + effectiveDepth(callee, functions, visiting));
  }

  visiting.delete(scope.name);
  return best;
}

function reachesLogLoop(
  scope: Scope,
  functions: Map<string, Scope>,
  visiting: Set<string> = new Set(),
): boolean {
  if (scope.hasLogLoop) return true;
  if (visiting.has(scope.name)) return false;
  visiting.add(scope.name);
  for (const call of scope.calls) {
    const callee = functions.get(call.name);
    if (callee && reachesLogLoop(callee, functions, visiting)) return true;
  }
  return false;
}

export function solveRecurrence(a: number, halving: boolean, k: number): ComplexityClass {
  if (!halving) {
    if (a <= 1) return polyClass(k + 1);
    return 'O(2^n)';
  }
  const logA = Math.log2(Math.max(a, 1));
  if (logA > k + 1e-9) {
    if (logA <= 1) return 'O(n)';
    if (logA <= 2) return 'O(n^2)';
    return 'O(n^3)';
  }
  if (Math.abs(logA - k) < 1e-9) {
    if (k === 0) return 'O(log n)';
    if (k === 1) return 'O(n log n)';
    if (k === 2) return 'O(n^2 log n)';
    return 'O(n^3)';
  }
  return polyClass(k);
}

const TWO_D_PATTERNS: RegExp[] = [
  /Array\.from\([\s\S]{0,80}?=>[\s\S]{0,80}?(?:new\s+Array\(|Array\(|\[\s*\])/,
  /\.fill\([^)]*\)\s*\.\s*map\(/,
  /\.map\([\s\S]{0,60}?=>[\s\S]{0,60}?(?:new\s+Array\(|\[\s*\])/,
  /\bdp\s*\[[^\]]+\]\s*\[[^\]]+\]\s*=/,
  /\[\s*\]\s*\.\s*concat[\s\S]{0,40}\[\s*\]/,
];

function estimateSpace(
  source: string,
  ast: AnyNode,
  scopes: { root: Scope; functions: Map<string, Scope> },
): { cls: ComplexityClass; note: string } {
  const recursive = [...scopes.functions.values()].filter((f) => f.pathSelfCalls > 0);
  let recursionSpace: ComplexityClass = 'O(1)';
  if (recursive.length > 0) {
    recursionSpace = recursive.every((f) => f.halving) ? 'O(log n)' : 'O(n)';
  }

  let allocSpace: ComplexityClass = 'O(1)';
  let note = 'no growing allocations detected';

  if (TWO_D_PATTERNS.some((re) => re.test(source))) {
    allocSpace = 'O(n^2)';
    note = 'a 2-D table is allocated';
  } else {
    let insideLoop = false;
    walkAst(ast as never, (node) => {
      const n = node as unknown as AnyNode;
      if (!LOOP_TYPES.has(n.type)) return;
      if (/\.push\(|\.set\(|\.add\(|\.concat\(/.test(src(source, n))) insideLoop = true;
    });
    if (insideLoop || /new (?:Map|Set)\(|new Array\(/.test(source)) {
      allocSpace = 'O(n)';
      note = insideLoop
        ? 'elements accumulate into a collection inside a loop'
        : 'a collection sized by the input is allocated';
    }
  }

  const cls = maxComplexity(allocSpace, recursionSpace);
  if (compareComplexity(recursionSpace, allocSpace) > 0) {
    note = `recursion depth dominates (${recursionSpace} call stack)`;
  }
  return { cls, note };
}

export function analyzeJs(source: string): StaticComplexity {
  const notes: string[] = [];
  let ast: AnyNode;
  try {
    ast = parseJs(source) as unknown as AnyNode;
  } catch (err) {
    return {
      time: 'unknown',
      space: 'unknown',
      confidence: 0,
      notes: [`Could not parse the source: ${(err as Error).message}`],
      maxLoopDepth: 0,
      recursion: { detected: false, functions: [] },
    };
  }

  const scopes = collectScopes(ast, source);
  const { root, functions } = scopes;

  const reachable = root.calls.some((c) => functions.has(c.name));
  const depth = reachable
    ? effectiveDepth(root, functions)
    : Math.max(
        effectiveDepth(root, functions),
        ...[...functions.values()].map((f) => effectiveDepth(f, functions)),
      );
  const hasLog = reachable
    ? reachesLogLoop(root, functions)
    : reachesLogLoop(root, functions) ||
      [...functions.values()].some((f) => reachesLogLoop(f, functions));

  let time: ComplexityClass = polyClass(depth);
  let confidence = 0.7;

  if (depth === 1) notes.push('one loop over the input');
  else if (depth > 1) notes.push(`${depth} nested loops over the input → n^${depth}`);

  if (hasLog) {
    if (depth === 0) {
      time = maxComplexity(time, 'O(log n)');
      notes.push('the loop halves its range each iteration → logarithmic');
      confidence = 0.8;
    } else if (depth === 1) {
      time = maxComplexity(time, 'O(n log n)');
      notes.push('a halving loop sits inside a linear loop → n log n');
    }
  }

  const recursive = [...functions.values()].filter((f) => f.pathSelfCalls > 0);

  for (const fn of recursive) {
    const inLoop = fn.calls.length >= 0 && recursesInsideLoop(fn, source);
    const branching = inLoop ? Math.max(fn.pathSelfCalls, 2) : fn.pathSelfCalls;
    const workDepth = effectiveDepth(fn, functions);
    let cls = solveRecurrence(branching, fn.halving, workDepth);

    if (inLoop && !fn.halving) {
      cls = maxComplexity(cls, 'O(2^n)');
      notes.push(
        `\`${fn.name}\` recurses from inside a loop — branching is data-dependent, so this is exponential unless pruned`,
      );
      confidence = Math.min(confidence, 0.5);
    } else if (fn.halving && branching >= 2) {
      notes.push(
        `\`${fn.name}\` makes ${branching} recursive calls on halves with ${
          workDepth ? 'linear' : 'constant'
        } work → ${cls}`,
      );
    } else if (fn.halving) {
      notes.push(`\`${fn.name}\` recurses on half the input each time → logarithmic depth`);
    } else if (branching >= 2) {
      notes.push(
        `\`${fn.name}\` branches ${branching} ways without shrinking the input by a factor → exponential`,
      );
    } else {
      notes.push(`\`${fn.name}\` recurses linearly (one call, input shrinks by a constant)`);
    }

    if (fn.memoized && compareComplexity(cls, 'O(n^2)') > 0) {
      cls = 'O(n^2)';
      notes.push(
        `\`${fn.name}\` appears memoized — that collapses the exponential tree, so the real bound is the state count`,
      );
      confidence = Math.min(confidence, 0.45);
    }

    time = maxComplexity(time, cls);
    confidence = Math.min(confidence, fn.halving || branching <= 1 ? 0.7 : 0.55);
  }

  if (depth === 0 && recursive.length === 0 && !hasLog) {
    notes.push('no loops or recursion — constant work');
    confidence = 0.85;
  }

  const seenNotes = new Set(notes);
  walkAst(ast as never, (node) => {
    const n = node as unknown as AnyNode;
    if (n.type !== 'CallExpression') return;
    const callee = n.callee as AnyNode | undefined;
    if (callee?.type !== 'MemberExpression') return;
    const name = ((callee.property as AnyNode) as { name?: string })?.name;
    const hidden = name ? HIDDEN_COST[name] : undefined;
    if (!hidden) return;
    if (!seenNotes.has(hidden)) {
      seenNotes.add(hidden);
      notes.push(hidden);
    }
    if (name === 'sort' || name === 'toSorted') {
      time = maxComplexity(time, depth >= 1 ? 'O(n^2)' : 'O(n log n)');
    }
  });

  const space = estimateSpace(source, ast, scopes);
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

function recursesInsideLoop(fn: Scope, source: string): boolean {
  let ast: AnyNode;
  try {
    ast = parseJs(`(${fn.bodyText})`) as unknown as AnyNode;
  } catch {
    try {
      ast = parseJs(fn.bodyText) as unknown as AnyNode;
    } catch {
      return false;
    }
  }

  let found = false;
  const walk = (node: AnyNode, loopDepth: number) => {
    if (found) return;
    for (const child of childNodes(node)) {
      const next =
        LOOP_TYPES.has(child.type) || isIteratingCall(child) ? loopDepth + 1 : loopDepth;
      if (child.type === 'CallExpression' && calleeName(child) === fn.name && next > 0) {
        found = true;
        return;
      }
      walk(child, next);
    }
  };
  walk(ast, 0);
  void source;
  return found;
}
