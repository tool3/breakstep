import type { Template } from '@/types';

export const recursion: Template = {
  id: 'recursion',
  title: 'Recursion — Tree Traversals',
  category: 'Patterns',
  blurb: 'Base case, smaller problem, combine — and where the visit goes decides everything.',
  tags: ['recursion', 'tree', 'traversal', 'call-stack'],
  expected: { time: 'O(n)', space: 'O(n)' },
  params: [
    {
      name: 'values',
      label: 'Values to insert',
      type: 'numberArray',
      default: [50, 30, 70, 20, 40, 60, 80],
    },
  ],
  code: {
    typescript: `// PATTERN: recursion  ·  PROBLEM: traverse a binary tree
//
// Every recursive function has the same three parts:
//
//   1. a BASE CASE that returns without recursing   (here: an empty subtree)
//   2. a step that makes the problem SMALLER        (here: descend to a child)
//   3. a way to COMBINE the sub-answers             (here: concatenate, or max)
//
// A tree is the natural home for this, because a subtree is just a smaller
// tree — the recursive structure is in the data, not only in the code.
//
// The three traversals differ by ONE LINE: where the visit sits relative to the
// two recursive calls. That placement is the whole difference between them:
//
//   pre-order   visit, left, right   → copy or serialize a tree top-down
//   in-order    left, visit, right   → a BST comes out sorted
//   post-order  left, right, visit   → children finished first: free a tree,
//                                      compute sizes, evaluate an expression

const values = [50, 30, 70, 20, 40, 60, 80];

class TreeNode {
  value: number;
  left: TreeNode | null = null;
  right: TreeNode | null = null;

  constructor(value: number) {
    this.value = value;
  }
}

function insert(node: TreeNode | null, value: number): TreeNode {
  if (node === null) return new TreeNode(value);      // base case

  if (value < node.value) node.left = insert(node.left, value);
  else if (value > node.value) node.right = insert(node.right, value);

  return node;
}

function preorder(node: TreeNode | null, out: number[] = []): number[] {
  if (node === null) return out;

  out.push(node.value);      // visit BEFORE the children
  preorder(node.left, out);
  preorder(node.right, out);
  return out;
}

function inorder(node: TreeNode | null, out: number[] = []): number[] {
  if (node === null) return out;

  inorder(node.left, out);
  out.push(node.value);      // visit BETWEEN the children
  inorder(node.right, out);
  return out;
}

function postorder(node: TreeNode | null, out: number[] = []): number[] {
  if (node === null) return out;

  postorder(node.left, out);
  postorder(node.right, out);
  out.push(node.value);      // visit AFTER the children
  return out;
}

/** Combine by taking the deeper side and adding one for this node. */
function height(node: TreeNode | null): number {
  if (node === null) return 0;
  return 1 + Math.max(height(node.left), height(node.right));
}

/** Combine by summing — the same skeleton, a different combine step. */
function countNodes(node: TreeNode | null): number {
  if (node === null) return 0;
  return 1 + countNodes(node.left) + countNodes(node.right);
}

/** A whole predicate expressed as one recursive question. */
function isBalanced(node: TreeNode | null): boolean {
  if (node === null) return true;

  const gap = Math.abs(height(node.left) - height(node.right));
  return gap <= 1 && isBalanced(node.left) && isBalanced(node.right);
}

let root: TreeNode | null = null;
for (const value of values) root = insert(root, value);

console.log('pre-order  ->', preorder(root).join(', '));
console.log('in-order   ->', inorder(root).join(', '), '(sorted — that is the BST invariant)');
console.log('post-order ->', postorder(root).join(', '));
console.log('height     ->', height(root));
console.log('nodes      ->', countNodes(root));
console.log('balanced?  ->', isBalanced(root));
`,
    python: `# PATTERN: recursion  ·  PROBLEM: traverse a binary tree
#
# Every recursive function has the same three parts:
#
#   1. a BASE CASE that returns without recursing   (here: an empty subtree)
#   2. a step that makes the problem SMALLER        (here: descend to a child)
#   3. a way to COMBINE the sub-answers             (here: concatenate, or max)
#
# A tree is the natural home for this, because a subtree is just a smaller
# tree - the recursive structure is in the data, not only in the code.
#
# The three traversals differ by ONE LINE: where the visit sits relative to the
# two recursive calls. That placement is the whole difference between them:
#
#   pre-order   visit, left, right   -> copy or serialize a tree top-down
#   in-order    left, visit, right   -> a BST comes out sorted
#   post-order  left, right, visit   -> children finished first: free a tree,
#                                       compute sizes, evaluate an expression

values = [50, 30, 70, 20, 40, 60, 80]


class TreeNode:
    def __init__(self, value):
        self.value = value
        self.left = None
        self.right = None


def insert(node, value):
    if node is None:
        return TreeNode(value)      # base case

    if value < node.value:
        node.left = insert(node.left, value)
    elif value > node.value:
        node.right = insert(node.right, value)

    return node


def preorder(node, out=None):
    if out is None:
        out = []
    if node is None:
        return out

    out.append(node.value)     # visit BEFORE the children
    preorder(node.left, out)
    preorder(node.right, out)
    return out


def inorder(node, out=None):
    if out is None:
        out = []
    if node is None:
        return out

    inorder(node.left, out)
    out.append(node.value)     # visit BETWEEN the children
    inorder(node.right, out)
    return out


def postorder(node, out=None):
    if out is None:
        out = []
    if node is None:
        return out

    postorder(node.left, out)
    postorder(node.right, out)
    out.append(node.value)     # visit AFTER the children
    return out


def height(node):
    """Combine by taking the deeper side and adding one for this node."""
    if node is None:
        return 0
    return 1 + max(height(node.left), height(node.right))


def count_nodes(node):
    """Combine by summing - the same skeleton, a different combine step."""
    if node is None:
        return 0
    return 1 + count_nodes(node.left) + count_nodes(node.right)


def is_balanced(node):
    """A whole predicate expressed as one recursive question."""
    if node is None:
        return True

    gap = abs(height(node.left) - height(node.right))
    return gap <= 1 and is_balanced(node.left) and is_balanced(node.right)


root = None
for value in values:
    root = insert(root, value)

print("pre-order  ->", ", ".join(str(v) for v in preorder(root)))
print("in-order   ->", ", ".join(str(v) for v in inorder(root)),
      "(sorted - that is the BST invariant)")
print("post-order ->", ", ".join(str(v) for v in postorder(root)))
print("height     ->", height(root))
print("nodes      ->", count_nodes(root))
print("balanced?  ->", is_balanced(root))
`,
  },
  bench: {
    typescript: `breakstep.bench({
  input: (n) => {
    let tree: TreeNode | null = null;
    for (const v of breakstep.randomInts(n, n * 4, 11)) tree = insert(tree, v);
    return tree;
  },
  // One full traversal touches every node exactly once.
  run: (tree) => inorder(tree as TreeNode | null),
  sizes: [16, 32, 64, 128, 256, 512, 1024],
});
`,
    python: `def _build(n):
    tree = None
    for v in breakstep.random_ints(n, n * 4, 11):
        tree = insert(tree, v)
    return tree


# One full traversal touches every node exactly once.
breakstep.bench(input=_build, run=inorder, sizes=[16, 32, 64, 128, 256, 512])
`,
  },
  instrumented: {
    typescript: `// Recursion — the same traversals, drawn explicitly.
//
// Highlighting the already-visited nodes as the walk proceeds makes the
// difference between the three orders obvious at a glance.

const values = breakstep.param<number[]>('values', [50, 30, 70, 20, 40]);

class TreeNode {
  value: number;
  left: TreeNode | null = null;
  right: TreeNode | null = null;
  constructor(value: number) {
    this.value = value;
  }
}

function insert(node: TreeNode | null, value: number): TreeNode {
  if (node === null) return new TreeNode(value);
  if (value < node.value) node.left = insert(node.left, value);
  else if (value > node.value) node.right = insert(node.right, value);
  return node;
}

let root: TreeNode | null = null;
for (const value of values) root = insert(root, value);

breakstep.show(root, { label: 'The tree' });

function walk(
  node: TreeNode | null,
  order: 'pre' | 'in' | 'post',
  out: number[] = [],
): number[] {
  if (node === null) return out;

  const visit = () => {
    out.push(node.value);
    breakstep.show(root, () => ({
      label: \`\${order}-order: visit \${node.value}\`,
      highlight: {
        ...Object.fromEntries(out.map((v) => [String(v), 'visited' as const])),
        [String(node.value)]: 'active' as const,
      },
      meta: { visited: out.length, so_far: out.join(',') },
    }));
  };

  if (order === 'pre') visit();
  walk(node.left, order, out);
  if (order === 'in') visit();
  walk(node.right, order, out);
  if (order === 'post') visit();

  return out;
}

breakstep.log('pre-order  ->', walk(root, 'pre').join(', '));
breakstep.log('in-order   ->', walk(root, 'in').join(', '));
breakstep.log('post-order ->', walk(root, 'post').join(', '));

function inorder(node: TreeNode | null, out: number[] = []): number[] {
  if (node === null) return out;
  inorder(node.left, out);
  out.push(node.value);
  inorder(node.right, out);
  return out;
}

breakstep.bench({
  input: (n) => {
    let tree: TreeNode | null = null;
    for (const v of breakstep.randomInts(n, n * 4, 11)) tree = insert(tree, v);
    return tree;
  },
  run: (tree) => inorder(tree as TreeNode | null),
  sizes: [16, 32, 64, 128, 256, 512, 1024],
});
`,
    python: `# Recursion - the same traversals, drawn explicitly.

values = breakstep.param('values', [50, 30, 70, 20, 40])


class TreeNode:
    def __init__(self, value):
        self.value = value
        self.left = None
        self.right = None


def insert(node, value):
    if node is None:
        return TreeNode(value)
    if value < node.value:
        node.left = insert(node.left, value)
    elif value > node.value:
        node.right = insert(node.right, value)
    return node


root = None
for value in values:
    root = insert(root, value)

breakstep.show(root, label="The tree")


def walk(node, order, out=None):
    if out is None:
        out = []
    if node is None:
        return out

    def visit():
        out.append(node.value)

        def frame():
            highlight = {str(v): "visited" for v in out}
            highlight[str(node.value)] = "active"
            return {
                "label": f"{order}-order: visit {node.value}",
                "highlight": highlight,
                "meta": {"visited": len(out), "so_far": ",".join(str(v) for v in out)},
            }

        breakstep.show(root, frame)

    if order == "pre":
        visit()
    walk(node.left, order, out)
    if order == "in":
        visit()
    walk(node.right, order, out)
    if order == "post":
        visit()

    return out


breakstep.log("pre-order  ->", ", ".join(str(v) for v in walk(root, "pre")))
breakstep.log("in-order   ->", ", ".join(str(v) for v in walk(root, "in")))
breakstep.log("post-order ->", ", ".join(str(v) for v in walk(root, "post")))


def inorder(node, out=None):
    if out is None:
        out = []
    if node is None:
        return out
    inorder(node.left, out)
    out.append(node.value)
    inorder(node.right, out)
    return out


def _build(n):
    tree = None
    for v in breakstep.random_ints(n, n * 4, 11):
        tree = insert(tree, v)
    return tree


breakstep.bench(input=_build, run=inorder, sizes=[16, 32, 64, 128, 256, 512])
`,
  },
};

export const backtracking: Template = {
  id: 'backtracking',
  title: 'Backtracking — Subsets & Permutations',
  category: 'Patterns',
  blurb: 'Choose, explore, un-choose — and the shape of the tree is the complexity.',
  tags: ['backtracking', 'recursion', 'exponential', 'call-stack'],
  expected: { time: 'O(2^n)', space: 'O(n)' },
  params: [
    {
      name: 'n',
      label: 'Set size',
      type: 'number',
      default: 4,
      min: 1,
      max: 12,
      help: '2ⁿ subsets — 12 already means 4096.',
    },
    {
      name: 'mode',
      label: 'Enumerate',
      type: 'select',
      default: 'subsets',
      options: [
        { label: 'Subsets — 2ⁿ', value: 'subsets' },
        { label: 'Permutations — n!', value: 'permutations' },
      ],
    },
  ],
  code: {
    typescript: `// PATTERN: backtracking  ·  PROBLEM: enumerate subsets and permutations
//
// Backtracking is recursion with an undo. Three steps, always:
//
//   CHOOSE     add something to the partial answer
//   EXPLORE    recurse on the smaller remaining problem
//   UN-CHOOSE  remove it again, so the next branch starts clean
//
// Skip the un-choose and every branch inherits the last one's mess. That single
// \`pop()\` is what makes one shared array safe across the entire search tree —
// the alternative is copying the array at every node, which is correct but
// wasteful.
//
// The SHAPE of the recursion tree is the complexity, and it is worth being able
// to read it off the code:
//
//   subsets       2 branches per element (in / out)      → 2ⁿ leaves
//   permutations  one branch per unused element          → n! leaves
//
// Both keep the call stack only n deep, which is why the space cost stays
// linear while the time cost explodes. Pruning — abandoning a branch that
// cannot lead anywhere — is the only thing that ever tames these.

const n = 4;
const mode = 'subsets';

const items = Array.from({ length: n }, (_, i) => i + 1);

function subsets(nums: number[]): number[][] {
  const out: number[][] = [];
  const current: number[] = [];

  const explore = (index: number) => {
    if (index === nums.length) {
      out.push([...current]);   // a copy: \`current\` keeps changing
      return;
    }

    // Branch 1: leave nums[index] out.
    explore(index + 1);

    // Branch 2: take it — then undo, which is the backtrack.
    current.push(nums[index]);
    explore(index + 1);
    current.pop();
  };

  explore(0);
  return out;
}

function permutations(nums: number[]): number[][] {
  const out: number[][] = [];
  const current: number[] = [];
  const used = nums.map(() => false);

  const explore = () => {
    if (current.length === nums.length) {
      out.push([...current]);
      return;
    }

    for (let i = 0; i < nums.length; i++) {
      if (used[i]) continue;    // this is the pruning

      used[i] = true;           // choose
      current.push(nums[i]);
      explore();                // explore
      current.pop();            // un-choose
      used[i] = false;
    }
  };

  explore();
  return out;
}

const results = mode === 'permutations' ? permutations(items) : subsets(items);

console.log('set        ->', items.join(', '));
console.log('mode       ->', mode);
console.log('count      ->', results.length, mode === 'permutations' ? '(= n!)' : '(= 2^n)');
console.log('first few  ->', results.slice(0, 8).map((r) => '[' + r.join(',') + ']').join('  '));
console.log('empty set included? ->', results.some((r) => r.length === 0));
`,
    python: `# PATTERN: backtracking  ·  PROBLEM: enumerate subsets and permutations
#
# Backtracking is recursion with an undo. Three steps, always:
#
#   CHOOSE     add something to the partial answer
#   EXPLORE    recurse on the smaller remaining problem
#   UN-CHOOSE  remove it again, so the next branch starts clean
#
# Skip the un-choose and every branch inherits the last one's mess. That single
# \`pop()\` is what makes one shared list safe across the entire search tree -
# the alternative is copying the list at every node, which is correct but
# wasteful.
#
# The SHAPE of the recursion tree is the complexity, and it is worth being able
# to read it off the code:
#
#   subsets       2 branches per element (in / out)      -> 2^n leaves
#   permutations  one branch per unused element          -> n! leaves
#
# Both keep the call stack only n deep, which is why the space cost stays
# linear while the time cost explodes. Pruning - abandoning a branch that
# cannot lead anywhere - is the only thing that ever tames these.

n = 4
mode = 'subsets'

items = list(range(1, n + 1))


def subsets(nums):
    out = []
    current = []

    def explore(index):
        if index == len(nums):
            out.append(list(current))   # a copy: current keeps changing
            return

        # Branch 1: leave nums[index] out.
        explore(index + 1)

        # Branch 2: take it - then undo, which is the backtrack.
        current.append(nums[index])
        explore(index + 1)
        current.pop()

    explore(0)
    return out


def permutations(nums):
    out = []
    current = []
    used = [False] * len(nums)

    def explore():
        if len(current) == len(nums):
            out.append(list(current))
            return

        for i in range(len(nums)):
            if used[i]:
                continue      # this is the pruning

            used[i] = True    # choose
            current.append(nums[i])
            explore()         # explore
            current.pop()     # un-choose
            used[i] = False

    explore()
    return out


results = permutations(items) if mode == "permutations" else subsets(items)

print("set        ->", ", ".join(str(v) for v in items))
print("mode       ->", mode)
print("count      ->", len(results), "(= n!)" if mode == "permutations" else "(= 2^n)")
print("first few  ->", "  ".join(str(r) for r in results[:8]))
print("empty set included? ->", any(len(r) == 0 for r in results))
`,
  },
  bench: {
    typescript: `breakstep.bench({
  input: (size) => Array.from({ length: size }, (_, i) => i),
  run: (arr) => (mode === 'permutations' ? permutations(arr as number[]) : subsets(arr as number[])),
  // Exponential growth: n is the SET SIZE here, not an array length.
  sizes: mode === 'permutations' ? [2, 3, 4, 5, 6, 7, 8] : [2, 4, 6, 8, 10, 12, 14, 16],
});
`,
    python: `breakstep.bench(
    input=lambda size: list(range(size)),
    run=lambda arr: permutations(arr) if mode == "permutations" else subsets(arr),
    # Exponential growth: n is the SET SIZE here, not a list length.
    sizes=[2, 3, 4, 5, 6, 7] if mode == "permutations" else [2, 4, 6, 8, 10, 12],
)
`,
  },
  instrumented: {
    typescript: `// Backtracking — the same enumeration, drawn explicitly as a call stack.

const n = breakstep.param<number>('n', 4);
const mode = breakstep.param<string>('mode', 'subsets');
const items = Array.from({ length: n }, (_, i) => i + 1);

function subsets(nums: number[]): number[][] {
  const out: number[][] = [];
  const current: number[] = [];
  const stack: { label: string; depth: number }[] = [];

  const explore = (index: number) => {
    stack.push({ label: \`explore(i=\${index}) [\${current.join(',')}]\`, depth: stack.length });
    breakstep.show(stack, {
      as: 'callstack',
      label: \`depth \${stack.length}\`,
      highlight: { [stack.length - 1]: 'active' },
      meta: { current: \`[\${current.join(',')}]\`, found: out.length },
    });

    if (index === nums.length) {
      out.push([...current]);
    } else {
      explore(index + 1);
      current.push(nums[index]);
      explore(index + 1);
      current.pop();
    }

    stack.pop();
  };

  explore(0);
  return out;
}

function permutations(nums: number[]): number[][] {
  const out: number[][] = [];
  const current: number[] = [];
  const used = nums.map(() => false);
  const stack: { label: string; depth: number }[] = [];

  const explore = () => {
    stack.push({ label: \`perm [\${current.join(',')}]\`, depth: stack.length });
    breakstep.show(stack, {
      as: 'callstack',
      label: \`depth \${stack.length}\`,
      highlight: { [stack.length - 1]: 'active' },
      meta: { current: \`[\${current.join(',')}]\`, found: out.length },
    });

    if (current.length === nums.length) {
      out.push([...current]);
    } else {
      for (let i = 0; i < nums.length; i++) {
        if (used[i]) continue;
        used[i] = true;
        current.push(nums[i]);
        explore();
        current.pop();
        used[i] = false;
      }
    }

    stack.pop();
  };

  explore();
  return out;
}

const results = mode === 'permutations' ? permutations(items) : subsets(items);

breakstep.show([], { as: 'callstack', label: 'Stack unwound — done' });
breakstep.log(results.length, mode, 'of [' + items.join(', ') + ']');
breakstep.log(results.slice(0, 20).map((r) => '[' + r.join(',') + ']').join('  '));

breakstep.bench({
  input: (size) => Array.from({ length: size }, (_, i) => i),
  run: (arr) => (mode === 'permutations' ? permutations(arr as number[]) : subsets(arr as number[])),
  sizes: mode === 'permutations' ? [2, 3, 4, 5, 6, 7, 8] : [2, 4, 6, 8, 10, 12, 14, 16],
});
`,
    python: `# Backtracking - the same enumeration, drawn explicitly as a call stack.

n = breakstep.param('n', 4)
mode = breakstep.param('mode', 'subsets')
items = list(range(1, n + 1))


def subsets(nums):
    out = []
    current = []
    stack = []

    def explore(index):
        stack.append({"label": f"explore(i={index}) {current}", "depth": len(stack)})
        breakstep.show(stack, kind="callstack", label=f"depth {len(stack)}",
                 highlight={len(stack) - 1: "active"},
                 meta={"current": str(current), "found": len(out)})

        if index == len(nums):
            out.append(list(current))
        else:
            explore(index + 1)
            current.append(nums[index])
            explore(index + 1)
            current.pop()

        stack.pop()

    explore(0)
    return out


def permutations(nums):
    out = []
    current = []
    used = [False] * len(nums)
    stack = []

    def explore():
        stack.append({"label": f"perm {current}", "depth": len(stack)})
        breakstep.show(stack, kind="callstack", label=f"depth {len(stack)}",
                 highlight={len(stack) - 1: "active"},
                 meta={"current": str(current), "found": len(out)})

        if len(current) == len(nums):
            out.append(list(current))
        else:
            for i in range(len(nums)):
                if used[i]:
                    continue
                used[i] = True
                current.append(nums[i])
                explore()
                current.pop()
                used[i] = False

        stack.pop()

    explore()
    return out


results = permutations(items) if mode == "permutations" else subsets(items)

breakstep.show([], kind="callstack", label="Stack unwound - done")
breakstep.log(len(results), mode, "of", items)
breakstep.log("  ".join(str(r) for r in results[:20]))

breakstep.bench(
    input=lambda size: list(range(size)),
    run=lambda arr: permutations(arr) if mode == "permutations" else subsets(arr),
    sizes=[2, 3, 4, 5, 6, 7] if mode == "permutations" else [2, 4, 6, 8, 10, 12],
)
`,
  },
};
