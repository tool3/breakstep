import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { Skeleton } from 'antd';
import { MONACO_THEMES, monacoLanguageFor, setupMonaco } from '@/editor/monacoSetup';
import { formatFull, formatValue } from './visualizers/format';
import type { Language, RunError } from '@/types';
import type { LineBreakpoint } from '@/types/debug';
import type { ThemeName } from '@/hooks/useTheme';
import styles from './EditorPanel.module.scss';

setupMonaco();

interface Props {
  code: string;
  docVersion?: number;
  language: Language;
  theme: ThemeName;
  error?: RunError;
  compact?: boolean;
  activeLine?: number | null;
  breakpoints?: Map<number, LineBreakpoint>;
  scope?: Record<string, unknown> | null;
  onToggleBreakpoint?: (line: number) => void;
  onGutterContextMenu?: (line: number, x: number, y: number) => void;
  onChange: (value: string) => void;
  onRun: () => void;
  onSubmit?: () => void;
  resetKey?: string;
  registerGoToLine?: (fn: (line: number) => void) => void;
}

function EditorPanelInner({
  code,
  docVersion = 0,
  language,
  theme,
  error,
  compact,
  activeLine,
  breakpoints,
  scope,
  onToggleBreakpoint,
  onGutterContextMenu,
  onChange,
  onRun,
  onSubmit,
  resetKey,
  registerGoToLine,
}: Props) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const hoverDisposable = useRef<{ dispose: () => void } | null>(null);
  const decorations = useRef<editor.IEditorDecorationsCollection | null>(null);
  const debugDecorations = useRef<editor.IEditorDecorationsCollection | null>(null);
  const runRef = useRef(onRun);
  runRef.current = onRun;
  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const applying = useRef(false);
  const handleChange = useCallback((value: string | undefined) => {
    if (applying.current) return;
    changeRef.current(value ?? '');
  }, []);
  const toggleRef = useRef(onToggleBreakpoint);
  toggleRef.current = onToggleBreakpoint;
  const gutterMenuRef = useRef(onGutterContextMenu);
  gutterMenuRef.current = onGutterContextMenu;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  const hasGutterMarks = (breakpoints?.size ?? 0) > 0 || activeLine != null;
  const large = code.length > 60_000;

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

  const codeRef = useRef(code);
  codeRef.current = code;

  useEffect(() => {
    const ed = editorRef.current;
    const model = ed?.getModel();
    if (!ed || !model) return;

    const next = codeRef.current;
    if (model.getValue() === next) return;

    applying.current = true;
    try {
      ed.pushUndoStop();
      model.pushEditOperations(
        [],
        [{ range: model.getFullModelRange(), text: next, forceMoveMarkers: true }],
        () => null,
      );
      ed.pushUndoStop();
    } finally {
      applying.current = false;
    }
  }, [docVersion]);

  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    ed.setScrollTop(0);
    ed.setPosition({ lineNumber: 1, column: 1 });
  }, [resetKey]);

  useEffect(
    () => () => {
      hoverDisposable.current?.dispose();
      hoverDisposable.current = null;
    },
    [],
  );

  const handleMount: OnMount = (ed, monaco) => {
    editorRef.current = ed;
    monacoRef.current = monaco;
    decorations.current = ed.createDecorationsCollection([]);

    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current());
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, () =>
      submitRef.current?.(),
    );

    ed.addAction({
      id: 'breakstep.toggleWordWrap',
      label: 'View: Toggle Word Wrap',
      keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.KeyZ],
      contextMenuGroupId: 'view',
      run: (target) => {
        const wrapped = target.getOption(monaco.editor.EditorOption.wordWrap);
        target.updateOptions({ wordWrap: wrapped === 'on' ? 'off' : 'on' });
      },
    });

    debugDecorations.current = ed.createDecorationsCollection([]);

    hoverDisposable.current = monaco.languages.registerHoverProvider(
      ['typescript', 'javascript', 'python'],
      {
        provideHover(model, position) {
          const current = scopeRef.current;
          if (!current) return null;

          const word = model.getWordAtPosition(position);
          if (!word || !(word.word in current)) return null;

          const value = current[word.word];
          const full = formatFull(value);
          const short = formatValue(value, 60);

          return {
            range: new monaco.Range(
              position.lineNumber,
              word.startColumn,
              position.lineNumber,
              word.endColumn,
            ),
            contents: [
              { value: `**${word.word}** — value at this step` },
              { value: '```\n' + (full.length > 400 ? short : full) + '\n```' },
            ],
          };
        },
      },
    );

    const inGutter = (target: editor.IMouseTarget) =>
      target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
      target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS;

    ed.onMouseDown((event) => {
      if (event.event.rightButton) return;
      if (!inGutter(event.target) || !event.target.position) return;
      toggleRef.current?.(event.target.position.lineNumber);
    });

    ed.onContextMenu((event) => {
      if (!inGutter(event.target) || !event.target.position) return;
      event.event.preventDefault();
      event.event.stopPropagation();
      gutterMenuRef.current?.(
        event.target.position.lineNumber,
        event.event.posx,
        event.event.posy,
      );
    });
  };

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

  useEffect(() => {
    const monaco = monacoRef.current;
    const collection = debugDecorations.current;
    const ed = editorRef.current;
    if (!monaco || !collection) return;

    const next: editor.IModelDeltaDecoration[] = [];

    for (const breakpoint of (breakpoints ?? new Map()).values()) {
      const glyph = !breakpoint.enabled
        ? styles.breakpointDisabled
        : breakpoint.condition
          ? styles.breakpointConditional
          : styles.breakpointGlyph;

      const hover = !breakpoint.enabled
        ? 'Disabled breakpoint — right-click to enable'
        : breakpoint.condition
          ? `Conditional breakpoint: \`${breakpoint.condition}\``
          : 'Breakpoint — click to remove, right-click for a condition';

      next.push({
        range: new monaco.Range(breakpoint.line, 1, breakpoint.line, 1),
        options: {
          isWholeLine: false,
          glyphMarginClassName: glyph,
          glyphMarginHoverMessage: { value: hover },
          overviewRuler: {
            color: breakpoint.enabled ? '#f4585d' : '#6b7280',
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
            color: '#ffb800',
            position: monaco.editor.OverviewRulerLane.Full,
          },
        },
      });
      ed?.revealLineInCenterIfOutsideViewport(activeLine);
    }

    collection.set(next);
  }, [breakpoints, activeLine]);

  const options = useMemo<editor.IStandaloneEditorConstructionOptions>(
    () => ({
      fontSize: compact ? 16 : 13,
      lineHeight: compact ? 24 : 21,
      fontFamily: "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
      fontLigatures: false,
      minimap: { enabled: false },
      glyphMargin: !compact || hasGutterMarks,
      lineNumbersMinChars: compact ? 2 : 3,
      folding: !compact && !large,
      wordWrap: compact ? 'on' : 'off',
      scrollBeyondLastLine: true,
      renderLineHighlight: 'line',
      smoothScrolling: false,
      cursorBlinking: 'blink',
      cursorSmoothCaretAnimation: 'off',
      stickyScroll: { enabled: !compact && !large, maxLineCount: 3 },
      padding: { top: 0, bottom: compact ? 40 : 14 },
      tabSize: language === 'python' ? 4 : 2,
      automaticLayout: true,
      bracketPairColorization: { enabled: !large },

      guides: {
        indentation: !large,
        bracketPairs: false,
        highlightActiveIndentation: !large,
      },
      unicodeHighlight: { ambiguousCharacters: false, invisibleCharacters: false },
      codeLens: false,
      lightbulb: { enabled: 'onCode' as editor.ShowLightbulbIconMode },
      occurrencesHighlight: 'singleFile',
      selectionHighlight: true,
      dragAndDrop: true,
      links: true,
      colorDecorators: true,
      matchBrackets: 'always',
      multiCursorModifier: 'alt',
      renderWhitespace: 'selection',
      inlayHints: { enabled: 'on' },
      formatOnPaste: false,
      formatOnType: false,
      find: {
        seedSearchStringFromSelection: 'always',
        autoFindInSelection: 'multiline',
        addExtraSpaceOnTop: false,
      },
      scrollbar: {
        verticalScrollbarSize: compact ? 14 : 10,
        horizontalScrollbarSize: compact ? 14 : 10,
        alwaysConsumeMouseWheel: true,
        useShadows: false,
      },
      overviewRulerBorder: false,
      suggestSelection: 'first',
      quickSuggestions: { other: !large, comments: false, strings: false },
    }),
    [compact, language, large, hasGutterMarks],
  );

  return (
    <div className={styles.panel}>
      <Editor
        className={styles.editor}
        language={monacoLanguageFor(language)}
        theme={MONACO_THEMES[theme]}
        defaultValue={code}
        onChange={handleChange}
        onMount={handleMount}
        loading={<Skeleton active paragraph={{ rows: 8 }} className={styles.loading} />}
        options={options}
      />
    </div>
  );
}

export const EditorPanel = memo(EditorPanelInner);
