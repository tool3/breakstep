import { describe, expect, it } from 'vitest';
import { listFunctions, listPythonFunctions } from './functions';

describe('listPythonFunctions', () => {
  it('finds module-level functions in source order', () => {
    const found = listPythonFunctions(`
def first(a):
    return a

def second():
    pass
`);
    expect(found.map((f) => f.qualified)).toEqual(['first', 'second']);
    expect(found[0].line).toBe(2);
    expect(found[1].line).toBe(5);
  });

  it('qualifies methods with their class', () => {
    const found = listPythonFunctions(`
class Stack:
    def __init__(self):
        self.items = []

    def push(self, v):
        self.items.append(v)

def helper():
    pass
`);
    expect(found.map((f) => f.qualified)).toEqual(['Stack.__init__', 'Stack.push', 'helper']);
    expect(found.find((f) => f.name === 'push')!.line).toBe(6);
  });

  it('closes the class block when the indentation drops', () => {
    const found = listPythonFunctions(`
class A:
    def m(self):
        pass
class B:
    def m(self):
        pass
`);
    expect(found.map((f) => f.qualified)).toEqual(['A.m', 'B.m']);
  });

  it('reads async definitions too', () => {
    expect(listPythonFunctions('async def go():\n    pass').map((f) => f.name)).toEqual(['go']);
  });

  it('ignores the word def inside a string or comment', () => {
    const found = listPythonFunctions(`
s = "def fake():"
# def also_fake():
def real():
    pass
`);
    expect(found.map((f) => f.name)).toEqual(['real']);
  });

  it('finds nothing in a file with no functions', () => {
    expect(listPythonFunctions('x = 1\nprint(x)')).toEqual([]);
  });
});

describe('listFunctions', () => {
  it('reads TypeScript through the type stripper, keeping line numbers', () => {
    const found = listFunctions(
      `interface Node { val: number }\n\nfunction insert(root: Node | null, v: number): Node {\n  return root!;\n}\n`,
      'typescript',
    );
    expect(found.map((f) => f.qualified)).toEqual(['insert']);
    expect(found[0].line).toBe(3);
  });

  it('reads plain JavaScript directly', () => {
    expect(listFunctions('function go() {}', 'javascript').map((f) => f.name)).toEqual(['go']);
  });

  it('routes Python to the indentation reader', () => {
    expect(listFunctions('def go():\n    pass', 'python').map((f) => f.name)).toEqual(['go']);
  });

  it('returns nothing rather than throwing on broken TypeScript', () => {
    expect(listFunctions('function (: {', 'typescript')).toEqual([]);
  });
});
