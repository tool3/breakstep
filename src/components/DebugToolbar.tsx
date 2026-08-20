import { Button, Tooltip } from 'antd';
import { CODICON, CodeIcon } from './CodeIcon';
import type { DebuggerState } from '@/hooks/useDebugger';
import styles from './DebugToolbar.module.scss';

interface Props {
  debug: DebuggerState;
  onStop: () => void;
  /**
   * `floating` overlays the editor, which is where these controls belong.
   * `inline` is for a phone, where the editor and the panel are separate tabs
   * and a bar floating over a hidden editor would strand the session.
   */
  variant?: 'floating' | 'inline';
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const shift = isMac ? '⇧' : 'Shift+';

/**
 * The transport, floating over the editor.
 *
 * Where VS Code puts it, and for the reason VS Code puts it there: these
 * buttons act on a specific line, so they belong next to the line rather than in
 * a panel at the other end of the screen. Keyboard equivalents are in the
 * tooltips because that is how anyone learns them — and they are the same keys,
 * so nobody has to.
 *
 * Step back has no VS Code equivalent to be consistent with. It sits first,
 * where the recording makes it possible and a live debugger cannot follow.
 */
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
