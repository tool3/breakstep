import { useCallback, useEffect, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { Skeleton } from 'antd';
import { MONACO_THEMES, monacoLanguageFor, setupMonaco } from '@/editor/monacoSetup';
import type { Language, RunError } from '@/types';
import type { ThemeName } from '@/hooks/useTheme';
import styles from './EditorPanel.module.scss';

// Monaco must be configured before the React wrapper asks the loader for it.
setupMonaco();

interface Props {
  code: string;
  language: Language;
  theme: ThemeName;
  error?: RunError;
  /** Phone-sized: wrap lines and shrink the gutter rather than scroll sideways. */
  compact?: boolean;
  onChange: (value: string) => void;
  onRun: () => void;
  /** Registered by the parent so other panels can jump to a line. */
  registerGoToLine?: (fn: (line: number) => void) => void;
}

export function EditorPanel({
  code,
  language,
  theme,
  error,
  compact,
  onChange,
  onRun,
  registerGoToLine,
}: Props) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const decorations = useRef<editor.IEditorDecorationsCollection | null>(null);
  const runRef = useRef(onRun);
  runRef.current = onRun;

  const goToLine = useCallback((line: number) => {
    const ed = editorRef.current;
    if (!ed) return;
    ed.revealLineInCenter(line);
    ed.setPosition({ lineNumber: line, column: 1 });
    ed.focus();
  }, []);

  useEffect(() => {
    registerGoToLine?.(goToLine);
  }, [registerGoToLine, goToLine]);

  const handleMount: OnMount = (ed, monaco) => {
    editorRef.current = ed;
    monacoRef.current = monaco;
    decorations.current = ed.createDecorationsCollection([]);

    // Cmd/Ctrl+Enter runs, matching every notebook and REPL people already use.
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current());
  };

  /**
   * Mark the failing line in the gutter. Decorations are used rather than
   * markers so Monaco's own type diagnostics keep their squiggles.
   */
  useEffect(() => {
    const monaco = monacoRef.current;
    const collection = decorations.current;
    if (!monaco || !collection) return;

    if (!error?.line) {
      collection.clear();
      return;
    }

    collection.set([
      {
        range: new monaco.Range(error.line, 1, error.line, 1),
        options: {
          isWholeLine: true,
          className: styles.errorLine,
          glyphMarginClassName: styles.errorGlyph,
          glyphMarginHoverMessage: { value: error.message },
          overviewRuler: {
            color: '#f2555a',
            position: monaco.editor.OverviewRulerLane.Right,
          },
        },
      },
    ]);
  }, [error]);

  return (
    <div className={styles.panel}>
      <Editor
        className={styles.editor}
        language={monacoLanguageFor(language)}
        theme={MONACO_THEMES[theme]}
        value={code}
        onChange={(value) => onChange(value ?? '')}
        onMount={handleMount}
        loading={<Skeleton active paragraph={{ rows: 8 }} className={styles.loading} />}
        options={{
          // 16px on phones: anything smaller and iOS Safari zooms the page in
          // when the editor takes focus.
          fontSize: compact ? 16 : 13,
          lineHeight: compact ? 24 : 21,
          fontFamily: "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
          fontLigatures: false,
          minimap: { enabled: false },
          glyphMargin: !compact,
          lineNumbersMinChars: compact ? 2 : 3,
          folding: !compact,
          // Horizontal scrolling is miserable on a touchscreen.
          wordWrap: compact ? 'on' : 'off',
          scrollBeyondLastLine: false,
          renderLineHighlight: 'all',
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          padding: { top: 12, bottom: compact ? 40 : 14 },
          tabSize: language === 'python' ? 4 : 2,
          automaticLayout: true,
          bracketPairColorization: { enabled: true },
          guides: { indentation: true, bracketPairs: false },
          scrollbar: {
            verticalScrollbarSize: compact ? 14 : 10,
            horizontalScrollbarSize: compact ? 14 : 10,
          },
          suggestSelection: 'first',
          quickSuggestions: { other: true, comments: false, strings: false },
        }}
      />
    </div>
  );
}
