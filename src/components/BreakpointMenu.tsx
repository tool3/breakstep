import { useEffect, useRef, useState } from 'react';
import type { LineBreakpoint } from '@/types/debug';
import styles from './BreakpointMenu.module.scss';

export interface BreakpointMenuTarget {
  line: number;
  x: number;
  y: number;
}

interface Props {
  target: BreakpointMenuTarget;
  breakpoint?: LineBreakpoint;
  onToggleEnabled: (line: number, enabled: boolean) => void;
  onSetCondition: (line: number, condition?: string) => void;
  onRemove: (line: number) => void;
  onClose: () => void;
}

/**
 * The gutter's right-click menu, and the condition editor behind it.
 *
 * This is the one debugger affordance that cannot be a keyboard shortcut or a
 * list row: adding a condition is something you do *at a line*, so it has to
 * open where you clicked. Conditions are cheap here for a reason worth stating —
 * the run is already recorded, so a condition is answered against the scope
 * captured at that step and can be written, edited or removed long after the
 * program finished.
 */
export function BreakpointMenu({
  target,
  breakpoint,
  onToggleEnabled,
  onSetCondition,
  onRemove,
  onClose,
}: Props) {
  const [editing, setEditing] = useState(breakpoint?.condition !== undefined);
  const [draft, setDraft] = useState(breakpoint?.condition ?? '');
  const box = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);

  // Dismiss the way every context menu does: a click elsewhere, or Escape.
  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (editing) field.current?.focus();
  }, [editing]);

  const commit = () => {
    onSetCondition(target.line, draft);
    onClose();
  };

  return (
    <div
      ref={box}
      className={styles.menu}
      // Kept inside the viewport: a right-click near the bottom would otherwise
      // open a menu you cannot reach the end of.
      style={{ left: target.x, top: Math.min(target.y, window.innerHeight - 150) }}
      role="menu"
      aria-label={`Breakpoint on line ${target.line}`}
    >
      <div className={styles.head}>line {target.line}</div>

      {editing ? (
        <form
          className={styles.editor}
          onSubmit={(event) => {
            event.preventDefault();
            commit();
          }}
        >
          <label className={styles.label} htmlFor="breakpoint-condition">
            Break when
          </label>
          <input
            id="breakpoint-condition"
            ref={field}
            className={styles.input}
            value={draft}
            placeholder="lo > 4"
            onChange={(event) => setDraft(event.target.value)}
            spellCheck={false}
          />
          <p className={styles.hint}>
            Answered against the variables recorded at that line, every time it is reached.
          </p>
          <div className={styles.actions}>
            <button type="submit" className={styles.confirm}>
              {draft.trim() ? 'Set condition' : 'Make unconditional'}
            </button>
          </div>
        </form>
      ) : (
        <ul className={styles.items}>
          <li>
            <button type="button" onClick={() => setEditing(true)}>
              {breakpoint?.condition ? 'Edit condition…' : 'Add condition…'}
            </button>
          </li>
          {breakpoint && (
            <li>
              <button
                type="button"
                onClick={() => {
                  onToggleEnabled(target.line, !breakpoint.enabled);
                  onClose();
                }}
              >
                {breakpoint.enabled ? 'Disable breakpoint' : 'Enable breakpoint'}
              </button>
            </li>
          )}
          {breakpoint && (
            <li>
              <button
                type="button"
                className={styles.destructive}
                onClick={() => {
                  onRemove(target.line);
                  onClose();
                }}
              >
                Remove breakpoint
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
