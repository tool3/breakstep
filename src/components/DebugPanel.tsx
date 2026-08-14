import { useMemo } from 'react';
import { Button, Empty, Slider, Switch, Tooltip } from 'antd';
import {
  CaretRightOutlined,
  CloseOutlined,
  DownloadOutlined,
  LoginOutlined,
  LogoutOutlined,
  PauseOutlined,
  StepBackwardOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { formatValue, formatFull } from './visualizers/format';
import type { DebuggerState } from '@/hooks/useDebugger';
import styles from './DebugPanel.module.scss';

interface Props {
  debug: DebuggerState;
  /** Jump the editor to a line — used by the call stack and function list. */
  onGoToLine: (line: number) => void;
  onStop: () => void;
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

export function DebugPanel({ debug, onGoToLine, onStop }: Props) {
  const { step, steps, index, functions } = debug;

  const scope = useMemo(() => (step ? orderScope(step.scope) : []), [step]);
  const atEnd = index >= steps.length - 1;

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

  return (
    <div className={styles.panel}>
      {/* --- Transport ------------------------------------------------- */}
      <div className={styles.controls}>
        <Tooltip title="Step back — the recording runs both ways">
          <Button
            size="small"
            icon={<StepBackwardOutlined />}
            onClick={() => debug.run('stepBack')}
            disabled={index === 0}
            aria-label="Step back"
          />
        </Tooltip>

        <Tooltip title={debug.playing ? 'Pause' : 'Play until the next breakpoint'}>
          <Button
            size="small"
            type="primary"
            icon={debug.playing ? <PauseOutlined /> : <CaretRightOutlined />}
            onClick={() => (debug.playing ? debug.pause() : debug.play())}
            disabled={atEnd}
            aria-label={debug.playing ? 'Pause' : 'Play'}
          />
        </Tooltip>

        <Tooltip title="Step over — run any call to completion">
          <Button
            size="small"
            icon={<DownloadOutlined rotate={-90} />}
            onClick={() => debug.run('stepOver')}
            disabled={atEnd}
            aria-label="Step over"
          />
        </Tooltip>

        <Tooltip title="Step into — one step, entering calls">
          <Button
            size="small"
            icon={<LoginOutlined />}
            onClick={() => debug.run('stepInto')}
            disabled={atEnd}
            aria-label="Step into"
          />
        </Tooltip>

        <Tooltip title="Step out — finish this function">
          <Button
            size="small"
            icon={<LogoutOutlined />}
            onClick={() => debug.run('stepOut')}
            disabled={atEnd}
            aria-label="Step out"
          />
        </Tooltip>

        <Tooltip title="Continue to the next breakpoint">
          <Button size="small" onClick={() => debug.run('continue')} disabled={atEnd}>
            Continue
          </Button>
        </Tooltip>

        <Tooltip title="Back to the first step">
          <Button
            size="small"
            icon={<UndoOutlined />}
            onClick={() => debug.run('restart')}
            aria-label="Restart"
          />
        </Tooltip>

        <span className={styles.spacer} />

        <Tooltip title="Leave the debugger">
          <Button size="small" type="text" icon={<CloseOutlined />} onClick={onStop} aria-label="Stop debugging" />
        </Tooltip>
      </div>

      <div className={styles.timeline}>
        <Slider
          min={0}
          max={Math.max(steps.length - 1, 0)}
          value={index}
          onChange={debug.seek}
          tooltip={{ formatter: (v) => `line ${steps[v ?? 0]?.line ?? '?'}` }}
          aria-label="Recorded steps"
        />
        <span className={styles.counter}>
          {index + 1} / {steps.length}
        </span>
      </div>

      <div className={styles.scroll}>
        {/* --- Where we are ------------------------------------------- */}
        <section className={styles.section}>
          <h3 className={styles.heading}>Position</h3>
          <button type="button" className={styles.position} onClick={() => step && onGoToLine(step.line)}>
            <span className={styles.kindTag} data-kind={step?.kind}>
              {step?.kind}
            </span>
            <span className={styles.positionText}>
              {step?.fn ? <code>{step.fn}</code> : <em>top level</em>} · line {step?.line}
            </span>
          </button>
        </section>

        {/* --- Variables ---------------------------------------------- */}
        <section className={styles.section}>
          <h3 className={styles.heading}>Variables</h3>
          {scope.length === 0 ? (
            <p className={styles.none}>Nothing in scope here.</p>
          ) : (
            <ul className={styles.scope}>
              {scope.map(([name, value]) => (
                <li key={name} className={styles.scopeRow}>
                  <span className={styles.scopeName}>{name}</span>
                  <span className={styles.scopeValue} title={formatFull(value)}>
                    {formatValue(value, 40)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* --- Call stack --------------------------------------------- */}
        <section className={styles.section}>
          <h3 className={styles.heading}>Call stack</h3>
          {!step || step.stack.length === 0 ? (
            <p className={styles.none}>Top level — nothing on the stack.</p>
          ) : (
            <ul className={styles.stack}>
              {[...step.stack].reverse().map((frame, i) => (
                <li key={`${frame.label}-${i}`} className={styles.stackRow}>
                  <span className={styles.stackDepth}>#{frame.depth}</span>
                  <code>{frame.label}</code>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* --- Per-function switches ---------------------------------- */}
        <section className={styles.section}>
          <div className={styles.headingRow}>
            <h3 className={styles.heading}>Break on entry</h3>
            <span className={styles.bulk}>
              <button type="button" onClick={() => debug.setAllFunctions(true)}>
                all
              </button>
              <button type="button" onClick={() => debug.setAllFunctions(false)}>
                none
              </button>
            </span>
          </div>

          <p className={styles.hint}>
            A function with its switch off is stepped straight through — the picture keeps moving
            and the debugger does not stop.
          </p>

          {functions.length === 0 ? (
            <p className={styles.none}>No named functions in this file.</p>
          ) : (
            <ul className={styles.functions}>
              {functions.map((fn) => (
                <li key={fn.qualified} className={styles.functionRow}>
                  <Switch
                    size="small"
                    checked={debug.breakFunctions.has(fn.qualified)}
                    onChange={() => debug.toggleFunction(fn.qualified)}
                    aria-label={`Break on entry to ${fn.qualified}`}
                  />
                  <button type="button" className={styles.functionName} onClick={() => onGoToLine(fn.line)}>
                    <code>{fn.qualified}</code>
                    <span className={styles.functionLine}>line {fn.line}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* --- Line breakpoints --------------------------------------- */}
        {debug.breakpoints.size > 0 && (
          <section className={styles.section}>
            <div className={styles.headingRow}>
              <h3 className={styles.heading}>Breakpoints</h3>
              <span className={styles.bulk}>
                <button type="button" onClick={debug.clearBreakpoints}>
                  clear
                </button>
              </span>
            </div>
            <ul className={styles.functions}>
              {[...debug.breakpoints]
                .sort((a, b) => a - b)
                .map((line) => (
                  <li key={line} className={styles.functionRow}>
                    <span className={styles.breakDot} />
                    <button type="button" className={styles.functionName} onClick={() => onGoToLine(line)}>
                      <code>line {line}</code>
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
