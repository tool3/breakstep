import { parseJs } from '@/analysis/instrument';
import { stripPythonNoise } from '@/analysis/staticPy';
import { stripTypes } from '@/engine/transpile';
import type { Language } from '@/types';

interface Call {
  name: string;
  expression: string;
}

type Node = {
  type: string;
  start: number;
  end: number;
  id?: { name?: string };
  callee?: { type: string; name?: string };
  [key: string]: unknown;
};

function children(node: Node): Node[] {
  const out: Node[] = [];
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) if (item && typeof item === 'object' && 'type' in item) out.push(item as Node);
    } else if (value && typeof value === 'object' && 'type' in (value as object)) {
      out.push(value as Node);
    }
  }
  return out;
}

function declaredJs(ast: Node, source: string): { name: string; body: string }[] {
  return children(ast)
    .filter((node) => node.type === 'FunctionDeclaration' && node.id?.name)
    .map((node) => ({ name: node.id!.name!, body: source.slice(node.start, node.end) }));
}

const STUB_MARKER = 'TODO';

function topLevelCallsJs(ast: Node, source: string): Call[] {
  const found: Call[] = [];

  const visit = (node: Node) => {
    if (node.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name) {
      found.push({ name: node.callee.name, expression: source.slice(node.start, node.end) });
    }
    for (const child of children(node)) visit(child);
  };

  for (const statement of children(ast)) {
    if (statement.type === 'FunctionDeclaration' || statement.type === 'ClassDeclaration') continue;
    visit(statement);
  }
  return found;
}

function topLevelLinesPy(source: string): string[] {
  return source.split('\n').filter((line) => line.length > 0 && !/^\s/.test(line));
}

function declaredPy(source: string): { name: string; body: string }[] {
  const lines = source.split('\n');
  const out: { name: string; body: string }[] = [];

  lines.forEach((line, index) => {
    const match = /^def\s+([A-Za-z_]\w*)\s*\(/.exec(line);
    if (!match) return;
    const body: string[] = [];
    for (let i = index + 1; i < lines.length; i++) {
      if (lines[i].trim() && !/^\s/.test(lines[i])) break;
      body.push(lines[i]);
    }
    out.push({ name: match[1], body: body.join('\n') });
  });

  return out;
}

function callFrom(text: string, at: number): string | null {
  const open = text.indexOf('(', at);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return text.slice(at, i + 1);
  }
  return null;
}

function codeOnly(line: string): string {
  return stripPythonNoise(line).padEnd(line.length, ' ');
}

function callsPy(source: string, name: string): string[] {
  const out: string[] = [];
  for (const line of topLevelLinesPy(source)) {
    if (/^(def|class)\s/.test(line)) continue;
    const code = codeOnly(line);
    const pattern = new RegExp(`(?<![\\w.])${name}\\s*\\(`, 'g');
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(code))) {
      const expression = callFrom(line, match.index);
      if (expression) out.push(expression);
    }
  }
  return out;
}

function jsSource(source: string): string {
  const stripped = stripTypes(source);
  return stripped.ok ? stripped.code : source;
}

export function entryCall(source: string, language: Language): Call | null {
  if (language === 'python') {
    const declared = declaredPy(source);
    const ordered = [
      ...declared.filter((fn) => fn.body.includes(STUB_MARKER)),
      ...[...declared].reverse(),
    ];
    for (const fn of ordered) {
      const [first] = callsPy(source, fn.name);
      if (first) return { name: fn.name, expression: first };
    }
    return null;
  }

  const code = jsSource(source);
  let ast: Node;
  try {
    ast = parseJs(code) as unknown as Node;
  } catch {
    return null;
  }

  const declared = declaredJs(ast, code);
  const calls = topLevelCallsJs(ast, code);
  const ordered = [
    ...declared.filter((fn) => fn.body.includes(STUB_MARKER)),
    ...[...declared].reverse(),
  ];

  for (const fn of ordered) {
    const call = calls.find((candidate) => candidate.name === fn.name);
    if (call) return call;
  }
  return null;
}

export function callsAtTopLevel(source: string, name: string, language: Language): boolean {
  if (language === 'python') return callsPy(source, name).length > 0;

  const code = jsSource(source);
  try {
    return topLevelCallsJs(parseJs(code) as unknown as Node, code).some((call) => call.name === name);
  } catch {
    return true;
  }
}
