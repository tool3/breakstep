import MagicString from 'magic-string';
import { parseJs } from './instrument';
import type { FunctionInfo } from '@/types/debug';

export const STEP_FN = '__breakstep_step';
export const ENTER_FN = '__breakstep_enter';
export const EXIT_FN = '__breakstep_exit';

interface AnyNode {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

const LOOP_TYPES = new Set([
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
]);

const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

const BLOCK_SCOPE_TYPES = new Set([
  'BlockStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'SwitchStatement',
  'CatchClause',
  'StaticBlock',
]);

interface Binding {
  name: string;
  start: number;
}

interface Scope {
  kind: 'function' | 'block' | 'program';
  bindings: Binding[];
  hasOwnThis: boolean;
  thisUnsafe: boolean;
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

function patternNames(node: AnyNode | null | undefined, out: string[] = []): string[] {
  if (!node) return out;
  switch (node.type) {
    case 'Identifier':
      out.push(node.name as string);
      break;
    case 'ObjectPattern':
      for (const prop of (node.properties as AnyNode[]) ?? []) {
        patternNames((prop.value ?? prop.argument) as AnyNode, out);
      }
      break;
    case 'ArrayPattern':
      for (const el of (node.elements as (AnyNode | null)[]) ?? []) patternNames(el, out);
      break;
    case 'AssignmentPattern':
      patternNames(node.left as AnyNode, out);
      break;
    case 'RestElement':
      patternNames(node.argument as AnyNode, out);
      break;
  }
  return out;
}

const RESERVED = new Set(['breakstep', 'params', 'console', 'arguments', 'undefined', 'NaN', 'Infinity']);

function isSnapshotable(name: string): boolean {
  return !RESERVED.has(name) && !name.startsWith('__breakstep');
}

export interface AutoInstrumentOptions {
  debug?: boolean;
}

export interface AutoInstrumentResult {
  code: string;
  ok: boolean;
  steps: number;
}

export function autoInstrument(
  source: string,
  options: AutoInstrumentOptions = {},
): AutoInstrumentResult {
  let ast: AnyNode;
  try {
    ast = parseJs(source) as unknown as AnyNode;
  } catch {
    return { code: source, ok: false, steps: 0 };
  }

  const debug = options.debug === true;

  const s = new MagicString(source);
  const scopes: Scope[] = [];
  let steps = 0;

  const visibleAt = (pos: number): { safe: string[]; deferred: string[] } => {
    const seen = new Set<string>();
    const safe: string[] = [];
    const deferred: string[] = [];

    let innermostFunction = 0;
    for (let i = scopes.length - 1; i >= 0; i--) {
      if (scopes[i].kind === 'function' || scopes[i].kind === 'program') {
        innermostFunction = i;
        break;
      }
    }

    for (let i = scopes.length - 1; i >= 0; i--) {
      for (const binding of scopes[i].bindings) {
        if (seen.has(binding.name) || !isSnapshotable(binding.name)) continue;

        if (binding.start < pos) {
          seen.add(binding.name);
          safe.push(binding.name);
        } else if (i < innermostFunction) {
          seen.add(binding.name);
          deferred.push(binding.name);
        }
      }
    }

    return { safe, deferred };
  };

  const thisIsSafe = (): boolean => {
    for (let i = scopes.length - 1; i >= 0; i--) {
      if (scopes[i].hasOwnThis) return !scopes[i].thisUnsafe;
    }
    return false;
  };

  const injectStatementHooks = (body: AnyNode[], skipFirst: boolean): void => {
    if (!debug) return;

    body.forEach((statement, index) => {
      if (skipFirst && index === 0) return;
      if (typeof statement.start !== 'number') return;
      if (statement.type === 'FunctionDeclaration' || statement.type === 'ClassDeclaration') return;

      s.appendLeft(
        statement.start,
        `${STEP_FN}(${lineOf(statement.start)},${snapshotThunk(statement.start)},'stmt');`,
      );
      steps++;
    });
  };

  const snapshotThunk = (pos: number): string => {
    const { safe, deferred } = visibleAt(pos);
    const entries = thisIsSafe() ? [`'this':this`] : [];
    entries.push(...safe.slice(0, 24));

    const forward = deferred.slice(0, 12);
    if (forward.length === 0) return `()=>({${entries.join(',')}})`;

    return `()=>{const __s={${entries.join(',')}};try{Object.assign(__s,{${forward.join(',')}})}catch(__e){}return __s}`;
  };

  const lineOf = (pos: number): number => {
    let line = 1;
    for (let i = 0; i < pos && i < source.length; i++) if (source.charCodeAt(i) === 10) line++;
    return line;
  };

  const collectBindings = (node: AnyNode, scope: Scope, isFunctionScope: boolean): void => {
    const walk = (cur: AnyNode) => {
      for (const child of childNodes(cur)) {
        if (FUNCTION_TYPES.has(child.type)) {
          if (child.type === 'FunctionDeclaration' && child.id) {
            scope.bindings.push({ name: (child.id as AnyNode).name as string, start: child.start });
          }
          continue;
        }
        if (child.type === 'ClassDeclaration') {
          if (child.id) {
            scope.bindings.push({ name: (child.id as AnyNode).name as string, start: child.end });
          }
          continue;
        }

        if (child.type === 'VariableDeclaration') {
          const isVar = child.kind === 'var';
          if (isVar === isFunctionScope || !isVar) {
            for (const decl of (child.declarations as AnyNode[]) ?? []) {
              for (const name of patternNames(decl.id as AnyNode)) {
                scope.bindings.push({ name, start: decl.end });
              }
            }
          }
        }

        if (BLOCK_SCOPE_TYPES.has(child.type) && child !== node) {
          if (isFunctionScope) collectHoistedVars(child, scope);
          continue;
        }
        walk(child);
      }
    };
    walk(node);
  };

  const collectHoistedVars = (node: AnyNode, scope: Scope): void => {
    const walk = (cur: AnyNode) => {
      for (const child of childNodes(cur)) {
        if (FUNCTION_TYPES.has(child.type)) continue;
        if (child.type === 'VariableDeclaration' && child.kind === 'var') {
          for (const decl of (child.declarations as AnyNode[]) ?? []) {
            for (const name of patternNames(decl.id as AnyNode)) {
              scope.bindings.push({ name, start: decl.end });
            }
          }
        }
        walk(child);
      }
    };
    walk(node);
  };

  const isConstructor = (parent: AnyNode | null): boolean =>
    parent?.type === 'MethodDefinition' && parent.kind === 'constructor';

  const classStack: string[] = [];

  const visit = (node: AnyNode, parent: AnyNode | null): void => {
    if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
      const id = node.id as AnyNode | undefined;
      classStack.push((id?.name as string | undefined) ?? '');
      for (const child of childNodes(node)) visit(child, node);
      classStack.pop();
      return;
    }

    if (FUNCTION_TYPES.has(node.type)) {
      const isArrow = node.type === 'ArrowFunctionExpression';
      const body = node.body as AnyNode;
      const scope: Scope = {
        kind: 'function',
        bindings: [],
        hasOwnThis: !isArrow,
        thisUnsafe: isConstructor(parent),
      };

      for (const param of (node.params as AnyNode[]) ?? []) {
        for (const name of patternNames(param)) {
          scope.bindings.push({ name, start: node.start });
        }
      }

      if (body?.type === 'BlockStatement') {
        collectBindings(body, scope, true);
        scopes.push(scope);

        const name = functionLabel(node, parent, classStack.at(-1));
        const pos = body.start + 1;
        s.appendLeft(
          pos,
          `${ENTER_FN}(${JSON.stringify(name)},${lineOf(node.start)},${snapshotThunk(node.start + 1)});try{`,
        );
        s.appendLeft(body.end - 1, `}finally{${EXIT_FN}();}`);

        if (Array.isArray(body.body)) injectStatementHooks(body.body as AnyNode[], false);
        for (const child of childNodes(body)) visit(child, node);
        scopes.pop();
        return;
      }

      scopes.push(scope);
      for (const child of childNodes(node)) visit(child, node);
      scopes.pop();
      return;
    }

    if (LOOP_TYPES.has(node.type)) {
      const scope: Scope = { kind: 'block', bindings: [], hasOwnThis: false, thisUnsafe: false };

      const init = (node.init ?? node.left) as AnyNode | undefined;
      if (init?.type === 'VariableDeclaration') {
        for (const decl of (init.declarations as AnyNode[]) ?? []) {
          for (const name of patternNames(decl.id as AnyNode)) {
            scope.bindings.push({ name, start: init.start });
          }
        }
      }

      scopes.push(scope);
      const body = node.body as AnyNode | undefined;

      if (body) {
        const bodyScope: Scope = { kind: 'block', bindings: [], hasOwnThis: false, thisUnsafe: false };
        if (body.type === 'BlockStatement') collectBindings(body, bodyScope, false);
        scopes.push(bodyScope);

        const pos = body.type === 'BlockStatement' ? body.start + 1 : body.start;
        const call = `${STEP_FN}(${lineOf(node.start)},${snapshotThunk(pos)});`;

        if (body.type === 'BlockStatement') {
          s.appendLeft(pos, call);
        } else if (body.type === 'EmptyStatement') {
          s.appendLeft(pos, `{${call}}`);
        } else {
          s.appendLeft(pos, `{${call}`);
          s.appendRight(body.end, `}`);
        }
        steps++;

        if (body.type === 'BlockStatement' && Array.isArray(body.body)) {
          injectStatementHooks(body.body as AnyNode[], true);
        }
        for (const child of childNodes(body)) visit(child, node);
        scopes.pop();
      }

      for (const key of ['init', 'test', 'update', 'left', 'right']) {
        const child = node[key] as AnyNode | undefined;
        if (child && typeof child.type === 'string') visit(child, node);
      }

      scopes.pop();
      return;
    }

    if (BLOCK_SCOPE_TYPES.has(node.type)) {
      const scope: Scope = { kind: 'block', bindings: [], hasOwnThis: false, thisUnsafe: false };
      collectBindings(node, scope, false);
      scopes.push(scope);
      if (node.type === 'BlockStatement' && Array.isArray(node.body)) {
        injectStatementHooks(node.body as AnyNode[], false);
      }
      for (const child of childNodes(node)) visit(child, node);
      scopes.pop();
      return;
    }

    for (const child of childNodes(node)) visit(child, node);
  };

  const programScope: Scope = {
    kind: 'program',
    bindings: [],
    hasOwnThis: false,
    thisUnsafe: false,
  };
  collectBindings(ast, programScope, true);
  scopes.push(programScope);
  if (Array.isArray(ast.body)) injectStatementHooks(ast.body as AnyNode[], false);
  for (const child of childNodes(ast)) visit(child, ast);

  const endThunk = snapshotThunk(source.length + 1);
  if (endThunk !== '()=>({})') {
    s.append(`\n;${STEP_FN}(${lineOf(source.length)},${endThunk},'final');`);
    steps++;
  }
  scopes.pop();

  return { code: s.toString(), ok: true, steps };
}

function functionLabel(node: AnyNode, parent: AnyNode | null, className?: string): string {
  const id = node.id as AnyNode | undefined;
  if (id?.name) return id.name as string;

  if (parent?.type === 'MethodDefinition' || parent?.type === 'Property') {
    const key = parent.key as AnyNode | undefined;
    const name = (key?.name ?? key?.value) as string | undefined;
    if (name) return className ? `${className}.${name}` : String(name);
  }
  if (parent?.type === 'VariableDeclarator') {
    const pid = parent.id as AnyNode | undefined;
    if (pid?.name) return pid.name as string;
  }
  return '(anonymous)';
}

export function listFunctions(source: string): FunctionInfo[] {
  let ast: AnyNode;
  try {
    ast = parseJs(source) as unknown as AnyNode;
  } catch {
    return [];
  }

  const lineStarts: number[] = [0];
  for (let i = 0; i < source.length; i++) {
    if (source.charCodeAt(i) === 10) lineStarts.push(i + 1);
  }
  const lineAt = (pos: number) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= pos) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };

  const found: FunctionInfo[] = [];
  const seen = new Set<string>();

  const walk = (node: AnyNode, parent: AnyNode | null, enclosingClass: string | null): void => {
    let currentClass = enclosingClass;
    if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
      const id = node.id as AnyNode | undefined;
      currentClass = (id as { name?: string })?.name ?? enclosingClass;
    }

    if (FUNCTION_TYPES.has(node.type)) {
      const name = functionLabel(node, parent);
      if (name !== '(anonymous)') {
        const qualified =
          parent?.type === 'MethodDefinition' && currentClass ? `${currentClass}.${name}` : name;
        if (!seen.has(qualified)) {
          seen.add(qualified);
          found.push({ name, qualified, line: lineAt(node.start) });
        }
      }
    }

    for (const child of childNodes(node)) walk(child, node, currentClass);
  };

  walk(ast, null, null);
  return found.sort((a, b) => a.line - b.line);
}

export function hasManualInstrumentation(source: string): boolean {
  return /\bbreakstep\s*\.\s*(show|viz)\s*\(/.test(source);
}
