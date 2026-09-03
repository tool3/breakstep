import { Button, Tooltip } from 'antd';
import { CODICON, CodeIcon } from './CodeIcon';
import type { DebuggerState } from '@/hooks/useDebugger';
import styles from './DebugToolbar.module.scss';

interface Props {
  debug: DebuggerState;
  onStop: () => void;
  variant?: 'floating' | 'inline';
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const shift = isMac ? '⇧' : 'Shift+';

export function DebugToolbar({ debug, onStop, variant = 'floating' }: Props) {
  const { steps, index, outcome } = debug;
  const atEnd = index >= steps.length - 1;
  const atStart = index <= 0;

  return (
    <div
      className={variant === 'inline' ? `${styles.bar} ${styles.inline}` : styles.bar}
      role="toolbar"
      aria-label="Debug controls"
    >
      <Tooltip title="Step back — the recording runs both ways">
        <Button
          size="small"
          type="text"
          icon={<CodeIcon glyph={CODICON.stepBack} />}
          disabled={atStart}
          onClick={() => debug.run('stepBack')}
          aria-label="Step back"
        />
      </Tooltip>

      <span className={styles.divider} />

      {debug.playing ? (
        <Tooltip title="Pause">
          <Button
            size="small"
            type="text"
            icon={<CodeIcon glyph={CODICON.pause} />}
            onClick={debug.pause}
            aria-label="Pause"
          />
        </Tooltip>
      ) : (
        <Tooltip title={`Continue to the next breakpoint (F5)`}>
          <Button
            size="small"
            type="text"
            className={styles.primary}
            icon={<CodeIcon glyph={CODICON.continue} size={18} />}
            disabled={atEnd}
            onClick={() => debug.run('continue')}
            aria-label="Continue"
          />
        </Tooltip>
      )}

      <Tooltip title="Step over — run any call to completion (F10)">
        <Button
          size="small"
          type="text"
          icon={<CodeIcon glyph={CODICON.stepOver} />}
          disabled={atEnd}
          onClick={() => debug.run('stepOver')}
          aria-label="Step over"
        />
      </Tooltip>

      <Tooltip title="Step into — one step, entering calls (F11)">
        <Button
          size="small"
          type="text"
          icon={<CodeIcon glyph={CODICON.stepInto} />}
          disabled={atEnd}
          onClick={() => debug.run('stepInto')}
          aria-label="Step into"
        />
      </Tooltip>

      <Tooltip title={`Step out — finish this function (${shift}F11)`}>
        <Button
          size="small"
          type="text"
          icon={<CodeIcon glyph={CODICON.stepOut} />}
          disabled={atEnd}
          onClick={() => debug.run('stepOut')}
          aria-label="Step out"
        />
      </Tooltip>

      <span className={styles.divider} />

      <Tooltip title="Restart — run again to the first breakpoint (⇧⌘F5)">
        <Button
          size="small"
          type="text"
          icon={<CodeIcon glyph={CODICON.restart} />}
          onClick={() => debug.run('restart')}
          aria-label="Restart"
        />
      </Tooltip>

      <Tooltip title={`Stop debugging (${shift}F5)`}>
        <Button
          size="small"
          type="text"
          className={styles.stop}
          icon={<CodeIcon glyph={CODICON.stop} />}
          onClick={onStop}
          aria-label="Stop debugging"
        />
      </Tooltip>

      {/* Where the session is, for when the panel is on another tab. */}
      <span className={styles.state} data-outcome={outcome}>
        {outcome === 'completed' ? 'ran to completion' : `line ${debug.step?.line ?? '—'}`}
      </span>
    </div>
  );
}
