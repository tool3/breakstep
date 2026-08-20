import { useMemo, useState } from 'react';
import { Button, Empty, Input, Slider, Switch, Tooltip } from 'antd';
import {
  CloseOutlined,
  DownOutlined,
  PlusOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { DebugToolbar } from './DebugToolbar';
import { formatValue, formatFull } from './visualizers/format';
import type { DebuggerState } from '@/hooks/useDebugger';
import styles from './DebugPanel.module.scss';

interface Props {
  debug: DebuggerState;
  /** Jump the editor to a line — used by the call stack and the breakpoint list. */
  onGoToLine: (line: number) => void;
  onStop: () => void;
  /**
   * Phone-sized. The floating toolbar lives over the editor, which is a
   * different tab there, so the panel carries its own copy.
   */
  compact?: boolean;
}

/** Order scope entries so the things that change sit at the top. */
function orderScope(scope: Record<string, unknown>): [string, unknown][] {
  const entries = Object.entries(scope).filter(([name]) => name !== 'this');
  const rank = (value: unknown) => {
    if (value === null || typeof value !== 'object') return 0; // scalars first
    if (Array.isArray(value)) return 1;
    return 2;
  };
  return entries.sort((a, b) => rank(a[1]) - rank(b[1]) || a[0].localeCompare(b[0]));
}

/**
 * One collapsible section, as the debug sidebar is built everywhere else.
 *
 * Open by default and remembered per section while the session lasts, because
 * which of these you care about depends entirely on what you are chasing.
 */
function Section({
  title,
  count,
  actions,
  children,
}: {
  title: string;
  count?: number | string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <section className={styles.section} data-open={open}>
      <div className={styles.sectionHead}>
        <button
          type="button"
          className={styles.sectionToggle}
          onClick={() => setOpen((was) => !was)}
          aria-expanded={open}
        >
          <span className={styles.chevron}>{open ? <DownOutlined /> : <RightOutlined />}</span>
          <span className={styles.sectionTitle}>{title}</span>
          {count !== undefined && count !== 0 && <span className={styles.count}>{count}</span>}
        </button>
        {actions && <span className={styles.sectionActions}>{actions}</span>}
      </div>
      {open && <div className={styles.sectionBody}>{children}</div>}
    </section>
  );
}

export function DebugPanel({ debug, onGoToLine, onStop, compact }: Props) {
  const { step, steps, index, functions, breakpoints, outcome } = debug;
  const [watchDraft, setWatchDraft] = useState('');

  const scope = useMemo(() => (step ? orderScope(step.scope) : []), [step]);
  const lines = useMemo(
    () => [...breakpoints.values()].sort((a, b) => a.line - b.line),
    [breakpoints],
  );

  if (!debug.active) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Press Debug to record a run, then step through it here."
          />
        </div>
      </div>
    );
  }

  const completed = outcome === 'completed';

  return (
    <div className={styles.panel}>
      {compact && <DebugToolbar debug={debug} onStop={onStop} variant="inline" />}

      {/* --- Where the session is ------------------------------------- */}
      <div className={styles.status} data-outcome={outcome}>
        <span className={styles.statusDot} />
        <button
          type="button"
          className={styles.statusText}
          onClick={() => step && onGoToLine(step.line)}
        >
          {completed ? (
            <>
              Ran to completion
              <span className={styles.statusHint}>
                {breakpoints.size === 0 && debug.breakFunctions.size === 0
                  ? 'no breakpoints were set — click the gutter to add one, then Restart'
                  : 'nothing else was hit — step back through it, or Restart'}
              </span>
            </>
          ) : (
            <>
              Paused on line {step?.line ?? '—'}
              <span className={styles.statusHint}>
                {step?.kind}
                {step?.fn ? ` · ${step.fn}` : ''}
              </span>
            </>
          )}
        </button>

        <Tooltip title="Stop on every recorded step instead of running to a breakpoint">
          <label className={styles.everyLine}>
            <Switch
              size="small"
              checked={debug.stepEveryLine}
              onChange={(checked) => debug.setStepEveryLine(checked)}
              aria-label="Show every line"
            />
            every line
          </label>
        </Tooltip>

      </div>

      {/* --- The recording, scrubbable ------------------------------- */}
      <div className={styles.timeline}>
        <Slider
          min={0}
          max={Math.max(steps.length - 1, 0)}
          value={index}
          onChange={debug.seek}
          tooltip={{ open: false }}
          aria-label="Position in the recording"
        />
        <span className={styles.counter}>
          {index + 1} / {steps.length}
        </span>
      </div>

      <div className={styles.scroll}>
        {/* --- Variables ------------------------------------------- */}
        <Section title="Variables" count={scope.length}>
          {scope.length === 0 ? (
            <p className={styles.none}>Nothing in scope here.</p>
          ) : (
            <ul className={styles.scope}>
              {scope.map(([name, value]) => (
                <li key={name} className={styles.scopeRow}>
                  <span className={styles.scopeName}>{name}</span>
                  <span className={styles.scopeValue} title={formatFull(value)}>
                    {formatValue(value, 80)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* --- Watch ------------------------------------------------ */}
        <Section title="Watch" count={debug.watch.length}>
          <form
            className={styles.watchAdd}
            onSubmit={(event) => {
              event.preventDefault();
              debug.addWatch(watchDraft);
              setWatchDraft('');
            }}
          >
            <Input
              size="small"
              value={watchDraft}
              onChange={(event) => setWatchDraft(event.target.value)}
              placeholder="node.next.val"
              aria-label="Add a watch expression"
            />
            <Button
              size="small"
              type="text"
              icon={<PlusOutlined />}
              htmlType="submit"
              aria-label="Add watch expression"
            />
          </form>

          {debug.watch.length === 0 ? (
            <p className={styles.none}>
              Nothing watched. Expressions are answered against the scope recorded at wherever the
              cursor is, so a path like <code>node.next.val</code> works and a function call does
              not.
            </p>
          ) : (
            <ul className={styles.scope}>
              {debug.watch.map((expression) => {
                const result = debug.evaluate(expression);
                return (
                  <li key={expression} className={styles.scopeRow}>
                    <span className={styles.scopeName}>{expression}</span>
                    <span
                      className={result.error ? styles.scopeError : styles.scopeValue}
                      title={result.error ?? formatFull(result.value)}
                    >
                      {result.error ?? formatValue(result.value, 80)}
                    </span>
                    <button
                      type="button"
                      className={styles.rowRemove}
                      onClick={() => debug.removeWatch(expression)}
                      aria-label={`Stop watching ${expression}`}
                    >
                      <CloseOutlined />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* --- Call stack ------------------------------------------ */}
        <Section title="Call stack" count={step?.stack.length ?? 0}>
          {!step || step.stack.length === 0 ? (
            <p className={styles.none}>Top level — nothing on the stack.</p>
          ) : (
            <ul className={styles.stack}>
              {[...step.stack].reverse().map((frame, i) => (
                <li key={`${frame.label}-${i}`} className={styles.stackRow} data-top={i === 0}>
                  <span className={styles.stackDepth}>#{frame.depth}</span>
                  <code>{frame.label}</code>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* --- Breakpoints ----------------------------------------- */}
        <Section
          title="Breakpoints"
          count={lines.length + debug.breakFunctions.size}
          actions={
            lines.length > 0 && (
              <button type="button" className={styles.bulkButton} onClick={debug.clearBreakpoints}>
                clear
              </button>
            )
          }
        >
          {lines.length === 0 && functions.length === 0 ? (
            <p className={styles.none}>Click the gutter beside a line to break there.</p>
          ) : null}

          {lines.length > 0 && (
            <ul className={styles.breakList}>
              {lines.map((breakpoint) => (
                <li key={breakpoint.line} className={styles.breakRow}>
                  <input
                    type="checkbox"
                    checked={breakpoint.enabled}
                    onChange={(event) =>
                      debug.setBreakpointEnabled(breakpoint.line, event.target.checked)
                    }
                    aria-label={`Breakpoint on line ${breakpoint.line} enabled`}
                  />
                  <button
                    type="button"
                    className={styles.breakWhere}
                    onClick={() => onGoToLine(breakpoint.line)}
                  >
                    <code>line {breakpoint.line}</code>
                    {breakpoint.condition && (
                      <span className={styles.condition}>when {breakpoint.condition}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    className={styles.rowRemove}
                    onClick={() => debug.removeBreakpoint(breakpoint.line)}
                    aria-label={`Remove the breakpoint on line ${breakpoint.line}`}
                  >
                    <CloseOutlined />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {functions.length > 0 && (
            <>
              <p className={styles.subhead}>On entry to</p>
              <ul className={styles.breakList}>
                {functions.map((fn) => (
                  <li key={fn.qualified} className={styles.breakRow}>
                    <input
                      type="checkbox"
                      checked={debug.breakFunctions.has(fn.qualified)}
                      onChange={() => debug.toggleFunction(fn.qualified)}
                      aria-label={`Break on entry to ${fn.qualified}`}
                    />
                    <button
                      type="button"
                      className={styles.breakWhere}
                      onClick={() => onGoToLine(fn.line)}
                    >
                      <code>{fn.qualified}</code>
                      <span className={styles.condition}>line {fn.line}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>
      </div>
    </div>
  );
}
