import { Button, Dropdown, Segmented, Tooltip, type MenuProps } from 'antd';
import {
  AppstoreOutlined,
  BgColorsOutlined,
  BugOutlined,
  CaretRightOutlined,
  CheckOutlined,
  CloudUploadOutlined,
  CodeOutlined,
  ExperimentOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  GithubOutlined,
  LoadingOutlined,
  MoreOutlined,
  TrophyOutlined,
  StopOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { LANGUAGES, type EditorMode, type Language, type RunStatus, type Template } from '@/types';
import { THEMES, type ThemeName } from '@/hooks/useTheme';
import type { LayoutMode } from '@/hooks/useLayout';
import styles from './Header.module.scss';
import Logo from './svgs/logo';

interface Props {
  template: Template;
  language: Language;
  mode: EditorMode;
  status: RunStatus;
  analyzing: boolean;
  isDirty: boolean;
  hasInstrumented: boolean;
  theme: ThemeName;
  layout: LayoutMode;
  onOpenTemplates: () => void;
  onOpenProblems: () => void;
  onLanguage: (language: Language) => void;
  onMode: (mode: EditorMode) => void;
  onRun: () => void;
  onSubmit: () => void;
  canSubmit: boolean;
  judging: boolean;
  onDebug: () => void;
  debugging: boolean;
  onAnalyze: () => void;
  onCancel: () => void;
  onResetCode: () => void;
  onTheme: (theme: ThemeName) => void;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const runShortcut = isMac ? '⌘↵' : 'Ctrl+Enter';
const submitShortcut = isMac ? '⇧⌘↵' : 'Ctrl+Shift+Enter';

function themeMenuItems(theme: ThemeName, onTheme: (t: ThemeName) => void): MenuProps['items'] {
  return THEMES.map((t) => ({
    key: t.value,
    label: (
      <span className={styles.themeItem}>
        <span className={styles.themeSwatch} style={{ background: t.chrome }} />
        <span>
          <span className={styles.themeName}>{t.label}</span>
          <span className={styles.themeHint}>{t.hint}</span>
        </span>
        {t.value === theme && <CheckOutlined className={styles.themeCheck} />}
      </span>
    ),
    onClick: () => onTheme(t.value),
  }));
}

export function Header({
  template,
  language,
  mode,
  status,
  analyzing,
  isDirty,
  hasInstrumented,
  theme,
  layout,
  onOpenTemplates,
  onOpenProblems,
  onLanguage,
  onMode,
  onRun,
  onSubmit,
  canSubmit,
  judging,
  onDebug,
  debugging,
  onAnalyze,
  onCancel,
  onResetCode,
  onTheme,
}: Props) {
  const busy = status === 'running' || status === 'preparing';
  const instrumented = mode === 'instrumented';
  const compact = layout === 'compact';

  const modeTooltip = !hasInstrumented
    ? 'This one is plain code either way — a problem has no breakstep.* variant, and the run is auto-traced'
    : instrumented
      ? 'Hide the breakstep.* API and go back to plain code'
      : 'Show the breakstep.* API calls that drive the visualizer';

  const overflowItems: MenuProps['items'] = [
    {
      key: 'language',
      type: 'group',
      label: 'Language',
      children: LANGUAGES.map((l) => ({
        key: `lang-${l.value}`,
        label: (
          <span className={styles.menuRow}>
            {l.label}
            {l.value === language && <CheckOutlined className={styles.themeCheck} />}
          </span>
        ),
        onClick: () => onLanguage(l.value),
      })),
    },
    { type: 'divider' },
    {
      key: 'mode',
      icon: instrumented ? <EyeOutlined /> : <EyeInvisibleOutlined />,
      label: instrumented ? 'Hide instrumentation' : 'Show instrumentation',
      disabled: !hasInstrumented,
      onClick: () => onMode(instrumented ? 'clean' : 'instrumented'),
    },
    {
      key: 'problems',
      icon: <TrophyOutlined />,
      label: 'LeetCode problems',
      onClick: onOpenProblems,
    },
    ...(canSubmit
      ? [
          {
            key: 'submit',
            icon: judging ? <LoadingOutlined /> : <CloudUploadOutlined />,
            label: 'Submit for judging',
            disabled: busy || judging,
            onClick: onSubmit,
          },
        ]
      : []),
    {
      key: 'debug',
      icon: <BugOutlined />,
      label: debugging ? 'Re-record for the debugger' : 'Debug',
      disabled: busy,
      onClick: onDebug,
    },
    {
      key: 'analyze',
      icon: analyzing ? <LoadingOutlined /> : <ExperimentOutlined />,
      label: 'Analyze complexity',
      disabled: busy || analyzing,
      onClick: onAnalyze,
    },
    {
      key: 'reset',
      icon: <UndoOutlined />,
      label: 'Reset code',
      disabled: !isDirty,
      onClick: onResetCode,
    },
    { type: 'divider' },
    { key: 'theme', type: 'group', label: 'Theme', children: themeMenuItems(theme, onTheme) },
    { type: 'divider' },
    {
      key: 'source',
      icon: <GithubOutlined />,
      label: 'Source on GitHub',
      onClick: () => window.open('https://github.com', '_blank', 'noreferrer'),
    },
  ];

  return (
    <header className={styles.header} data-layout={layout}>
      <div className={styles.brand}>
        <Logo width={25} />
        <span className={styles.wordmark}>Breakstep</span>
        <span className={styles.tagline}>data structures, step by step</span>
      </div>

      <Button
        className={styles.templateButton}
        icon={<AppstoreOutlined />}
        onClick={onOpenTemplates}
        aria-label={`Template: ${template.title}. Choose another`}
      >
        <span className={styles.templateName}>{template.title}</span>
        {isDirty && (
          <Tooltip title="You have unsaved edits to this template">
            <span className={styles.dirtyDot} aria-label="edited" />
          </Tooltip>
        )}
      </Button>

      {!compact && (
        <Segmented<Language>
          className={styles.languages}
          value={language}
          onChange={onLanguage}
          options={LANGUAGES.map((l) => ({
            label: layout === 'stacked' ? l.label.slice(0, 2) : l.label,
            value: l.value,
          }))}
          aria-label="Language"
        />
      )}

      <div className={styles.spacer} />

      <div className={styles.actions}>
        {!compact && (
          <>
            {/*
              The instrumentation toggle. Clean is the default: ordinary CS code,
              traced automatically. Revealing the breakstep.* calls hands over full
              control — and switches auto-tracing off, since the code now drives
              the visualizer itself.
            */}
            <Tooltip title={modeTooltip}>
              <Button
                className={instrumented && hasInstrumented ? styles.modeOn : undefined}
                icon={instrumented && hasInstrumented ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                onClick={() => onMode(instrumented ? 'clean' : 'instrumented')}
                disabled={!hasInstrumented}
                aria-label={instrumented ? 'Hide instrumentation' : 'Show instrumentation'}
                aria-pressed={instrumented && hasInstrumented}
              >
                <span className={styles.modeLabel}>
                  {instrumented && hasInstrumented ? 'Instrumented' : 'Plain code'}
                </span>
              </Button>
            </Tooltip>

            <Tooltip title="Restore the original template code">
              <Button
                className={styles.iconOnly}
                type="text"
                icon={<UndoOutlined />}
                onClick={onResetCode}
                disabled={!isDirty}
                aria-label="Reset code"
              />
            </Tooltip>

            <Dropdown trigger={['click']} menu={{ selectedKeys: [theme], items: themeMenuItems(theme, onTheme) }}>
              <Button className={styles.iconOnly} type="text" icon={<BgColorsOutlined />} aria-label="Theme" />
            </Dropdown>

            <Tooltip title="Breakstep is open source">
              <Button
                className={styles.desktopOnly}
                type="text"
                icon={<GithubOutlined />}
                href="https://github.com"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Source"
              />
            </Tooltip>

            <Tooltip title="Paste a LeetCode link and get the technique, the dataset and a solution">
              <Button
                className={styles.problemsButton}
                icon={<TrophyOutlined />}
                onClick={onOpenProblems}
                aria-label="LeetCode problems"
              >
                <span className={styles.problemsLabel}>Problems</span>
              </Button>
            </Tooltip>

            <Tooltip title="Record a run and step through it line by line">
              <Button
                className={debugging ? styles.modeOn : undefined}
                icon={<BugOutlined />}
                onClick={onDebug}
                disabled={busy}
                aria-label="Debug"
                aria-pressed={debugging}
              >
                <span className={styles.analyzeLabel}>Debug</span>
              </Button>
            </Tooltip>

            <Tooltip title="Sweep input sizes and fit the growth curve">
              <Button
                icon={analyzing ? <LoadingOutlined /> : <ExperimentOutlined />}
                onClick={onAnalyze}
                disabled={busy || analyzing}
                aria-label="Analyze"
              >
                <span className={styles.analyzeLabel}>Analyze</span>
              </Button>
            </Tooltip>
          </>
        )}

        {busy ? (
          <Button danger icon={<StopOutlined />} onClick={onCancel} aria-label="Stop">
            <span className={styles.runLabel}>Stop</span>
          </Button>
        ) : (
          <Tooltip title={compact ? 'Run' : `Run (${runShortcut})`}>
            <Button
              type={canSubmit && !compact ? 'default' : 'primary'}
              icon={<CaretRightOutlined />}
              onClick={onRun}
              aria-label="Run"
            >
              <span className={styles.runLabel}>Run</span>
            </Button>
          </Tooltip>
        )}

        {/*
          Submit only exists for a problem, because only a problem has a right
          answer to be judged against. A permanently disabled button would be
          clutter on every template; this appears with the thing it acts on.
        */}
        {canSubmit && !compact && (
          <Tooltip title={`Run the published examples and record the verdict (${submitShortcut})`}>
            <Button
              className={styles.submitButton}
              type="primary"
              icon={judging ? <LoadingOutlined /> : <CloudUploadOutlined />}
              onClick={onSubmit}
              disabled={busy || judging}
              aria-label="Submit"
            >
              <span className={styles.runLabel}>{judging ? 'Judging' : 'Submit'}</span>
            </Button>
          </Tooltip>
        )}

        {compact && (
          <Dropdown trigger={['click']} menu={{ items: overflowItems }} placement="bottomRight">
            <Button className={styles.iconOnly} icon={<MoreOutlined />} aria-label="More options" />
          </Dropdown>
        )}
      </div>
    </header>
  );
}

export function ModeBadge({
  mode,
  compact,
  hasInstrumented = true,
}: {
  mode: EditorMode;
  compact?: boolean;
  hasInstrumented?: boolean;
}) {
  const clean = mode === 'clean' || !hasInstrumented;
  return (
    <span className={styles.badge} data-mode={clean ? 'clean' : mode}>
      <CodeOutlined />
      {compact
        ? clean
          ? 'Plain code — auto-traced'
          : 'Instrumented'
        : clean
          ? 'Plain code — Breakstep traces it automatically'
          : 'Instrumented — your breakstep.* calls drive the visualizer'}
    </span>
  );
}
