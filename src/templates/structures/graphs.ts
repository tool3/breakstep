import type { Template } from '@/types';

export const graph: Template = {
  id: 'graph',
  title: 'Graph',
  category: 'Data structures',
  blurb: 'An adjacency list: vertices, edges, degrees — and why not a matrix.',
  tags: ['graph', 'adjacency-list', 'edges'],
  expected: { time: 'O(n)', space: 'O(n)' },
  params: [
    {
      name: 'edges',
      label: 'Edges (a-b)',
      type: 'stringArray',
      default: ['A-B', 'A-C', 'B-D', 'B-E', 'C-F', 'E-F', 'E-G', 'F-H'],
    },
    { name: 'from', binds: 'fromVertex', label: 'Inspect vertex', type: 'string', default: 'B' },
  ],
  code: {
    typescript: `// Undirected graph, stored as an adjacency list.
//
// Two representations compete:
//
//   adjacency LIST    — a set of neighbours per vertex.
//                       O(V + E) memory, O(1) edge test, O(degree) to iterate.
//   adjacency MATRIX  — a V × V grid of booleans.
//                       O(V²) memory whether or not the edges exist.
//
// Real graphs are sparse — a social network has millions of people and a few
// hundred friends each — so the list wins almost every time. The matrix pays
// off only when the graph is dense or you need edge lookups in a tight loop.
//
// A Set per vertex (rather than an array) keeps \`hasEdge\` O(1) and makes
// duplicate edges impossible.

const edges = ['A-B', 'A-C', 'B-D', 'B-E', 'C-F', 'E-F', 'E-G', 'F-H'];
const fromVertex = 'B';

class Graph {
  adjacency = new Map<string, Set<string>>();

  addVertex(vertex: string): void {
    if (!this.adjacency.has(vertex)) this.adjacency.set(vertex, new Set());
  }

  /** Undirected: an edge is recorded on both endpoints. */
  addEdge(a: string, b: string): void {
    this.addVertex(a);
    this.addVertex(b);
    this.adjacency.get(a)!.add(b);
    this.adjacency.get(b)!.add(a);
  }

  removeEdge(a: string, b: string): void {
    this.adjacency.get(a)?.delete(b);
    this.adjacency.get(b)?.delete(a);
  }

  hasEdge(a: string, b: string): boolean {
    return this.adjacency.get(a)?.has(b) === true;
  }

  neighbors(vertex: string): string[] {
    return [...(this.adjacency.get(vertex) ?? [])];
  }

  degree(vertex: string): number {
    return this.adjacency.get(vertex)?.size ?? 0;
  }

  vertices(): string[] {
    return [...this.adjacency.keys()];
  }

  /** Each undirected edge is stored twice, so halve the total. */
  edgeCount(): number {
    let total = 0;
    for (const neighbours of this.adjacency.values()) total += neighbours.size;
    return total / 2;
  }
}

const graph = new Graph();
for (const edge of edges) {
  const [a, b] = edge.split('-');
  graph.addEdge(a, b);
}

console.log('vertices   ->', graph.vertices().join(', '));
console.log('edges      ->', graph.edgeCount());
console.log('neighbors(' + fromVertex + ') ->', graph.neighbors(fromVertex).join(', '));
console.log('degree(' + fromVertex + ')    ->', graph.degree(fromVertex));
console.log('hasEdge(A,B) ->', graph.hasEdge('A', 'B'));
console.log('hasEdge(A,D) ->', graph.hasEdge('A', 'D'));

// Degree distribution says a lot about a graph's shape at a glance.
const busiest = graph.vertices().reduce((best, v) =>
  graph.degree(v) > graph.degree(best) ? v : best,
);
console.log('most connected ->', busiest, 'with degree', graph.degree(busiest));
`,
    python: `# Undirected graph, stored as an adjacency list.
#
# Two representations compete:
#
#   adjacency LIST    - a set of neighbours per vertex.
#                       O(V + E) memory, O(1) edge test, O(degree) to iterate.
#   adjacency MATRIX  - a V x V grid of booleans.
#                       O(V^2) memory whether or not the edges exist.
#
# Real graphs are sparse - a social network has millions of people and a few
# hundred friends each - so the list wins almost every time. The matrix pays
# off only when the graph is dense or you need edge lookups in a tight loop.
#
# A set per vertex (rather than a list) keeps \`has_edge\` O(1) and makes
# duplicate edges impossible.

edges = ['A-B', 'A-C', 'B-D', 'B-E', 'C-F', 'E-F', 'E-G', 'F-H']
fromVertex = 'B'


class Graph:
    def __init__(self):
        self.adjacency = {}

    def add_vertex(self, vertex):
        if vertex not in self.adjacency:
            self.adjacency[vertex] = set()

    def add_edge(self, a, b):
        """Undirected: an edge is recorded on both endpoints."""
        self.add_vertex(a)
        self.add_vertex(b)
        self.adjacency[a].add(b)
        self.adjacency[b].add(a)

    def remove_edge(self, a, b):
        self.adjacency.get(a, set()).discard(b)
        self.adjacency.get(b, set()).discard(a)

    def has_edge(self, a, b):
        return b in self.adjacency.get(a, set())

    def neighbors(self, vertex):
        return sorted(self.adjacency.get(vertex, set()))

    def degree(self, vertex):
        return len(self.adjacency.get(vertex, set()))

    def vertices(self):
        return list(self.adjacency.keys())

    def edge_count(self):
        """Each undirected edge is stored twice, so halve the total."""
        total = 0
        for neighbours in self.adjacency.values():
            total += len(neighbours)
        return total // 2


graph = Graph()
for edge in edges:
    a, b = edge.split("-")
    graph.add_edge(a, b)

print("vertices   ->", ", ".join(graph.vertices()))
print("edges      ->", graph.edge_count())
print("neighbors(" + fromVertex + ") ->", ", ".join(graph.neighbors(fromVertex)))
print("degree(" + fromVertex + ")    ->", graph.degree(fromVertex))
print("has_edge(A,B) ->", graph.has_edge("A", "B"))
print("has_edge(A,D) ->", graph.has_edge("A", "D"))

# Degree distribution says a lot about a graph's shape at a glance.
busiest = graph.vertices()[0]
for v in graph.vertices():
    if graph.degree(v) > graph.degree(busiest):
        busiest = v
print("most connected ->", busiest, "with degree", graph.degree(busiest))
`,
  },
  bench: {
    typescript: `breakstep.bench({
  // A ring with chords: V and E both grow linearly with n.
  input: (n) => Array.from({ length: n }, (_, i) => i + '-' + ((i + 1) % n)),
  run: (list: string[]) => {
    const g = new Graph();
    for (const e of list) {
      const [a, b] = e.split('-');
      g.addEdge(a, b);
    }
    for (const v of g.vertices()) g.degree(v);
    return g.edgeCount();
  },
});
`,
    python: `def _bench(pairs):
    g = Graph()
    for e in pairs:
        a, b = e.split("-")
        g.add_edge(a, b)
    for v in g.vertices():
        g.degree(v)
    return g.edge_count()


# A ring with chords: V and E both grow linearly with n.
breakstep.bench(input=lambda n: [str(i) + "-" + str((i + 1) % n) for i in range(n)], run=_bench)
`,
  },
  instrumented: {
    typescript: `// Graph — the same structure, drawn explicitly.

const edges = breakstep.param<string[]>('edges', ['A-B', 'A-C', 'B-D']);
const fromVertex = breakstep.param<string>('from', 'B');

class Graph {
  adjacency = new Map<string, Set<string>>();

  addVertex(vertex: string): void {
    if (!this.adjacency.has(vertex)) this.adjacency.set(vertex, new Set());
  }

  addEdge(a: string, b: string): void {
    this.addVertex(a);
    this.addVertex(b);
    this.adjacency.get(a)!.add(b);
    this.adjacency.get(b)!.add(a);

    breakstep.show(this.adjacency, {
      label: \`addEdge(\${a}, \${b})\`,
      highlight: { [a]: 'active', [b]: 'active' },
      meta: { vertices: this.adjacency.size },
    });
  }

  neighbors(vertex: string): string[] {
    const found = [...(this.adjacency.get(vertex) ?? [])];
    breakstep.show(this.adjacency, {
      label: \`neighbors(\${vertex}) → \${found.join(', ')}\`,
      highlight: {
        [vertex]: 'match',
        ...Object.fromEntries(found.map((n) => [n, 'compare' as const])),
      },
      meta: { degree: found.length },
    });
    return found;
  }

  degree(vertex: string): number {
    return this.adjacency.get(vertex)?.size ?? 0;
  }

  vertices(): string[] {
    return [...this.adjacency.keys()];
  }

  edgeCount(): number {
    let total = 0;
    for (const neighbours of this.adjacency.values()) total += neighbours.size;
    return total / 2;
  }
}

const graph = new Graph();
for (const edge of edges) {
  const [a, b] = edge.split('-');
  graph.addEdge(a, b);
}

breakstep.log('vertices ->', graph.vertices().join(', '));
breakstep.log('edges    ->', graph.edgeCount());
breakstep.log('neighbors(' + fromVertex + ') ->', graph.neighbors(fromVertex).join(', '));

breakstep.bench({
  input: (n) => Array.from({ length: n }, (_, i) => i + '-' + ((i + 1) % n)),
  run: (list: string[]) => {
    const g = new Graph();
    for (const e of list) {
      const [a, b] = e.split('-');
      g.addEdge(a, b);
    }
    for (const v of g.vertices()) g.degree(v);
    return g.edgeCount();
  },
});
`,
    python: `# Graph - the same structure, drawn explicitly.

edges = breakstep.param('edges', ['A-B', 'A-C', 'B-D'])
fromVertex = breakstep.param('from', 'B')


class Graph:
    def __init__(self):
        self.adjacency = {}

    def add_vertex(self, vertex):
        if vertex not in self.adjacency:
            self.adjacency[vertex] = set()

    def add_edge(self, a, b):
        self.add_vertex(a)
        self.add_vertex(b)
        self.adjacency[a].add(b)
        self.adjacency[b].add(a)

        breakstep.show(self.adjacency, label=f"add_edge({a}, {b})",
                 highlight={a: "active", b: "active"},
                 meta={"vertices": len(self.adjacency)})

    def neighbors(self, vertex):
        found = sorted(self.adjacency.get(vertex, set()))
        highlight = {vertex: "match"}
        highlight.update({n: "compare" for n in found})
        breakstep.show(self.adjacency, label=f"neighbors({vertex}) -> {', '.join(found)}",
                 highlight=highlight, meta={"degree": len(found)})
        return found

    def degree(self, vertex):
        return len(self.adjacency.get(vertex, set()))

    def vertices(self):
        return list(self.adjacency.keys())

    def edge_count(self):
        total = 0
        for neighbours in self.adjacency.values():
            total += len(neighbours)
        return total // 2


graph = Graph()
for edge in edges:
    a, b = edge.split("-")
    graph.add_edge(a, b)

breakstep.log("vertices ->", ", ".join(graph.vertices()))
breakstep.log("edges    ->", graph.edge_count())
breakstep.log("neighbors(" + fromVertex + ") ->", ", ".join(graph.neighbors(fromVertex)))


def _bench(pairs):
    g = Graph()
    for e in pairs:
        a, b = e.split("-")
        g.add_edge(a, b)
    for v in g.vertices():
        g.degree(v)
    return g.edge_count()


breakstep.bench(input=lambda n: [str(i) + "-" + str((i + 1) % n) for i in range(n)], run=_bench)
`,
  },
};

export const dag: Template = {
  id: 'dag',
  title: 'DAG & Topological Sort',
  category: 'Data structures',
  blurb: 'Directed, acyclic, and orderable — the shape of every dependency graph.',
  tags: ['dag', 'directed', 'topological-sort', 'cycles'],
  expected: { time: 'O(n)', space: 'O(n)' },
  params: [
    {
      name: 'dependencies',
      label: 'Edges (before→after)',
      type: 'stringArray',
      default: ['parse>compile', 'lex>parse', 'compile>link', 'compile>test', 'link>package', 'test>package'],
    },
    {
      name: 'extraEdge',
      label: 'Extra edge to try',
      type: 'string',
      default: 'package>lex',
      help: 'The default closes a loop, so the cycle check has something to find.',
    },
  ],
  code: {
    typescript: `// Directed acyclic graph, and the sort that only a DAG admits.
//
// "Acyclic" is not decoration — it is the precondition. A topological order is
// a listing where every edge points forwards, and that exists if and only if
// there is no cycle. Build systems, task schedulers, spreadsheet recalculation
// and module loaders are all this same problem.
//
// Kahn's algorithm computes it by repeatedly taking a vertex with no remaining
// prerequisites. If it runs out of such vertices before covering every vertex,
// what remains must contain a cycle — so the sort doubles as the cycle test.

const dependencies = ['parse>compile', 'lex>parse', 'compile>link', 'compile>test', 'link>package', 'test>package'];
const extraEdge = 'package>lex';

class DAG {
  adjacency = new Map<string, string[]>();

  addVertex(vertex: string): void {
    if (!this.adjacency.has(vertex)) this.adjacency.set(vertex, []);
  }

  /** Directed: \`from\` must come before \`to\`. Recorded once, not twice. */
  addEdge(from: string, to: string): void {
    this.addVertex(from);
    this.addVertex(to);
    this.adjacency.get(from)!.push(to);
  }

  vertices(): string[] {
    return [...this.adjacency.keys()];
  }

  /** How many prerequisites each vertex is still waiting on. */
  inDegrees(): Map<string, number> {
    const degrees = new Map<string, number>();
    for (const vertex of this.vertices()) degrees.set(vertex, 0);

    for (const targets of this.adjacency.values()) {
      for (const target of targets) degrees.set(target, (degrees.get(target) ?? 0) + 1);
    }
    return degrees;
  }

  /**
   * Kahn's algorithm. Returns null when a cycle makes ordering impossible —
   * that null IS the cycle detector.
   */
  topologicalSort(): string[] | null {
    const degrees = this.inDegrees();
    const ready: string[] = [];

    for (const [vertex, degree] of degrees) {
      if (degree === 0) ready.push(vertex);
    }

    const order: string[] = [];

    while (ready.length > 0) {
      const vertex = ready.shift()!;
      order.push(vertex);

      // Finishing this vertex releases everything that depended on it.
      for (const next of this.adjacency.get(vertex) ?? []) {
        const remaining = degrees.get(next)! - 1;
        degrees.set(next, remaining);
        if (remaining === 0) ready.push(next);
      }
    }

    return order.length === this.adjacency.size ? order : null;
  }

  hasCycle(): boolean {
    return this.topologicalSort() === null;
  }
}

const dag = new DAG();
for (const dependency of dependencies) {
  const [from, to] = dependency.split('>');
  dag.addEdge(from, to);
}

console.log('vertices ->', dag.vertices().join(', '));
console.log('in-degrees ->', [...dag.inDegrees()].map(([v, d]) => v + ':' + d).join(', '));

const order = dag.topologicalSort();
console.log('topological order ->', order ? order.join(' → ') : 'impossible');
console.log('hasCycle() ->', dag.hasCycle());

// Now close a loop and watch the same routine refuse to produce an order.
const [from, to] = extraEdge.split('>');
dag.addEdge(from, to);

console.log('after adding ' + extraEdge + ':');
console.log('  topological order ->', dag.topologicalSort() ?? 'impossible — there is a cycle');
console.log('  hasCycle() ->', dag.hasCycle());
`,
    python: `# Directed acyclic graph, and the sort that only a DAG admits.
#
# "Acyclic" is not decoration - it is the precondition. A topological order is
# a listing where every edge points forwards, and that exists if and only if
# there is no cycle. Build systems, task schedulers, spreadsheet recalculation
# and module loaders are all this same problem.
#
# Kahn's algorithm computes it by repeatedly taking a vertex with no remaining
# prerequisites. If it runs out of such vertices before covering every vertex,
# what remains must contain a cycle - so the sort doubles as the cycle test.

from collections import deque

dependencies = ['parse>compile', 'lex>parse', 'compile>link', 'compile>test', 'link>package', 'test>package']
extraEdge = 'package>lex'


class DAG:
    def __init__(self):
        self.adjacency = {}

    def add_vertex(self, vertex):
        if vertex not in self.adjacency:
            self.adjacency[vertex] = []

    def add_edge(self, source, target):
        """Directed: source must come before target. Recorded once, not twice."""
        self.add_vertex(source)
        self.add_vertex(target)
        self.adjacency[source].append(target)

    def vertices(self):
        return list(self.adjacency.keys())

    def in_degrees(self):
        """How many prerequisites each vertex is still waiting on."""
        degrees = {v: 0 for v in self.vertices()}
        for targets in self.adjacency.values():
            for target in targets:
                degrees[target] = degrees.get(target, 0) + 1
        return degrees

    def topological_sort(self):
        """Kahn's algorithm. None when a cycle makes ordering impossible -
        that None IS the cycle detector."""
        degrees = self.in_degrees()
        ready = deque(v for v, d in degrees.items() if d == 0)
        order = []

        while ready:
            vertex = ready.popleft()
            order.append(vertex)

            # Finishing this vertex releases everything that depended on it.
            for nxt in self.adjacency.get(vertex, []):
                degrees[nxt] -= 1
                if degrees[nxt] == 0:
                    ready.append(nxt)

        return order if len(order) == len(self.adjacency) else None

    def has_cycle(self):
        return self.topological_sort() is None


dag = DAG()
for dependency in dependencies:
    source, target = dependency.split(">")
    dag.add_edge(source, target)

print("vertices ->", ", ".join(dag.vertices()))
print("in-degrees ->", ", ".join(v + ":" + str(d) for v, d in dag.in_degrees().items()))

order = dag.topological_sort()
print("topological order ->", " -> ".join(order) if order else "impossible")
print("has_cycle() ->", dag.has_cycle())

# Now close a loop and watch the same routine refuse to produce an order.
source, target = extraEdge.split(">")
dag.add_edge(source, target)

print("after adding " + extraEdge + ":")
print("  topological order ->", dag.topological_sort() or "impossible - there is a cycle")
print("  has_cycle() ->", dag.has_cycle())
`,
  },
  bench: {
    typescript: `breakstep.bench({
  // A chain of n dependencies — the longest possible topological order.
  input: (n) => Array.from({ length: n - 1 }, (_, i) => 'v' + i + '>v' + (i + 1)),
  run: (list: string[]) => {
    const d = new DAG();
    for (const e of list) {
      const [from, to] = e.split('>');
      d.addEdge(from, to);
    }
    return d.topologicalSort();
  },
});
`,
    python: `def _bench(pairs):
    d = DAG()
    for e in pairs:
        source, target = e.split(">")
        d.add_edge(source, target)
    return d.topological_sort()


# A chain of n dependencies - the longest possible topological order.
breakstep.bench(input=lambda n: ["v" + str(i) + ">v" + str(i + 1) for i in range(n - 1)], run=_bench)
`,
  },
  instrumented: {
    typescript: `// DAG — the same structure, drawn explicitly.
//
// \`directed: true\` keeps the arrowheads: without it BCS infers direction from
// whether edges are reciprocal, and a DAG's never are.

const dependencies = breakstep.param<string[]>('dependencies', ['lex>parse', 'parse>compile']);
const extraEdge = breakstep.param<string>('extraEdge', 'package>lex');

class DAG {
  adjacency = new Map<string, string[]>();

  addVertex(vertex: string): void {
    if (!this.adjacency.has(vertex)) this.adjacency.set(vertex, []);
  }

  addEdge(from: string, to: string): void {
    this.addVertex(from);
    this.addVertex(to);
    this.adjacency.get(from)!.push(to);

    breakstep.show(this.adjacency, {
      directed: true,
      label: \`\${from} must come before \${to}\`,
      highlight: { [from]: 'active', [to]: 'compare' },
    });
  }

  inDegrees(): Map<string, number> {
    const degrees = new Map<string, number>();
    for (const vertex of this.adjacency.keys()) degrees.set(vertex, 0);
    for (const targets of this.adjacency.values()) {
      for (const target of targets) degrees.set(target, (degrees.get(target) ?? 0) + 1);
    }
    return degrees;
  }

  topologicalSort(): string[] | null {
    const degrees = this.inDegrees();
    const ready: string[] = [];
    for (const [vertex, degree] of degrees) if (degree === 0) ready.push(vertex);

    const order: string[] = [];

    while (ready.length > 0) {
      const vertex = ready.shift()!;
      order.push(vertex);

      breakstep.show(this.adjacency, () => ({
        directed: true,
        label: \`take \${vertex} — no prerequisites left\`,
        highlight: {
          ...Object.fromEntries(order.map((v) => [v, 'visited' as const])),
          ...Object.fromEntries(ready.map((v) => [v, 'compare' as const])),
          [vertex]: 'active' as const,
        },
        meta: { placed: order.length, ready: ready.join(',') || '(none)' },
      }));

      for (const next of this.adjacency.get(vertex) ?? []) {
        const remaining = degrees.get(next)! - 1;
        degrees.set(next, remaining);
        if (remaining === 0) ready.push(next);
      }
    }

    const complete = order.length === this.adjacency.size;
    breakstep.show(this.adjacency, {
      directed: true,
      label: complete ? 'ordered every vertex' : 'stuck — the rest form a cycle',
      highlight: Object.fromEntries(
        [...this.adjacency.keys()].map((v) => [v, order.includes(v) ? 'visited' : 'error']),
      ),
    });

    return complete ? order : null;
  }

  hasCycle(): boolean {
    return this.topologicalSort() === null;
  }
}

const dag = new DAG();
for (const dependency of dependencies) {
  const [from, to] = dependency.split('>');
  dag.addEdge(from, to);
}

const order = dag.topologicalSort();
breakstep.log('topological order ->', order ? order.join(' → ') : 'impossible');

const [from, to] = extraEdge.split('>');
dag.addEdge(from, to);
breakstep.log('after ' + extraEdge + ' ->', dag.topologicalSort() ?? 'impossible — there is a cycle');

breakstep.bench({
  input: (n) => Array.from({ length: n - 1 }, (_, i) => 'v' + i + '>v' + (i + 1)),
  run: (list: string[]) => {
    const d = new DAG();
    for (const e of list) {
      const [a, b] = e.split('>');
      d.addEdge(a, b);
    }
    return d.topologicalSort();
  },
});
`,
    python: `# DAG - the same structure, drawn explicitly.
#
# \`directed=True\` keeps the arrowheads: without it BCS infers direction from
# whether edges are reciprocal, and a DAG's never are.

from collections import deque

dependencies = breakstep.param('dependencies', ['lex>parse', 'parse>compile'])
extraEdge = breakstep.param('extraEdge', 'package>lex')


class DAG:
    def __init__(self):
        self.adjacency = {}

    def add_vertex(self, vertex):
        if vertex not in self.adjacency:
            self.adjacency[vertex] = []

    def add_edge(self, source, target):
        self.add_vertex(source)
        self.add_vertex(target)
        self.adjacency[source].append(target)

        breakstep.show(self.adjacency, directed=True,
                 label=f"{source} must come before {target}",
                 highlight={source: "active", target: "compare"})

    def in_degrees(self):
        degrees = {v: 0 for v in self.adjacency}
        for targets in self.adjacency.values():
            for target in targets:
                degrees[target] = degrees.get(target, 0) + 1
        return degrees

    def topological_sort(self):
        degrees = self.in_degrees()
        ready = deque(v for v, d in degrees.items() if d == 0)
        order = []

        while ready:
            vertex = ready.popleft()
            order.append(vertex)

            def frame(vertex=vertex):
                highlight = {v: "visited" for v in order}
                highlight.update({v: "compare" for v in ready})
                highlight[vertex] = "active"
                return {
                    "directed": True,
                    "label": f"take {vertex} - no prerequisites left",
                    "highlight": highlight,
                    "meta": {"placed": len(order), "ready": ",".join(ready) or "(none)"},
                }

            breakstep.show(self.adjacency, frame)

            for nxt in self.adjacency.get(vertex, []):
                degrees[nxt] -= 1
                if degrees[nxt] == 0:
                    ready.append(nxt)

        complete = len(order) == len(self.adjacency)
        breakstep.show(self.adjacency, directed=True,
                 label="ordered every vertex" if complete else "stuck - the rest form a cycle",
                 highlight={v: ("visited" if v in order else "error") for v in self.adjacency})

        return order if complete else None

    def has_cycle(self):
        return self.topological_sort() is None


dag = DAG()
for dependency in dependencies:
    source, target = dependency.split(">")
    dag.add_edge(source, target)

order = dag.topological_sort()
breakstep.log("topological order ->", " -> ".join(order) if order else "impossible")

source, target = extraEdge.split(">")
dag.add_edge(source, target)
breakstep.log("after " + extraEdge + " ->", dag.topological_sort() or "impossible - there is a cycle")


def _bench(pairs):
    d = DAG()
    for e in pairs:
        a, b = e.split(">")
        d.add_edge(a, b)
    return d.topological_sort()


breakstep.bench(input=lambda n: ["v" + str(i) + ">v" + str(i + 1) for i in range(n - 1)], run=_bench)
`,
  },
};
