import { Button, Dropdown, Segmented, Tooltip, type MenuProps } from 'antd';
import {
  AppstoreOutlined,
  BgColorsOutlined,
  CaretRightOutlined,
  CheckOutlined,
  CodeOutlined,
  ExperimentOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  GithubOutlined,
  LoadingOutlined,
  MoreOutlined,
  StopOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { LANGUAGES, type EditorMode, type Language, type RunStatus, type Template } from '@/types';
import { THEMES, type ThemeName } from '@/hooks/useTheme';
import type { LayoutMode } from '@/hooks/useLayout';
import styles from './Header.module.scss';

interface Props {
  template: Template;
  language: Language;
  mode: EditorMode;
  status: RunStatus;
  analyzing: boolean;
  isDirty: boolean;
  theme: ThemeName;
  layout: LayoutMode;
  onOpenTemplates: () => void;
  onLanguage: (language: Language) => void;
  onMode: (mode: EditorMode) => void;
  onRun: () => void;
  onAnalyze: () => void;
  onCancel: () => void;
  onResetCode: () => void;
  onTheme: (theme: ThemeName) => void;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const runShortcut = isMac ? '⌘↵' : 'Ctrl+Enter';

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
  theme,
  layout,
  onOpenTemplates,
  onLanguage,
  onMode,
  onRun,
  onAnalyze,
  onCancel,
  onResetCode,
  onTheme,
}: Props) {
  const busy = status === 'running' || status === 'preparing';
  const instrumented = mode === 'instrumented';
  const compact = layout === 'compact';

  const modeTooltip = instrumented
    ? 'Hide the BCS API and go back to plain code'
    : 'Show the BCS API calls that drive the visualizer';

  /**
   * Everything that does not fit on a phone lives here. Nothing is dropped —
   * the controls move rather than disappear, so no device loses a feature.
   */
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
      onClick: () => onMode(instrumented ? 'clean' : 'instrumented'),
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
        <span className={styles.logo} aria-hidden="true">
          <svg viewBox="0 0 32 32" width="24" height="24">
            <circle cx="9" cy="10" r="3" fill="var(--breakstep-accent)" />
            <circle cx="22" cy="9" r="3" fill="var(--breakstep-mint)" />
            <circle cx="10" cy="23" r="3" fill="var(--breakstep-amber)" />
            <circle cx="23" cy="22" r="3" fill="var(--breakstep-violet)" />
            <path
              d="M9 10 L22 9 M9 10 L10 23 M22 9 L23 22 M10 23 L23 22"
              stroke="var(--breakstep-border-strong)"
              strokeWidth="1.6"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </span>
        <span className={styles.wordmark}>BCS</span>
        <span className={styles.tagline}>Browser Code Studio</span>
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
              traced automatically. Revealing the BCS calls hands over full
              control — and switches auto-tracing off, since the code now drives
              the visualizer itself.
            */}
            <Tooltip title={modeTooltip}>
              <Button
                className={instrumented ? styles.modeOn : undefined}
                icon={instrumented ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                onClick={() => onMode(instrumented ? 'clean' : 'instrumented')}
                aria-label={instrumented ? 'Hide instrumentation' : 'Show instrumentation'}
                aria-pressed={instrumented}
              >
                <span className={styles.modeLabel}>
                  {instrumented ? 'Instrumented' : 'Plain code'}
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

            <Tooltip title="BCS is open source">
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

            <Tooltip title="Sweep input sizes and fit the growth curve">
              <Button
                icon={analyzing ? <LoadingOutlined /> : <ExperimentOutlined />}
                onClick={onAnalyze}
                disabled={busy || analyzing}
                // antd icons carry their own aria-label, which would otherwise
                // be prepended to every button's accessible name.
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
            <Button type="primary" icon={<CaretRightOutlined />} onClick={onRun} aria-label="Run">
              <span className={styles.runLabel}>Run</span>
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

/** Small badge above the editor explaining the current mode. */
export function ModeBadge({ mode, compact }: { mode: EditorMode; compact?: boolean }) {
  const clean = mode === 'clean';
  return (
    <span className={styles.badge} data-mode={mode}>
      <CodeOutlined />
      {compact
        ? clean
          ? 'Plain code — auto-traced'
          : 'Instrumented'
        : clean
          ? 'Plain code — BCS traces it automatically'
          : 'Instrumented — your breakstep.* calls drive the visualizer'}
    </span>
  );
}
