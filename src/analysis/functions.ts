import type { Language } from '@/types';
import type { FunctionInfo } from '@/types/debug';
import { listFunctions as listJsFunctions } from './autoInstrument';
import { stripPythonNoise } from './staticPy';
import { stripTypes } from '@/engine/transpile';

/**
 * Python's function inventory, read from indentation.
 *
 * Same reasoning as the static analyzer: shipping a Python parser to name a few
 * functions would mean booting Pyodide before the debug panel can draw itself.
 */
export function listPythonFunctions(source: string): FunctionInfo[] {
  const lines = stripPythonNoise(source).split('\n');
  const out: FunctionInfo[] = [];
  const seen = new Set<string>();

  /** Open class blocks, so a method reports as `Class.method`. */
  const classes: { name: string; indent: number }[] = [];

  lines.forEach((raw, index) => {
    const expanded = raw.replace(/\t/g, '    ');
    const trimmed = expanded.trim();
    if (!trimmed) return;
    const indent = expanded.length - expanded.trimStart().length;

    while (classes.length && indent <= classes[classes.length - 1].indent) classes.pop();

    const classMatch = trimmed.match(/^class\s+([A-Za-z_]\w*)/);
    if (classMatch) {
      classes.push({ name: classMatch[1], indent });
      return;
    }

    const defMatch = trimmed.match(/^(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/);
    if (!defMatch) return;

    const name = defMatch[1];
    const owner = classes.find((c) => c.indent < indent);
    const qualified = owner ? `${owner.name}.${name}` : name;
    if (seen.has(qualified)) return;

    seen.add(qualified);
    out.push({ name, qualified, line: index + 1 });
  });

  return out;
}

/**
 * Every function in the source, for the per-function breakpoint switches.
 *
 * TypeScript is type-stripped first because acorn cannot read annotations —
 * and because stripping preserves line numbers, the reported lines still point
 * at the right place in the editor.
 */
export function listFunctions(source: string, language: Language): FunctionInfo[] {
  if (language === 'python') return listPythonFunctions(source);
  if (language === 'typescript') {
    const stripped = stripTypes(source);
    return stripped.ok ? listJsFunctions(stripped.code) : [];
  }
  return listJsFunctions(source);
}
