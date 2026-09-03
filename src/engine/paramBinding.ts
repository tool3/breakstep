import MagicString from 'magic-string';
import type { Language, ParamSpec, ParamValues } from '@/types';

export function bindingName(spec: ParamSpec): string {
  return spec.binds ?? spec.name;
}

export function toLiteral(value: unknown, language: Language): string {
  const python = language === 'python';

  if (value === null || value === undefined) return python ? 'None' : 'null';
  if (typeof value === 'boolean') return python ? (value ? 'True' : 'False') : String(value);
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '0';
  if (typeof value === 'string') return quote(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => toLiteral(v, language)).join(', ')}]`;
  }
  return python ? 'None' : 'null';
}

function quote(text: string): string {
  return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
}

interface Binding {
  start: number;
  end: number;
  text: string;
}

function scanInitializer(source: string, from: number): number {
  let depth = 0;
  let quote: string | null = null;

  for (let i = from; i < source.length; i++) {
    const ch = source[i];

    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '[' || ch === '{' || ch === '(') depth++;
    else if (ch === ']' || ch === '}' || ch === ')') depth--;
    else if (depth === 0) {
      if (ch === ';') return i;
      if (ch === '\n') return i;
      if (ch === '/' && (source[i + 1] === '/' || source[i + 1] === '*')) return i;
      if (ch === '#') return i;
    }
  }

  return source.length;
}

export function findJsBinding(source: string, name: string): Binding | null {
  const pattern = new RegExp(
    `^(?:export[ \\t]+)?(?:const|let|var)[ \\t]+${escapeRegex(name)}[ \\t]*(?::[^=\\n]*)?=[ \\t]*`,
    'm',
  );
  const match = pattern.exec(source);
  if (!match) return null;

  const start = match.index + match[0].length;
  const end = scanInitializer(source, start);
  const text = source.slice(start, end).trimEnd();
  if (!text) return null;

  return { start, end: start + text.length, text };
}

export function findPythonBinding(source: string, name: string): Binding | null {
  const pattern = new RegExp(`^${escapeRegex(name)}[ \\t]*=[ \\t]*`, 'm');
  const match = pattern.exec(source);
  if (!match) return null;

  const start = match.index + match[0].length;
  const end = scanInitializer(source, start);
  const text = source.slice(start, end).trimEnd();
  if (!text) return null;

  return { start, end: start + text.length, text };
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function findBinding(source: string, name: string, language: Language): Binding | null {
  return language === 'python' ? findPythonBinding(source, name) : findJsBinding(source, name);
}

export function parseLiteral(text: string, spec: ParamSpec): unknown {
  const trimmed = text.trim();

  switch (spec.type) {
    case 'number': {
      const n = Number(trimmed);
      return Number.isFinite(n) ? n : spec.default;
    }
    case 'boolean':
      return /^(true|True)$/.test(trimmed);
    case 'string':
    case 'select':
      return unquote(trimmed) ?? spec.default;
    case 'numberArray': {
      const items = splitArray(trimmed);
      if (!items) return spec.default;
      const nums = items.map(Number).filter((n) => Number.isFinite(n));
      return nums.length === items.length ? nums : spec.default;
    }
    case 'stringArray': {
      const items = splitArray(trimmed);
      if (!items) return spec.default;
      const strings = items.map((i) => unquote(i)).filter((v): v is string => v !== null);
      return strings.length === items.length ? strings : spec.default;
    }
    default:
      return spec.default;
  }
}

function unquote(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length >= 2 && /^['"]/.test(trimmed) && trimmed.at(-1) === trimmed[0]) {
    return trimmed.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, '\n');
  }
  return null;
}

function splitArray(text: string): string[] | null {
  if (!text.startsWith('[') || !text.endsWith(']')) return null;
  const inner = text.slice(1, -1).trim();
  if (inner === '') return [];

  const parts: string[] = [];
  let depth = 0;
  let quoteChar: string | null = null;
  let current = '';

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (quoteChar) {
      current += ch;
      if (ch === quoteChar && inner[i - 1] !== '\\') quoteChar = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quoteChar = ch;
      current += ch;
      continue;
    }
    if (ch === '[' || ch === '(' || ch === '{') depth++;
    if (ch === ']' || ch === ')' || ch === '}') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

export function readParamsFromSource(
  source: string,
  specs: ParamSpec[],
  language: Language,
): ParamValues {
  const out: ParamValues = {};
  for (const spec of specs) {
    const binding = findBinding(source, bindingName(spec), language);
    out[spec.name] = binding ? parseLiteral(binding.text, spec) : spec.default;
  }
  return out;
}

export interface WriteResult {
  code: string;
  bound: boolean;
}

export function writeParamToSource(
  source: string,
  spec: ParamSpec,
  value: unknown,
  language: Language,
): WriteResult {
  const binding = findBinding(source, bindingName(spec), language);
  if (!binding) return { code: source, bound: false };

  const literal = toLiteral(value, language);
  if (literal === binding.text) return { code: source, bound: true };

  const s = new MagicString(source);
  s.overwrite(binding.start, binding.end, literal);
  return { code: s.toString(), bound: true };
}

export function boundParams(
  source: string,
  specs: ParamSpec[],
  language: Language,
): Set<string> {
  const bound = new Set<string>();
  for (const spec of specs) {
    if (findBinding(source, bindingName(spec), language)) bound.add(spec.name);
  }
  return bound;
}
