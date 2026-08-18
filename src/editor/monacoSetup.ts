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
import { MEMBER_CALL_TOKEN, MEMBER_TOKEN, registerMemberTokens } from './memberTokens';

export const MONACO_THEMES = {
  midnight: 'breakstep-midnight',
  graphite: 'breakstep-graphite',
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
      // `trie.size` — a cooler, quieter blue-grey than the near-white objects
      // it hangs off, so the two read as different kinds of name.
      { token: MEMBER_TOKEN, foreground: 'a9c1de' },
      // A call is a call whether it is `insert(…)` or `trie.insert(…)`.
      { token: MEMBER_CALL_TOKEN, foreground: '93b3ff' },
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

  /*
   * Graphite's editor.
   *
   * The token colours are the Dark+ family — green comments, salmon strings,
   * teal types — rather than this app's accent palette. That is deliberate: it
   * is what almost every editor and every judge site looks like, so code reads
   * the way people are used to reading it, and the chrome is the only thing
   * that says Breakstep.
   */
  monaco.editor.defineTheme(MONACO_THEMES.graphite, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c586c0' },
      { token: 'keyword.flow', foreground: 'c586c0' },
      { token: 'string', foreground: 'ce9178' },
      { token: 'number', foreground: 'b5cea8' },
      { token: 'regexp', foreground: 'd16969' },
      { token: 'type', foreground: '4ec9b0' },
      { token: 'type.identifier', foreground: '4ec9b0' },
      { token: 'identifier', foreground: '9cdcfe' },
      { token: 'delimiter', foreground: 'd4d4d4' },
      { token: 'function', foreground: 'dcdcaa' },
      { token: 'variable.predefined', foreground: '4fc1ff' },
      // `trie.size` — the object stays blue, the name read off it does not.
      { token: MEMBER_TOKEN, foreground: 'd8dde6' },
      // `trie.insert(…)` — a call reads as a call, the way it does everywhere.
      { token: MEMBER_CALL_TOKEN, foreground: 'dcdcaa' },
    ],
    colors: {
      'editor.background': '#1a1a1a',
      'editor.foreground': '#eff1f6',
      'editorLineNumber.foreground': '#6e6e6e',
      'editorLineNumber.activeForeground': '#c6c6c6',
      'editor.lineHighlightBackground': '#232323',
      'editor.selectionBackground': '#264f78',
      'editor.inactiveSelectionBackground': '#3a3d41',
      'editorCursor.foreground': '#aeafad',
      'editorIndentGuide.background1': '#2f2f2f',
      'editorIndentGuide.activeBackground1': '#4d4d4d',
      'editorWidget.background': '#282828',
      'editorWidget.border': '#3e3e3e',
      'editorSuggestWidget.background': '#282828',
      'editorSuggestWidget.selectedBackground': '#37373d',
      'editorGutter.background': '#1a1a1a',
      'editorError.foreground': '#ef4743',
      'editorWarning.foreground': '#ffb800',
      'scrollbarSlider.background': '#4f4f4f66',
      'scrollbarSlider.hoverBackground': '#5f5f5f99',
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
      // Objects keep the body text colour; a member is a deep navy, a call the
      // olive-brown that light editors have used for callables for years.
      { token: MEMBER_TOKEN, foreground: '12307d' },
      { token: MEMBER_CALL_TOKEN, foreground: '7a5c1e' },
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

  registerMemberTokens(monaco);

  loader.config({ monaco });
  return monaco;
}

export function monacoLanguageFor(language: string): string {
  if (language === 'python') return 'python';
  if (language === 'javascript') return 'javascript';
  return 'typescript';
}
