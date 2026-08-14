/**
 * Monaco bootstrap: bundled (not CDN) workers, Breakstep-matched themes, and the
 * `breakstep` ambient types so the API autocompletes inside the editor.
 *
 * Bundling Monaco rather than loading it from a CDN keeps the app working
 * offline and behind corporate proxies, and it is why `vite.config.ts` splits
 * Monaco into its own chunk.
 */
// Importing the `monaco-editor` barrel pulls in every language Monaco ships
// (~3.3 MB). Breakstep needs three, so the editor core and those three grammars are
// imported explicitly instead — roughly a quarter of the bytes.
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

// `editor.all.js` would register every contrib Monaco has, including diff
// editors, peek views, sticky scroll and inline-edit machinery this app has no
// UI for. Registering only what a single-file code pane actually uses roughly
// halves the chunk.
import 'monaco-editor/esm/vs/editor/contrib/bracketMatching/browser/bracketMatching.js';
import 'monaco-editor/esm/vs/editor/contrib/caretOperations/browser/caretOperations.js';
import 'monaco-editor/esm/vs/editor/contrib/clipboard/browser/clipboard.js';
import 'monaco-editor/esm/vs/editor/contrib/comment/browser/comment.js';
import 'monaco-editor/esm/vs/editor/contrib/contextmenu/browser/contextmenu.js';
import 'monaco-editor/esm/vs/editor/contrib/cursorUndo/browser/cursorUndo.js';
import 'monaco-editor/esm/vs/editor/contrib/find/browser/findController.js';
import 'monaco-editor/esm/vs/editor/contrib/folding/browser/folding.js';
import 'monaco-editor/esm/vs/editor/contrib/format/browser/formatActions.js';
import 'monaco-editor/esm/vs/editor/contrib/hover/browser/hoverContribution.js';
import 'monaco-editor/esm/vs/editor/contrib/indentation/browser/indentation.js';
import 'monaco-editor/esm/vs/editor/contrib/lineSelection/browser/lineSelection.js';
import 'monaco-editor/esm/vs/editor/contrib/linesOperations/browser/linesOperations.js';
import 'monaco-editor/esm/vs/editor/contrib/multicursor/browser/multicursor.js';
import 'monaco-editor/esm/vs/editor/contrib/parameterHints/browser/parameterHints.js';
import 'monaco-editor/esm/vs/editor/contrib/smartSelect/browser/smartSelect.js';
import 'monaco-editor/esm/vs/editor/contrib/snippet/browser/snippetController2.js';
import 'monaco-editor/esm/vs/editor/contrib/suggest/browser/suggestController.js';
import 'monaco-editor/esm/vs/editor/contrib/wordHighlighter/browser/wordHighlighter.js';
import 'monaco-editor/esm/vs/editor/contrib/wordOperations/browser/wordOperations.js';
import 'monaco-editor/esm/vs/editor/contrib/wordPartOperations/browser/wordPartOperations.js';

import 'monaco-editor/esm/vs/language/typescript/monaco.contribution';
import 'monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution';
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution';
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution';
import { loader } from '@monaco-editor/react';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import { BREAKSTEP_API_DTS } from './breakstepApiTypes';

export const MONACO_THEMES = {
  midnight: 'breakstep-midnight',
  slate: 'breakstep-slate',
  light: 'breakstep-light',
} as const;

let initialized = false;

declare global {
  interface Window {
    MonacoEnvironment?: monaco.Environment;
  }
}

export function setupMonaco(): typeof monaco {
  if (initialized) return monaco;
  initialized = true;

  window.MonacoEnvironment = {
    getWorker(_workerId: string, label: string) {
      // Python has no language service here — its highlighting is grammar-only,
      // and correctness feedback comes from actually running the code.
      return label === 'typescript' || label === 'javascript'
        ? new tsWorker()
        : new editorWorker();
    },
  };

  monaco.editor.defineTheme(MONACO_THEMES.midnight, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '5d626c', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'b183ff' },
      { token: 'string', foreground: '35d6a0' },
      { token: 'number', foreground: 'f2a53c' },
      { token: 'type', foreground: '5f8dff' },
      { token: 'type.identifier', foreground: '5f8dff' },
      { token: 'identifier', foreground: 'e3e5ea' },
      { token: 'delimiter', foreground: '868d99' },
      { token: 'function', foreground: '93b3ff' },
    ],
    colors: {
      'editor.background': '#08090b',
      'editor.foreground': '#e3e5ea',
      'editorLineNumber.foreground': '#383b43',
      'editorLineNumber.activeForeground': '#93b3ff',
      'editor.lineHighlightBackground': '#0e0f13',
      'editor.selectionBackground': '#243049',
      'editor.inactiveSelectionBackground': '#191b21',
      'editorCursor.foreground': '#5f8dff',
      'editorIndentGuide.background1': '#17181d',
      'editorIndentGuide.activeBackground1': '#2c2e35',
      'editorWidget.background': '#111216',
      'editorWidget.border': '#1d1e23',
      'editorSuggestWidget.background': '#111216',
      'editorSuggestWidget.selectedBackground': '#1c1e25',
      'editorGutter.background': '#08090b',
      'editorError.foreground': '#f4585d',
      'editorWarning.foreground': '#f2a53c',
      'scrollbarSlider.background': '#2c2e3588',
      'scrollbarSlider.hoverBackground': '#3a3d46aa',
    },
  });

  monaco.editor.defineTheme(MONACO_THEMES.slate, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '626d80', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'a97bff' },
      { token: 'string', foreground: '39d3a0' },
      { token: 'number', foreground: 'f0a13a' },
      { token: 'type', foreground: '5b8cff' },
      { token: 'type.identifier', foreground: '5b8cff' },
      { token: 'identifier', foreground: 'd8dee9' },
      { token: 'delimiter', foreground: '8b95a7' },
      { token: 'function', foreground: '8fb2ff' },
    ],
    colors: {
      'editor.background': '#0b0e14',
      'editor.foreground': '#d8dee9',
      'editorLineNumber.foreground': '#3a4353',
      'editorLineNumber.activeForeground': '#8fb2ff',
      'editor.lineHighlightBackground': '#11151d',
      'editor.selectionBackground': '#233252',
      'editor.inactiveSelectionBackground': '#1a2233',
      'editorCursor.foreground': '#5b8cff',
      'editorIndentGuide.background1': '#1b202a',
      'editorIndentGuide.activeBackground1': '#2f3745',
      'editorWidget.background': '#151a24',
      'editorWidget.border': '#222834',
      'editorSuggestWidget.background': '#151a24',
      'editorSuggestWidget.selectedBackground': '#1f2938',
      'editorGutter.background': '#0b0e14',
      'editorError.foreground': '#f2555a',
      'editorWarning.foreground': '#f0a13a',
      'scrollbarSlider.background': '#2f374588',
      'scrollbarSlider.hoverBackground': '#3d4757aa',
    },
  });

  monaco.editor.defineTheme(MONACO_THEMES.light, {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '8b95a5', fontStyle: 'italic' },
      { token: 'keyword', foreground: '7c4ddb' },
      { token: 'string', foreground: '0f7d5a' },
      { token: 'number', foreground: 'b06d0f' },
      { token: 'type', foreground: '2558c4' },
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#1c2430',
      'editorLineNumber.foreground': '#b3bcc9',
      'editorLineNumber.activeForeground': '#2f6bea',
      'editor.lineHighlightBackground': '#f6f8fb',
      'editorIndentGuide.background1': '#eceef2',
    },
  });

  const ts = monaco.languages.typescript;

  const compilerOptions: monaco.languages.typescript.CompilerOptions = {
    // Monaco bundles an older TS whose ScriptTarget enum stops at ES2020.
    target: ts.ScriptTarget.ESNext,
    lib: ['es2022', 'dom'],
    allowNonTsExtensions: true,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    strict: true,
    noEmit: true,
    // User code runs inside a function wrapper, so top-level statements and
    // repeated identifiers across template switches must not be errors.
    allowUmdGlobalAccess: true,
  };

  ts.typescriptDefaults.setCompilerOptions(compilerOptions);
  ts.javascriptDefaults.setCompilerOptions({ ...compilerOptions, strict: false, checkJs: false });

  ts.typescriptDefaults.addExtraLib(BREAKSTEP_API_DTS, 'ts:breakstep-runtime.d.ts');
  ts.javascriptDefaults.addExtraLib(BREAKSTEP_API_DTS, 'ts:breakstep-runtime.d.ts');

  // 2304 "cannot find name" would fire for injected globals in JS mode, and
  // 1375 complains about top-level await outside a module.
  ts.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: false,
  });
  ts.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    diagnosticCodesToIgnore: [1375, 1378, 2669, 7027],
  });

  loader.config({ monaco });
  return monaco;
}

export function monacoLanguageFor(language: string): string {
  if (language === 'python') return 'python';
  if (language === 'javascript') return 'javascript';
  return 'typescript';
}
