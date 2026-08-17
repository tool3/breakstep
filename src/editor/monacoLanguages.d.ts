/**
 * Monaco ships its basic-language grammars as plain JavaScript with no types.
 * Only the shape actually used here is declared: the Monarch definition, which
 * `memberTokens.ts` clones so it can prepend a rule.
 */
declare module 'monaco-editor/esm/vs/basic-languages/typescript/typescript' {
  import type * as monacoNs from 'monaco-editor/esm/vs/editor/editor.api';
  export const language: monacoNs.languages.IMonarchLanguage;
  export const conf: monacoNs.languages.LanguageConfiguration;
}

declare module 'monaco-editor/esm/vs/basic-languages/python/python' {
  import type * as monacoNs from 'monaco-editor/esm/vs/editor/editor.api';
  export const language: monacoNs.languages.IMonarchLanguage;
  export const conf: monacoNs.languages.LanguageConfiguration;
}
