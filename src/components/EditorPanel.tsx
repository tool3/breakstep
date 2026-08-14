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
  /** The line the debugger is paused on, highlighted and scrolled into view. */
  activeLine?: number | null;
  /** Lines carrying a breakpoint, drawn as red dots in the gutter. */
  breakpoints?: Set<number>;
  /** Clicking the gutter toggles a breakpoint on that line. */
  onToggleBreakpoint?: (line: number) => void;
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
  activeLine,
  breakpoints,
  onToggleBreakpoint,
  onChange,
  onRun,
  registerGoToLine,
}: Props) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const decorations = useRef<editor.IEditorDecorationsCollection | null>(null);
  const debugDecorations = useRef<editor.IEditorDecorationsCollection | null>(null);
  const runRef = useRef(onRun);
  runRef.current = onRun;
  // Read through a ref so the mouse handler is installed exactly once.
  const toggleRef = useRef(onToggleBreakpoint);
  toggleRef.current = onToggleBreakpoint;

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

    debugDecorations.current = ed.createDecorationsCollection([]);

    // Clicking the gutter toggles a breakpoint, the way every editor does it.
    ed.onMouseDown((event) => {
      const target = event.target;
      const isGutter =
        target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
        target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS;
      if (!isGutter || !target.position) return;
      toggleRef.current?.(target.position.lineNumber);
    });
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

  /** Breakpoint dots and the paused-line band, kept apart from error markers. */
  useEffect(() => {
    const monaco = monacoRef.current;
    const collection = debugDecorations.current;
    const ed = editorRef.current;
    if (!monaco || !collection) return;

    const next: editor.IModelDeltaDecoration[] = [];

    for (const line of breakpoints ?? []) {
      next.push({
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: false,
          glyphMarginClassName: styles.breakpointGlyph,
          glyphMarginHoverMessage: { value: 'Breakpoint — click to remove' },
          overviewRuler: {
            color: '#f4585d',
            position: monaco.editor.OverviewRulerLane.Left,
          },
        },
      });
    }

    if (activeLine) {
      next.push({
        range: new monaco.Range(activeLine, 1, activeLine, 1),
        options: {
          isWholeLine: true,
          className: styles.activeLine,
          glyphMarginClassName: styles.activeGlyph,
          overviewRuler: {
            color: '#f2a53c',
            position: monaco.editor.OverviewRulerLane.Full,
          },
        },
      });
      ed?.revealLineInCenterIfOutsideViewport(activeLine);
    }

    collection.set(next);
  }, [breakpoints, activeLine]);

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
          // The gutter is where breakpoints live, so it stays even on a phone
          // once a debug session is running.
          // On a phone the glyph margin is dead space until it has something
          // to show; the line-number gutter still toggles breakpoints.
          glyphMargin: !compact || (breakpoints?.size ?? 0) > 0 || activeLine != null,
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
