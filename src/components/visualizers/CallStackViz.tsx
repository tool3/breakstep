import { memo } from 'react';
import type { CallStackView } from '@/types/viz';
import { stateClass } from './Cell';
import styles from './viz.module.scss';

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
      {}
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
