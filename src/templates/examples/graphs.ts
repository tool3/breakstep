import type { Template } from '@/types';

export const graphTraversal: Template = {
  id: 'example-graph',
  title: 'Graph — BFS & DFS',
  category: 'Worked examples',
  blurb: 'Same graph, same visited set — only the container changes.',
  tags: ['graph', 'bfs', 'dfs', 'traversal'],
  expected: { time: 'O(n)', space: 'O(n)' },
  params: [
    {
      name: 'strategy',
      label: 'Traversal',
      type: 'select',
      default: 'bfs',
      options: [
        { label: 'BFS — queue, level by level', value: 'bfs' },
        { label: 'DFS — stack, deep first', value: 'dfs' },
      ],
    },
    { name: 'start', label: 'Start node', type: 'string', default: 'A' },
  ],
  code: {
    typescript: `// BFS and DFS are the SAME algorithm with a different container.
//
//   BFS takes from the front of a queue  -> explores level by level, finds
//                                           the shortest unweighted path
//   DFS takes from the top of a stack    -> dives to a leaf before backtracking
//
// Both visit every node and every edge once: O(V + E).

const strategy = 'bfs';
const start = 'A';

const graph: Record<string, string[]> = {
  A: ['B', 'C'],
  B: ['A', 'D', 'E'],
  C: ['A', 'F'],
  D: ['B'],
  E: ['B', 'F', 'G'],
  F: ['C', 'E', 'H'],
  G: ['E'],
  H: ['F'],
};

function traverse(adj: Record<string, string[]>, from: string, mode: string): string[] {
  const frontier: string[] = [from];
  const visited = new Set<string>([from]);
  const order: string[] = [];

  while (frontier.length > 0) {
    // The ONLY difference between the two traversals is this line.
    const node = mode === 'bfs' ? frontier.shift()! : frontier.pop()!;
    order.push(node);

    for (const neighbour of adj[node] ?? []) {
      if (visited.has(neighbour)) continue;
      visited.add(neighbour);
      frontier.push(neighbour);
    }
  }

  return order;
}

const order = traverse(graph, start, strategy);
console.log(strategy.toUpperCase(), 'order:', order.join(' -> '));
console.log('reached', order.length, 'of', Object.keys(graph).length, 'nodes');
`,
    python: `# BFS and DFS are the SAME algorithm with a different container.
#
#   BFS takes from the front of a queue  -> explores level by level, finds
#                                           the shortest unweighted path
#   DFS takes from the top of a stack    -> dives to a leaf before backtracking
#
# Both visit every node and every edge once: O(V + E).

from collections import deque

strategy = 'bfs'
start = 'A'

graph = {
    "A": ["B", "C"],
    "B": ["A", "D", "E"],
    "C": ["A", "F"],
    "D": ["B"],
    "E": ["B", "F", "G"],
    "F": ["C", "E", "H"],
    "G": ["E"],
    "H": ["F"],
}


def traverse(adj, source, mode):
    frontier = deque([source])
    visited = {source}
    order = []

    while frontier:
        # The ONLY difference between the two traversals is this line.
        node = frontier.popleft() if mode == "bfs" else frontier.pop()
        order.append(node)

        for neighbour in adj.get(node, []):
            if neighbour in visited:
                continue
            visited.add(neighbour)
            frontier.append(neighbour)

    return order


order = traverse(graph, start, strategy)
print(strategy.upper(), "order:", " -> ".join(order))
print("reached", len(order), "of", len(graph), "nodes")
`,
  },
  bench: {
    typescript: `breakstep.bench({
  // A ring with chords - V and E both grow linearly with n.
  input: (n) => {
    const adj: Record<string, string[]> = {};
    for (let i = 0; i < n; i++) adj[String(i)] = [String((i + 1) % n), String((i + 7) % n)];
    return adj;
  },
  run: (adj) => traverse(adj as Record<string, string[]>, '0', strategy),
  sizes: [32, 64, 128, 256, 512, 1024],
});
`,
    python: `breakstep.bench(
    # A ring with chords - V and E both grow linearly with n.
    input=lambda n: {str(i): [str((i + 1) % n), str((i + 7) % n)] for i in range(n)},
    run=lambda adj: traverse(adj, "0", strategy),
    sizes=[32, 64, 128, 256, 512],
)
`,
  },
  instrumented: {
    typescript: `// BFS and DFS are the SAME algorithm with a different container.
//
//   BFS takes from the front of a queue  → explores level by level, finds the
//                                          shortest unweighted path
//   DFS takes from the top of a stack    → dives to a leaf before backtracking
//
// Both visit every node and every edge once: O(V + E).

const strategy = breakstep.param<string>('strategy', 'bfs');
const start = breakstep.param<string>('start', 'A');

const graph: Record<string, string[]> = {
  A: ['B', 'C'],
  B: ['A', 'D', 'E'],
  C: ['A', 'F'],
  D: ['B'],
  E: ['B', 'F', 'G'],
  F: ['C', 'E', 'H'],
  G: ['E'],
  H: ['F'],
};

function traverse(adj: Record<string, string[]>, from: string, mode: string): string[] {
  const frontier: string[] = [from];
  const visited = new Set<string>([from]);
  const order: string[] = [];
  const depth: Record<string, number> = { [from]: 0 };

  breakstep.show(adj, { label: 'Starting graph', highlight: { [from]: 'active' } });

  while (frontier.length > 0) {
    // The ONLY difference between the two traversals is this line.
    const node = mode === 'bfs' ? frontier.shift()! : frontier.pop()!;
    order.push(node);

    for (const neighbour of adj[node] ?? []) {
      if (visited.has(neighbour)) continue;
      visited.add(neighbour);
      depth[neighbour] = depth[node] + 1;
      frontier.push(neighbour);
    }

    // Factory form — recolouring every visited node is O(V) per step, which
    // would report this O(V + E) traversal as quadratic on the Analyze tab.
    breakstep.show(adj, () => ({
      label: \`visit \${node} (\${mode.toUpperCase()})\`,
      highlight: {
        ...Object.fromEntries(order.map((n) => [n, 'visited' as const])),
        ...Object.fromEntries(frontier.map((n) => [n, 'compare' as const])),
        [node]: 'active' as const,
      },
      meta: {
        order: order.join(' → '),
        frontier: frontier.join(',') || '(empty)',
        depth: depth[node],
      },
    }));
  }

  return order;
}

const order = traverse(graph, start, strategy);
breakstep.log(strategy.toUpperCase(), 'order:', order.join(' → '));
breakstep.log('reached', order.length, 'of', Object.keys(graph).length, 'nodes');

breakstep.bench({
  // A ring with chords — V and E both grow linearly with n.
  input: (n) => {
    const adj: Record<string, string[]> = {};
    for (let i = 0; i < n; i++) {
      adj[String(i)] = [String((i + 1) % n), String((i + 7) % n)];
    }
    return adj;
  },
  run: (adj) => traverse(adj as Record<string, string[]>, '0', strategy),
  sizes: [32, 64, 128, 256, 512, 1024],
});
`,
    python: `# BFS and DFS are the SAME algorithm with a different container.
#
#   BFS takes from the front of a queue  -> explores level by level, finds the
#                                           shortest unweighted path
#   DFS takes from the top of a stack    -> dives to a leaf before backtracking
#
# Both visit every node and every edge once: O(V + E).

from collections import deque

strategy = breakstep.param('strategy', 'bfs')
start = breakstep.param('start', 'A')

graph = {
    "A": ["B", "C"],
    "B": ["A", "D", "E"],
    "C": ["A", "F"],
    "D": ["B"],
    "E": ["B", "F", "G"],
    "F": ["C", "E", "H"],
    "G": ["E"],
    "H": ["F"],
}


def traverse(adj, source, mode):
    frontier = deque([source])
    visited = {source}
    order = []
    depth = {source: 0}

    breakstep.show(adj, label="Starting graph", highlight={source: "active"})

    while frontier:
        # The ONLY difference between the two traversals is this line.
        node = frontier.popleft() if mode == "bfs" else frontier.pop()
        order.append(node)

        for neighbour in adj.get(node, []):
            if neighbour in visited:
                continue
            visited.add(neighbour)
            depth[neighbour] = depth[node] + 1
            frontier.append(neighbour)

        # Factory form - recolouring every visited node is O(V) per step, which
        # would report this O(V + E) traversal as quadratic on the Analyze tab.
        def frame():
            highlight = {n: "visited" for n in order}
            highlight.update({n: "compare" for n in frontier})
            highlight[node] = "active"
            return {
                "label": f"visit {node} ({mode.upper()})",
                "highlight": highlight,
                "meta": {"order": " -> ".join(order),
                         "frontier": ",".join(frontier) or "(empty)",
                         "depth": depth[node]},
            }

        breakstep.show(adj, frame)

    return order


order = traverse(graph, start, strategy)
print(strategy.upper(), "order:", " -> ".join(order))
print("reached", len(order), "of", len(graph), "nodes")


def ring(n):
    # A ring with chords - V and E both grow linearly with n.
    return {str(i): [str((i + 1) % n), str((i + 7) % n)] for i in range(n)}


breakstep.bench(
    input=ring,
    run=lambda adj: traverse(adj, "0", strategy),
    sizes=[32, 64, 128, 256, 512],
)
`,
  },
};

export const gridIslands: Template = {
  id: 'example-grid',
  title: 'Grid — Number of Islands',
  category: 'Worked examples',
  blurb: 'A matrix is just a graph where the edges are implied by adjacency.',
  tags: ['matrix', 'grid', 'flood-fill', 'dfs'],
  expected: { time: 'O(n)', space: 'O(n)' },
  params: [
    { name: 'rows', label: 'Rows', type: 'number', default: 8, min: 3, max: 20 },
    { name: 'cols', label: 'Columns', type: 'number', default: 12, min: 3, max: 24 },
    { name: 'density', label: 'Land density %', type: 'number', default: 45, min: 10, max: 90, step: 5 },
  ],
  code: {
    typescript: `// Number of Islands - flood fill on a grid.
//
// A grid IS a graph: each cell is a node, and its up/down/left/right
// neighbours are its edges. Because every cell is sunk at most once, the
// whole scan is O(rows x cols) - linear in the number of cells, despite the
// nested loops and the recursive fill.

const rows = 8;
const cols = 12;
const density = 45;

const LAND = 1;
const WATER = 0;

/** Deterministic pseudo-random cells, so every run draws the same map. */
function makeGrid(r: number, c: number, pct: number): number[][] {
  let seed = 2024;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed % 100;
  };
  return Array.from({ length: r }, () =>
    Array.from({ length: c }, () => (next() < pct ? LAND : WATER)),
  );
}

function countIslands(grid: number[][]): number {
  const r = grid.length;
  const c = grid[0].length;
  const seen = grid.map((row) => row.map(() => false));
  let islands = 0;

  const sink = (y: number, x: number) => {
    if (y < 0 || y >= r || x < 0 || x >= c) return;
    if (seen[y][x] || grid[y][x] === WATER) return;

    seen[y][x] = true;
    sink(y + 1, x);
    sink(y - 1, x);
    sink(y, x + 1);
    sink(y, x - 1);
  };

  for (let y = 0; y < r; y++) {
    for (let x = 0; x < c; x++) {
      if (grid[y][x] === LAND && !seen[y][x]) {
        islands++;
        sink(y, x);
      }
    }
  }

  return islands;
}

const grid = makeGrid(rows, cols, density);
console.log('islands:', countIslands(grid));
console.log('cells scanned:', rows * cols);
`,
    python: `# Number of Islands - flood fill on a grid.
#
# A grid IS a graph: each cell is a node, and its up/down/left/right
# neighbours are its edges. Because every cell is sunk at most once, the
# whole scan is O(rows x cols) - linear in the number of cells, despite the
# nested loops and the recursive fill.

import sys

sys.setrecursionlimit(20000)

rows = 8
cols = 12
density = 45

LAND, WATER = 1, 0


def make_grid(r, c, pct):
    """Deterministic pseudo-random cells, so every run draws the same map."""
    seed = 2024
    grid = []
    for _ in range(r):
        row = []
        for _ in range(c):
            seed = (seed * 1664525 + 1013904223) % 4294967296
            row.append(LAND if seed % 100 < pct else WATER)
        grid.append(row)
    return grid


def count_islands(grid):
    r, c = len(grid), len(grid[0])
    seen = [[False] * c for _ in range(r)]
    islands = 0

    def sink(y, x):
        if y < 0 or y >= r or x < 0 or x >= c:
            return
        if seen[y][x] or grid[y][x] == WATER:
            return

        seen[y][x] = True
        sink(y + 1, x)
        sink(y - 1, x)
        sink(y, x + 1)
        sink(y, x - 1)

    for y in range(r):
        for x in range(c):
            if grid[y][x] == LAND and not seen[y][x]:
                islands += 1
                sink(y, x)

    return islands


grid = make_grid(rows, cols, density)
print("islands:", count_islands(grid))
print("cells scanned:", rows * cols)
`,
  },
  bench: {
    typescript: `breakstep.bench({
  // Grow both dimensions together so n = total cells stays the size measure.
  input: (n) => {
    const side = Math.max(2, Math.round(Math.sqrt(n)));
    return makeGrid(side, side, density);
  },
  run: (g) => countIslands(g as number[][]),
  sizes: [64, 256, 1024, 4096, 9216, 16384],
});
`,
    python: `import math


def _square(n):
    side = max(2, round(math.sqrt(n)))
    return make_grid(side, side, density)


# Grow both dimensions together so n = total cells stays the size measure.
breakstep.bench(input=_square, run=count_islands, sizes=[64, 256, 1024, 2304, 4096])
`,
  },
  instrumented: {
    typescript: `// Number of Islands — flood fill on a grid.
//
// A grid IS a graph: each cell is a node, and its up/down/left/right
// neighbours are its edges. Because every cell is sunk at most once, the whole
// scan is O(rows × cols) — linear in the number of cells, despite the nested
// loops and the recursive fill.

const rows = breakstep.param<number>('rows', 8);
const cols = breakstep.param<number>('cols', 12);
const density = breakstep.param<number>('density', 45);

const LAND = 1;
const WATER = 0;

/** Deterministic pseudo-random cells, so every run draws the same map. */
function makeGrid(r: number, c: number, pct: number): number[][] {
  let seed = 2024;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed % 100;
  };
  return Array.from({ length: r }, () =>
    Array.from({ length: c }, () => (next() < pct ? LAND : WATER)),
  );
}

function countIslands(grid: number[][]): number {
  const r = grid.length;
  const c = grid[0].length;
  const seen = grid.map((row) => row.map(() => false));
  let islands = 0;

  const sink = (y: number, x: number, id: number) => {
    if (y < 0 || y >= r || x < 0 || x >= c) return;
    if (seen[y][x] || grid[y][x] === WATER) return;
    seen[y][x] = true;

    // Factory form — \`markSeen\` rescans the whole grid, so building it eagerly
    // would report this linear scan as O(cells²) on the Analyze tab.
    breakstep.show(grid, () => ({
      label: \`island \${id}: flooding (\${y}, \${x})\`,
      highlight: {
        ...markSeen(seen),
        [\`\${y},\${x}\`]: 'active' as const,
      },
      meta: { island: id, cell: \`\${y},\${x}\` },
    }));

    sink(y + 1, x, id);
    sink(y - 1, x, id);
    sink(y, x + 1, id);
    sink(y, x - 1, id);
  };

  for (let y = 0; y < r; y++) {
    for (let x = 0; x < c; x++) {
      if (grid[y][x] === LAND && !seen[y][x]) {
        islands++;
        sink(y, x, islands);
      }
    }
  }

  return islands;
}

function markSeen(seen: boolean[][]): Record<string, 'visited'> {
  const out: Record<string, 'visited'> = {};
  for (let y = 0; y < seen.length; y++) {
    for (let x = 0; x < seen[y].length; x++) {
      if (seen[y][x]) out[\`\${y},\${x}\`] = 'visited';
    }
  }
  return out;
}

const grid = makeGrid(rows, cols, density);
breakstep.show(grid, { label: \`\${rows}×\${cols} grid — 1 is land, 0 is water\` });

const count = countIslands(grid);
breakstep.show(grid, { label: \`\${count} island\${count === 1 ? '' : 's'}\` });
breakstep.log('islands:', count);
breakstep.log('cells scanned:', rows * cols);

breakstep.bench({
  // Grow both dimensions together so n = total cells stays the size measure.
  input: (n) => {
    const side = Math.max(2, Math.round(Math.sqrt(n)));
    return makeGrid(side, side, density);
  },
  run: (g) => countIslands(g as number[][]),
  sizes: [64, 256, 1024, 4096, 9216, 16384],
});
`,
    python: `# Number of Islands - flood fill on a grid.
#
# A grid IS a graph: each cell is a node, and its up/down/left/right
# neighbours are its edges. Because every cell is sunk at most once, the whole
# scan is O(rows x cols) - linear in the number of cells, despite the nested
# loops and the recursive fill.

import math
import sys

sys.setrecursionlimit(20000)

rows = breakstep.param('rows', 8)
cols = breakstep.param('cols', 12)
density = breakstep.param('density', 45)

LAND, WATER = 1, 0


def make_grid(r, c, pct):
    """Deterministic pseudo-random cells, so every run draws the same map."""
    seed = 2024
    grid = []
    for _ in range(r):
        row = []
        for _ in range(c):
            seed = (seed * 1664525 + 1013904223) % 4294967296
            row.append(LAND if seed % 100 < pct else WATER)
        grid.append(row)
    return grid


def count_islands(grid):
    r, c = len(grid), len(grid[0])
    seen = [[False] * c for _ in range(r)]
    islands = 0

    def mark_seen():
        return {f"{y},{x}": "visited" for y in range(r) for x in range(c) if seen[y][x]}

    def sink(y, x, island_id):
        if y < 0 or y >= r or x < 0 or x >= c:
            return
        if seen[y][x] or grid[y][x] == WATER:
            return
        seen[y][x] = True

        # Factory form - \`mark_seen\` rescans the whole grid, so building it
        # eagerly would report this linear scan as O(cells^2) on Analyze.
        def frame():
            highlight = mark_seen()
            highlight[f"{y},{x}"] = "active"
            return {
                "label": f"island {island_id}: flooding ({y}, {x})",
                "highlight": highlight,
                "meta": {"island": island_id, "cell": f"{y},{x}"},
            }

        breakstep.show(grid, frame)

        sink(y + 1, x, island_id)
        sink(y - 1, x, island_id)
        sink(y, x + 1, island_id)
        sink(y, x - 1, island_id)

    for y in range(r):
        for x in range(c):
            if grid[y][x] == LAND and not seen[y][x]:
                islands += 1
                sink(y, x, islands)

    return islands


grid = make_grid(rows, cols, density)
breakstep.show(grid, label=f"{rows}x{cols} grid - 1 is land, 0 is water")

count = count_islands(grid)
breakstep.show(grid, label=f"{count} island" + ("" if count == 1 else "s"))
print("islands:", count)
print("cells scanned:", rows * cols)


def square(n):
    # Grow both dimensions together so n = total cells stays the size measure.
    side = max(2, round(math.sqrt(n)))
    return make_grid(side, side, density)


breakstep.bench(input=square, run=count_islands, sizes=[64, 256, 1024, 2304, 4096])
`,
  },
};
