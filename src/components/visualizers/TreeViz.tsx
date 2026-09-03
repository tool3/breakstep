import { memo, useMemo } from 'react';
import type { TreeView } from '@/types/viz';
import { layoutTree, scalable } from './layout';
import { nodeStateClass } from './Cell';
import { formatFull, formatValue } from './format';
import styles from './viz.module.scss';

export const TreeViz = memo(function TreeViz({ view }: { view: TreeView }) {
  const layout = useMemo(() => layoutTree(view.root, view.binary ?? true), [view.root, view.binary]);

  if (!view.root) {
    return (
      <div className={styles.canvas}>
        <span className={styles.caption}>root → ∅ (empty tree)</span>
      </div>
    );
  }

  const radius = layout.nodes.length > 60 ? 14 : layout.nodes.length > 30 ? 17 : 20;

  return (
    <div className={styles.canvas}>
      <div className={styles.scrollArea}>
        <svg
          className={styles.svg}
          style={scalable(Math.max(layout.width, 220), Math.max(layout.height, 120))}
          viewBox={`0 0 ${Math.max(layout.width, 220)} ${Math.max(layout.height, 120)}`}
          role="img"
          aria-label={`Tree with ${layout.nodes.length} nodes and depth ${layout.depth + 1}`}
        >
          {layout.edges.map((e) => (
            <line
              key={`${e.from}-${e.to}`}
              className={styles.edge}
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
            />
          ))}

          {layout.nodes.map(({ node, x, y }) => (
            <g key={node.id}>
              <title>{formatFull(node.value)}</title>
              <circle
                className={[styles.nodeCircle, nodeStateClass(node.state)].filter(Boolean).join(' ')}
                cx={x}
                cy={y}
                r={radius}
              />
              <text className={styles.nodeLabel} x={x} y={y} fontSize={radius < 17 ? 10 : 12}>
                {formatValue(node.value, 4)}
              </text>
              {node.note && (
                <text className={styles.nodeSub} x={x} y={y + radius + 12}>
                  {node.note}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      <span className={styles.caption}>
        {layout.nodes.length} nodes · height {layout.depth + 1}
      </span>
    </div>
  );
});
