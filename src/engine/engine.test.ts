import { describe, expect, it } from 'vitest';
import { stripTypes, toRunnableJs } from './transpile';
import { counterPreamble, instrument, OP_FN, parseJs, walkAst } from '@/analysis/instrument';
import { revivePython } from './pythonRuntime';
import { normalize } from './normalize';
import type { LinkedListView } from '@/types/viz';

describe('stripTypes', () => {
  it('erases annotations but keeps the runtime code', () => {
    const { ok, code } = stripTypes(`const x: number = 1;\nfunction f(a: string): void {}`);
    expect(ok).toBe(true);
    expect(code).toContain('const x');
    expect(code).not.toContain(': number');
  });

  it('drops interfaces and type aliases entirely', () => {
    const { code } = stripTypes(`interface A { x: number }\ntype B = A;\nconst c = 1;`);
    expect(code).not.toContain('interface');
    expect(code).toContain('const c = 1');
  });

  it('keeps generics working at runtime', () => {
    const { ok, code } = stripTypes(`const v = breakstep.param<number[]>('nums', []);`);
    expect(ok).toBe(true);
    expect(code).toContain(`breakstep.param('nums', [])`);
  });

  it('reports a syntax error with its line', () => {
    const result = stripTypes(`const a = ;\n`);
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('passes JavaScript through untouched', () => {
    const source = `const a = 1;`;
    expect(toRunnableJs(source, 'javascript')).toEqual({ ok: true, code: source });
  });
});

describe('instrument', () => {
  const opCount = (source: string) => (source.match(new RegExp(`${OP_FN}\\(\\)`, 'g')) ?? []).length;

  it('injects a counter into every loop kind', () => {
    const { code } = instrument(`
      for (let i = 0; i < n; i++) {}
      for (const x of xs) {}
      for (const k in o) {}
      while (a) {}
      do {} while (b);
    `);
    expect(opCount(code)).toBe(5);
  });

  it('braces an un-braced loop body before injecting', () => {
    const { code } = instrument(`for (let i = 0; i < n; i++) total += i;`);
    expect(code).toContain('{');
    expect(opCount(code)).toBe(1);
  });

  it('injects into function bodies', () => {
    const { code } = instrument(`function f() { return 1; }\nconst g = () => { return 2; };`);
    expect(opCount(code)).toBe(2);
  });

  it('rewrites a concise arrow body without breaking it', () => {
    const { code } = instrument(`const double = (x) => x * 2;`);
    expect(code).toContain(`(${OP_FN}(),`);
    // The rewritten arrow must still evaluate to the original expression.
    const fn = new Function(OP_FN, `${code}; return double(4);`);
    expect(fn(() => {})).toBe(8);
  });

  it('leaves unparseable source alone rather than corrupting it', () => {
    const source = `function ( {`;
    expect(instrument(source)).toEqual({ code: source, ok: false });
  });

  it('preserves the line count so error line numbers stay accurate', () => {
    const source = `const a = 1;\nfor (let i = 0; i < 3; i++) {\n  a;\n}\n`;
    const { code } = instrument(source);
    expect(code.split('\n')).toHaveLength(source.split('\n').length);
  });

  it('builds a counter preamble that throws past the limit', () => {
    const preamble = counterPreamble(3);
    const run = new Function(`${preamble}\nfor (let i = 0; i < 10; i++) { ${OP_FN}(); }`);
    expect(run).toThrow(/Operation limit exceeded/);
  });
});

describe('walkAst', () => {
  it('visits every node with its parent', () => {
    const ast = parseJs(`const a = [1, 2];`);
    const types: string[] = [];
    walkAst(ast, (node) => types.push(node.type));
    expect(types).toContain('VariableDeclaration');
    expect(types).toContain('ArrayExpression');
    expect(types).toContain('Literal');
  });
});

describe('revivePython', () => {
  it('rebuilds a list', () => {
    expect(revivePython({ __id__: 0, t: 'list', v: [1, 2, 3] })).toEqual([1, 2, 3]);
  });

  it('rebuilds a set as an array', () => {
    expect(revivePython({ __id__: 0, t: 'set', v: ['a', 'b'] })).toEqual(['a', 'b']);
  });

  it('rebuilds a string-keyed dict as a plain object', () => {
    const out = revivePython({
      __id__: 0,
      t: 'map',
      v: [
        ['a', 1],
        ['b', 2],
      ],
    });
    expect(out).toEqual({ a: 1, b: 2 });
  });

  it('rebuilds a non-string-keyed dict as a Map', () => {
    const out = revivePython({ __id__: 0, t: 'map', v: [[1, 'one']] });
    expect(out).toBeInstanceOf(Map);
    expect((out as Map<unknown, unknown>).get(1)).toBe('one');
  });

  it('rebuilds a class instance as an object with its fields', () => {
    const out = revivePython({
      __id__: 0,
      t: 'obj',
      cls: 'ListNode',
      v: { val: 7, next: null },
    });
    expect(out).toEqual({ val: 7, next: null });
  });

  it('restores a shared reference as the same object, not a copy', () => {
    const shared = { __id__: 1, t: 'obj', cls: 'N', v: { val: 9 } };
    const out = revivePython({
      __id__: 0,
      t: 'list',
      v: [shared, { __ref__: 1 }],
    }) as unknown[];
    expect(out[0]).toBe(out[1]);
  });

  it('restores a real cycle so a cyclic Python list renders as a cycle', () => {
    // a -> b -> a, as `_encode` would emit it.
    const encoded = {
      __id__: 0,
      t: 'obj',
      cls: 'ListNode',
      v: {
        val: 1,
        next: {
          __id__: 1,
          t: 'obj',
          cls: 'ListNode',
          v: { val: 2, next: { __ref__: 0 } },
        },
      },
    };

    const revived = revivePython(encoded) as Record<string, unknown>;
    expect(revived.val).toBe(1);
    const second = revived.next as Record<string, unknown>;
    expect(second.val).toBe(2);
    expect(second.next).toBe(revived);

    // And the normalizer must see it as a cycle rather than recursing forever.
    const view = normalize(revived) as LinkedListView;
    expect(view.kind).toBe('linkedList');
    expect(view.cyclic).toBe(true);
    expect(view.nodes).toHaveLength(2);
  });

  it('passes primitives straight through', () => {
    expect(revivePython(42)).toBe(42);
    expect(revivePython('x')).toBe('x');
    expect(revivePython(null)).toBeNull();
  });

  it('rebuilds a nested adjacency map that the graph detector accepts', () => {
    const encoded = {
      __id__: 0,
      t: 'map',
      v: [
        ['a', { __id__: 1, t: 'list', v: ['b'] }],
        ['b', { __id__: 2, t: 'list', v: ['a'] }],
      ],
    };
    expect(normalize(revivePython(encoded)).kind).toBe('graph');
  });
});
