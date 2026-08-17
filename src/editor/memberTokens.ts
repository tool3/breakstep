/**
 * Tell an object apart from what is read off it.
 *
 * Monaco colours `trie.size` in one colour, because its TypeScript grammar
 * emits `identifier` for both halves. The type-aware answer would be semantic
 * tokens, but monaco's TypeScript worker keeps
 * `getEncodedSemanticClassifications` to itself — it is in the bundle and not on
 * the worker's public surface — so there is nothing to ask.
 *
 * What is left is lexical, and for this it is enough: a name straight after a
 * dot is a member, and a member straight before a `(` is being called. That
 * gets `trie.size` and `trie.insert(…)` coloured differently from `trie`, which
 * is the distinction worth having. It does not know a method from a function
 * stored in a property, and does not need to.
 */
import type * as monacoNs from 'monaco-editor/esm/vs/editor/editor.api';

/** Token types the themes provide colours for. */
export const MEMBER_TOKEN = 'member.property';
export const MEMBER_CALL_TOKEN = 'member.function';

/**
 * Rules to put at the front of a tokenizer state.
 *
 * The call form comes first so `insert(` wins over the plain-member form. Both
 * require the dot, which is what keeps them away from `1.5` and `...rest`.
 */
function memberRules(): monacoNs.languages.IMonarchLanguageRule[] {
  return [
    [/(\.)(\s*)([a-zA-Z_$][\w$]*)(?=\s*\()/, ['delimiter', 'white', MEMBER_CALL_TOKEN]],
    [/(\.)(\s*)([a-zA-Z_$][\w$]*)/, ['delimiter', 'white', MEMBER_TOKEN]],
  ] as unknown as monacoNs.languages.IMonarchLanguageRule[];
}

/** A tokenizer with the member rules prepended to one of its states. */
function withMemberRules(
  language: monacoNs.languages.IMonarchLanguage,
  state: string,
): monacoNs.languages.IMonarchLanguage {
  const tokenizer = language.tokenizer as Record<
    string,
    monacoNs.languages.IMonarchLanguageRule[]
  >;
  const existing = tokenizer[state];
  if (!Array.isArray(existing)) return language;

  return {
    ...language,
    tokenizer: { ...tokenizer, [state]: [...memberRules(), ...existing] },
  };
}

/**
 * Install the rules for every language the editor offers.
 *
 * Registered through `onLanguage` rather than directly, and after the
 * basic-language contributions have been imported, so this handler runs last
 * and its tokenizer is the one that sticks.
 */
export function registerMemberTokens(monaco: typeof monacoNs): void {
  // TypeScript and JavaScript share one grammar, whose rules live in `common`.
  const installTs = async () => {
    const { language } = await import('monaco-editor/esm/vs/basic-languages/typescript/typescript');
    for (const id of ['typescript', 'javascript']) {
      monaco.languages.setMonarchTokensProvider(id, withMemberRules(language, 'common'));
    }
  };

  const installPython = async () => {
    const { language } = await import('monaco-editor/esm/vs/basic-languages/python/python');
    monaco.languages.setMonarchTokensProvider('python', withMemberRules(language, 'root'));
  };

  monaco.languages.onLanguage('typescript', installTs);
  monaco.languages.onLanguage('javascript', installTs);
  monaco.languages.onLanguage('python', installPython);
}
