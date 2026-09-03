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
import { DebugToolbar } from './components/DebugToolbar';
import { BreakpointMenu, type BreakpointMenuTarget } from './components/BreakpointMenu';
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

type PanelKey = 'visualize' | 'output' | 'complexity';
type CompactKey = 'code' | 'params' | PanelKey;
type BottomKey = 'problem' | 'submissions' | 'params';

const EditorPanel = lazy(() =>
  import('./components/EditorPanel').then((m) => ({ default: m.EditorPanel })),
);

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

  const [breakpointMenu, setBreakpointMenu] = useState<BreakpointMenuTarget | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [problemsOpen, setProblemsOpen] = useState(false);
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
      if (compact) setCompactTab('code');
      goToLineRef.current?.(line);
    },
    [compact],
  );

  const { run, debugRun, analyze, status, result, flushCode, currentCode } = workspace;

  const reveal = useCallback(
    (key: PanelKey) => {
      setPanel(key);
      if (compact) setCompactTab(key);
    },
    [compact],
  );

  const handleRun = useCallback(() => {
    flushCode();
    debug.end();
    run();
    reveal('visualize');
  }, [flushCode, run, reveal, debug]);

  const handleDebug = useCallback(() => {
    flushCode();
    debug.end();
    reveal('visualize');
    void debugRun().then((steps) => {
      debug.begin(steps, listFunctions(currentCode(), workspace.language));
      if (compact) setCompactTab('params');
    });
  }, [debugRun, debug, reveal, compact, flushCode, currentCode, workspace.language]);

  const handleSubmit = useCallback(async () => {
    flushCode();
    debug.end();
    setBottomTab('submissions');
    if (compact) setCompactTab('params');

    const draft = await workspace.submit();
    if (draft) await submissions.record(draft);
  }, [workspace, submissions, debug, compact, flushCode]);

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

  const handleLoadProblem = useCallback(
    (problem: LeetProblem) => {
      debug.end();
      workspace.loadProblem(problem, 'starter');
      setProblemsOpen(false);
      if (compact) setCompactTab('code');
    },
    [workspace, debug, compact],
  );

  const handleRevealSolution = useCallback(
    (problem: LeetProblem) => {
      debug.end();
      workspace.loadProblem(problem, 'solution');
      setProblemsOpen(false);
      if (compact) setCompactTab('code');
    },
    [workspace, debug, compact],
  );

  const handleOpenTemplate = useCallback(
    (templateId: string) => {
      debug.end();
      workspace.selectTemplate(templateId);
      setProblemsOpen(false);
      if (compact) setCompactTab('code');
    },
    [workspace, debug, compact],
  );

  useEffect(() => {
    setBottomTab(workspace.problemSlug ? 'problem' : 'params');
  }, [workspace.problemSlug]);

  useEffect(() => {
    if (status === 'error' && result?.error) reveal('output');
  }, [status, result, reveal]);

  const openBreakpointMenu = useCallback((line: number, x: number, y: number) => {
    setBreakpointMenu({ line, x, y });
  }, []);

  const closeBreakpointMenu = useCallback(() => setBreakpointMenu(null), []);

  useEffect(() => {
    if (!debug.active) return;

    const onKey = (event: KeyboardEvent) => {
      const command = (() => {
        if (event.key === 'F5') return event.shiftKey ? 'stop' : 'continue';
        if (event.key === 'F10') return 'stepOver';
        if (event.key === 'F11') return event.shiftKey ? 'stepOut' : 'stepInto';
        return null;
      })();
      if (!command) return;

      event.preventDefault();
      if (command === 'stop') {
        debug.end();
        return;
      }
      if (command === 'continue' && (event.metaKey || event.ctrlKey)) {
        debug.run('restart');
        return;
      }
      debug.run(command);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [debug]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
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

  const editor = (
    <div className={styles.editorPane}>
      {}
      {debug.active && !compact && <DebugToolbar debug={debug} onStop={debug.end} />}
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
          onGutterContextMenu={openBreakpointMenu}
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
      language={workspace.language}
      code={workspace.code}
      bound={workspace.boundParams}
      onChange={workspace.setParam}
      onReset={workspace.resetParams}
    />
  );

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
    <DebugPanel debug={debug} onGoToLine={goToLine} onStop={debug.end} compact={compact} />
  ) : (
    <div className={styles.column}>
      <Tabs
        className={styles.tabs}
        activeKey={bottomTab}
        onChange={(key) => setBottomTab(key as BottomKey)}
        items={[
          {
            key: 'problem',
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

          {breakpointMenu && (
            <BreakpointMenu
              target={breakpointMenu}
              breakpoint={debug.breakpoints.get(breakpointMenu.line)}
              onToggleEnabled={debug.setBreakpointEnabled}
              onSetCondition={debug.setBreakpointCondition}
              onRemove={debug.removeBreakpoint}
              onClose={closeBreakpointMenu}
            />
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
