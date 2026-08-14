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
  ExperimentOutlined,
  PartitionOutlined,
  SlidersOutlined,
} from '@ant-design/icons';
import { Header, ModeBadge } from './components/Header';
import { ParamsPanel } from './components/ParamsPanel';
import { OutputPanel } from './components/OutputPanel';
import { VisualizerPanel } from './components/VisualizerPanel';
import { ComplexityPanel } from './components/ComplexityPanel';
import { TemplatePicker } from './components/TemplatePicker';
import { SplitPane } from './components/SplitPane';
import { useWorkspace } from './hooks/useWorkspace';
import { useTheme } from './hooks/useTheme';
import { useLayout } from './hooks/useLayout';
import { useLocalStorage } from './hooks/useLocalStorage';
import styles from './App.module.scss';

/** Panels the right-hand side (or the phone tab bar) can show. */
type PanelKey = 'visualize' | 'output' | 'complexity';
/** On a phone the editor and parameters join the same tab strip. */
type CompactKey = 'code' | 'params' | PanelKey;

// Monaco is by far the largest dependency. Splitting it out means the shell,
// the visualizers and the analysis panels paint before it arrives.
const EditorPanel = lazy(() =>
  import('./components/EditorPanel').then((m) => ({ default: m.EditorPanel })),
);

/** antd tokens mapped onto the BCS palette so the two never drift apart. */
function useAntdTheme(isDark: boolean, coarsePointer: boolean) {
  return useMemo(
    () => ({
      algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      token: {
        colorPrimary: isDark ? '#5b8cff' : '#2f6bea',
        colorSuccess: isDark ? '#39d3a0' : '#0f9d6f',
        colorWarning: isDark ? '#f0a13a' : '#c47c14',
        colorError: isDark ? '#f2555a' : '#d13b41',
        colorBgBase: isDark ? '#0b0e14' : '#f6f7f9',
        colorBgContainer: isDark ? '#11151d' : '#ffffff',
        colorBgElevated: isDark ? '#1a2029' : '#ffffff',
        colorBorder: isDark ? '#222834' : '#e0e4ea',
        colorBorderSecondary: isDark ? '#1b202a' : '#eceef2',
        colorText: isDark ? '#d8dee9' : '#1c2430',
        colorTextSecondary: isDark ? '#98a2b3' : '#5a6675',
        colorTextTertiary: isDark ? '#626d80' : '#8b95a5',
        borderRadius: 6,
        fontSize: 13,
        // Touch devices get taller controls everywhere antd renders one.
        controlHeight: coarsePointer ? 38 : 30,
        controlHeightSM: coarsePointer ? 32 : 24,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, 'Helvetica Neue', sans-serif",
      },
      components: {
        Segmented: { itemSelectedBg: isDark ? '#1f2938' : '#e8effd' },
        Tabs: { horizontalItemPadding: '9px 14px', cardPadding: '6px 12px' },
        Button: { paddingInline: 12 },
        Slider: {
          railSize: coarsePointer ? 5 : 3,
          handleSize: coarsePointer ? 14 : 10,
          handleSizeHover: coarsePointer ? 16 : 12,
        },
      },
    }),
    [isDark, coarsePointer],
  );
}

const COMPACT_TABS: { key: CompactKey; label: string; icon: ReactNode }[] = [
  { key: 'code', label: 'Code', icon: <CodeOutlined /> },
  { key: 'params', label: 'Inputs', icon: <SlidersOutlined /> },
  { key: 'visualize', label: 'Visual', icon: <PartitionOutlined /> },
  { key: 'output', label: 'Output', icon: <ExperimentOutlined /> },
  { key: 'complexity', label: 'Analyze', icon: <BarChartOutlined /> },
];

export default function App() {
  const workspace = useWorkspace();
  const { theme, setTheme, isDark } = useTheme();
  const layout = useLayout();
  const antdConfig = useAntdTheme(isDark, layout.coarsePointer);

  const [pickerOpen, setPickerOpen] = useState(false);
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

  const { run, analyze, status, result } = workspace;

  /** Show a panel, wherever that panel currently lives. */
  const reveal = useCallback(
    (key: PanelKey) => {
      setPanel(key);
      if (compact) setCompactTab(key);
    },
    [compact],
  );

  const handleRun = useCallback(() => {
    run();
    reveal('visualize');
  }, [run, reveal]);

  const handleAnalyze = useCallback(() => {
    analyze();
    reveal('complexity');
  }, [analyze, reveal]);

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
        handleRun();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPickerOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleRun]);

  // --- The pieces, arranged differently per layout ---------------------------

  const editor = (
    <div className={styles.editorPane}>
      <ModeBadge mode={workspace.mode} compact={compact} />
      <Suspense
        fallback={<Skeleton active paragraph={{ rows: 10 }} className={styles.editorLoading} />}
      >
        <EditorPanel
          code={workspace.code}
          language={workspace.language}
          theme={theme}
          error={workspace.result?.error}
          compact={compact}
          onChange={workspace.setCode}
          onRun={handleRun}
          registerGoToLine={registerGoToLine}
        />
      </Suspense>
    </div>
  );

  const params = (
    <ParamsPanel
      template={template}
      values={workspace.params}
      mode={workspace.mode}
      bound={workspace.boundParams}
      onChange={workspace.setParam}
      onReset={workspace.resetParams}
    />
  );

  const visualizer = (
    <VisualizerPanel
      frames={workspace.frames}
      status={workspace.status}
      compact={compact}
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
      onAnalyze={handleAnalyze}
    />
  );

  const countBadge = (text: string | number) => <span className={styles.badge}>{text}</span>;

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
            theme={theme}
            layout={layout.mode}
            onOpenTemplates={() => setPickerOpen(true)}
            onLanguage={workspace.setLanguage}
            onMode={workspace.setMode}
            onRun={handleRun}
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
              {COMPACT_TABS.map((tab) => {
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
                <kbd>⌘</kbd>
                <kbd>↵</kbd> run · <kbd>⌘</kbd>
                <kbd>K</kbd> templates · <kbd>←</kbd>
                <kbd>→</kbd> step
              </span>
            </footer>
          )}

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
