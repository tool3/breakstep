import { describe, expect, it } from 'vitest';
import {
  bindingName,
  boundParams,
  findBinding,
  parseLiteral,
  readParamsFromSource,
  toLiteral,
  writeParamToSource,
} from './paramBinding';
import type { ParamSpec } from '@/types';

const numberSpec: ParamSpec = { name: 'size', label: 'Size', type: 'number', default: 10 };
const arraySpec: ParamSpec = { name: 'values', label: 'Values', type: 'numberArray', default: [1, 2] };
const stringSpec: ParamSpec = { name: 'text', label: 'Text', type: 'string', default: 'hi' };
const wordsSpec: ParamSpec = { name: 'words', label: 'Words', type: 'stringArray', default: ['a'] };
const flagSpec: ParamSpec = { name: 'flag', label: 'Flag', type: 'boolean', default: true };

describe('toLiteral', () => {
  it('emits language-appropriate literals', () => {
    expect(toLiteral(42, 'typescript')).toBe('42');
    expect(toLiteral('hi', 'typescript')).toBe("'hi'");
    expect(toLiteral([1, 2, 3], 'typescript')).toBe('[1, 2, 3]');
    expect(toLiteral(['a', 'b'], 'python')).toBe("['a', 'b']");
  });

  it('uses the capitalised Python booleans and None', () => {
    expect(toLiteral(true, 'python')).toBe('True');
    expect(toLiteral(false, 'python')).toBe('False');
    expect(toLiteral(null, 'python')).toBe('None');
    expect(toLiteral(true, 'typescript')).toBe('true');
    expect(toLiteral(null, 'typescript')).toBe('null');
  });

  it('escapes quotes inside strings', () => {
    expect(toLiteral("it's", 'typescript')).toBe("'it\\'s'");
  });
});

describe('parseLiteral', () => {
  it('reads each parameter type back out of source text', () => {
    expect(parseLiteral('42', numberSpec)).toBe(42);
    expect(parseLiteral("'hello'", stringSpec)).toBe('hello');
    expect(parseLiteral('"hello"', stringSpec)).toBe('hello');
    expect(parseLiteral('[1, 2, 3]', arraySpec)).toEqual([1, 2, 3]);
    expect(parseLiteral("['a', 'b']", wordsSpec)).toEqual(['a', 'b']);
    expect(parseLiteral('true', flagSpec)).toBe(true);
    expect(parseLiteral('True', flagSpec)).toBe(true);
  });

  it('falls back to the default when the literal is not readable', () => {
    expect(parseLiteral('computeSize()', numberSpec)).toBe(10);
    expect(parseLiteral('buildValues()', arraySpec)).toEqual([1, 2]);
  });

  it('handles an empty array', () => {
    expect(parseLiteral('[]', arraySpec)).toEqual([]);
  });

  it('does not split on commas inside nested brackets or strings', () => {
    expect(parseLiteral("['a,b', 'c']", wordsSpec)).toEqual(['a,b', 'c']);
  });
});

describe('findBinding — JavaScript and TypeScript', () => {
  it('finds a plain const', () => {
    expect(findBinding('const size = 10;', 'size', 'typescript')?.text).toBe('10');
  });

  it('finds a const with a type annotation', () => {
    expect(findBinding('const values: number[] = [1, 2];', 'values', 'typescript')?.text).toBe(
      '[1, 2]',
    );
  });

  it('works on TypeScript that acorn could not parse', () => {
    const source = [
      'const size = 32;',
      '',
      'interface Node { left: Node | null }',
      'function f(a: number[]): void {}',
    ].join('\n');
    expect(findBinding(source, 'size', 'typescript')?.text).toBe('32');
  });

  it('ignores a trailing comment', () => {
    expect(findBinding('const n = 5; // how many', 'n', 'typescript')?.text).toBe('5');
  });

  it('spans a multi-line array literal', () => {
    const source = 'const values = [\n  1,\n  2,\n];\n';
    expect(findBinding(source, 'values', 'typescript')?.text).toBe('[\n  1,\n  2,\n]');
  });

  it('ignores declarations that are not at the top level', () => {
    const source = 'function f() {\n  const size = 99;\n}\n';
    expect(findBinding(source, 'size', 'typescript')).toBeNull();
  });

  it('accepts let and var too', () => {
    expect(findBinding('let size = 1;', 'size', 'typescript')?.text).toBe('1');
    expect(findBinding('var size = 2;', 'size', 'typescript')?.text).toBe('2');
  });

  it('returns null for a name that is not there', () => {
    expect(findBinding('const other = 1;', 'size', 'typescript')).toBeNull();
  });
});

describe('findBinding — Python', () => {
  it('finds a module-level assignment', () => {
    expect(findBinding('size = 10\n', 'size', 'python')?.text).toBe('10');
  });

  it('ignores an indented assignment', () => {
    expect(findBinding('def f():\n    size = 10\n', 'size', 'python')).toBeNull();
  });

  it('ignores a trailing comment', () => {
    expect(findBinding('n = 5  # how many\n', 'n', 'python')?.text).toBe('5');
  });

  it('does not match a longer name that merely starts the same', () => {
    expect(findBinding('sizes = [1]\nsize = 2\n', 'size', 'python')?.text).toBe('2');
  });
});

describe('writeParamToSource', () => {
  it('rewrites only the bound literal', () => {
    const source = 'const size = 10;\nconst other = 10;\n';
    const { code, bound } = writeParamToSource(source, numberSpec, 42, 'typescript');
    expect(bound).toBe(true);
    expect(code).toBe('const size = 42;\nconst other = 10;\n');
  });

  it('rewrites an array literal', () => {
    const { code } = writeParamToSource(
      'const values = [1, 2];\n',
      arraySpec,
      [7, 8, 9],
      'typescript',
    );
    expect(code).toBe('const values = [7, 8, 9];\n');
  });

  it('preserves the type annotation', () => {
    const { code } = writeParamToSource(
      'const values: number[] = [1, 2];\n',
      arraySpec,
      [3],
      'typescript',
    );
    expect(code).toBe('const values: number[] = [3];\n');
  });

  it('rewrites Python assignments', () => {
    const { code } = writeParamToSource('size = 10\n', numberSpec, 3, 'python');
    expect(code).toBe('size = 3\n');
  });

  it('reports an unbound parameter instead of guessing', () => {
    const source = 'const renamed = 10;\n';
    const { code, bound } = writeParamToSource(source, numberSpec, 42, 'typescript');
    expect(bound).toBe(false);
    expect(code).toBe(source);
  });

  it('is a no-op when the value already matches', () => {
    const source = 'const size = 10;\n';
    expect(writeParamToSource(source, numberSpec, 10, 'typescript').code).toBe(source);
  });

  it('survives a read/write round trip', () => {
    let source = "const text = 'hello';\n";
    source = writeParamToSource(source, stringSpec, "it's", 'typescript').code;
    expect(readParamsFromSource(source, [stringSpec], 'typescript').text).toBe("it's");
  });
});

describe('readParamsFromSource', () => {
  it('reads every spec it can find and defaults the rest', () => {
    const source = 'const size = 25;\n';
    const values = readParamsFromSource(source, [numberSpec, arraySpec], 'typescript');
    expect(values).toEqual({ size: 25, values: [1, 2] });
  });
});

describe('boundParams', () => {
  it('reports which parameters still have a constant', () => {
    const source = 'const size = 1;\n';
    const bound = boundParams(source, [numberSpec, arraySpec], 'typescript');
    expect(bound.has('size')).toBe(true);
    expect(bound.has('values')).toBe(false);
  });
});

describe('bindingName', () => {
  it('defaults to the parameter name and honours an override', () => {
    expect(bindingName(numberSpec)).toBe('size');
    expect(bindingName({ ...numberSpec, binds: 'total' })).toBe('total');
  });
});
