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

// Monaco must be configured before the React wrapper asks the loader for it.
setupMonaco();

interface Props {
  /**
   * The buffer the app wants in the editor.
   *
   * Applied on mount and then only when `docVersion` changes. It is not a
   * controlled value: Monaco owns the text, and feeding every keystroke back in
   * through React is what made typing cost 35ms a character.
   */
  code: string;
  /** Incremented by the app when it replaces the buffer. */
  docVersion?: number;
  language: Language;
  theme: ThemeName;
  error?: RunError;
  /** Phone-sized: wrap lines and shrink the gutter rather than scroll sideways. */
  compact?: boolean;
  /** The line the debugger is paused on, highlighted and scrolled into view. */
  activeLine?: number | null;
  /**
   * Breakpoints by line, drawn in the gutter the way VS Code draws them: a
   * filled dot, a hollow ring when disabled, and a marked dot when conditional.
   */
  breakpoints?: Map<number, LineBreakpoint>;
  /**
   * The variables in scope at the paused step. Hovering a name shows what it
   * holds *right now*, which is the question you actually have while stepping —
   * the type is already on the line above.
   */
  scope?: Record<string, unknown> | null;
  /** Clicking the gutter toggles a breakpoint on that line. */
  onToggleBreakpoint?: (line: number) => void;
  /**
   * Right-clicking the gutter, for the menu that edits a condition or disables
   * a breakpoint without deleting it. Given viewport coordinates to anchor to.
   */
  onGutterContextMenu?: (line: number, x: number, y: number) => void;
  onChange: (value: string) => void;
  onRun: () => void;
  /**
   * Submit for judging, when there is a problem open to submit to.
   *
   * Bound inside the editor as well as globally because Monaco claims
   * Cmd+Shift+Enter for "insert line above" and would otherwise swallow it —
   * the same reason Cmd+Enter is claimed back for Run.
   */
  onSubmit?: () => void;
  /**
   * Changes when a different file is put in the editor — another template,
   * language or mode. Editing does not change it, so the view only jumps back
   * to the top when the thing being edited is genuinely new.
   */
  resetKey?: string;
  /** Registered by the parent so other panels can jump to a line. */
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
  // Read through a ref for the same reason as the options memo: a new function
  // identity makes the wrapper tear down and re-attach its model listener.
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  /** True while the app is writing the buffer, so its own write is not echoed. */
  const applying = useRef(false);
  const handleChange = useCallback((value: string | undefined) => {
    if (applying.current) return;
    changeRef.current(value ?? '');
  }, []);
  // Read through a ref so the mouse handler is installed exactly once.
  const toggleRef = useRef(onToggleBreakpoint);
  toggleRef.current = onToggleBreakpoint;
  const gutterMenuRef = useRef(onGutterContextMenu);
  gutterMenuRef.current = onGutterContextMenu;
  // Same for the hover provider: registered once, but it must always read the
  // scope of the step the debugger is on right now.
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  // Booleans, not the values themselves, so the options memo below rebuilds
  // only when something about the *configuration* changes — never on a
  // keystroke, and never because a new Set of the same breakpoints arrived.
  const hasGutterMarks = (breakpoints?.size ?? 0) > 0 || activeLine != null;
  // Past this size the per-line decorations cost more than they teach. Measured
  // on `code.length` rather than a line count so it stays O(1) per render.
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

  /**
   * Put the app's buffer into the model.
   *
   * Keyed on `docVersion` deliberately, not on `code`: the version only moves
   * when the app replaces the text, so a keystroke never reaches this. `code` is
   * read fresh through the ref when it does run.
   *
   * Applied as an edit rather than `setValue` so it joins the undo stack —
   * revealing a solution stays one Cmd+Z from the attempt it replaced.
   */
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

  // Open a new file at its beginning. Monaco keeps the scroll position when a
  // model's contents are replaced, which otherwise drops you into the middle of
  // a problem you have never seen.
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    ed.setScrollTop(0);
    ed.setPosition({ lineNumber: 1, column: 1 });
  }, [resetKey]);

  // The provider is global to Monaco, not to this editor, so it has to go when
  // the panel does or a second mount would answer twice.
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

    // Cmd/Ctrl+Enter runs, matching every notebook and REPL people already use.
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current());
    // And with Shift, it submits — one step further on from the same gesture.
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, () =>
      submitRef.current?.(),
    );

    /*
     * Word wrap on Alt+Z.
     *
     * VS Code has this and Monaco does not ship it: the toggle lives in the
     * workbench, not the editor. Registered as an action rather than a bare
     * command so it also appears in the command palette and the context menu,
     * which is where someone who does not know the chord will look.
     */
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

    /**
     * Value-on-hover while paused.
     *
     * Monaco already answers "what type is this?"; the debugger is the only
     * thing that can answer "what is in it on this iteration?", so it does.
     */
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
              // Fenced so long structures keep their shape and wrap sanely.
              { value: '```\n' + (full.length > 400 ? short : full) + '\n```' },
            ],
          };
        },
      },
    );

    const inGutter = (target: editor.IMouseTarget) =>
      target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
      target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS;

    // Clicking the gutter toggles a breakpoint, the way every editor does it.
    ed.onMouseDown((event) => {
      if (event.event.rightButton) return;
      if (!inGutter(event.target) || !event.target.position) return;
      toggleRef.current?.(event.target.position.lineNumber);
    });

    /*
     * Right-clicking it opens the breakpoint menu instead — where a condition
     * gets edited and a breakpoint gets disabled rather than deleted. Monaco's
     * own context menu belongs to the text, so the glyph margin is ours to
     * claim, and the browser's has to be told to stay out of the way.
     */
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
          // The paused line is worth finding from the scrollbar at a glance.
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

  /**
   * Monaco applies `updateOptions` whenever this object changes identity, and
   * that forces a full re-layout. Built once per configuration so an unrelated
   * re-render — a debug step, a log line — cannot make the editor relayout.
   */
  const options = useMemo<editor.IStandaloneEditorConstructionOptions>(
    () => ({
      // 16px on phones: anything smaller and iOS Safari zooms the page in
      // when the editor takes focus.
      fontSize: compact ? 16 : 13,
      lineHeight: compact ? 24 : 21,
      fontFamily: "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
      fontLigatures: false,
      minimap: { enabled: false },
      // On a phone the glyph margin is dead space until it has something
      // to show; the line-number gutter still toggles breakpoints.
      glyphMargin: !compact || hasGutterMarks,
      lineNumbersMinChars: compact ? 2 : 3,
      folding: !compact && !large,
      // Horizontal scrolling is miserable on a touchscreen.
      wordWrap: compact ? 'on' : 'off',
      // VS Code's default, and it matters more than it looks. With it off the
      // scroll stops dead on the last line, so a quick flick slams into a wall
      // — which reads as the editor stalling even though every frame was on
      // time. A screenful of slack lets momentum run out the way it does
      // everywhere else.
      scrollBeyondLastLine: true,
      // 'all' repaints the gutter as well as the line on every cursor move.
      renderLineHighlight: 'line',
      // Both of these animate continuously. Smooth scrolling in particular eases
      // every wheel tick over ~125ms, which reads as lag however high the frame
      // rate is — the scroll simply arrives after your fingers.
      smoothScrolling: false,
      cursorBlinking: 'blink',
      cursorSmoothCaretAnimation: 'off',
      // Sticky scroll pins the enclosing function to the top of the viewport,
      // which is worth a lot in a long file. It asks the language worker for
      // symbols, so it is off on a phone, where the header would also eat a
      // third of the visible code.
      stickyScroll: { enabled: !compact && !large, maxLineCount: 3 },
      // Top padding is done in CSS on the wrapper, not here: Monaco does not
      // account for its own `padding.top` when resolving a gutter click, so a
      // 12px gap on a 21px line put every breakpoint one line above the one you
      // clicked. Bottom padding is safe — nothing is hit-tested below the last
      // line.
      padding: { top: 0, bottom: compact ? 40 : 14 },
      tabSize: language === 'python' ? 4 : 2,
      automaticLayout: true,
      bracketPairColorization: { enabled: !large },

      // --- Scrolling smoothness ------------------------------------------
      //
      // Monaco does not composite its scroll: it re-renders the visible lines
      // every frame. Everything below is per-line work that was measured on a
      // 6x-throttled CPU and removed because it costs more than it gives.
      //
      // Indentation guides are by far the biggest: one absolutely-positioned
      // element per indent level per visible line, rebuilt on every scroll
      // frame. Removing them alone cut the editor's per-frame JavaScript by
      // about 45%. Bracket colouring stays — it costs a fraction as much and
      // shows nesting just as well.
      /*
       * Indentation guides are the expensive one — an absolutely-positioned
       * element per indent level per visible line, rebuilt every scroll frame —
       * but they are on because VS Code has them and nested code needs them.
       * Only up to `large`, past which the per-line work stops paying for
       * itself; `scripts/editor-perf.mjs` is what settles where that line is.
       */
      guides: {
        indentation: !large,
        bracketPairs: false,
        highlightActiveIndentation: !large,
      },
      // Scanning every rendered line for homoglyphs, CSS colours and URLs, none
      // of which appear in the code this app is for.
      unicodeHighlight: { ambiguousCharacters: false, invisibleCharacters: false },
      /*
       * Nothing provides code lenses here, so leaving it on would buy a model
       * scan per change in exchange for nothing to show.
       */
      codeLens: false,
      lightbulb: { enabled: 'onCode' as editor.ShowLightbulbIconMode },
      /*
       * Selecting a word marks every other one, and putting the caret in a
       * symbol marks its other uses — VS Code's defaults, and the two most
       * missed things in this editor. Both run off the cursor with a delay
       * rather than per frame, so neither shows up in the scroll budget.
       */
      occurrencesHighlight: 'singleFile',
      selectionHighlight: true,
      // Ordinary editing affordances VS Code has on, all cheap.
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
        // Monaco's default. Letting unused wheel events escape to the page
        // sounds polite, but on a short file you reach the end constantly, and
        // every one of those events then goes looking for another scroller.
        alwaysConsumeMouseWheel: true,
        // Two gradient overlays repainted on every scroll frame.
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

/**
 * Memoised, and the reason matters: this panel must not re-render because
 * something else in the app did. Every callback it takes is read through a ref,
 * so the only props that ever change identity are the ones that should cause
 * work — a new document version, a new error line, a new debugger step.
 */
export const EditorPanel = memo(EditorPanelInner);
