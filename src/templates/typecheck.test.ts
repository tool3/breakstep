import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { TEMPLATES, templateSource, templateBench, BENCH_BANNER } from './index';
import { PROBLEMS } from '@/leetcode/catalogue';
import { BREAKSTEP_API_DTS } from '@/editor/breakstepApiTypes';
import type { EditorMode, Template } from '@/types';

const OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ESNext,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
  moduleResolution: ts.ModuleResolutionKind.Node10,
  strict: true,
  noEmit: true,
  allowUmdGlobalAccess: true,
  skipLibCheck: true,
};

const AMBIENT = 'breakstep-runtime.d.ts';
const ENTRY = 'template.ts';

const IGNORED = new Set([
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
    const source = runnableSource(template, mode);
    const diagnostics = check(source);
    expect(diagnostics.length, `\n${describeDiagnostics(diagnostics, source)}\n`).toBe(0);
  });
});
