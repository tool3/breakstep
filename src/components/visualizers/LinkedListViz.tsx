import { memo } from 'react';
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
          <span className={styles.caption} style={{ alignSelf: 'center', paddingBottom: 22 }}>
            head
          </span>
          <span className={styles.arrow} aria-hidden="true">
            →
          </span>

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
                <span className={styles.arrow} aria-hidden="true" style={{ paddingBottom: 20 }}>
                  {doubly ? '⇄' : '→'}
                </span>
              )}
            </div>
          ))}

          <span className={styles.arrow} aria-hidden="true" style={{ paddingBottom: 20 }}>
            →
          </span>
          {cyclic ? (
            <span className={styles.cycleBadge} style={{ alignSelf: 'center', marginBottom: 22 }}>
              ↺ back to node {loopsTo ?? 0}
            </span>
          ) : (
            <span className={styles.caption} style={{ alignSelf: 'center', paddingBottom: 22 }}>
              null
            </span>
          )}
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
