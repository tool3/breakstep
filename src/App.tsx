import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { App as AntApp, ConfigProvider, Skeleton, Tabs, theme as antdTheme } from 'antd';
import {
  BarChartOutlined,
  CodeOutlined,
  BugOutlined,
  ExperimentOutlined,
  TrophyOutlined,
  CloudUploadOutlined,
  PartitionOutlined,
  SlidersOutlined,
} from '@ant-design/icons';
import { Header, ModeBadge } from './components/Header';
import { SubmissionsPanel, VerdictDot } from './components/SubmissionsPanel';
import { ParamsPanel } from './components/ParamsPanel';
import { ProblemPanel } from './components/ProblemPanel';
import { DebugPanel } from './components/DebugPanel';
import { OutputPanel } from './components/OutputPanel';
import { VisualizerPanel } from './components/VisualizerPanel';
import { ComplexityPanel } from './components/ComplexityPanel';
import { TemplatePicker } from './components/TemplatePicker';
import { ProblemDrawer } from './components/ProblemDrawer';
import { SplitPane } from './components/SplitPane';
import { useWorkspace } from './hooks/useWorkspace';
import { useDebugger } from './hooks/useDebugger';
import { useSubmissions } from './hooks/useSubmissions';
import { listFunctions } from './analysis/functions';
import type { LeetProblem } from './leetcode/types';
import type { Submission } from './submissions/types';
import { themeDefinition, useTheme, type ThemeName } from './hooks/useTheme';
import { useLayout } from './hooks/useLayout';
import { useLocalStorage } from './hooks/useLocalStorage';
import styles from './App.module.scss';

/** Panels the right-hand side (or the phone tab bar) can show. */
type PanelKey = 'visualize' | 'output' | 'complexity';
/** On a phone the editor and parameters join the same tab strip. */
type CompactKey = 'code' | 'params' | PanelKey;
/** The tabs under the editor: what you are solving, how it went, what it runs on. */
type BottomKey = 'problem' | 'submissions' | 'params';

// Monaco is by far the largest dependency. Splitting it out means the shell,
// the visualizers and the analysis panels paint before it arrives.
const EditorPanel = lazy(() =>
  import('./components/EditorPanel').then((m) => ({ default: m.EditorPanel })),
);

/**
 * antd tokens mapped onto the Breakstep palette so the two never drift apart.
 *
 * Taken from the active theme rather than from a light/dark boolean: antd
 * renders into portals — dropdowns, tooltips, drawers — and with one hardcoded
 * dark palette those surfaces belonged to whichever theme the numbers were
 * copied from, not the one on screen.
 */
function useAntdTheme(theme: ThemeName, coarsePointer: boolean) {
  return useMemo(() => {
    const { dark, antd } = themeDefinition(theme);

    return {
      algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      token: {
        colorPrimary: antd.primary,
        colorSuccess: antd.success,
        colorWarning: antd.warning,
        colorError: antd.error,
        colorBgBase: antd.bg,
        colorBgContainer: antd.container,
        colorBgElevated: antd.elevated,
        colorBorder: antd.border,
        colorBorderSecondary: antd.borderSecondary,
        colorText: antd.text,
        colorTextSecondary: antd.textSecondary,
        colorTextTertiary: antd.textTertiary,
        borderRadius: 6,
        fontSize: 13,
        // Touch devices get taller controls everywhere antd renders one.
        controlHeight: coarsePointer ? 38 : 30,
        controlHeightSM: coarsePointer ? 32 : 24,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, 'Helvetica Neue', sans-serif",
      },
      components: {
        Segmented: { itemSelectedBg: antd.segmentedSelected },
        Tabs: { horizontalItemPadding: '9px 14px', cardPadding: '6px 12px' },
        Button: { paddingInline: 12 },
        Slider: {
          railSize: coarsePointer ? 5 : 3,
          handleSize: coarsePointer ? 14 : 10,
          handleSizeHover: coarsePointer ? 16 : 12,
          // antd derives the track from a *tint* of the primary, which on a
          // dark panel comes out grey-blue and looks like a disabled control.
          // The accent is the accent.
          trackBg: antd.primary,
          trackHoverBg: antd.primary,
          handleColor: antd.primary,
          handleActiveColor: antd.primary,
          dotActiveBorderColor: antd.primary,
          railBg: antd.border,
          railHoverBg: antd.elevated,
        },
      },
    };
  }, [theme, coarsePointer]);
}

/**
 * The phone tab strip. While debugging, the Inputs slot becomes the debugger —
 * the parameters are fixed for the recording anyway, and the controls need the
 * room far more than the sliders do.
 */
function compactTabs(debugging: boolean): { key: CompactKey; label: string; icon: ReactNode }[] {
  return [
    { key: 'code', label: 'Code', icon: <CodeOutlined /> },
    debugging
      ? { key: 'params', label: 'Debug', icon: <BugOutlined /> }
      : { key: 'params', label: 'Inputs', icon: <SlidersOutlined /> },
    { key: 'visualize', label: 'Visual', icon: <PartitionOutlined /> },
    { key: 'output', label: 'Output', icon: <ExperimentOutlined /> },
    { key: 'complexity', label: 'Analyze', icon: <BarChartOutlined /> },
  ];
}

export default function App() {
  const workspace = useWorkspace();
  const debug = useDebugger();
  const submissions = useSubmissions(workspace.problemSlug);
  const { theme, setTheme } = useTheme();
  const layout = useLayout();
  const antdConfig = useAntdTheme(theme, layout.coarsePointer);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [problemsOpen, setProblemsOpen] = useState(false);
  /** Which of the three bottom-left tabs is showing. */
  const [bottomTab, setBottomTab] = useState<BottomKey>('params');

  const openProblems = useCallback(() => setProblemsOpen(true), []);
  const closeProblems = useCallback(() => setProblemsOpen(false), []);
  const [panel, setPanel] = useState<PanelKey>('visualize');
  const [compactTab, setCompactTab] = useState<CompactKey>('code');
  const [splitRatio, setSplitRatio] = useLocalStorage('layout:split', 50);
  const [editorRatio, setEditorRatio] = useLocalStorage('layout:editor', 72);
  const [stackRatio, setStackRatio] = useLocalStorage('layout:stack', 52);

  const template = workspace.template;
  const compact = layout.mode === 'compact';
  const goToLineRef = useRef<((line: number) => void) | null>(null);

  const registerGoToLine = useCallback((fn: (line: number) => void) => {
    goToLineRef.current = fn;
  }, []);

  const goToLine = useCallback(
    (line: number) => {
      // The editor may not be on screen on a phone; bring it back first.
      if (compact) setCompactTab('code');
      goToLineRef.current?.(line);
    },
    [compact],
  );

  const { run, debugRun, analyze, status, result, flushCode, currentCode } = workspace;

  /** Show a panel, wherever that panel currently lives. */
  const reveal = useCallback(
    (key: PanelKey) => {
      setPanel(key);
      if (compact) setCompactTab(key);
    },
    [compact],
  );

  /*
   * Every explicit action flushes the pending publish first.
   *
   * Typing is deliberately debounced, so `workspace.code` can be up to a moment
   * behind what is on screen. The runners read the live buffer and are never
   * wrong, but anything derived from the published one — the function list the
   * debugger offers breakpoints for, the entry name the Analyze tab shows — would
   * be. Pressing a button means "use what I can see", so flush and mean it.
   */
  const handleRun = useCallback(() => {
    flushCode();
    debug.end();
    run();
    reveal('visualize');
  }, [flushCode, run, reveal, debug]);

  /**
   * Record a run, then hand it to the debugger.
   *
   * The run itself is an ordinary run — same code, same parameters, same
   * frames — so the picture the debugger walks is exactly the picture Run
   * would have produced.
   */
  const handleDebug = useCallback(() => {
    flushCode();
    debug.end();
    reveal('visualize');
    void debugRun().then((steps) => {
      // The live buffer, not the published one: this runs after an await, and
      // the closure still holds whatever `code` was before the flush.
      debug.begin(steps, listFunctions(currentCode(), workspace.language));
      if (compact) setCompactTab('params');
    });
  }, [debugRun, debug, reveal, compact, flushCode, currentCode, workspace.language]);

  /**
   * Judge the buffer and record the attempt.
   *
   * The verdict is the point, so the panel showing it comes forward — and the
   * frames on screen are left exactly as they were, because a submission is not
   * a run and should not wipe the picture you were reading.
   */
  const handleSubmit = useCallback(async () => {
    flushCode();
    // A debug session owns this whole pane, so the verdict would land behind it.
    debug.end();
    setBottomTab('submissions');
    if (compact) setCompactTab('params');

    const draft = await workspace.submit();
    if (draft) await submissions.record(draft);
  }, [workspace, submissions, debug, compact, flushCode]);

  /** Put a past attempt back in the editor, in the language it was written in. */
  const handleRestore = useCallback(
    (submission: Submission) => {
      debug.end();
      workspace.restoreCode(submission.code, submission.language);
      if (compact) setCompactTab('code');
    },
    [workspace, debug, compact],
  );

  const handleAnalyze = useCallback(() => {
    flushCode();
    analyze();
    reveal('complexity');
  }, [flushCode, analyze, reveal]);

  /** Load a problem's starter code and get out of the way. */
  const handleLoadProblem = useCallback(
    (problem: LeetProblem) => {
      debug.end();
      workspace.loadProblem(problem, 'starter');
      setProblemsOpen(false);
      if (compact) setCompactTab('code');
    },
    [workspace, debug, compact],
  );

  /** The reveal: the editor becomes the worked solution, ready to run. */
  const handleRevealSolution = useCallback(
    (problem: LeetProblem) => {
      debug.end();
      workspace.loadProblem(problem, 'solution');
      setProblemsOpen(false);
      if (compact) setCompactTab('code');
    },
    [workspace, debug, compact],
  );

  /** Jump from a recommendation to the template that teaches the technique. */
  const handleOpenTemplate = useCallback(
    (templateId: string) => {
      debug.end();
      workspace.selectTemplate(templateId);
      setProblemsOpen(false);
      if (compact) setCompactTab('code');
    },
    [workspace, debug, compact],
  );

  /*
   * A problem that has just been opened is what you want to read, so show it.
   * Leaving a problem behind for an ordinary template sends you back to the
   * parameters, since the Problem tab is disabled with nothing in it.
   */
  useEffect(() => {
    setBottomTab(workspace.problemSlug ? 'problem' : 'params');
  }, [workspace.problemSlug]);

  // An error is worth interrupting for — surface the log without being asked.
  useEffect(() => {
    if (status === 'error' && result?.error) reveal('output');
  }, [status, result, reveal]);

  // Global shortcuts. Monaco owns Cmd+Enter inside the editor; this covers the
  // rest of the app so Run works no matter where focus is.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        // Shift makes it a submission: the same gesture, one step further on.
        if (e.shiftKey) void handleSubmit();
        else handleRun();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPickerOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleRun, handleSubmit]);

  // --- The pieces, arranged differently per layout ---------------------------

  const editor = (
    <div className={styles.editorPane}>
      <ModeBadge
        mode={workspace.mode}
        compact={compact}
        hasInstrumented={workspace.hasInstrumented}
      />
      <Suspense
        fallback={<Skeleton active paragraph={{ rows: 10 }} className={styles.editorLoading} />}
      >
        <EditorPanel
          code={workspace.code}
          docVersion={workspace.docVersion}
          language={workspace.language}
          theme={theme}
          error={workspace.result?.error}
          compact={compact}
          activeLine={debug.active ? (debug.step?.line ?? null) : null}
          breakpoints={debug.breakpoints}
          scope={debug.active ? (debug.step?.scope ?? null) : null}
          onToggleBreakpoint={debug.toggleBreakpoint}
          onChange={workspace.setCode}
          onRun={handleRun}
          onSubmit={workspace.problem ? handleSubmit : undefined}
          resetKey={`${workspace.templateId}:${workspace.language}:${workspace.mode}`}
          registerGoToLine={registerGoToLine}
        />
      </Suspense>
    </div>
  );

  const inputs = (
    <ParamsPanel
      template={template}
      values={workspace.params}
      mode={workspace.mode}
      bound={workspace.boundParams}
      onChange={workspace.setParam}
      onReset={workspace.resetParams}
    />
  );

  /**
   * A function from the current file, for the benchmark example the Analyze tab
   * shows when nothing registered one. Falls back to `solve` when the file has
   * no named function to point at.
   */
  const benchFn = useMemo(
    () => listFunctions(workspace.code, workspace.language)[0]?.name,
    [workspace.code, workspace.language],
  );

  const countBadge = (text: string | number) => <span className={styles.badge}>{text}</span>;

  const problemPanel = (
    <ProblemPanel
      problem={workspace.problem}
      language={workspace.language}
      verdict={submissions.latest?.verdict ?? null}
      onReveal={handleRevealSolution}
      onResetToStarter={workspace.resetCode}
      onOpenTemplate={handleOpenTemplate}
      onFindProblem={openProblems}
    />
  );

  /**
   * Below the editor: the problem, and the parameters.
   *
   * A debug session takes the whole pane — the transport, the variables and the
   * call stack need the room, and neither tab is any use while paused.
   */
  const submissionsPanel = (
    <SubmissionsPanel
      problem={workspace.problem}
      items={submissions.items}
      loading={submissions.loading}
      judging={workspace.judging}
      onSubmit={handleSubmit}
      onRestore={handleRestore}
      onRemove={submissions.remove}
      onClear={submissions.clear}
      onFindProblem={openProblems}
    />
  );

  const params = debug.active ? (
    <DebugPanel debug={debug} onGoToLine={goToLine} onStop={debug.end} />
  ) : (
    <div className={styles.column}>
      <Tabs
        className={styles.tabs}
        activeKey={bottomTab}
        onChange={(key) => setBottomTab(key as BottomKey)}
        items={[
          {
            key: 'problem',
            // Nothing to show until a problem is open, and saying so is better
            // than an empty tab that looks broken.
            disabled: workspace.problem === null,
            label: (
              <span className={styles.tabLabel}>
                <TrophyOutlined />
                Problem
                {workspace.problem && countBadge(workspace.problem.number)}
              </span>
            ),
            children: problemPanel,
          },
          {
            key: 'submissions',
            // A problem is what makes a submission mean anything, so this is
            // greyed out with the Problem tab rather than on its own.
            disabled: workspace.problem === null,
            label: (
              <span className={styles.tabLabel}>
                <CloudUploadOutlined />
                Submissions
                {/* The last verdict, carried on the tab: whether this problem is
                    solved is worth knowing without opening anything. */}
                {submissions.latest && (
                  <VerdictDot
                    verdict={submissions.latest.verdict}
                    title={`Last submission: ${submissions.latest.verdict.replace('-', ' ')}`}
                  />
                )}
              </span>
            ),
            children: submissionsPanel,
          },
          {
            key: 'params',
            label: (
              <span className={styles.tabLabel}>
                <SlidersOutlined />
                Parameters
              </span>
            ),
            children: inputs,
          },
        ]}
      />
    </div>
  );

  const visualizer = (
    <VisualizerPanel
      frames={workspace.frames}
      status={workspace.status}
      compact={compact}
      pinnedFrame={debug.active ? debug.frameIndex : null}
      following={debug.active}
      onRun={handleRun}
    />
  );

  const output = (
    <OutputPanel
      logs={workspace.logs}
      result={workspace.result}
      status={workspace.status}
      detail={workspace.detail}
      onGoToLine={goToLine}
    />
  );

  const complexity = (
    <ComplexityPanel
      report={workspace.analysis}
      analyzing={workspace.analyzing}
      stale={workspace.analysisStale}
      detail={workspace.detail}
      template={template}
      language={workspace.language}
      benchFn={benchFn}
      onAnalyze={handleAnalyze}
    />
  );

  const panelStack = (
    <div className={styles.column}>
      <Tabs
        className={styles.tabs}
        activeKey={panel}
        onChange={(key) => setPanel(key as PanelKey)}
        items={[
          {
            key: 'visualize',
            label: (
              <span className={styles.tabLabel}>
                <PartitionOutlined />
                Visualize
                {workspace.frames.length > 0 && countBadge(workspace.frames.length)}
              </span>
            ),
            children: visualizer,
          },
          {
            key: 'output',
            label: (
              <span className={styles.tabLabel}>
                <CodeOutlined />
                Output
                {workspace.result?.error && <span className={styles.badgeError}>!</span>}
              </span>
            ),
            children: output,
          },
          {
            key: 'complexity',
            label: (
              <span className={styles.tabLabel}>
                <BarChartOutlined />
                Analyze
                {workspace.analysis?.empirical?.best &&
                  workspace.analysis.empirical.best !== 'unknown' &&
                  countBadge(workspace.analysis.empirical.best)}
              </span>
            ),
            children: complexity,
          },
        ]}
      />
    </div>
  );

  const editorWithParams = (
    <div className={styles.column}>
      <SplitPane
        direction="vertical"
        ratio={editorRatio}
        onRatioChange={setEditorRatio}
        min={35}
        max={92}
        first={editor}
        second={params}
      />
    </div>
  );

  const compactPanes: Record<CompactKey, ReactNode> = {
    code: editor,
    params,
    visualize: visualizer,
    output,
    complexity,
  };

  return (
    <ConfigProvider theme={antdConfig}>
      <AntApp className={styles.antRoot}>
        <div className={styles.app} data-layout={layout.mode}>
          <Header
            template={template}
            language={workspace.language}
            mode={workspace.mode}
            status={workspace.status}
            analyzing={workspace.analyzing}
            isDirty={workspace.isDirty}
            hasInstrumented={workspace.hasInstrumented}
            theme={theme}
            layout={layout.mode}
            onOpenTemplates={() => setPickerOpen(true)}
            onOpenProblems={openProblems}
            onLanguage={workspace.setLanguage}
            onMode={workspace.setMode}
            onRun={handleRun}
            onSubmit={handleSubmit}
            canSubmit={workspace.problem !== null}
            judging={workspace.judging}
            onDebug={handleDebug}
            debugging={debug.active}
            onAnalyze={handleAnalyze}
            onCancel={workspace.cancel}
            onResetCode={workspace.resetCode}
            onTheme={setTheme}
          />

          <main className={styles.main}>
            {layout.mode === 'desktop' && (
              <SplitPane
                ratio={splitRatio}
                onRatioChange={setSplitRatio}
                min={25}
                max={75}
                first={editorWithParams}
                second={panelStack}
              />
            )}

            {/* Tablet portrait: narrow but tall, so split top-to-bottom. */}
            {layout.mode === 'stacked' && (
              <SplitPane
                direction="vertical"
                ratio={stackRatio}
                onRatioChange={setStackRatio}
                min={25}
                max={80}
                first={editorWithParams}
                second={panelStack}
              />
            )}

            {compact && (
              <div className={styles.compactPane} role="tabpanel" aria-label={compactTab}>
                {compactPanes[compactTab]}
              </div>
            )}
          </main>

          {compact ? (
            <nav className={styles.bottomBar} role="tablist" aria-label="Panels">
              {compactTabs(debug.active).map((tab) => {
                const active = compactTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={
                      active ? `${styles.bottomTab} ${styles.bottomTabActive}` : styles.bottomTab
                    }
                    onClick={() => {
                      setCompactTab(tab.key);
                      if (tab.key !== 'code' && tab.key !== 'params') setPanel(tab.key);
                    }}
                  >
                    <span className={styles.bottomIcon}>{tab.icon}</span>
                    <span className={styles.bottomLabel}>{tab.label}</span>
                    {tab.key === 'visualize' && workspace.frames.length > 0 && (
                      <span className={styles.bottomDot} />
                    )}
                    {tab.key === 'output' && workspace.result?.error && (
                      <span className={styles.bottomDotError} />
                    )}
                  </button>
                );
              })}
            </nav>
          ) : (
            <footer className={styles.footer}>
              <span className={styles.footerItem}>
                <ExperimentOutlined /> {template.blurb}
              </span>
              <span className={styles.spacer} />
              <span className={styles.footerHint}>
                {debug.active ? (
                  <>
                    debugging · <kbd>{debug.index + 1}</kbd> of <kbd>{debug.steps.length}</kbd>{' '}
                    steps · line <kbd>{debug.step?.line ?? '—'}</kbd>
                  </>
                ) : (
                  <>
                    <kbd>⌘</kbd>
                    <kbd>↵</kbd> run · <kbd>⌘</kbd>
                    <kbd>K</kbd> templates · <kbd>←</kbd>
                    <kbd>→</kbd> step
                  </>
                )}
              </span>
            </footer>
          )}

          <ProblemDrawer
            open={problemsOpen}
            currentSlug={workspace.problemSlug}
            solvedSlugs={submissions.solved}
            compact={compact}
            onClose={closeProblems}
            onLoad={handleLoadProblem}
            onOpenTemplate={handleOpenTemplate}
          />

          <TemplatePicker
            open={pickerOpen}
            currentId={workspace.templateId}
            compact={compact}
            onSelect={workspace.selectTemplate}
            onClose={() => setPickerOpen(false)}
          />
        </div>
      </AntApp>
    </ConfigProvider>
  );
}
