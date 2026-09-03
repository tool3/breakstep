import type * as monacoNs from 'monaco-editor/esm/vs/editor/editor.api';

export const MEMBER_TOKEN = 'member.property';
export const MEMBER_CALL_TOKEN = 'member.function';

function memberRules(): monacoNs.languages.IMonarchLanguageRule[] {
  return [
    [/(\.)(\s*)([a-zA-Z_$][\w$]*)(?=\s*\()/, ['delimiter', 'white', MEMBER_CALL_TOKEN]],
    [/(\.)(\s*)([a-zA-Z_$][\w$]*)/, ['delimiter', 'white', MEMBER_TOKEN]],
  ] as unknown as monacoNs.languages.IMonarchLanguageRule[];
}

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

export function registerMemberTokens(monaco: typeof monacoNs): void {
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
