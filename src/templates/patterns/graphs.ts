import type { Template } from '@/types';

export const bfs: Template = {
  id: 'bfs',
  title: 'BFS — Shortest Unweighted Path',
  category: 'Patterns',
  blurb: 'A queue explores level by level, so the first time you arrive is the shortest way.',
  tags: ['bfs', 'graph', 'queue', 'shortest-path'],
  expected: { time: 'O(n)', space: 'O(n)' },
  params: [
    {
      name: 'edges',
      label: 'Edges (a-b)',
      type: 'stringArray',
      default: ['A-B', 'A-C', 'B-D', 'B-E', 'C-F', 'E-F', 'E-G', 'F-H', 'G-H'],
    },
    { name: 'start', label: 'Start vertex', type: 'string', default: 'A' },
    { name: 'goal', label: 'Goal vertex', type: 'string', default: 'H' },
  ],
  code: {
    typescript: `// PATTERN: breadth-first search  ·  PROBLEM: shortest path, unweighted
//
// BFS visits everything one step away, then everything two steps away, and so
// on. Because it never looks further before finishing the current ring, the
// FIRST time it reaches a vertex is necessarily along a shortest path. That
// guarantee is what makes it the right tool for unweighted shortest paths —
// and exactly why DFS, which dives to a leaf immediately, cannot do this.
//
// Two details do all the work:
//   · Mark a vertex visited when you ENQUEUE it, not when you dequeue it —
//     otherwise it can be queued several times before you get to it.
//   · Record where you came from, and the path falls out by walking back.

const edges = ['A-B', 'A-C', 'B-D', 'B-E', 'C-F', 'E-F', 'E-G', 'F-H', 'G-H'];
const start = 'A';
const goal = 'H';

class Graph {
  adjacency = new Map<string, Set<string>>();

  addEdge(a: string, b: string): void {
    if (!this.adjacency.has(a)) this.adjacency.set(a, new Set());
    if (!this.adjacency.has(b)) this.adjacency.set(b, new Set());
    this.adjacency.get(a)!.add(b);
    this.adjacency.get(b)!.add(a);
  }

  neighbors(vertex: string): string[] {
    return [...(this.adjacency.get(vertex) ?? [])];
  }

  vertices(): string[] {
    return [...this.adjacency.keys()];
  }
}

interface BfsResult {
  order: string[];
  distance: Map<string, number>;
  cameFrom: Map<string, string | null>;
}

function breadthFirst(graph: Graph, from: string): BfsResult {
  const queue: string[] = [from];
  const distance = new Map<string, number>([[from, 0]]);
  const cameFrom = new Map<string, string | null>([[from, null]]);
  const order: string[] = [];

  let head = 0; // head index instead of shift(): dequeue stays O(1)

  while (head < queue.length) {
    const vertex = queue[head++];
    order.push(vertex);

    for (const neighbor of graph.neighbors(vertex)) {
      if (distance.has(neighbor)) continue; // already found, and found sooner

      distance.set(neighbor, distance.get(vertex)! + 1);
      cameFrom.set(neighbor, vertex);
      queue.push(neighbor);
    }
  }

  return { order, distance, cameFrom };
}

/** Walk the parent links backwards, then reverse. */
function reconstruct(cameFrom: Map<string, string | null>, goal: string): string[] {
  if (!cameFrom.has(goal)) return [];

  const path: string[] = [];
  let current: string | null = goal;

  while (current !== null) {
    path.push(current);
    current = cameFrom.get(current) ?? null;
  }

  return path.reverse();
}

const graph = new Graph();
for (const edge of edges) {
  const [a, b] = edge.split('-');
  graph.addEdge(a, b);
}

const { order, distance, cameFrom } = breadthFirst(graph, start);

console.log('visit order ->', order.join(' → '));
console.log('distances   ->', [...distance].map(([v, d]) => v + ':' + d).join(', '));
console.log('shortest path ' + start + ' → ' + goal + ' ->', reconstruct(cameFrom, goal).join(' → '));
console.log('length      ->', distance.get(goal), 'edges');
console.log('unreachable ->', graph.vertices().filter((v) => !distance.has(v)).join(', ') || '(none)');
`,
    python: `# PATTERN: breadth-first search  ·  PROBLEM: shortest path, unweighted
#
# BFS visits everything one step away, then everything two steps away, and so
# on. Because it never looks further before finishing the current ring, the
# FIRST time it reaches a vertex is necessarily along a shortest path. That
# guarantee is what makes it the right tool for unweighted shortest paths -
# and exactly why DFS, which dives to a leaf immediately, cannot do this.
#
# Two details do all the work:
#   - Mark a vertex visited when you ENQUEUE it, not when you dequeue it -
#     otherwise it can be queued several times before you get to it.
#   - Record where you came from, and the path falls out by walking back.

from collections import deque

edges = ['A-B', 'A-C', 'B-D', 'B-E', 'C-F', 'E-F', 'E-G', 'F-H', 'G-H']
start = 'A'
goal = 'H'


class Graph:
    def __init__(self):
        self.adjacency = {}

    def add_edge(self, a, b):
        self.adjacency.setdefault(a, set()).add(b)
        self.adjacency.setdefault(b, set()).add(a)

    def neighbors(self, vertex):
        return sorted(self.adjacency.get(vertex, set()))

    def vertices(self):
        return list(self.adjacency.keys())


def breadth_first(graph, source):
    queue = deque([source])
    distance = {source: 0}
    came_from = {source: None}
    order = []

    while queue:
        vertex = queue.popleft()   # deque.popleft is O(1); list.pop(0) is not
        order.append(vertex)

        for neighbor in graph.neighbors(vertex):
            if neighbor in distance:
                continue           # already found, and found sooner

            distance[neighbor] = distance[vertex] + 1
            came_from[neighbor] = vertex
            queue.append(neighbor)

    return order, distance, came_from


def reconstruct(came_from, target):
    """Walk the parent links backwards, then reverse."""
    if target not in came_from:
        return []

    path = []
    current = target

    while current is not None:
        path.append(current)
        current = came_from.get(current)

    return list(reversed(path))


graph = Graph()
for edge in edges:
    a, b = edge.split("-")
    graph.add_edge(a, b)

order, distance, came_from = breadth_first(graph, start)

print("visit order ->", " -> ".join(order))
print("distances   ->", ", ".join(v + ":" + str(d) for v, d in distance.items()))
print("shortest path " + start + " -> " + goal + " ->", " -> ".join(reconstruct(came_from, goal)))
print("length      ->", distance.get(goal), "edges")
print("unreachable ->", ", ".join(v for v in graph.vertices() if v not in distance) or "(none)")
`,
  },
  bench: {
    typescript: `breakstep.bench({
  // A ring with chords: V and E both grow linearly with n.
  input: (n) => {
    const g = new Graph();
    for (let i = 0; i < n; i++) {
      g.addEdge(String(i), String((i + 1) % n));
      g.addEdge(String(i), String((i + 7) % n));
    }
    return g;
  },
  run: (g) => breadthFirst(g as Graph, '0'),
  sizes: [32, 64, 128, 256, 512, 1024],
});
`,
    python: `def _ring(n):
    g = Graph()
    for i in range(n):
        g.add_edge(str(i), str((i + 1) % n))
        g.add_edge(str(i), str((i + 7) % n))
    return g


# A ring with chords: V and E both grow linearly with n.
breakstep.bench(input=_ring, run=lambda g: breadth_first(g, "0"),
          sizes=[32, 64, 128, 256, 512])
`,
  },
  instrumented: {
    typescript: `// BFS — the same solution, drawn explicitly.

const edges = breakstep.param<string[]>('edges', ['A-B', 'A-C', 'B-D']);
const start = breakstep.param<string>('start', 'A');
const goal = breakstep.param<string>('goal', 'H');

class Graph {
  adjacency = new Map<string, Set<string>>();

  addEdge(a: string, b: string): void {
    if (!this.adjacency.has(a)) this.adjacency.set(a, new Set());
    if (!this.adjacency.has(b)) this.adjacency.set(b, new Set());
    this.adjacency.get(a)!.add(b);
    this.adjacency.get(b)!.add(a);
  }

  neighbors(vertex: string): string[] {
    return [...(this.adjacency.get(vertex) ?? [])];
  }
}

function breadthFirst(graph: Graph, from: string) {
  const queue: string[] = [from];
  const distance = new Map<string, number>([[from, 0]]);
  const cameFrom = new Map<string, string | null>([[from, null]]);
  const order: string[] = [];
  let head = 0;

  while (head < queue.length) {
    const vertex = queue[head++];
    order.push(vertex);

    for (const neighbor of graph.neighbors(vertex)) {
      if (distance.has(neighbor)) continue;
      distance.set(neighbor, distance.get(vertex)! + 1);
      cameFrom.set(neighbor, vertex);
      queue.push(neighbor);
    }

    // Factory form: recolouring every visited vertex is O(V) per step.
    breakstep.show(graph.adjacency, () => ({
      label: \`visit \${vertex} at distance \${distance.get(vertex)}\`,
      highlight: {
        ...Object.fromEntries(order.map((v) => [v, 'visited' as const])),
        ...Object.fromEntries(queue.slice(head).map((v) => [v, 'compare' as const])),
        [vertex]: 'active' as const,
      },
      meta: { distance: distance.get(vertex), frontier: queue.slice(head).join(',') || '(empty)' },
    }));
  }

  return { order, distance, cameFrom };
}

const graph = new Graph();
for (const edge of edges) {
  const [a, b] = edge.split('-');
  graph.addEdge(a, b);
}

const { order, distance, cameFrom } = breadthFirst(graph, start);

const path: string[] = [];
let current: string | null = goal;
while (current !== null && cameFrom.has(current)) {
  path.push(current);
  current = cameFrom.get(current) ?? null;
}
path.reverse();

breakstep.show(graph.adjacency, {
  label: \`shortest path \${start} → \${goal}\`,
  highlight: Object.fromEntries(path.map((v) => [v, 'match' as const])),
});

breakstep.log('visit order ->', order.join(' → '));
breakstep.log('shortest path ->', path.join(' → '), '(' + distance.get(goal) + ' edges)');

breakstep.bench({
  input: (n) => {
    const g = new Graph();
    for (let i = 0; i < n; i++) {
      g.addEdge(String(i), String((i + 1) % n));
      g.addEdge(String(i), String((i + 7) % n));
    }
    return g;
  },
  run: (g) => breadthFirst(g as Graph, '0'),
  sizes: [32, 64, 128, 256, 512, 1024],
});
`,
    python: `# BFS - the same solution, drawn explicitly.

from collections import deque

edges = breakstep.param('edges', ['A-B', 'A-C', 'B-D'])
start = breakstep.param('start', 'A')
goal = breakstep.param('goal', 'H')


class Graph:
    def __init__(self):
        self.adjacency = {}

    def add_edge(self, a, b):
        self.adjacency.setdefault(a, set()).add(b)
        self.adjacency.setdefault(b, set()).add(a)

    def neighbors(self, vertex):
        return sorted(self.adjacency.get(vertex, set()))


def breadth_first(graph, source):
    queue = deque([source])
    distance = {source: 0}
    came_from = {source: None}
    order = []

    while queue:
        vertex = queue.popleft()
        order.append(vertex)

        for neighbor in graph.neighbors(vertex):
            if neighbor in distance:
                continue
            distance[neighbor] = distance[vertex] + 1
            came_from[neighbor] = vertex
            queue.append(neighbor)

        def frame(vertex=vertex):
            highlight = {v: "visited" for v in order}
            highlight.update({v: "compare" for v in queue})
            highlight[vertex] = "active"
            return {
                "label": f"visit {vertex} at distance {distance[vertex]}",
                "highlight": highlight,
                "meta": {"distance": distance[vertex],
                         "frontier": ",".join(queue) or "(empty)"},
            }

        breakstep.show(graph.adjacency, frame)

    return order, distance, came_from


graph = Graph()
for edge in edges:
    a, b = edge.split("-")
    graph.add_edge(a, b)

order, distance, came_from = breadth_first(graph, start)

path = []
current = goal
while current is not None and current in came_from:
    path.append(current)
    current = came_from.get(current)
path.reverse()

breakstep.show(graph.adjacency, label=f"shortest path {start} -> {goal}",
         highlight={v: "match" for v in path})

breakstep.log("visit order ->", " -> ".join(order))
breakstep.log("shortest path ->", " -> ".join(path), "(" + str(distance.get(goal)) + " edges)")


def _ring(n):
    g = Graph()
    for i in range(n):
        g.add_edge(str(i), str((i + 1) % n))
        g.add_edge(str(i), str((i + 7) % n))
    return g


breakstep.bench(input=_ring, run=lambda g: breadth_first(g, "0"),
          sizes=[32, 64, 128, 256, 512])
`,
  },
};

export const dfs: Template = {
  id: 'dfs',
  title: 'DFS — Connected Components',
  category: 'Patterns',
  blurb: 'A stack dives to a leaf before backtracking — perfect for reachability.',
  tags: ['dfs', 'graph', 'stack', 'recursion', 'components'],
  expected: { time: 'O(n)', space: 'O(n)' },
  params: [
    {
      name: 'edges',
      label: 'Edges (a-b)',
      type: 'stringArray',
      default: ['A-B', 'B-C', 'A-C', 'D-E', 'F-G', 'G-H', 'H-F'],
    },
    { name: 'start', label: 'Start vertex', type: 'string', default: 'A' },
  ],
  code: {
    typescript: `// PATTERN: depth-first search  ·  PROBLEM: connected components
//
// DFS commits to one direction and follows it until it runs out, then backs up
// and tries the next. That makes it useless for shortest paths — the first time
// it reaches a vertex may be by a long detour — but ideal for questions about
// REACHABILITY: what can I get to, is there a cycle, which pieces are separate.
//
// Counting connected components is the canonical use: start a DFS at every
// vertex you have not already seen, and each fresh start is one more component.
//
// Both forms are here. They explore in different orders (the iterative one
// reverses each vertex's neighbours, because a stack is LIFO) but reach exactly
// the same set — which is the only thing the answer depends on.

const edges = ['A-B', 'B-C', 'A-C', 'D-E', 'F-G', 'G-H', 'H-F'];
const start = 'A';

class Graph {
  adjacency = new Map<string, Set<string>>();

  addEdge(a: string, b: string): void {
    if (!this.adjacency.has(a)) this.adjacency.set(a, new Set());
    if (!this.adjacency.has(b)) this.adjacency.set(b, new Set());
    this.adjacency.get(a)!.add(b);
    this.adjacency.get(b)!.add(a);
  }

  neighbors(vertex: string): string[] {
    return [...(this.adjacency.get(vertex) ?? [])];
  }

  vertices(): string[] {
    return [...this.adjacency.keys()];
  }
}

/** Recursive: the call stack IS the stack. */
function depthFirst(graph: Graph, from: string, seen = new Set<string>()): string[] {
  if (seen.has(from)) return [];

  seen.add(from);
  const order = [from];

  for (const neighbor of graph.neighbors(from)) {
    order.push(...depthFirst(graph, neighbor, seen));
  }

  return order;
}

/** Iterative: an explicit stack, immune to stack-overflow on deep graphs. */
function depthFirstIterative(graph: Graph, from: string): string[] {
  const stack = [from];
  const seen = new Set<string>();
  const order: string[] = [];

  while (stack.length > 0) {
    const vertex = stack.pop()!;
    if (seen.has(vertex)) continue;

    seen.add(vertex);
    order.push(vertex);

    // Pushed in order, popped in reverse — hence the different visit sequence.
    for (const neighbor of graph.neighbors(vertex)) {
      if (!seen.has(neighbor)) stack.push(neighbor);
    }
  }

  return order;
}

/** One DFS per unvisited vertex; each fresh start is a new component. */
function connectedComponents(graph: Graph): string[][] {
  const seen = new Set<string>();
  const components: string[][] = [];

  for (const vertex of graph.vertices()) {
    if (seen.has(vertex)) continue;
    components.push(depthFirst(graph, vertex, seen));
  }

  return components;
}

const graph = new Graph();
for (const edge of edges) {
  const [a, b] = edge.split('-');
  graph.addEdge(a, b);
}

console.log('recursive DFS from ' + start + ' ->', depthFirst(graph, start).join(' → '));
console.log('iterative DFS from ' + start + ' ->', depthFirstIterative(graph, start).join(' → '));

const components = connectedComponents(graph);
console.log('components ->', components.length);
components.forEach((group, i) => console.log('  #' + (i + 1), '->', group.join(', ')));
console.log('A and D connected? ->', depthFirst(graph, 'A').includes('D'));
`,
    python: `# PATTERN: depth-first search  ·  PROBLEM: connected components
#
# DFS commits to one direction and follows it until it runs out, then backs up
# and tries the next. That makes it useless for shortest paths - the first time
# it reaches a vertex may be by a long detour - but ideal for questions about
# REACHABILITY: what can I get to, is there a cycle, which pieces are separate.
#
# Counting connected components is the canonical use: start a DFS at every
# vertex you have not already seen, and each fresh start is one more component.
#
# Both forms are here. They explore in different orders (the iterative one
# reverses each vertex's neighbours, because a stack is LIFO) but reach exactly
# the same set - which is the only thing the answer depends on.

edges = ['A-B', 'B-C', 'A-C', 'D-E', 'F-G', 'G-H', 'H-F']
start = 'A'


class Graph:
    def __init__(self):
        self.adjacency = {}

    def add_edge(self, a, b):
        self.adjacency.setdefault(a, set()).add(b)
        self.adjacency.setdefault(b, set()).add(a)

    def neighbors(self, vertex):
        return sorted(self.adjacency.get(vertex, set()))

    def vertices(self):
        return list(self.adjacency.keys())


def depth_first(graph, source, seen=None):
    """Recursive: the call stack IS the stack."""
    if seen is None:
        seen = set()
    if source in seen:
        return []

    seen.add(source)
    order = [source]

    for neighbor in graph.neighbors(source):
        order.extend(depth_first(graph, neighbor, seen))

    return order


def depth_first_iterative(graph, source):
    """Iterative: an explicit stack, immune to recursion limits."""
    stack = [source]
    seen = set()
    order = []

    while stack:
        vertex = stack.pop()
        if vertex in seen:
            continue

        seen.add(vertex)
        order.append(vertex)

        # Pushed in order, popped in reverse - hence the different sequence.
        for neighbor in graph.neighbors(vertex):
            if neighbor not in seen:
                stack.append(neighbor)

    return order


def connected_components(graph):
    """One DFS per unvisited vertex; each fresh start is a new component."""
    seen = set()
    components = []

    for vertex in graph.vertices():
        if vertex in seen:
            continue
        components.append(depth_first(graph, vertex, seen))

    return components


graph = Graph()
for edge in edges:
    a, b = edge.split("-")
    graph.add_edge(a, b)

print("recursive DFS from " + start + " ->", " -> ".join(depth_first(graph, start)))
print("iterative DFS from " + start + " ->", " -> ".join(depth_first_iterative(graph, start)))

components = connected_components(graph)
print("components ->", len(components))
for i, group in enumerate(components):
    print("  #" + str(i + 1), "->", ", ".join(group))
print("A and D connected? ->", "D" in depth_first(graph, "A"))
`,
  },
  bench: {
    typescript: `breakstep.bench({
  input: (n) => {
    const g = new Graph();
    for (let i = 0; i < n; i++) {
      g.addEdge(String(i), String((i + 1) % n));
      g.addEdge(String(i), String((i + 7) % n));
    }
    return g;
  },
  run: (g) => depthFirstIterative(g as Graph, '0'),
  sizes: [32, 64, 128, 256, 512, 1024],
});
`,
    python: `def _ring(n):
    g = Graph()
    for i in range(n):
        g.add_edge(str(i), str((i + 1) % n))
        g.add_edge(str(i), str((i + 7) % n))
    return g


breakstep.bench(input=_ring, run=lambda g: depth_first_iterative(g, "0"),
          sizes=[32, 64, 128, 256, 512])
`,
  },
  instrumented: {
    typescript: `// DFS — the same solution, drawn explicitly.

const edges = breakstep.param<string[]>('edges', ['A-B', 'B-C', 'A-C', 'D-E']);
const start = breakstep.param<string>('start', 'A');

class Graph {
  adjacency = new Map<string, Set<string>>();

  addEdge(a: string, b: string): void {
    if (!this.adjacency.has(a)) this.adjacency.set(a, new Set());
    if (!this.adjacency.has(b)) this.adjacency.set(b, new Set());
    this.adjacency.get(a)!.add(b);
    this.adjacency.get(b)!.add(a);
  }

  neighbors(vertex: string): string[] {
    return [...(this.adjacency.get(vertex) ?? [])];
  }

  vertices(): string[] {
    return [...this.adjacency.keys()];
  }
}

function depthFirstIterative(graph: Graph, from: string): string[] {
  const stack = [from];
  const seen = new Set<string>();
  const order: string[] = [];

  while (stack.length > 0) {
    const vertex = stack.pop()!;
    if (seen.has(vertex)) continue;

    seen.add(vertex);
    order.push(vertex);

    for (const neighbor of graph.neighbors(vertex)) {
      if (!seen.has(neighbor)) stack.push(neighbor);
    }

    breakstep.show(graph.adjacency, () => ({
      label: \`visit \${vertex} (depth-first)\`,
      highlight: {
        ...Object.fromEntries(order.map((v) => [v, 'visited' as const])),
        ...Object.fromEntries(stack.map((v) => [v, 'compare' as const])),
        [vertex]: 'active' as const,
      },
      meta: { visited: order.length, stack: stack.join(',') || '(empty)' },
    }));
  }

  return order;
}

function connectedComponents(graph: Graph): string[][] {
  const seen = new Set<string>();
  const components: string[][] = [];

  for (const vertex of graph.vertices()) {
    if (seen.has(vertex)) continue;

    const group = depthFirstIterative(graph, vertex);
    for (const v of group) seen.add(v);
    components.push(group);
  }

  return components;
}

const graph = new Graph();
for (const edge of edges) {
  const [a, b] = edge.split('-');
  graph.addEdge(a, b);
}

breakstep.log('DFS from ' + start + ' ->', depthFirstIterative(graph, start).join(' → '));

const components = connectedComponents(graph);
breakstep.log('components ->', components.length);
components.forEach((group, i) => breakstep.log('  #' + (i + 1), '->', group.join(', ')));

breakstep.bench({
  input: (n) => {
    const g = new Graph();
    for (let i = 0; i < n; i++) {
      g.addEdge(String(i), String((i + 1) % n));
      g.addEdge(String(i), String((i + 7) % n));
    }
    return g;
  },
  run: (g) => depthFirstIterative(g as Graph, '0'),
  sizes: [32, 64, 128, 256, 512, 1024],
});
`,
    python: `# DFS - the same solution, drawn explicitly.

edges = breakstep.param('edges', ['A-B', 'B-C', 'A-C', 'D-E'])
start = breakstep.param('start', 'A')


class Graph:
    def __init__(self):
        self.adjacency = {}

    def add_edge(self, a, b):
        self.adjacency.setdefault(a, set()).add(b)
        self.adjacency.setdefault(b, set()).add(a)

    def neighbors(self, vertex):
        return sorted(self.adjacency.get(vertex, set()))

    def vertices(self):
        return list(self.adjacency.keys())


def depth_first_iterative(graph, source):
    stack = [source]
    seen = set()
    order = []

    while stack:
        vertex = stack.pop()
        if vertex in seen:
            continue

        seen.add(vertex)
        order.append(vertex)

        for neighbor in graph.neighbors(vertex):
            if neighbor not in seen:
                stack.append(neighbor)

        def frame(vertex=vertex):
            highlight = {v: "visited" for v in order}
            highlight.update({v: "compare" for v in stack})
            highlight[vertex] = "active"
            return {
                "label": f"visit {vertex} (depth-first)",
                "highlight": highlight,
                "meta": {"visited": len(order), "stack": ",".join(stack) or "(empty)"},
            }

        breakstep.show(graph.adjacency, frame)

    return order


def connected_components(graph):
    seen = set()
    components = []

    for vertex in graph.vertices():
        if vertex in seen:
            continue
        group = depth_first_iterative(graph, vertex)
        seen.update(group)
        components.append(group)

    return components


graph = Graph()
for edge in edges:
    a, b = edge.split("-")
    graph.add_edge(a, b)

breakstep.log("DFS from " + start + " ->", " -> ".join(depth_first_iterative(graph, start)))

components = connected_components(graph)
breakstep.log("components ->", len(components))
for i, group in enumerate(components):
    breakstep.log("  #" + str(i + 1), "->", ", ".join(group))


def _ring(n):
    g = Graph()
    for i in range(n):
        g.add_edge(str(i), str((i + 1) % n))
        g.add_edge(str(i), str((i + 7) % n))
    return g


breakstep.bench(input=_ring, run=lambda g: depth_first_iterative(g, "0"),
          sizes=[32, 64, 128, 256, 512])
`,
  },
};
