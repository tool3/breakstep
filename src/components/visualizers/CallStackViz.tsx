import { memo } from 'react';
import type { CallStackView } from '@/types/viz';
import { stateClass } from './Cell';
import styles from './viz.module.scss';

/**
 * The recursion call stack.
 *
 * Indented by depth, deepest frame on top — matching how a debugger shows it,
 * and making the "grow, hit the base case, unwind" rhythm of backtracking
 * visible as motion rather than as a wall of text.
 */
export const CallStackViz = memo(function CallStackViz({ view }: { view: CallStackView }) {
  const { entries } = view;

  if (entries.length === 0) {
    return (
      <div className={styles.canvas}>
        <span className={styles.caption}>call stack empty — nothing in flight</span>
      </div>
    );
  }

  const maxDepth = Math.max(...entries.map((e) => e.depth));

  return (
    <div className={styles.canvas}>
      <span className={styles.caption}>deepest frame first</span>
      {/* Left-aligned inside a fixed-width column so the depth indent reads as
          a staircase; centring each frame would just jitter them sideways. */}
      <div
        className={styles.stack}
        role="list"
        aria-label={`Call stack, ${entries.length} frames deep`}
      >
        {entries.map((entry, i) => (
          <div
            key={i}
            role="listitem"
            className={[styles.stackFrame, stateClass(entry.state)].filter(Boolean).join(' ')}
            style={{ marginLeft: Math.min(entry.depth, 12) * 10 }}
          >
            <span className={styles.stackDepth}>#{entry.depth}</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {entry.label}
            </span>
            {entry.returnValue !== undefined && (
              <span className={styles.entrySep}>→ {String(entry.returnValue)}</span>
            )}
          </div>
        ))}
      </div>
      <span className={styles.caption}>
        depth {entries.length} · max depth reached {maxDepth + 1}
      </span>
    </div>
  );
});
