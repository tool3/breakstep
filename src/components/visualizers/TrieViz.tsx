import { memo, useMemo } from 'react';
import type { TrieView } from '@/types/viz';
import { layoutTree, scalable, trieToTreeNode, trimToRadius } from './layout';
import { nodeStateClass } from './Cell';
import styles from './viz.module.scss';

export const TrieViz = memo(function TrieViz({ view }: { view: TrieView }) {
  const tree = useMemo(() => trieToTreeNode(view.root), [view.root]);
  const layout = useMemo(() => layoutTree(tree, false), [tree]);

  const terminals = useMemo(() => {
    const set = new Set<string>();
    const walk = (node: TrieView['root']) => {
      if (node.terminal) set.add(node.id);
      node.children.forEach(walk);
    };
    walk(view.root);
    return set;
  }, [view.root]);

  if (layout.nodes.length <= 1) {
    return (
      <div className={styles.canvas}>
        <span className={styles.caption}>empty trie — insert a word to see it grow</span>
      </div>
    );
  }

  const radius = layout.nodes.length > 60 ? 13 : layout.nodes.length > 30 ? 15 : 18;

  return (
    <div className={styles.canvas}>
      <div className={styles.scrollArea}>
        <svg
          className={styles.svg}
          style={scalable(Math.max(layout.width, 220), Math.max(layout.height, 120))}
          viewBox={`0 0 ${Math.max(layout.width, 220)} ${Math.max(layout.height, 120)}`}
          role="img"
          aria-label={`Trie with ${layout.nodes.length - 1} characters and ${terminals.size} complete words`}
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
              {terminals.has(node.id) && (
                <circle className={styles.terminalRing} cx={x} cy={y} r={radius + 3.5} />
              )}
              <text className={styles.nodeLabel} x={x} y={y} fontSize={radius < 16 ? 10 : 12}>
                {String(node.value)}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span
            className={styles.legendSwatch}
            style={{ borderRadius: '50%', borderColor: 'var(--breakstep-mint)', borderWidth: 2 }}
          />
           = a complete word ends here
        </span>
        <span className={styles.legendItem}>
          {terminals.size} word{terminals.size === 1 ? '' : 's'} · {layout.nodes.length - 1} nodes
        </span>
      </div>
    </div>
  );
});
