import { parse } from 'acorn';
import MagicString from 'magic-string';
import type { Node } from 'acorn';

export const OP_FN = '__breakstep_op';

export const OP_LIMIT_MESSAGE = 'Operation limit exceeded — is there an infinite loop?';

interface AnyNode extends Node {
  type: string;
  body?: AnyNode | AnyNode[];
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

export function walkAst(root: AnyNode, visit: (node: AnyNode, parent: AnyNode | null) => void): void {
  const stack: { node: AnyNode; parent: AnyNode | null }[] = [{ node: root, parent: null }];
  while (stack.length) {
    const { node, parent } = stack.pop()!;
    if (!node || typeof node.type !== 'string') continue;
    visit(node, parent);
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'start' || key === 'end' || key === 'loc') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const c of child) {
          if (c && typeof (c as AnyNode).type === 'string') {
            stack.push({ node: c as AnyNode, parent: node });
          }
        }
      } else if (child && typeof (child as AnyNode).type === 'string') {
        stack.push({ node: child as AnyNode, parent: node });
      }
    }
  }
}

export function parseJs(source: string): AnyNode {
  return parse(source, {
    ecmaVersion: 2023,
    sourceType: 'module',
    allowAwaitOutsideFunction: true,
    allowReturnOutsideFunction: true,
    locations: true,
  }) as unknown as AnyNode;
}

export function instrument(source: string): { code: string; ok: boolean } {
  let ast: AnyNode;
  try {
    ast = parseJs(source);
  } catch {
    return { code: source, ok: false };
  }

  const s = new MagicString(source);
  const call = `${OP_FN}();`;

  walkAst(ast, (node) => {
    if (LOOP_TYPES.has(node.type)) {
      injectIntoBody(s, node.body as AnyNode, call);
    } else if (FUNCTION_TYPES.has(node.type)) {
      const body = node.body as AnyNode;
      if (body?.type === 'BlockStatement') {
        s.appendLeft((body.start as number) + 1, call);
      } else if (body) {
        s.appendLeft(body.start as number, `(${OP_FN}(), `);
        s.appendRight(body.end as number, `)`);
      }
    }
  });

  return { code: s.toString(), ok: true };
}

function injectIntoBody(s: MagicString, body: AnyNode | undefined, call: string): void {
  if (!body) return;
  if (body.type === 'BlockStatement') {
    s.appendLeft((body.start as number) + 1, call);
  } else if (body.type === 'EmptyStatement') {
    s.appendLeft(body.start as number, `{${call}}`);
  } else {
    s.appendLeft(body.start as number, `{${call}`);
    s.appendRight(body.end as number, `}`);
  }
}

export function counterPreamble(limit: number): string {
  return [
    `let __breakstep_ops = 0;`,
    `const __breakstep_limit = ${limit};`,
    `function ${OP_FN}() {`,
    `  if (++__breakstep_ops > __breakstep_limit) {`,
    `    const e = new Error(${JSON.stringify(OP_LIMIT_MESSAGE)});`,
    `    e.name = 'BreakstepOperationLimit';`,
    `    throw e;`,
    `  }`,
    `}`,
    `globalThis.${OP_FN} = ${OP_FN};`,
    `globalThis.__breakstep_readOps = () => __breakstep_ops;`,
    `globalThis.__breakstep_resetOps = () => { __breakstep_ops = 0; };`,
  ].join('\n');
}
