import type { LeetProblem } from '../types';

// --- 133 · Clone Graph -------------------------------------------------------

const cloneHeader = {
  typescript: `class GraphNode {
  val: number;
  neighbors: GraphNode[] = [];
  constructor(val: number) {
    this.val = val;
  }
}

const adjacency = [[2, 4], [1, 3], [2, 4], [1, 3]];

`,
  python: `class GraphNode:
    def __init__(self, val):
        self.val = val
        self.neighbors = []


adjacency = [[2, 4], [1, 3], [2, 4], [1, 3]]

`,
};

const cloneDriver = {
  typescript: `
// --- examples ---------------------------------------------------------------

/** Build a graph from an adjacency list where node i has value i + 1. */
function buildGraph(adjacency: number[][]): GraphNode | null {
  if (adjacency.length === 0) return null;

  const nodes = adjacency.map((_, i) => new GraphNode(i + 1));
  adjacency.forEach((neighbors, i) => {
    nodes[i].neighbors = neighbors.map((val) => nodes[val - 1]);
  });

  return nodes[0];
}

/** Read a graph back out as an adjacency list, so it can be compared. */
function toAdjacency(node: GraphNode | null): number[][] {
  if (node === null) return [];

  const seen = new Map<number, GraphNode>();
  const stack = [node];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (seen.has(current.val)) continue;
    seen.set(current.val, current);
    for (const neighbor of current.neighbors) stack.push(neighbor);
  }

  return [...seen.keys()]
    .sort((a, b) => a - b)
    .map((val) => seen.get(val)!.neighbors.map((n) => n.val).sort((a, b) => a - b));
}

const original = buildGraph(adjacency);
const copy = cloneGraph(original);

console.log('example 1 ->', toAdjacency(copy));
console.log('is a copy ->', copy !== null && copy !== original ? 'true' : 'false');
console.log('example 2 ->', toAdjacency(cloneGraph(buildGraph([[]]))));
console.log('example 3 ->', toAdjacency(cloneGraph(buildGraph([]))));
`,
  python: `
# --- examples ---------------------------------------------------------------

def build_graph(adjacency):
    """Build a graph from an adjacency list where node i has value i + 1."""
    if not adjacency:
        return None

    nodes = [GraphNode(i + 1) for i in range(len(adjacency))]
    for i, neighbors in enumerate(adjacency):
        nodes[i].neighbors = [nodes[val - 1] for val in neighbors]

    return nodes[0]


def to_adjacency(node):
    """Read a graph back out as an adjacency list, so it can be compared."""
    if node is None:
        return []

    seen = {}
    stack = [node]
    while stack:
        current = stack.pop()
        if current.val in seen:
            continue
        seen[current.val] = current
        stack.extend(current.neighbors)

    return [sorted(n.val for n in seen[val].neighbors) for val in sorted(seen)]


original = build_graph(adjacency)
copy = clone_graph(original)

print('example 1 ->', to_adjacency(copy))
print('is a copy ->', 'true' if copy is not None and copy is not original else 'false')
print('example 2 ->', to_adjacency(clone_graph(build_graph([[]]))))
print('example 3 ->', to_adjacency(clone_graph(build_graph([]))))
`,
};

export const cloneGraph: LeetProblem = {
  slug: 'clone-graph',
  number: 133,
  title: 'Clone Graph',
  difficulty: 'Medium',
  topics: ['hash-table', 'depth-first-search', 'breadth-first-search', 'graph'],
  prompt:
    'Given a reference to a node in a connected undirected graph, return a deep copy: every node duplicated, every edge rebuilt between the duplicates, and no node from the original reachable from the copy.',
  constraints: [
    '0 ≤ number of nodes ≤ 100',
    'Node values are 1..n and unique',
    'The graph is connected, undirected, and has no repeated edges or self-loops',
  ],
  examples: [
    { input: 'adjacency = [[2,4],[1,3],[2,4],[1,3]]', output: '[[2,4],[1,3],[2,4],[1,3]]' },
    { input: 'adjacency = [[]]', output: '[[]]', note: 'one node, no edges' },
    { input: 'adjacency = []', output: '[]', note: 'empty graph' },
  ],
  techniques: [
    {
      pattern: 'dfs',
      rank: 1,
      why: 'Walk the graph and build each copy on first sight, remembering original → copy in a map. That map is what stops the cycles: meeting a node again returns the copy you already made instead of recursing forever.',
      complexity: { time: 'O(n)', space: 'O(n)' },
    },
    {
      pattern: 'bfs',
      rank: 2,
      why: 'The identical algorithm with a queue instead of the call stack. Worth preferring if the graph could be deep enough to overflow the stack.',
      complexity: { time: 'O(n)', space: 'O(n)' },
    },
  ],
  params: [],
  typescript: {
    starter: `${cloneHeader.typescript}function cloneGraph(node: GraphNode | null): GraphNode | null {
  // Remember original -> copy, or the cycles will never let you finish.
  // TODO
  return null;
}
${cloneDriver.typescript}`,
    solution: `${cloneHeader.typescript}function cloneGraph(node: GraphNode | null): GraphNode | null {
  const copies = new Map<GraphNode, GraphNode>();

  const visit = (current: GraphNode): GraphNode => {
    const existing = copies.get(current);
    if (existing) return existing;  // already copied: this is where cycles stop

    const copy = new GraphNode(current.val);
    // Registered BEFORE recursing, so a neighbour pointing back finds it.
    copies.set(current, copy);

    for (const neighbor of current.neighbors) copy.neighbors.push(visit(neighbor));
    return copy;
  };

  return node === null ? null : visit(node);
}
${cloneDriver.typescript}`,
  },
  python: {
    starter: `${cloneHeader.python}def clone_graph(node):
    """Remember original -> copy, or the cycles will never let you finish."""
    # TODO
    return None
${cloneDriver.python}`,
    solution: `${cloneHeader.python}def clone_graph(node):
    copies = {}

    def visit(current):
        if id(current) in copies:
            return copies[id(current)]  # already copied: cycles stop here

        copy = GraphNode(current.val)
        # Registered BEFORE recursing, so a neighbour pointing back finds it.
        copies[id(current)] = copy

        for neighbor in current.neighbors:
            copy.neighbors.append(visit(neighbor))
        return copy

    return None if node is None else visit(node)
${cloneDriver.python}`,
  },
  expectedOutput: [
    'example 1 -> [[2, 4], [1, 3], [2, 4], [1, 3]]',
    'is a copy -> true',
    'example 2 -> [[]]',
    'example 3 -> []',
  ],
};

// --- 207 · Course Schedule ---------------------------------------------------

const courseDriver = {
  typescript: `
// --- examples ---------------------------------------------------------------
console.log('example 1 ->', canFinish(numCourses, [[1, 0]]) ? 'true' : 'false');
console.log('example 2 ->', canFinish(2, [[1, 0], [0, 1]]) ? 'true' : 'false');
console.log('example 3 ->', canFinish(5, [[1, 0], [2, 1], [3, 2], [4, 3]]) ? 'true' : 'false');
`,
  python: `
# --- examples ---------------------------------------------------------------
print('example 1 ->', 'true' if can_finish(num_courses, [[1, 0]]) else 'false')
print('example 2 ->', 'true' if can_finish(2, [[1, 0], [0, 1]]) else 'false')
print('example 3 ->', 'true' if can_finish(5, [[1, 0], [2, 1], [3, 2], [4, 3]]) else 'false')
`,
};

export const courseSchedule: LeetProblem = {
  slug: 'course-schedule',
  number: 207,
  title: 'Course Schedule',
  difficulty: 'Medium',
  topics: ['depth-first-search', 'breadth-first-search', 'graph', 'topological-sort'],
  prompt:
    'There are numCourses courses, and prerequisites[i] = [a, b] means course b must come before course a. Decide whether some order exists that lets you take every course — that is, whether the prerequisite graph has a cycle.',
  constraints: [
    '1 ≤ numCourses ≤ 2000',
    '0 ≤ prerequisites.length ≤ 5000',
    'All prerequisite pairs are distinct',
  ],
  examples: [
    { input: 'numCourses = 2, prerequisites = [[1,0]]', output: 'true', note: 'take 0 then 1' },
    { input: 'numCourses = 2, prerequisites = [[1,0],[0,1]]', output: 'false', note: 'each needs the other' },
    { input: 'numCourses = 5, prerequisites = [[1,0],[2,1],[3,2],[4,3]]', output: 'true', note: 'a straight chain' },
  ],
  techniques: [
    {
      pattern: 'dfs',
      rank: 1,
      why: 'Colour each node white/grey/black as you walk. Meeting a grey node means you have re-entered a course still on the current path — a cycle, and the only thing that makes the schedule impossible.',
      complexity: { time: 'O(n)', space: 'O(n)' },
    },
    {
      pattern: 'bfs',
      rank: 2,
      why: "Kahn's algorithm: repeatedly take courses with no unmet prerequisites and remove them. If courses are left over when nothing is takeable, those courses are the cycle.",
      complexity: { time: 'O(n)', space: 'O(n)' },
    },
  ],
  params: [
    { name: 'numCourses', label: 'Courses', type: 'number', default: 2, min: 1, max: 20 },
  ],
  typescript: {
    starter: `const numCourses = 2;

function canFinish(numCourses: number, prerequisites: number[][]): boolean {
  // A schedule exists exactly when the prerequisite graph has no cycle.
  // TODO
  return false;
}
${courseDriver.typescript}`,
    solution: `const numCourses = 2;

function canFinish(numCourses: number, prerequisites: number[][]): boolean {
  const graph: number[][] = Array.from({ length: numCourses }, () => []);
  for (const [course, needs] of prerequisites) graph[needs].push(course);

  // 0 = untouched, 1 = on the current path, 2 = finished and known safe.
  const state = new Array<number>(numCourses).fill(0);

  const hasCycle = (course: number): boolean => {
    if (state[course] === 1) return true;   // back onto the current path
    if (state[course] === 2) return false;  // explored before, came out clean

    state[course] = 1;
    for (const next of graph[course]) {
      if (hasCycle(next)) return true;
    }
    state[course] = 2;

    return false;
  };

  for (let course = 0; course < numCourses; course++) {
    if (hasCycle(course)) return false;
  }

  return true;
}
${courseDriver.typescript}`,
  },
  python: {
    starter: `num_courses = 2


def can_finish(num_courses, prerequisites):
    """A schedule exists exactly when the prerequisite graph has no cycle."""
    # TODO
    return False
${courseDriver.python}`,
    solution: `num_courses = 2


def can_finish(num_courses, prerequisites):
    graph = [[] for _ in range(num_courses)]
    for course, needs in prerequisites:
        graph[needs].append(course)

    # 0 = untouched, 1 = on the current path, 2 = finished and known safe.
    state = [0] * num_courses

    def has_cycle(course):
        if state[course] == 1:
            return True   # back onto the current path
        if state[course] == 2:
            return False  # explored before, came out clean

        state[course] = 1
        for nxt in graph[course]:
            if has_cycle(nxt):
                return True
        state[course] = 2

        return False

    for course in range(num_courses):
        if has_cycle(course):
            return False

    return True
${courseDriver.python}`,
  },
  expectedOutput: ['example 1 -> true', 'example 2 -> false', 'example 3 -> true'],
};

// --- 695 · Max Area of Island ------------------------------------------------

const areaDriver = {
  typescript: `
// --- examples ---------------------------------------------------------------
console.log('example 1 ->', maxAreaOfIsland([
  [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0],
  [0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0],
  [0, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
]));
console.log('example 2 ->', maxAreaOfIsland([[0, 0, 0, 0, 0, 0, 0, 0]]));
console.log('example 3 ->', maxAreaOfIsland([[1, 1], [1, 0]]));
`,
  python: `
# --- examples ---------------------------------------------------------------
print('example 1 ->', max_area_of_island([
    [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0],
    [0, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
]))
print('example 2 ->', max_area_of_island([[0, 0, 0, 0, 0, 0, 0, 0]]))
print('example 3 ->', max_area_of_island([[1, 1], [1, 0]]))
`,
};

export const maxAreaOfIsland: LeetProblem = {
  slug: 'max-area-of-island',
  number: 695,
  title: 'Max Area of Island',
  difficulty: 'Medium',
  topics: ['array', 'depth-first-search', 'breadth-first-search', 'matrix'],
  prompt:
    'In a binary grid, an island is a group of 1s connected horizontally or vertically, and its area is how many cells it has. Return the area of the largest island, or 0 if there is no land at all.',
  constraints: ['1 ≤ rows, cols ≤ 50', 'grid[i][j] is 0 or 1'],
  examples: [
    { input: 'the 8×13 grid below', output: '6' },
    { input: 'grid = [[0,0,0,0,0,0,0,0]]', output: '0' },
    { input: 'grid = [[1,1],[1,0]]', output: '3' },
  ],
  techniques: [
    {
      pattern: 'dfs',
      rank: 1,
      why: 'A depth-first flood returns a size rather than a boolean: 1 for this cell plus whatever the four neighbours report. Sinking each visited cell to 0 is what keeps it from being counted twice.',
      complexity: { time: 'O(n)', space: 'O(n)' },
    },
    {
      pattern: 'bfs',
      rank: 2,
      why: 'Flood with a queue and count cells as they leave it. Same work, no recursion depth to worry about.',
      complexity: { time: 'O(n)', space: 'O(n)' },
    },
  ],
  params: [],
  typescript: {
    starter: `function maxAreaOfIsland(grid: number[][]): number {
  // Flood each island and return its size, not just whether it exists.
  // TODO
  return 0;
}
${areaDriver.typescript}`,
    solution: `function maxAreaOfIsland(grid: number[][]): number {
  const rows = grid.length;
  const cols = grid[0].length;

  const flood = (r: number, c: number): number => {
    if (r < 0 || c < 0 || r >= rows || c >= cols) return 0;
    if (grid[r][c] === 0) return 0;

    grid[r][c] = 0;  // sink it: counted once, and never re-entered
    return 1 + flood(r + 1, c) + flood(r - 1, c) + flood(r, c + 1) + flood(r, c - 1);
  };

  let best = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 1) best = Math.max(best, flood(r, c));
    }
  }

  return best;
}
${areaDriver.typescript}`,
  },
  python: {
    starter: `def max_area_of_island(grid):
    """Flood each island and return its size, not just whether it exists."""
    # TODO
    return 0
${areaDriver.python}`,
    solution: `def max_area_of_island(grid):
    rows, cols = len(grid), len(grid[0])

    def flood(r, c):
        if r < 0 or c < 0 or r >= rows or c >= cols:
            return 0
        if grid[r][c] == 0:
            return 0

        grid[r][c] = 0  # sink it: counted once, and never re-entered
        return 1 + flood(r + 1, c) + flood(r - 1, c) + flood(r, c + 1) + flood(r, c - 1)

    best = 0
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == 1:
                best = max(best, flood(r, c))

    return best
${areaDriver.python}`,
  },
  expectedOutput: ['example 1 -> 6', 'example 2 -> 0', 'example 3 -> 3'],
};

export const DFS_PROBLEMS = [cloneGraph, courseSchedule, maxAreaOfIsland];
