import { memo, useMemo } from 'react';
import type { GraphView } from '@/types/viz';
import { GRAPH_LAYOUT, layoutGraph, scalable, trimToRadius } from './layout';
import { nodeStateClass } from './Cell';
import styles from './viz.module.scss';

const EDGE_STATE_CLASS: Record<string, string> = {
  active: styles.edgeActive,
  visited: styles.edgeVisited,
  match: styles.edgeMatch,
  compare: styles.edgeActive,
};

/**
 * Directed and undirected graphs.
 *
 * The layout is deterministic (see `layoutGraph`) so a node never moves between
 * frames — the only thing that changes as you scrub the timeline is colour,
 * which is what makes a traversal readable.
 */
export const GraphViz = memo(function GraphViz({ view }: { view: GraphView }) {
  const { nodes, edges, directed } = view;
  const layout = useMemo(() => layoutGraph(nodes, edges), [nodes, edges]);
  const positions = useMemo(
    () => new Map(layout.nodes.map((n) => [n.id, n])),
    [layout.nodes],
  );

  if (nodes.length === 0) {
    return (
      <div className={styles.canvas}>
        <span className={styles.caption}>empty graph</span>
      </div>
    );
  }

  const radius = nodes.length > 30 ? 15 : nodes.length > 18 ? 18 : GRAPH_LAYOUT.radius;

  return (
    <div className={styles.canvas}>
      <div className={styles.scrollArea}>
        <svg
          className={styles.svg}
          style={scalable(layout.width, layout.height)}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          role="img"
          aria-label={`${directed ? 'Directed' : 'Undirected'} graph with ${nodes.length} nodes and ${edges.length} edges`}
        >
          {directed && (
            <defs>
              <marker
                id="breakstep-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
              </marker>
            </defs>
          )}

          {edges.map((edge, i) => {
            const from = positions.get(edge.from);
            const to = positions.get(edge.to);
            if (!from || !to) return null;

            // Self-loops need an arc, not a zero-length line.
            if (edge.from === edge.to) {
              return (
                <path
                  key={i}
                  className={[styles.edge, edge.state ? EDGE_STATE_CLASS[edge.state] : '']
                    .filter(Boolean)
                    .join(' ')}
                  d={`M ${from.x - 8} ${from.y - radius} a 14 14 0 1 1 16 0`}
                />
              );
            }

            const line = trimToRadius(from.x, from.y, to.x, to.y, radius + (directed ? 4 : 0));
            const cls = [styles.edge, edge.state ? EDGE_STATE_CLASS[edge.state] : '']
              .filter(Boolean)
              .join(' ');

            return (
              <g key={i}>
                <line
                  className={cls}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  markerEnd={directed ? 'url(#breakstep-arrow)' : undefined}
                  style={directed ? { color: 'var(--breakstep-border-strong)' } : undefined}
                />
                {edge.weight !== undefined && (
                  <text
                    className={styles.edgeWeight}
                    x={(line.x1 + line.x2) / 2}
                    y={(line.y1 + line.y2) / 2 - 4}
                  >
                    {edge.weight}
                  </text>
                )}
              </g>
            );
          })}

          {layout.nodes.map((node) => (
            <g key={node.id}>
              <title>{node.label}</title>
              <circle
                className={[styles.nodeCircle, nodeStateClass(node.state)].filter(Boolean).join(' ')}
                cx={node.x}
                cy={node.y}
                r={radius}
              />
              <text
                className={styles.nodeLabel}
                x={node.x}
                y={node.y}
                fontSize={radius < 18 ? 10 : 12}
              >
                {node.label.length > 4 ? `${node.label.slice(0, 3)}…` : node.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <span className={styles.caption}>
        {nodes.length} nodes · {edges.length} edges · {directed ? 'directed' : 'undirected'}
      </span>
    </div>
  );
});
