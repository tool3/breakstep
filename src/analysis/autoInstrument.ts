/**
 * Auto-trace instrumentation.
 *
 * This is what lets the default templates look like ordinary computer-science
 * code — a `ListNode` class, a `while` loop, no Breakstep API anywhere — and still
 * produce a step-by-step visualization. The rewrite injects three hooks:
 *
 *   __bcs_step(line, () => ({ …locals }))   at the top of every loop body
 *   __bcs_enter(name, line, () => ({ … }))  on function entry
 *   __bcs_exit()                            on function exit, via try/finally
 *
 * The snapshot is a *thunk*, so during a benchmark sweep (where capture is off)
 * it is never invoked and the measurement stays clean.
 *
 * The hard part is deciding which identifiers are safe to read. Naming a `let`
 * before its declaration is a TDZ ReferenceError, and naming a block-scoped
 * binding from outside its block is a plain ReferenceError — either would break
 * the user's program. So this walks the AST maintaining a real scope stack and
 * only ever snapshots bindings that are provably visible *and* already
 * initialized at the injection point.
 */
import MagicString from 'magic-string';
import { parseJs } from './instrument';
import type { FunctionInfo } from '@/types/debug';

export const STEP_FN = '__bcs_step';
export const ENTER_FN = '__bcs_enter';
export const EXIT_FN = '__bcs_exit';

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

/** Blocks that introduce a lexical scope for `let` / `const` / `class`. */
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
  /** Source offset of the declaration; a snapshot may only read it after this. */
  start: number;
}

interface Scope {
  kind: 'function' | 'block' | 'program';
  bindings: Binding[];
  /** True inside a non-arrow function, where `this` is a fresh binding. */
  hasOwnThis: boolean;
  /** `this` is unusable before `super()` in a derived constructor. */
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

/** Every identifier bound by a parameter or declaration pattern. */
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

/** Identifiers that would shadow or confuse the snapshot, or are ours. */
const RESERVED = new Set(['breakstep', 'params', 'console', 'arguments', 'undefined', 'NaN', 'Infinity']);

function isSnapshotable(name: string): boolean {
  return !RESERVED.has(name) && !name.startsWith('__bcs');
}

export interface AutoInstrumentOptions {
  /**
   * Also report before every ordinary statement, not just loop iterations and
   * function calls. This is what makes step-over and step-into meaningful, and
   * it roughly triples the number of recorded steps — so it is only switched on
   * for a debug run.
   */
  debug?: boolean;
}

export interface AutoInstrumentResult {
  code: string;
  ok: boolean;
  /** How many step hooks were injected — 0 means nothing will be captured. */
  steps: number;
}

/**
 * Rewrite `source` so it reports its own state as it runs.
 * Returns the source untouched when it cannot be parsed; the runner surfaces
 * the real syntax error when it evaluates the code.
 */
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

  /**
   * Names readable at `pos`, innermost scope first.
   *
   * Split into two groups, because "declared later in the file" means different
   * things depending on where the code runs:
   *
   *  - **safe** — declared before this point in the *current* invocation, so
   *    reading them can never hit a temporal dead zone.
   *  - **deferred** — declared later, but in a scope outside the enclosing
   *    function. By the time that function is called they are almost certainly
   *    initialized (`let root = null` under a `function insert()` that uses it),
   *    but "almost" is not "always", so these are read inside a try/catch.
   */
  const visibleAt = (pos: number): { safe: string[]; deferred: string[] } => {
    const seen = new Set<string>();
    const safe: string[] = [];
    const deferred: string[] = [];

    // Scopes at or above this index belong to the current invocation.
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

  /**
   * Report before each statement in a block, so the debugger can step one
   * statement at a time.
   *
   * The first statement of a loop body is skipped: the loop hook already fires
   * at exactly that position, and two hooks on one line would show up as two
   * indistinguishable steps.
   */
  const injectStatementHooks = (body: AnyNode[], skipFirst: boolean): void => {
    if (!debug) return;

    body.forEach((statement, index) => {
      if (skipFirst && index === 0) return;
      if (typeof statement.start !== 'number') return;
      // A hoisted declaration has no runtime position worth stopping at.
      if (statement.type === 'FunctionDeclaration' || statement.type === 'ClassDeclaration') return;

      s.appendLeft(
        statement.start,
        `${STEP_FN}(${lineOf(statement.start)},${snapshotThunk(statement.start)},'stmt');`,
      );
      steps++;
    });
  };

  /** `() => ({ a, b, this: … })` — evaluated only while frames are captured. */
  const snapshotThunk = (pos: number): string => {
    const { safe, deferred } = visibleAt(pos);
    // `this` leads: inside a method the receiver is the thing the code is
    // about, and the tracer weights earlier entries more heavily.
    const entries = thisIsSafe() ? [`'this':this`] : [];
    entries.push(...safe.slice(0, 24));

    const forward = deferred.slice(0, 12);
    if (forward.length === 0) return `()=>({${entries.join(',')}})`;

    // Forward references go through a try: if one really is still in its dead
    // zone, the frame simply loses those names instead of throwing.
    return `()=>{const __s={${entries.join(',')}};try{Object.assign(__s,{${forward.join(',')}})}catch(__e){}return __s}`;
  };

  const lineOf = (pos: number): number => {
    // Cheap enough: the sources here are a few hundred lines at most.
    let line = 1;
    for (let i = 0; i < pos && i < source.length; i++) if (source.charCodeAt(i) === 10) line++;
    return line;
  };

  /** Collect the bindings a scope introduces, without entering nested scopes. */
  const collectBindings = (node: AnyNode, scope: Scope, isFunctionScope: boolean): void => {
    const walk = (cur: AnyNode) => {
      for (const child of childNodes(cur)) {
        if (FUNCTION_TYPES.has(child.type)) {
          // Only the function's own name leaks into the enclosing scope.
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
          // `var` hoists to the function scope; let/const stay in this block.
          if (isVar === isFunctionScope || !isVar) {
            for (const decl of (child.declarations as AnyNode[]) ?? []) {
              for (const name of patternNames(decl.id as AnyNode)) {
                // Readable only once the declarator has finished initializing.
                scope.bindings.push({ name, start: decl.end });
              }
            }
          }
        }

        // Do not descend into nested lexical scopes; they collect their own.
        if (BLOCK_SCOPE_TYPES.has(child.type) && child !== node) {
          // `var` still hoists out of nested blocks into the function scope.
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

  /** A derived constructor cannot touch `this` until `super()` has run. */
  const isConstructor = (parent: AnyNode | null): boolean =>
    parent?.type === 'MethodDefinition' && parent.kind === 'constructor';

  /** Enclosing class names, so a method reports as `LinkedList.push`. */
  const classStack: string[] = [];

  const visit = (node: AnyNode, parent: AnyNode | null): void => {
    if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
      const id = node.id as AnyNode | undefined;
      classStack.push((id?.name as string | undefined) ?? '');
      // The superclass expression is evaluated outside the class body.
      for (const child of childNodes(node)) visit(child, node);
      classStack.pop();
      return;
    }

    // --- Function scopes -----------------------------------------------------
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

        // Constructors are wrapped too: the enter hook never touches `this`
        // (the scope above is marked unsafe, so snapshots leave it out), and
        // `super()` is legal inside the try block. Without this, switching on
        // a constructor's breakpoint would quietly do nothing.
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

      // Concise arrow body: nothing to inject, but its params are in scope.
      scopes.push(scope);
      for (const child of childNodes(node)) visit(child, node);
      scopes.pop();
      return;
    }

    // --- Loop bodies ---------------------------------------------------------
    if (LOOP_TYPES.has(node.type)) {
      const scope: Scope = { kind: 'block', bindings: [], hasOwnThis: false, thisUnsafe: false };

      // `for (let i = …)` and `for (const x of …)` bind in the loop's own scope.
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

      // Visit the header expressions too (they may contain functions).
      for (const key of ['init', 'test', 'update', 'left', 'right']) {
        const child = node[key] as AnyNode | undefined;
        if (child && typeof child.type === 'string') visit(child, node);
      }

      scopes.pop();
      return;
    }

    // --- Plain lexical blocks -----------------------------------------------
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

  // --- Program scope ---------------------------------------------------------
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

  // A final frame of the top-level state, so a program with no loops at all
  // still shows the structure it built.
  const endThunk = snapshotThunk(source.length + 1);
  if (endThunk !== '()=>({})') {
    s.append(`\n;${STEP_FN}(${lineOf(source.length)},${endThunk},'final');`);
    steps++;
  }
  scopes.pop();

  return { code: s.toString(), ok: true, steps };
}

/** A readable name for the call stack: `reverse`, `LinkedList.push`, `(anonymous)`. */
function functionLabel(node: AnyNode, parent: AnyNode | null, className?: string): string {
  const id = node.id as AnyNode | undefined;
  if (id?.name) return id.name as string;

  if (parent?.type === 'MethodDefinition' || parent?.type === 'Property') {
    const key = parent.key as AnyNode | undefined;
    const name = (key?.name ?? key?.value) as string | undefined;
    // Qualified so two classes with the same method name stay distinct — the
    // breakpoint switches match on this exact string.
    if (name) return className ? `${className}.${name}` : String(name);
  }
  if (parent?.type === 'VariableDeclarator') {
    const pid = parent.id as AnyNode | undefined;
    if (pid?.name) return pid.name as string;
  }
  return '(anonymous)';
}

/**
 * Every function in the source, for the per-function breakpoint switches.
 *
 * Reported in source order with the line the signature sits on, so clicking a
 * switch can also reveal the function in the editor.
 */
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

/**
 * Does this source already drive the visualizer itself?
 * When it does, auto-tracing steps aside rather than doubling up on frames.
 */
export function hasManualInstrumentation(source: string): boolean {
  return /\bbreakstep\s*\.\s*(show|viz)\s*\(/.test(source);
}
