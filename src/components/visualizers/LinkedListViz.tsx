import { memo, type ReactNode } from 'react';
import type { LinkedListView } from '@/types/viz';
import { Cell } from './Cell';
import styles from './viz.module.scss';

/**
 * Singly and doubly linked lists.
 *
 * The interesting case is a cycle: the normalizer stops traversal and flags it,
 * and here the final connector becomes a labelled loop-back rather than a
 * terminator, so Floyd's algorithm has something real to point at.
 */
/**
 * Anything sitting on the same line as the nodes: the connectors, and the
 * `head` and `null` captions at the ends.
 *
 * It mirrors a node's column exactly — an empty pointer row, an empty pointer
 * arrow, a body the same height as a cell, an empty index line — so its content
 * lands on the cell's centre by construction. The alternative, nudging each one
 * down by a hand-measured number of pixels, only held while nothing above or
 * below the cell changed, which is not true once pointers and indices come and
 * go.
 */
function Rail({ children, hidden }: { children: ReactNode; hidden?: boolean }) {
  return (
    <div className={styles.slot} aria-hidden={hidden}>
      <div className={styles.pointers} />
      <span className={styles.pointerArrow}>{'\u00a0'}</span>
      <div className={styles.slot}>
        <span className={styles.railBody}>{children}</span>
        <span className={styles.index}>{'\u00a0'}</span>
      </div>
    </div>
  );
}

export const LinkedListViz = memo(function LinkedListViz({ view }: { view: LinkedListView }) {
  const { nodes, doubly, cyclic, pointers } = view;

  if (nodes.length === 0) {
    return (
      <div className={styles.canvas}>
        <span className={styles.caption}>head → ∅ (empty list)</span>
      </div>
    );
  }

  const pointersAt = new Map<number, string[]>();
  for (const p of pointers ?? []) {
    if (!pointersAt.has(p.index)) pointersAt.set(p.index, []);
    pointersAt.get(p.index)!.push(p.name);
  }

  const last = nodes[nodes.length - 1];
  const loopsTo = cyclic ? last.next : null;

  return (
    <div className={styles.canvas}>
      <div className={styles.scrollArea}>
        <div className={styles.row} role="list" aria-label={`Linked list of ${nodes.length} nodes`}>
          <Rail>
            <span className={styles.caption}>head</span>
          </Rail>
          <Rail hidden>
            <span className={styles.arrow}>→</span>
          </Rail>

          {nodes.map((node, i) => (
            <div key={node.id} className={styles.row} role="listitem">
              <div className={styles.slot}>
                <div className={styles.pointers}>
                  {pointersAt.get(i)?.map((name) => (
                    <span key={name} className={styles.pointer}>
                      {name}
                    </span>
                  ))}
                </div>
                <span className={styles.pointerArrow} aria-hidden="true">
                  {pointersAt.has(i) ? '▼' : ' '}
                </span>
                <Cell value={node.value} state={node.state} index={i} />
              </div>

              {i < nodes.length - 1 && (
                <Rail hidden>
                  <span className={styles.arrow}>{doubly ? '⇄' : '→'}</span>
                </Rail>
              )}
            </div>
          ))}

          <Rail hidden>
            <span className={styles.arrow}>→</span>
          </Rail>
          <Rail>
            {cyclic ? (
              <span className={styles.cycleBadge}>↺ back to node {loopsTo ?? 0}</span>
            ) : (
              <span className={styles.caption}>null</span>
            )}
          </Rail>
        </div>
      </div>

      <span className={styles.caption}>
        {nodes.length} node{nodes.length === 1 ? '' : 's'}
        {doubly ? ' · doubly linked' : ''}
        {cyclic ? ' · contains a cycle' : ''}
      </span>
    </div>
  );
});
