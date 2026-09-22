import { memo, useMemo } from 'react';
import type { HeapView } from '@/types/viz';
import { heapToTree, layoutTree, trimToRadius } from './layout';
import { Cell, nodeStateClass } from './Cell';
import { formatValue } from './format';
import styles from './viz.module.scss';

export const HeapViz = memo(function HeapViz({ view }: { view: HeapView }) {
  const { items, heapType } = view;

  const tree = useMemo(
    () => heapToTree(items.map((c) => c.value), items.map((c) => c.state)),
    [items],
  );
  const layout = useMemo(() => layoutTree(tree, true), [tree]);

  if (items.length === 0) {
    return (
      <div className={styles.canvas}>
        <span className={styles.caption}>empty {heapType}-heap</span>
      </div>
    );
  }

  const radius = items.length > 40 ? 14 : items.length > 20 ? 17 : 20;

  return (
    <div className={styles.canvas}>
      <span className={styles.caption}>
        {heapType}-heap · root is the {heapType === 'min' ? 'smallest' : 'largest'} element
      </span>

      <div className={styles.scrollArea}>
        <svg
          className={styles.svg}
          width={Math.max(layout.width, 220)}
          height={Math.max(layout.height, 100)}
          viewBox={`0 0 ${Math.max(layout.width, 220)} ${Math.max(layout.height, 100)}`}
          role="img"
          aria-label={`${heapType} heap with ${items.length} elements`}
        >
          {layout.edges.map((e) => (
            <line
              key={`${e.from}-${e.to}`}
              className={styles.edge}
              {...trimToRadius(e.x1, e.y1, e.x2, e.y2, radius)}
            />
          ))}
          {layout.nodes.map(({ node, x, y }) => (
            <g key={node.id}>
              <circle
                className={[styles.nodeCircle, nodeStateClass(node.state)].filter(Boolean).join(' ')}
                cx={x}
                cy={y}
                r={radius}
              />
              <text className={styles.nodeLabel} x={x} y={y} fontSize={radius < 17 ? 10 : 12}>
                {formatValue(node.value, 4)}
              </text>
              <text className={styles.nodeSub} x={x} y={y + radius + 11}>
                [{node.note}]
              </text>
            </g>
          ))}
        </svg>
      </div>

      <span className={styles.caption}>backing array</span>
      <div className={styles.scrollArea}>
        <div className={styles.row} role="grid" aria-label="Heap backing array">
          {items.map((cell, i) => (
            <Cell key={i} value={cell.value} state={cell.state} index={i} small />
          ))}
        </div>
      </div>
    </div>
  );
});
