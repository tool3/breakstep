import { memo } from 'react';
import type { ArrayView } from '@/types/viz';
import { Cell } from './Cell';
import styles from './viz.module.scss';

/**
 * Arrays, stacks, queues and deques all render from this one view.
 *
 * A stack is drawn as a vertical column with the top at the top; a queue keeps
 * the horizontal axis but labels the ends, because "which end do I take from"
 * is the only thing that distinguishes them.
 */
export const ArrayViz = memo(function ArrayViz({ view }: { view: ArrayView }) {
  const { items, pointers, variant = 'array', showIndices } = view;
  const isStack = variant === 'stack';

  if (items.length === 0) {
    return (
      <div className={styles.canvas}>
        <span className={styles.caption}>{variant} · empty</span>
      </div>
    );
  }

  if (isStack) {
    return (
      <div className={styles.canvas}>
        <span className={styles.caption}>top of stack</span>
        <div className={styles.column} role="grid" aria-label="Stack contents, top first">
          {items.map((cell, i) => (
            <Cell key={i} value={cell.value} state={cell.state} note={cell.note} index={i} />
          ))}
        </div>
        <span className={styles.caption}>bottom</span>
      </div>
    );
  }

  const pointersAt = new Map<number, string[]>();
  for (const p of pointers ?? []) {
    if (!pointersAt.has(p.index)) pointersAt.set(p.index, []);
    pointersAt.get(p.index)!.push(p.name);
  }

  return (
    <div className={styles.canvas}>
      {variant === 'queue' && <span className={styles.caption}>front → back</span>}
      <div className={styles.scrollArea}>
        <div className={styles.row} role="grid" aria-label={`${variant} of ${items.length} items`}>
          {items.map((cell, i) => (
            <div key={i} className={styles.slot}>
              <div className={styles.pointers}>
                {pointersAt.get(i)?.map((name) => (
                  <span key={name} className={styles.pointer}>
                    {name}
                  </span>
                ))}
              </div>
              <span className={styles.pointerArrow} aria-hidden="true">
                {pointersAt.has(i) ? '▼' : ' '}
              </span>
              <Cell
                value={cell.value}
                state={cell.state}
                note={cell.note}
                index={showIndices ? i : undefined}
              />
            </div>
          ))}
        </div>
      </div>
      {/* Pointers that ran off the end still need to be visible somewhere. */}
      {(pointers ?? []).some((p) => p.index < 0 || p.index >= items.length) && (
        <div className={styles.pointers}>
          {(pointers ?? [])
            .filter((p) => p.index < 0 || p.index >= items.length)
            .map((p) => (
              <span key={p.name} className={styles.pointer}>
                {p.name} = {p.index} (out of range)
              </span>
            ))}
        </div>
      )}
    </div>
  );
});
