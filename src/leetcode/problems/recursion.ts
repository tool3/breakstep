import type { LeetProblem } from '../types';

const treeHeader = (values: string, python?: string) => ({
  typescript: `class TreeNode {
  val: number;
  left: TreeNode | null = null;
  right: TreeNode | null = null;
  constructor(val: number) {
    this.val = val;
  }
}

const values = [${values}];

`,
  python: `class TreeNode:
    def __init__(self, val):
        self.val = val
        self.left = None
        self.right = None


values = [${python ?? values}]

`,
});

const BUILD_TREE = {
  typescript: `/** Rebuild a tree from LeetCode's level-order array, nulls and all. */
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
}`,
  python: `def build_tree(values):
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

    return root`,
};

const invertDriver = {
  typescript: `
// --- examples ---------------------------------------------------------------
${BUILD_TREE.typescript}

/** Serialize back to a level-order array, trailing holes trimmed. */
function toArray(root: TreeNode | null): (number | null)[] {
  if (root === null) return [];

  const out: (number | null)[] = [];
  const queue: (TreeNode | null)[] = [root];

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node === null) {
      out.push(null);
      continue;
    }
    out.push(node.val);
    queue.push(node.left, node.right);
  }

  while (out.length > 0 && out[out.length - 1] === null) out.pop();
  return out;
}

console.log('example 1 ->', toArray(invertTree(buildTree(values))));
console.log('example 2 ->', toArray(invertTree(buildTree([2, 1, 3]))));
console.log('example 3 ->', toArray(invertTree(buildTree([]))));
`,
  python: `
# --- examples ---------------------------------------------------------------
${BUILD_TREE.python}


def to_array(root):
    """Serialize back to a level-order array, trailing holes trimmed."""
    if root is None:
        return []

    out = []
    queue = [root]

    while queue:
        node = queue.pop(0)
        if node is None:
            out.append(None)
            continue
        out.append(node.val)
        queue.append(node.left)
        queue.append(node.right)

    while out and out[-1] is None:
        out.pop()
    return out


print('example 1 ->', to_array(invert_tree(build_tree(values))))
print('example 2 ->', to_array(invert_tree(build_tree([2, 1, 3]))))
print('example 3 ->', to_array(invert_tree(build_tree([]))))
`,
};

export const invertBinaryTree: LeetProblem = {
  slug: 'invert-binary-tree',
  number: 226,
  title: 'Invert Binary Tree',
  difficulty: 'Easy',
  topics: ['tree', 'depth-first-search', 'breadth-first-search', 'binary-tree'],
  prompt:
    'Mirror a binary tree: every node keeps its value, but its left and right subtrees swap places, all the way down.',
  constraints: ['0 ≤ number of nodes ≤ 100', '-100 ≤ Node.val ≤ 100'],
  examples: [
    { input: 'root = [4,2,7,1,3,6,9]', output: '[4,7,2,9,6,3,1]' },
    { input: 'root = [2,1,3]', output: '[2,3,1]' },
    { input: 'root = []', output: '[]' },
  ],
  techniques: [
    {
      pattern: 'recursion',
      rank: 1,
      why: 'The definition is already recursive: an inverted tree is a node whose children are the inverted opposite subtrees. Trust the recursive call and the whole solution is three lines.',
      complexity: { time: 'O(n)', space: 'O(n)' },
    },
    {
      pattern: 'bfs',
      rank: 2,
      why: 'Push every node onto a queue and swap its children as it comes off. Identical work, and it avoids recursion if the tree could be pathologically deep.',
      complexity: { time: 'O(n)', space: 'O(n)' },
    },
  ],
  params: [],
  typescript: {
    starter: `${treeHeader('4, 2, 7, 1, 3, 6, 9').typescript}function invertTree(root: TreeNode | null): TreeNode | null {
  // Swap the children, then trust the recursion for the rest.
  // TODO
  return root;
}
${invertDriver.typescript}`,
    solution: `${treeHeader('4, 2, 7, 1, 3, 6, 9').typescript}function invertTree(root: TreeNode | null): TreeNode | null {
  // An empty tree is already its own mirror — that is the base case.
  if (root === null) return null;

  const left = invertTree(root.left);
  const right = invertTree(root.right);

  root.left = right;
  root.right = left;

  return root;
}
${invertDriver.typescript}`,
  },
  python: {
    starter: `${treeHeader('4, 2, 7, 1, 3, 6, 9').python}def invert_tree(root):
    """Swap the children, then trust the recursion for the rest."""
    # TODO
    return root
${invertDriver.python}`,
    solution: `${treeHeader('4, 2, 7, 1, 3, 6, 9').python}def invert_tree(root):
    # An empty tree is already its own mirror - that is the base case.
    if root is None:
        return None

    left = invert_tree(root.left)
    right = invert_tree(root.right)

    root.left = right
    root.right = left

    return root
${invertDriver.python}`,
  },
  expectedOutput: [
    'example 1 -> [4, 7, 2, 9, 6, 3, 1]',
    'example 2 -> [2, 3, 1]',
    'example 3 -> []',
  ],
};

const depthDriver = {
  typescript: `
// --- examples ---------------------------------------------------------------
${BUILD_TREE.typescript}

console.log('example 1 ->', maxDepth(buildTree(values)));
console.log('example 2 ->', maxDepth(buildTree([1, null, 2])));
console.log('example 3 ->', maxDepth(buildTree([])));
`,
  python: `
# --- examples ---------------------------------------------------------------
${BUILD_TREE.python}


print('example 1 ->', max_depth(build_tree(values)))
print('example 2 ->', max_depth(build_tree([1, None, 2])))
print('example 3 ->', max_depth(build_tree([])))
`,
};

export const maximumDepth: LeetProblem = {
  slug: 'maximum-depth-of-binary-tree',
  number: 104,
  title: 'Maximum Depth of Binary Tree',
  difficulty: 'Easy',
  topics: ['tree', 'depth-first-search', 'breadth-first-search', 'binary-tree'],
  prompt:
    'Return the depth of a binary tree: the number of nodes along the longest path from the root down to a leaf. An empty tree has depth 0.',
  constraints: ['0 ≤ number of nodes ≤ 10⁴', '-100 ≤ Node.val ≤ 100'],
  examples: [
    { input: 'root = [3,9,20,null,null,15,7]', output: '3' },
    { input: 'root = [1,null,2]', output: '2' },
    { input: 'root = []', output: '0' },
  ],
  techniques: [
    {
      pattern: 'recursion',
      rank: 1,
      why: 'Depth is one plus the deeper of the two subtrees, and an empty tree is zero. The recurrence is the whole answer; there is nothing left to design.',
      complexity: { time: 'O(n)', space: 'O(n)' },
    },
    {
      pattern: 'bfs',
      rank: 2,
      why: 'Count the levels as you drain them. Slightly more code, but it finds the depth without ever recursing.',
      complexity: { time: 'O(n)', space: 'O(n)' },
    },
  ],
  params: [],
  typescript: {
    starter: `${treeHeader('3, 9, 20, null, null, 15, 7', '3, 9, 20, None, None, 15, 7').typescript}function maxDepth(root: TreeNode | null): number {
  // One plus the deeper side; zero for an empty tree.
  // TODO
  return 0;
}
${depthDriver.typescript}`,
    solution: `${treeHeader('3, 9, 20, null, null, 15, 7', '3, 9, 20, None, None, 15, 7').typescript}function maxDepth(root: TreeNode | null): number {
  if (root === null) return 0;

  return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
}
${depthDriver.typescript}`,
  },
  python: {
    starter: `${treeHeader('3, 9, 20, null, null, 15, 7', '3, 9, 20, None, None, 15, 7').python}def max_depth(root):
    """One plus the deeper side; zero for an empty tree."""
    # TODO
    return 0
${depthDriver.python}`,
    solution: `${treeHeader('3, 9, 20, null, null, 15, 7', '3, 9, 20, None, None, 15, 7').python}def max_depth(root):
    if root is None:
        return 0

    return 1 + max(max_depth(root.left), max_depth(root.right))
${depthDriver.python}`,
  },
  expectedOutput: ['example 1 -> 3', 'example 2 -> 2', 'example 3 -> 0'],
};

const stairsDriver = {
  typescript: `
// --- examples ---------------------------------------------------------------
console.log('example 1 ->', climbStairs(n));
console.log('example 2 ->', climbStairs(3));
console.log('example 3 ->', climbStairs(10));
`,
  python: `
# --- examples ---------------------------------------------------------------
print('example 1 ->', climb_stairs(n))
print('example 2 ->', climb_stairs(3))
print('example 3 ->', climb_stairs(10))
`,
};

export const climbingStairs: LeetProblem = {
  slug: 'climbing-stairs',
  number: 70,
  title: 'Climbing Stairs',
  difficulty: 'Easy',
  topics: ['math', 'dynamic-programming', 'memoization'],
  prompt:
    'A staircase has n steps and you climb either 1 or 2 at a time. Count the distinct ways to reach the top.',
  constraints: ['1 ≤ n ≤ 45'],
  examples: [
    { input: 'n = 2', output: '2', note: '1+1 or 2' },
    { input: 'n = 3', output: '3', note: '1+1+1, 1+2, 2+1' },
    { input: 'n = 10', output: '89' },
  ],
  techniques: [
    {
      pattern: 'recursion',
      rank: 1,
      why: 'The last move was a 1 or a 2, so ways(n) = ways(n−1) + ways(n−2) — Fibonacci in disguise. Written plainly the recursion is exponential; remembering each answer, or just keeping the last two, makes it linear.',
      complexity: { time: 'O(n)', space: 'O(1)' },
    },
  ],
  params: [{ name: 'n', label: 'Steps', type: 'number', default: 2, min: 1, max: 45 }],
  typescript: {
    starter: `const n = 2;

function climbStairs(n: number): number {
  // ways(n) = ways(n - 1) + ways(n - 2). Do not recompute what you know.
  // TODO
  return 0;
}
${stairsDriver.typescript}`,
    solution: `const n = 2;

function climbStairs(n: number): number {
  // Only the previous two answers are ever needed, so only they are kept.
  let twoBack = 1;  // ways to climb 0 steps
  let oneBack = 1;  // ways to climb 1 step

  for (let step = 2; step <= n; step++) {
    const ways = oneBack + twoBack;
    twoBack = oneBack;
    oneBack = ways;
  }

  return oneBack;
}
${stairsDriver.typescript}`,
  },
  python: {
    starter: `n = 2


def climb_stairs(n):
    """ways(n) = ways(n - 1) + ways(n - 2). Do not recompute what you know."""
    # TODO
    return 0
${stairsDriver.python}`,
    solution: `n = 2


def climb_stairs(n):
    # Only the previous two answers are ever needed, so only they are kept.
    two_back = 1  # ways to climb 0 steps
    one_back = 1  # ways to climb 1 step

    for _ in range(2, n + 1):
        two_back, one_back = one_back, one_back + two_back

    return one_back
${stairsDriver.python}`,
  },
  expectedOutput: ['example 1 -> 2', 'example 2 -> 3', 'example 3 -> 89'],
};

const mergeListsDriver = {
  typescript: `
// --- examples ---------------------------------------------------------------

/** Build a linked list from an array, and read one back out. */
function toList(values: number[]): ListNode | null {
  let head: ListNode | null = null;
  for (let i = values.length - 1; i >= 0; i--) {
    const node = new ListNode(values[i]);
    node.next = head;
    head = node;
  }
  return head;
}

function toArray(head: ListNode | null): number[] {
  const out: number[] = [];
  for (let node = head; node !== null; node = node.next) out.push(node.val);
  return out;
}

console.log('example 1 ->', toArray(mergeTwoLists(toList(list1), toList(list2))));
console.log('example 2 ->', toArray(mergeTwoLists(toList([]), toList([]))));
console.log('example 3 ->', toArray(mergeTwoLists(toList([]), toList([0]))));
`,
  python: `
# --- examples ---------------------------------------------------------------

def to_list(values):
    """Build a linked list from a list of values."""
    head = None
    for value in reversed(values):
        node = ListNode(value)
        node.next = head
        head = node
    return head


def to_array(head):
    out = []
    node = head
    while node is not None:
        out.append(node.val)
        node = node.next
    return out


print('example 1 ->', to_array(merge_two_lists(to_list(list1), to_list(list2))))
print('example 2 ->', to_array(merge_two_lists(to_list([]), to_list([]))))
print('example 3 ->', to_array(merge_two_lists(to_list([]), to_list([0]))))
`,
};

export const mergeTwoSortedLists: LeetProblem = {
  slug: 'merge-two-sorted-lists',
  number: 21,
  title: 'Merge Two Sorted Lists',
  difficulty: 'Easy',
  topics: ['linked-list', 'recursion'],
  prompt:
    'Given the heads of two sorted linked lists, splice them into one sorted list and return its head. The result should reuse the existing nodes rather than allocate new ones.',
  constraints: [
    '0 ≤ length of each list ≤ 50',
    '-100 ≤ Node.val ≤ 100',
    'Both lists are sorted ascending',
  ],
  examples: [
    { input: 'list1 = [1,2,4], list2 = [1,3,4]', output: '[1,1,2,3,4,4]' },
    { input: 'list1 = [], list2 = []', output: '[]' },
    { input: 'list1 = [], list2 = [0]', output: '[0]' },
  ],
  techniques: [
    {
      pattern: 'recursion',
      rank: 1,
      why: 'The smaller head is the answer’s head, and the rest of the answer is the merge of what is left — which is the same problem, one node smaller. An empty list is the base case, and it falls out in two lines.',
      complexity: { time: 'O(n)', space: 'O(n)' },
    },
    {
      pattern: 'two-pointers',
      rank: 2,
      why: 'The iterative version walks a pointer down each list, appending the smaller node to a dummy head. Same result in constant extra space, which matters if the lists could be long enough to exhaust the stack.',
      complexity: { time: 'O(n)', space: 'O(1)' },
    },
  ],
  params: [
    { name: 'list1', label: 'First sorted list', type: 'numberArray', default: [1, 2, 4] },
    { name: 'list2', label: 'Second sorted list', type: 'numberArray', default: [1, 3, 4] },
  ],
  typescript: {
    starter: `class ListNode {
  val: number;
  next: ListNode | null = null;
  constructor(val: number) {
    this.val = val;
  }
}

const list1 = [1, 2, 4];
const list2 = [1, 3, 4];

function mergeTwoLists(a: ListNode | null, b: ListNode | null): ListNode | null {
  // The smaller head, followed by the merge of whatever is left.
  // TODO
  return a;
}
${mergeListsDriver.typescript}`,
    solution: `class ListNode {
  val: number;
  next: ListNode | null = null;
  constructor(val: number) {
    this.val = val;
  }
}

const list1 = [1, 2, 4];
const list2 = [1, 3, 4];

function mergeTwoLists(a: ListNode | null, b: ListNode | null): ListNode | null {
  // Running out of one list is the base case: whatever is left of the other
  // is already sorted, so it is already the answer.
  if (a === null) return b;
  if (b === null) return a;

  if (a.val <= b.val) {
    a.next = mergeTwoLists(a.next, b);
    return a;
  }

  b.next = mergeTwoLists(a, b.next);
  return b;
}
${mergeListsDriver.typescript}`,
  },
  python: {
    starter: `class ListNode:
    def __init__(self, val):
        self.val = val
        self.next = None


list1 = [1, 2, 4]
list2 = [1, 3, 4]


def merge_two_lists(a, b):
    """The smaller head, followed by the merge of whatever is left."""
    # TODO
    return a
${mergeListsDriver.python}`,
    solution: `class ListNode:
    def __init__(self, val):
        self.val = val
        self.next = None


list1 = [1, 2, 4]
list2 = [1, 3, 4]


def merge_two_lists(a, b):
    # Running out of one list is the base case: whatever is left of the other
    # is already sorted, so it is already the answer.
    if a is None:
        return b
    if b is None:
        return a

    if a.val <= b.val:
        a.next = merge_two_lists(a.next, b)
        return a

    b.next = merge_two_lists(a, b.next)
    return b
${mergeListsDriver.python}`,
  },
  expectedOutput: [
    'example 1 -> [1, 1, 2, 3, 4, 4]',
    'example 2 -> []',
    'example 3 -> [0]',
  ],
};

const reverseDriver = {
  typescript: `
// --- examples ---------------------------------------------------------------

/** Build a linked list from an array, and read one back out. */
function toList(values: number[]): ListNode | null {
  let head: ListNode | null = null;
  for (let i = values.length - 1; i >= 0; i--) {
    const node = new ListNode(values[i]);
    node.next = head;
    head = node;
  }
  return head;
}

function toArray(head: ListNode | null): number[] {
  const out: number[] = [];
  for (let node = head; node !== null; node = node.next) out.push(node.val);
  return out;
}

console.log('example 1 ->', toArray(reverseList(toList(values))));
console.log('example 2 ->', toArray(reverseList(toList([1, 2]))));
console.log('example 3 ->', toArray(reverseList(toList([]))));
`,
  python: `
# --- examples ---------------------------------------------------------------

def to_list(values):
    """Build a linked list from a list of values."""
    head = None
    for value in reversed(values):
        node = ListNode(value)
        node.next = head
        head = node
    return head


def to_array(head):
    out = []
    node = head
    while node is not None:
        out.append(node.val)
        node = node.next
    return out


print('example 1 ->', to_array(reverse_list(to_list(values))))
print('example 2 ->', to_array(reverse_list(to_list([1, 2]))))
print('example 3 ->', to_array(reverse_list(to_list([]))))
`,
};

export const reverseLinkedList: LeetProblem = {
  slug: 'reverse-linked-list',
  number: 206,
  title: 'Reverse Linked List',
  difficulty: 'Easy',
  topics: ['linked-list', 'recursion'],
  prompt:
    'Reverse a singly linked list and return the new head. The classic follow-up asks for both the iterative and the recursive answer.',
  constraints: ['0 ≤ number of nodes ≤ 5000', '-5000 ≤ Node.val ≤ 5000'],
  examples: [
    { input: 'head = [1,2,3,4,5]', output: '[5,4,3,2,1]' },
    { input: 'head = [1,2]', output: '[2,1]' },
    { input: 'head = []', output: '[]' },
  ],
  techniques: [
    {
      pattern: 'recursion',
      rank: 1,
      why: 'Reverse everything after the head, then make the old second node point back at the head. The one line that catches people is that the head’s own `next` must be cleared, or the last two nodes end up pointing at each other.',
      complexity: { time: 'O(n)', space: 'O(n)' },
    },
    {
      pattern: 'two-pointers',
      rank: 2,
      why: 'A previous pointer and a current pointer walking down the list, turning each link around as they pass. Constant space, and the version to write in an interview.',
      complexity: { time: 'O(n)', space: 'O(1)' },
    },
  ],
  params: [{ name: 'values', label: 'List values', type: 'numberArray', default: [1, 2, 3, 4, 5] }],
  typescript: {
    starter: `class ListNode {
  val: number;
  next: ListNode | null = null;
  constructor(val: number) {
    this.val = val;
  }
}

const values = [1, 2, 3, 4, 5];

function reverseList(head: ListNode | null): ListNode | null {
  // Reverse the rest, then point the old second node back at the head.
  // TODO
  return head;
}
${reverseDriver.typescript}`,
    solution: `class ListNode {
  val: number;
  next: ListNode | null = null;
  constructor(val: number) {
    this.val = val;
  }
}

const values = [1, 2, 3, 4, 5];

function reverseList(head: ListNode | null): ListNode | null {
  // An empty list, or a single node, is already reversed.
  if (head === null || head.next === null) return head;

  // Reverse everything after the head: rest is the new head, and head.next
  // is still the node that used to follow us — now the tail of that reversal.
  const rest = reverseList(head.next);

  head.next.next = head;
  // Without this the last two nodes point at each other and the list cycles.
  head.next = null;

  return rest;
}
${reverseDriver.typescript}`,
  },
  python: {
    starter: `class ListNode:
    def __init__(self, val):
        self.val = val
        self.next = None


values = [1, 2, 3, 4, 5]


def reverse_list(head):
    """Reverse the rest, then point the old second node back at the head."""
    # TODO
    return head
${reverseDriver.python}`,
    solution: `class ListNode:
    def __init__(self, val):
        self.val = val
        self.next = None


values = [1, 2, 3, 4, 5]


def reverse_list(head):
    # An empty list, or a single node, is already reversed.
    if head is None or head.next is None:
        return head

    # Reverse everything after the head. rest is the new head, and head.next
    # is still the node that used to follow us - now the tail of that reversal.
    rest = reverse_list(head.next)

    head.next.next = head
    # Without this the last two nodes point at each other and the list cycles.
    head.next = None

    return rest
${reverseDriver.python}`,
  },
  expectedOutput: [
    'example 1 -> [5, 4, 3, 2, 1]',
    'example 2 -> [2, 1]',
    'example 3 -> []',
  ],
};

export const RECURSION_PROBLEMS = [
  invertBinaryTree,
  maximumDepth,
  climbingStairs,
  mergeTwoSortedLists,
  reverseLinkedList,
];
