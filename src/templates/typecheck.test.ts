/**
 * Every template must type-check.
 *
 * Shipping teaching code with red squiggles in it undermines the whole point —
 * the reader cannot tell our mistake from theirs. Monaco reports these in the
 * browser, where nobody was looking; this runs the same check in the suite, with
 * the same compiler options and the same ambient `breakstep` types the editor
 * gets, so a template with an error fails the build instead.
 */
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { TEMPLATES, templateSource, templateBench, BENCH_BANNER } from './index';
import { PROBLEMS } from '@/leetcode/catalogue';
import { BREAKSTEP_API_DTS } from '@/editor/breakstepApiTypes';
import type { EditorMode, Template } from '@/types';

/** Mirrors the options handed to Monaco in `monacoSetup.ts`. */
const OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ESNext,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
  moduleResolution: ts.ModuleResolutionKind.Node10,
  strict: true,
  noEmit: true,
  // User code runs inside a function wrapper, so top-level statements and
  // repeated identifiers across templates must not be errors.
  allowUmdGlobalAccess: true,
  skipLibCheck: true,
};

const AMBIENT = 'breakstep-runtime.d.ts';
const ENTRY = 'template.ts';

/**
 * Diagnostics that are artefacts of checking a fragment, not real problems.
 *
 * Deliberately short. "Cannot redeclare block-scoped variable" is *not* here:
 * a top-level `const top` really does collide with `window.top` from lib.dom,
 * and the editor really does say so.
 */
const IGNORED = new Set([
  // Top-level await and module-shape complaints: the real code is wrapped.
  1375, 1378,
]);

function check(source: string): ts.Diagnostic[] {
  const files = new Map<string, string>([
    [AMBIENT, BREAKSTEP_API_DTS],
    [ENTRY, source],
  ]);

  const host: ts.CompilerHost = {
    fileExists: (name) => files.has(name) || ts.sys.fileExists(name),
    readFile: (name) => files.get(name) ?? ts.sys.readFile(name),
    getSourceFile: (name, languageVersion) => {
      const text = files.get(name) ?? ts.sys.readFile(name);
      return text === undefined
        ? undefined
        : ts.createSourceFile(name, text, languageVersion, true);
    },
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    writeFile: () => undefined,
    getCurrentDirectory: () => '/',
    getDirectories: () => [],
    getCanonicalFileName: (name) => name,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
  };

  const program = ts.createProgram([AMBIENT, ENTRY], OPTIONS, host);
  const entry = program.getSourceFile(ENTRY)!;

  return [
    ...program.getSyntacticDiagnostics(entry),
    ...program.getSemanticDiagnostics(entry),
  ].filter((d) => !IGNORED.has(d.code));
}

/** `template.ts(14,9): error TS2339: …` — enough to find and fix it. */
function describeDiagnostics(diagnostics: ts.Diagnostic[], source: string): string {
  const lines = source.split('\n');

  return diagnostics
    .map((d) => {
      const message = ts.flattenDiagnosticMessageText(d.messageText, ' ');
      if (d.file === undefined || d.start === undefined) return `TS${d.code}: ${message}`;

      const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
      return (
        `line ${line + 1}:${character + 1} TS${d.code}: ${message}\n` +
        `    ${lines[line]?.trim() ?? ''}`
      );
    })
    .join('\n');
}

/** What actually runs: the buffer, plus the harness in clean mode. */
function runnableSource(template: Template, mode: EditorMode): string {
  const code = templateSource(template, 'typescript', mode);
  if (mode === 'instrumented') return code;

  const harness = templateBench(template, 'typescript');
  return harness.trim()
    ? `${code}\n\n${BENCH_BANNER.typescript}\n${harness}`
    : code;
}

const cases = TEMPLATES.flatMap((template) =>
  (['clean', 'instrumented'] as EditorMode[]).map(
    (mode) => [`${template.id} (${mode})`, template, mode] as const,
  ),
);

/** Problems open in the same editor, so they are held to the same bar. */
const problemCases = PROBLEMS.flatMap((problem) => [
  [`${problem.slug} (starter)`, problem.typescript.starter] as const,
  [`${problem.slug} (solution)`, problem.typescript.solution] as const,
]);

describe('problems type-check in the editor', () => {
  it.each(problemCases)('%s', (_name, source) => {
    const diagnostics = check(source);
    expect(diagnostics.length, `\n${describeDiagnostics(diagnostics, source)}\n`).toBe(0);
  });
});

describe('templates type-check in the editor', () => {
  it.each(cases)('%s', (_name, template, mode) => {
    const source = templateSource(template, 'typescript', mode);
    const diagnostics = check(source);
    expect(diagnostics.length, `\n${describeDiagnostics(diagnostics, source)}\n`).toBe(0);
  });

  it.each(cases)('%s — with the harness appended', (_name, template, mode) => {
    // Clean mode runs with a benchmark harness bolted on, and that seam is
    // exactly where a mismatched signature would hide.
    const source = runnableSource(template, mode);
    const diagnostics = check(source);
    expect(diagnostics.length, `\n${describeDiagnostics(diagnostics, source)}\n`).toBe(0);
  });
});
