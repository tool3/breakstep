import type { LeetProblem } from '../types';

const levelHeader = {
  typescript: `class TreeNode {
  val: number;
  left: TreeNode | null = null;
  right: TreeNode | null = null;
  constructor(val: number) {
    this.val = val;
  }
}

const values = [3, 9, 20, null, null, 15, 7];

`,
  python: `class TreeNode:
    def __init__(self, val):
        self.val = val
        self.left = None
        self.right = None


values = [3, 9, 20, None, None, 15, 7]

`,
};

const levelDriver = {
  typescript: `
// --- examples ---------------------------------------------------------------

/** Rebuild a tree from LeetCode's level-order array, nulls and all. */
function buildTree(values: (number | null)[]): TreeNode | null {
  if (values.length === 0 || values[0] === null) return null;

  const root = new TreeNode(values[0]);
  const queue: TreeNode[] = [root];
  let i = 1;

  while (i < values.length) {
    const node = queue.shift()!;
    if (i < values.length && values[i] !== null) {
      node.left = new TreeNode(values[i] as number);
      queue.push(node.left);
    }
    i++;
    if (i < values.length && values[i] !== null) {
      node.right = new TreeNode(values[i] as number);
      queue.push(node.right);
    }
    i++;
  }

  return root;
}

console.log('example 1 ->', levelOrder(buildTree(values)));
console.log('example 2 ->', levelOrder(buildTree([1])));
console.log('example 3 ->', levelOrder(buildTree([])));
`,
  python: `
# --- examples ---------------------------------------------------------------

def build_tree(values):
    """Rebuild a tree from LeetCode's level-order array, Nones and all."""
    if not values or values[0] is None:
        return None

    root = TreeNode(values[0])
    queue = [root]
    i = 1

    while i < len(values):
        node = queue.pop(0)
        if i < len(values) and values[i] is not None:
            node.left = TreeNode(values[i])
            queue.append(node.left)
        i += 1
        if i < len(values) and values[i] is not None:
            node.right = TreeNode(values[i])
            queue.append(node.right)
        i += 1

    return root


print('example 1 ->', level_order(build_tree(values)))
print('example 2 ->', level_order(build_tree([1])))
print('example 3 ->', level_order(build_tree([])))
`,
};

export const levelOrderTraversal: LeetProblem = {
  slug: 'binary-tree-level-order-traversal',
  number: 102,
  title: 'Binary Tree Level Order Traversal',
  difficulty: 'Medium',
  topics: ['tree', 'breadth-first-search', 'binary-tree'],
  prompt:
    'Return the values of a binary tree level by level, left to right — one inner list per level, top level first.',
  constraints: ['0 ≤ number of nodes ≤ 2000', '-1000 ≤ Node.val ≤ 1000'],
  examples: [
    { input: 'root = [3,9,20,null,null,15,7]', output: '[[3],[9,20],[15,7]]' },
    { input: 'root = [1]', output: '[[1]]' },
    { input: 'root = []', output: '[]' },
  ],
  techniques: [
    {
      pattern: 'bfs',
      rank: 1,
      why: 'Level order is breadth-first order, by definition. Take the queue\'s current length before draining it and you have exactly one level — no depth bookkeeping needed.',
      complexity: { time: 'O(n)', space: 'O(n)' },
    },
    {
      pattern: 'dfs',
      rank: 2,
      why: 'A depth-first walk carrying the depth also works: append each value to rows[depth]. It visits levels out of order but ends up with the same answer, and uses stack space instead of a queue.',
      complexity: { time: 'O(n)', space: 'O(n)' },
    },
  ],
  params: [],
  typescript: {
    starter: `${levelHeader.typescript}function levelOrder(root: TreeNode | null): number[][] {
  // Drain the queue one level at a time.
  // TODO
  return [];
}
${levelDriver.typescript}`,
    solution: `${levelHeader.typescript}function levelOrder(root: TreeNode | null): number[][] {
  if (root === null) return [];

  const levels: number[][] = [];
  let queue: TreeNode[] = [root];

  while (queue.length > 0) {
    const row: number[] = [];
    const next: TreeNode[] = [];

    // Everything in queue right now is one level — that is the whole trick.
    for (const node of queue) {
      row.push(node.val);
      if (node.left) next.push(node.left);
      if (node.right) next.push(node.right);
    }

    levels.push(row);
    queue = next;
  }

  return levels;
}
${levelDriver.typescript}`,
  },
  python: {
    starter: `${levelHeader.python}def level_order(root):
    """Drain the queue one level at a time."""
    # TODO
    return []
${levelDriver.python}`,
    solution: `${levelHeader.python}def level_order(root):
    if root is None:
        return []

    levels = []
    queue = [root]

    while queue:
        row = []
        nxt = []

        # Everything in queue right now is one level - that is the whole trick.
        for node in queue:
            row.append(node.val)
            if node.left:
                nxt.append(node.left)
            if node.right:
                nxt.append(node.right)

        levels.append(row)
        queue = nxt

    return levels
${levelDriver.python}`,
  },
  expectedOutput: [
    'example 1 -> [[3], [9, 20], [15, 7]]',
    'example 2 -> [[1]]',
    'example 3 -> []',
  ],
};

const orangesDriver = {
  typescript: `
// --- examples ---------------------------------------------------------------
console.log('example 1 ->', orangesRotting([[2, 1, 1], [1, 1, 0], [0, 1, 1]]));
console.log('example 2 ->', orangesRotting([[2, 1, 1], [0, 1, 1], [1, 0, 1]]));
console.log('example 3 ->', orangesRotting([[0, 2]]));
`,
  python: `
# --- examples ---------------------------------------------------------------
print('example 1 ->', oranges_rotting([[2, 1, 1], [1, 1, 0], [0, 1, 1]]))
print('example 2 ->', oranges_rotting([[2, 1, 1], [0, 1, 1], [1, 0, 1]]))
print('example 3 ->', oranges_rotting([[0, 2]]))
`,
};

export const rottingOranges: LeetProblem = {
  slug: 'rotting-oranges',
  number: 994,
  title: 'Rotting Oranges',
  difficulty: 'Medium',
  topics: ['array', 'breadth-first-search', 'matrix'],
  prompt:
    'In a grid, 0 is empty, 1 is a fresh orange and 2 is a rotten one. Every minute, a rotten orange rots each fresh orange directly adjacent to it. Return the number of minutes until no fresh orange remains, or -1 if some fresh orange can never be reached.',
  constraints: ['1 ≤ rows, cols ≤ 10', 'grid[i][j] is 0, 1 or 2'],
  examples: [
    { input: 'grid = [[2,1,1],[1,1,0],[0,1,1]]', output: '4' },
    { input: 'grid = [[2,1,1],[0,1,1],[1,0,1]]', output: '-1', note: 'the bottom-left orange is cut off' },
    { input: 'grid = [[0,2]]', output: '0', note: 'nothing fresh to rot' },
  ],
  techniques: [
    {
      pattern: 'bfs',
      rank: 1,
      why: 'Rot spreads one ring per minute, which is precisely what breadth-first search measures. Start the queue with every rotten orange at once — a multi-source BFS — and the number of rounds is the answer.',
      complexity: { time: 'O(n)', space: 'O(n)' },
    },
  ],
  params: [],
  typescript: {
    starter: `function orangesRotting(grid: number[][]): number {
  // Multi-source BFS: every rotten orange starts in the queue together.
  // TODO
  return 0;
}
${orangesDriver.typescript}`,
    solution: `function orangesRotting(grid: number[][]): number {
  const rows = grid.length;
  const cols = grid[0].length;

  let queue: [number, number][] = [];
  let fresh = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 2) queue.push([r, c]);
      else if (grid[r][c] === 1) fresh++;
    }
  }

  if (fresh === 0) return 0;

  const moves = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let minutes = 0;

  // Every pass over the queue is one minute of rot spreading outwards.
  while (queue.length > 0 && fresh > 0) {
    const next: [number, number][] = [];

    for (const [r, c] of queue) {
      for (const [dr, dc] of moves) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
        if (grid[nr][nc] !== 1) continue;

        grid[nr][nc] = 2;  // marking it rotten is also how it is "visited"
        fresh--;
        next.push([nr, nc]);
      }
    }

    queue = next;
    minutes++;
  }

  return fresh === 0 ? minutes : -1;
}
${orangesDriver.typescript}`,
  },
  python: {
    starter: `def oranges_rotting(grid):
    """Multi-source BFS: every rotten orange starts in the queue together."""
    # TODO
    return 0
${orangesDriver.python}`,
    solution: `def oranges_rotting(grid):
    rows, cols = len(grid), len(grid[0])

    queue = []
    fresh = 0

    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == 2:
                queue.append((r, c))
            elif grid[r][c] == 1:
                fresh += 1

    if fresh == 0:
        return 0

    moves = [(1, 0), (-1, 0), (0, 1), (0, -1)]
    minutes = 0

    # Every pass over the queue is one minute of rot spreading outwards.
    while queue and fresh > 0:
        nxt = []

        for r, c in queue:
            for dr, dc in moves:
                nr, nc = r + dr, c + dc
                if nr < 0 or nc < 0 or nr >= rows or nc >= cols:
                    continue
                if grid[nr][nc] != 1:
                    continue

                grid[nr][nc] = 2  # marking it rotten also marks it visited
                fresh -= 1
                nxt.append((nr, nc))

        queue = nxt
        minutes += 1

    return minutes if fresh == 0 else -1
${orangesDriver.python}`,
  },
  expectedOutput: ['example 1 -> 4', 'example 2 -> -1', 'example 3 -> 0'],
};

const islandsDriver = {
  typescript: `
// --- examples ---------------------------------------------------------------
console.log('example 1 ->', numIslands([
  ['1', '1', '1', '1', '0'],
  ['1', '1', '0', '1', '0'],
  ['1', '1', '0', '0', '0'],
  ['0', '0', '0', '0', '0'],
]));
console.log('example 2 ->', numIslands([
  ['1', '1', '0', '0', '0'],
  ['1', '1', '0', '0', '0'],
  ['0', '0', '1', '0', '0'],
  ['0', '0', '0', '1', '1'],
]));
console.log('example 3 ->', numIslands([['0']]));
`,
  python: `
# --- examples ---------------------------------------------------------------
print('example 1 ->', num_islands([
    ['1', '1', '1', '1', '0'],
    ['1', '1', '0', '1', '0'],
    ['1', '1', '0', '0', '0'],
    ['0', '0', '0', '0', '0'],
]))
print('example 2 ->', num_islands([
    ['1', '1', '0', '0', '0'],
    ['1', '1', '0', '0', '0'],
    ['0', '0', '1', '0', '0'],
    ['0', '0', '0', '1', '1'],
]))
print('example 3 ->', num_islands([['0']]))
`,
};

export const numberOfIslands: LeetProblem = {
  slug: 'number-of-islands',
  number: 200,
  title: 'Number of Islands',
  difficulty: 'Medium',
  topics: ['array', 'depth-first-search', 'breadth-first-search', 'union-find', 'matrix'],
  prompt:
    "A grid of '1' (land) and '0' (water). Count the islands: groups of land connected horizontally or vertically. The grid's outside edges all count as water.",
  constraints: ['1 ≤ rows, cols ≤ 300', "grid[i][j] is '0' or '1'"],
  examples: [
    { input: 'grid = [["1","1","1","1","0"],["1","1","0","1","0"],["1","1","0","0","0"],["0","0","0","0","0"]]', output: '1' },
    { input: 'grid = [["1","1","0","0","0"],["1","1","0","0","0"],["0","0","1","0","0"],["0","0","0","1","1"]]', output: '3' },
    { input: 'grid = [["0"]]', output: '0' },
  ],
  techniques: [
    {
      pattern: 'bfs',
      rank: 1,
      why: 'Scan for unvisited land; each time you find some, flood the whole island from it and add one to the count. A queue keeps the flood iterative, so a 300×300 grid of solid land cannot blow the call stack.',
      complexity: { time: 'O(n)', space: 'O(n)' },
    },
    {
      pattern: 'dfs',
      rank: 2,
      why: 'The same flood written recursively, and shorter to write. Just be aware the recursion can go as deep as there are land cells.',
      complexity: { time: 'O(n)', space: 'O(n)' },
    },
  ],
  params: [],
  typescript: {
    starter: `function numIslands(grid: string[][]): number {
  // Every unvisited '1' starts a flood; count the floods.
  // TODO
  return 0;
}
${islandsDriver.typescript}`,
    solution: `function numIslands(grid: string[][]): number {
  const rows = grid.length;
  const cols = grid[0].length;
  const moves = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let islands = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== '1') continue;

      islands++;
      // Flood this island so its other cells are never counted again.
      const queue: [number, number][] = [[r, c]];
      grid[r][c] = '0';

      while (queue.length > 0) {
        const [cr, cc] = queue.pop()!;
        for (const [dr, dc] of moves) {
          const nr = cr + dr;
          const nc = cc + dc;
          if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
          if (grid[nr][nc] !== '1') continue;

          grid[nr][nc] = '0';  // mark on the way in, never twice in the queue
          queue.push([nr, nc]);
        }
      }
    }
  }

  return islands;
}
${islandsDriver.typescript}`,
  },
  python: {
    starter: `def num_islands(grid):
    """Every unvisited '1' starts a flood; count the floods."""
    # TODO
    return 0
${islandsDriver.python}`,
    solution: `def num_islands(grid):
    rows, cols = len(grid), len(grid[0])
    moves = [(1, 0), (-1, 0), (0, 1), (0, -1)]
    islands = 0

    for r in range(rows):
        for c in range(cols):
            if grid[r][c] != '1':
                continue

            islands += 1
            # Flood this island so its cells are never counted again.
            queue = [(r, c)]
            grid[r][c] = '0'

            while queue:
                cr, cc = queue.pop()
                for dr, dc in moves:
                    nr, nc = cr + dr, cc + dc
                    if nr < 0 or nc < 0 or nr >= rows or nc >= cols:
                        continue
                    if grid[nr][nc] != '1':
                        continue

                    grid[nr][nc] = '0'  # mark on the way in, never twice
                    queue.append((nr, nc))

    return islands
${islandsDriver.python}`,
  },
  expectedOutput: ['example 1 -> 1', 'example 2 -> 3', 'example 3 -> 0'],
};

const rightViewDriver = {
  typescript: `
// --- examples ---------------------------------------------------------------

/** Rebuild a tree from LeetCode's level-order array, nulls and all. */
function buildRightTree(values: (number | null)[]): TreeNode | null {
  if (values.length === 0 || values[0] === null) return null;

  const root = new TreeNode(values[0]);
  const queue: TreeNode[] = [root];
  let i = 1;

  while (i < values.length) {
    const node = queue.shift()!;
    if (i < values.length && values[i] !== null) {
      node.left = new TreeNode(values[i] as number);
      queue.push(node.left);
    }
    i++;
    if (i < values.length && values[i] !== null) {
      node.right = new TreeNode(values[i] as number);
      queue.push(node.right);
    }
    i++;
  }

  return root;
}

console.log('example 1 ->', rightSideView(buildRightTree([1, 2, 3, null, 5, null, 4])));
console.log('example 2 ->', rightSideView(buildRightTree([1, null, 3])));
console.log('example 3 ->', rightSideView(buildRightTree([])));
`,
  python: `
# --- examples ---------------------------------------------------------------

def build_right_tree(values):
    """Rebuild a tree from LeetCode's level-order array, Nones and all."""
    if not values or values[0] is None:
        return None

    root = TreeNode(values[0])
    queue = [root]
    i = 1

    while i < len(values):
        node = queue.pop(0)
        if i < len(values) and values[i] is not None:
            node.left = TreeNode(values[i])
            queue.append(node.left)
        i += 1
        if i < len(values) and values[i] is not None:
            node.right = TreeNode(values[i])
            queue.append(node.right)
        i += 1

    return root


print('example 1 ->', right_side_view(build_right_tree([1, 2, 3, None, 5, None, 4])))
print('example 2 ->', right_side_view(build_right_tree([1, None, 3])))
print('example 3 ->', right_side_view(build_right_tree([])))
`,
};

export const rightSideView: LeetProblem = {
  slug: 'binary-tree-right-side-view',
  number: 199,
  title: 'Binary Tree Right Side View',
  difficulty: 'Medium',
  topics: ['tree', 'depth-first-search', 'breadth-first-search', 'binary-tree'],
  prompt:
    'Standing to the right of a binary tree, return the values you can see from top to bottom — the last node of each level.',
  constraints: ['0 ≤ number of nodes ≤ 100', '-100 ≤ Node.val ≤ 100'],
  examples: [
    { input: 'root = [1,2,3,null,5,null,4]', output: '[1,3,4]' },
    { input: 'root = [1,null,3]', output: '[1,3]' },
    { input: 'root = []', output: '[]' },
  ],
  techniques: [
    {
      pattern: 'bfs',
      rank: 1,
      why: 'What you see from the right is the last node of each level, and breadth-first search hands you the levels one at a time. Take the final value of each and you are done — no geometry, no depth arithmetic.',
      complexity: { time: 'O(n)', space: 'O(n)' },
    },
    {
      pattern: 'dfs',
      rank: 2,
      why: 'Walk right-child-first, carrying the depth, and record the first node seen at each new depth. Fewer lines, and it is the version to reach for if the tree is narrow and deep.',
      complexity: { time: 'O(n)', space: 'O(n)' },
    },
  ],
  params: [],
  typescript: {
    starter: `class TreeNode {
  val: number;
  left: TreeNode | null = null;
  right: TreeNode | null = null;
  constructor(val: number) {
    this.val = val;
  }
}

function rightSideView(root: TreeNode | null): number[] {
  // The last node of each level is the one you can see.
  // TODO
  return [];
}
${rightViewDriver.typescript}`,
    solution: `class TreeNode {
  val: number;
  left: TreeNode | null = null;
  right: TreeNode | null = null;
  constructor(val: number) {
    this.val = val;
  }
}

function rightSideView(root: TreeNode | null): number[] {
  if (root === null) return [];

  const view: number[] = [];
  let level: TreeNode[] = [root];

  while (level.length > 0) {
    // The last node of this level is the one visible from the right.
    view.push(level[level.length - 1].val);

    const next: TreeNode[] = [];
    for (const node of level) {
      if (node.left) next.push(node.left);
      if (node.right) next.push(node.right);
    }
    level = next;
  }

  return view;
}
${rightViewDriver.typescript}`,
  },
  python: {
    starter: `class TreeNode:
    def __init__(self, val):
        self.val = val
        self.left = None
        self.right = None


def right_side_view(root):
    """The last node of each level is the one you can see."""
    # TODO
    return []
${rightViewDriver.python}`,
    solution: `class TreeNode:
    def __init__(self, val):
        self.val = val
        self.left = None
        self.right = None


def right_side_view(root):
    if root is None:
        return []

    view = []
    level = [root]

    while level:
        # The last node of this level is the one visible from the right.
        view.append(level[-1].val)

        nxt = []
        for node in level:
            if node.left:
                nxt.append(node.left)
            if node.right:
                nxt.append(node.right)
        level = nxt

    return view
${rightViewDriver.python}`,
  },
  expectedOutput: ['example 1 -> [1, 3, 4]', 'example 2 -> [1, 3]', 'example 3 -> []'],
};

const zeroOneDriver = {
  typescript: `
// --- examples ---------------------------------------------------------------
console.log('example 1 ->', updateMatrix([[0, 0, 0], [0, 1, 0], [0, 0, 0]]));
console.log('example 2 ->', updateMatrix([[0, 0, 0], [0, 1, 0], [1, 1, 1]]));
console.log('example 3 ->', updateMatrix([[0, 1], [1, 1]]));
`,
  python: `
# --- examples ---------------------------------------------------------------
print('example 1 ->', update_matrix([[0, 0, 0], [0, 1, 0], [0, 0, 0]]))
print('example 2 ->', update_matrix([[0, 0, 0], [0, 1, 0], [1, 1, 1]]))
print('example 3 ->', update_matrix([[0, 1], [1, 1]]))
`,
};

export const zeroOneMatrix: LeetProblem = {
  slug: '01-matrix',
  number: 542,
  title: '01 Matrix',
  difficulty: 'Medium',
  topics: ['array', 'dynamic-programming', 'breadth-first-search', 'matrix'],
  prompt:
    'For every cell of a binary matrix, return its distance to the nearest 0, counting steps between cells that share an edge.',
  constraints: ['1 ≤ rows, cols ≤ 10⁴', 'rows × cols ≤ 10⁴', 'At least one 0 is present'],
  examples: [
    { input: 'mat = [[0,0,0],[0,1,0],[0,0,0]]', output: '[[0,0,0],[0,1,0],[0,0,0]]' },
    { input: 'mat = [[0,0,0],[0,1,0],[1,1,1]]', output: '[[0,0,0],[0,1,0],[1,2,1]]' },
    { input: 'mat = [[0,1],[1,1]]', output: '[[0,1],[1,2]]' },
  ],
  techniques: [
    {
      pattern: 'bfs',
      rank: 1,
      why: 'Search outwards from every 0 at once rather than inwards from each 1. A multi-source BFS reaches each cell in distance order, so the first time a cell is touched is already its answer — one pass for the whole grid instead of one search per cell.',
      complexity: { time: 'O(n)', space: 'O(n)' },
    },
  ],
  params: [],
  typescript: {
    starter: `function updateMatrix(mat: number[][]): number[][] {
  // Search outwards from every zero at once, not inwards from each one.
  // TODO
  return mat;
}
${zeroOneDriver.typescript}`,
    solution: `function updateMatrix(mat: number[][]): number[][] {
  const rows = mat.length;
  const cols = mat[0].length;

  // -1 means "not reached yet", which doubles as the visited mark.
  const dist: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(-1));
  let queue: [number, number][] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (mat[r][c] === 0) {
        dist[r][c] = 0;
        queue.push([r, c]);
      }
    }
  }

  const moves = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let step = 0;

  // Every pass is one more step away from the nearest zero.
  while (queue.length > 0) {
    step++;
    const next: [number, number][] = [];

    for (const [r, c] of queue) {
      for (const [dr, dc] of moves) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
        if (dist[nr][nc] !== -1) continue;  // reached already, so already closer

        dist[nr][nc] = step;
        next.push([nr, nc]);
      }
    }

    queue = next;
  }

  return dist;
}
${zeroOneDriver.typescript}`,
  },
  python: {
    starter: `def update_matrix(mat):
    """Search outwards from every zero at once, not inwards from each one."""
    # TODO
    return mat
${zeroOneDriver.python}`,
    solution: `def update_matrix(mat):
    rows, cols = len(mat), len(mat[0])

    # -1 means "not reached yet", which doubles as the visited mark.
    dist = [[-1] * cols for _ in range(rows)]
    queue = []

    for r in range(rows):
        for c in range(cols):
            if mat[r][c] == 0:
                dist[r][c] = 0
                queue.append((r, c))

    moves = [(1, 0), (-1, 0), (0, 1), (0, -1)]
    step = 0

    # Every pass is one more step away from the nearest zero.
    while queue:
        step += 1
        nxt = []

        for r, c in queue:
            for dr, dc in moves:
                nr, nc = r + dr, c + dc
                if nr < 0 or nc < 0 or nr >= rows or nc >= cols:
                    continue
                if dist[nr][nc] != -1:
                    continue  # reached already, so already closer

                dist[nr][nc] = step
                nxt.append((nr, nc))

        queue = nxt

    return dist
${zeroOneDriver.python}`,
  },
  expectedOutput: [
    'example 1 -> [[0, 0, 0], [0, 1, 0], [0, 0, 0]]',
    'example 2 -> [[0, 0, 0], [0, 1, 0], [1, 2, 1]]',
    'example 3 -> [[0, 1], [1, 2]]',
  ],
};

export const BFS_PROBLEMS = [
  levelOrderTraversal,
  rottingOranges,
  numberOfIslands,
  rightSideView,
  zeroOneMatrix,
];
