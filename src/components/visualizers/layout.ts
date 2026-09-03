import type { GraphEdge, GraphNode, TreeNode, TrieNode } from '@/types/viz';

export interface PositionedNode<T> {
  node: T;
  x: number;
  y: number;
  depth: number;
}

export interface TreeLayout {
  nodes: PositionedNode<TreeNode>[];
  edges: { from: string; to: string; x1: number; y1: number; x2: number; y2: number }[];
  width: number;
  height: number;
  depth: number;
}

export const TREE_SPACING = { x: 56, y: 74, padding: 36 } as const;

export function layoutTree(root: TreeNode | null, binary: boolean): TreeLayout {
  if (!root) return { nodes: [], edges: [], width: 0, height: 0, depth: 0 };

  const nodes: PositionedNode<TreeNode>[] = [];
  const edges: TreeLayout['edges'] = [];
  const positions = new Map<string, { x: number; y: number }>();
  let column = 0;
  let maxDepth = 0;

  const place = (node: TreeNode | null, depth: number): number | null => {
    if (!node) {
      if (binary) column += 1;
      return null;
    }

    maxDepth = Math.max(maxDepth, depth);
    const children = node.children ?? [];

    if (children.length === 0) {
      const x = column++;
      positions.set(node.id, { x, y: depth });
      nodes.push({ node, x, y: depth, depth });
      return x;
    }

    if (binary) {
      const left = place(children[0] ?? null, depth + 1);
      const self = column++;
      const right = place(children[1] ?? null, depth + 1);
      positions.set(node.id, { x: self, y: depth });
      nodes.push({ node, x: self, y: depth, depth });
      for (const [child, cx] of [
        [children[0], left],
        [children[1], right],
      ] as const) {
        if (child && cx !== null) {
          edges.push({ from: node.id, to: child.id, x1: self, y1: depth, x2: cx, y2: depth + 1 });
        }
      }
      return self;
    }

    const childXs: number[] = [];
    for (const child of children) {
      const cx = place(child, depth + 1);
      if (cx !== null) childXs.push(cx);
    }
    const self = childXs.length
      ? (Math.min(...childXs) + Math.max(...childXs)) / 2
      : column++;
    positions.set(node.id, { x: self, y: depth });
    nodes.push({ node, x: self, y: depth, depth });
    for (const child of children) {
      if (!child) continue;
      const pos = positions.get(child.id);
      if (pos) edges.push({ from: node.id, to: child.id, x1: self, y1: depth, x2: pos.x, y2: depth + 1 });
    }
    return self;
  };

  place(root, 0);

  const toPx = (n: PositionedNode<TreeNode>) => ({
    ...n,
    x: TREE_SPACING.padding + n.x * TREE_SPACING.x,
    y: TREE_SPACING.padding + n.y * TREE_SPACING.y,
  });

  return {
    nodes: nodes.map(toPx),
    edges: edges.map((e) => ({
      ...e,
      x1: TREE_SPACING.padding + e.x1 * TREE_SPACING.x,
      y1: TREE_SPACING.padding + e.y1 * TREE_SPACING.y,
      x2: TREE_SPACING.padding + e.x2 * TREE_SPACING.x,
      y2: TREE_SPACING.padding + e.y2 * TREE_SPACING.y,
    })),
    width: TREE_SPACING.padding * 2 + Math.max(column - 1, 0) * TREE_SPACING.x,
    height: TREE_SPACING.padding * 2 + maxDepth * TREE_SPACING.y,
    depth: maxDepth,
  };
}

export function trieToTreeNode(node: TrieNode): TreeNode {
  return {
    id: node.id,
    value: node.char === '' ? '•' : node.char,
    state: node.state,
    note: node.terminal ? '●' : undefined,
    children: node.children.map(trieToTreeNode),
  };
}

export function heapToTree(values: unknown[], states: (string | undefined)[]): TreeNode | null {
  if (values.length === 0) return null;
  const build = (i: number): TreeNode | null => {
    if (i >= values.length) return null;
    return {
      id: `h${i}`,
      value: values[i],
      state: states[i] as TreeNode['state'],
      note: String(i),
      children: [build(2 * i + 1), build(2 * i + 2)],
    };
  };
  return build(0);
}

export interface GraphLayout {
  nodes: (GraphNode & { x: number; y: number })[];
  width: number;
  height: number;
}

export const GRAPH_LAYOUT = { radius: 22, padding: 44, minSize: 320 } as const;

export function layoutGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  iterations = 120,
): GraphLayout {
  const n = nodes.length;
  if (n === 0) return { nodes: [], width: GRAPH_LAYOUT.minSize, height: GRAPH_LAYOUT.minSize };

  const size = Math.max(GRAPH_LAYOUT.minSize, Math.min(720, 150 + n * 34));
  const centre = size / 2;
  const ring = centre - GRAPH_LAYOUT.padding;

  const pos = nodes.map((node, i) => {
    if (typeof node.x === 'number' && typeof node.y === 'number') {
      return { x: node.x * size, y: node.y * size, pinned: true };
    }
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: centre + ring * Math.cos(angle), y: centre + ring * Math.sin(angle), pinned: false };
  });

  if (n === 1) {
    pos[0] = { x: centre, y: centre, pinned: pos[0].pinned };
  }

  const index = new Map(nodes.map((node, i) => [node.id, i]));
  const links = edges
    .map((e) => [index.get(e.from), index.get(e.to)] as [number | undefined, number | undefined])
    .filter((pair): pair is [number, number] => pair[0] !== undefined && pair[1] !== undefined);

  const ideal = Math.max(70, ring * 1.6 / Math.sqrt(n));
  const repulsion = ideal * ideal;

  for (let step = 0; step < iterations && n > 1; step++) {
    const cooling = 1 - step / iterations;
    const dx = new Array<number>(n).fill(0);
    const dy = new Array<number>(n).fill(0);

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let vx = pos[i].x - pos[j].x;
        let vy = pos[i].y - pos[j].y;
        let dist = Math.hypot(vx, vy);
        if (dist < 0.01) {
          vx = ((i % 3) - 1) || 1;
          vy = ((j % 3) - 1) || 1;
          dist = Math.hypot(vx, vy);
        }
        const force = repulsion / (dist * dist);
        dx[i] += (vx / dist) * force;
        dy[i] += (vy / dist) * force;
        dx[j] -= (vx / dist) * force;
        dy[j] -= (vy / dist) * force;
      }
    }

    for (const [a, b] of links) {
      if (a === b) continue;
      const vx = pos[a].x - pos[b].x;
      const vy = pos[a].y - pos[b].y;
      const dist = Math.max(Math.hypot(vx, vy), 0.01);
      const force = (dist - ideal) * 0.35;
      dx[a] -= (vx / dist) * force;
      dy[a] -= (vy / dist) * force;
      dx[b] += (vx / dist) * force;
      dy[b] += (vy / dist) * force;
    }

    for (let i = 0; i < n; i++) {
      if (pos[i].pinned) continue;
      const step2 = Math.min(Math.hypot(dx[i], dy[i]), 24) * cooling;
      const norm = Math.max(Math.hypot(dx[i], dy[i]), 0.01);
      pos[i].x += (dx[i] / norm) * step2;
      pos[i].y += (dy[i] / norm) * step2;
      pos[i].x = clamp(pos[i].x, GRAPH_LAYOUT.padding, size - GRAPH_LAYOUT.padding);
      pos[i].y = clamp(pos[i].y, GRAPH_LAYOUT.padding, size - GRAPH_LAYOUT.padding);
    }
  }

  return {
    nodes: nodes.map((node, i) => ({ ...node, x: pos[i].x, y: pos[i].y })),
    width: size,
    height: size,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function trimToRadius(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  radius: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) return { x1, y1, x2, y2 };
  const ux = dx / dist;
  const uy = dy / dist;
  return {
    x1: x1 + ux * radius,
    y1: y1 + uy * radius,
    x2: x2 - ux * radius,
    y2: y2 - uy * radius,
  };
}

export function scalable(width: number, height: number) {
  return {
    width: '100%',
    minWidth: width,
    maxWidth: Math.round(width * MAX_UPSCALE),
    aspectRatio: `${width} / ${height}`,
    height: 'auto',
  } as const;
}

const MAX_UPSCALE = 1.8;
