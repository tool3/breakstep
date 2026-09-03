import type { Template } from '@/types';

export const binarySearchTree: Template = {
  id: 'example-bst',
  title: 'Binary Search Tree',
  category: 'Worked examples',
  blurb: 'Insert, search and in-order traverse — and see why balance matters.',
  tags: ['tree', 'bst', 'recursion'],
  expected: { time: 'O(log n)', space: 'O(n)' },
  params: [
    {
      name: 'values',
      label: 'Values to insert',
      type: 'numberArray',
      default: [50, 30, 70, 20, 40, 60, 80, 35, 65],
    },
    {
      name: 'search',
      binds: 'searchFor',
      label: 'Value to search for',
      type: 'number',
      default: 40,
      min: 0,
      max: 200,
    },
    {
      name: 'shape',
      label: 'Benchmark input shape',
      type: 'select',
      default: 'random',
      options: [
        { label: 'Shuffled — stays balanced, O(log n)', value: 'random' },
        { label: 'Already sorted — degenerates to a list, O(n)', value: 'sorted' },
      ],
      help: 'A BST is only logarithmic while it stays balanced. Try both.',
    },
  ],
  code: {
    typescript: `// Binary Search Tree.
//
// Every insert and lookup walks one root-to-leaf path, so the cost is the
// tree's HEIGHT - not its size. Insert shuffled data and the height is
// ~log2(n). Insert sorted data and the tree becomes a linked list with extra
// steps. Switch \`shape\` and re-run Analyze to watch the curve move.

const values = [50, 30, 70, 20, 40, 60, 80, 35, 65];
const searchFor = 40;
const shape = 'random';

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

  return node; // duplicates are ignored
}

function search(root: TreeNode | null, want: number): boolean {
  let node = root;

  while (node !== null) {
    if (want === node.value) return true;
    node = want < node.value ? node.left : node.right;
  }

  return false;
}

/** In-order traversal of a BST yields the values in sorted order. */
function inorder(node: TreeNode | null, out: number[] = []): number[] {
  if (node === null) return out;
  inorder(node.left, out);
  out.push(node.value);
  inorder(node.right, out);
  return out;
}

function height(node: TreeNode | null): number {
  return node === null ? 0 : 1 + Math.max(height(node.left), height(node.right));
}

let root: TreeNode | null = null;
for (const v of values) root = insert(root, v);

console.log('in-order (sorted):', inorder(root).join(', '));
console.log('height:', height(root), '- balanced would be', Math.ceil(Math.log2(values.length + 1)));
console.log('search(' + searchFor + '):', search(root, searchFor));
`,
    python: `# Binary Search Tree.
#
# Every insert and lookup walks one root-to-leaf path, so the cost is the
# tree's HEIGHT - not its size. Insert shuffled data and the height is
# ~log2(n). Insert sorted data and the tree becomes a linked list with extra
# steps. Switch \`shape\` and re-run Analyze to watch the curve move.

import math

values = [50, 30, 70, 20, 40, 60, 80, 35, 65]
searchFor = 40
shape = 'random'


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

    return node  # duplicates are ignored


def search(root, want):
    node = root

    while node is not None:
        if want == node.value:
            return True
        node = node.left if want < node.value else node.right

    return False


def inorder(node, out=None):
    """In-order traversal of a BST yields the values in sorted order."""
    if out is None:
        out = []
    if node is None:
        return out
    inorder(node.left, out)
    out.append(node.value)
    inorder(node.right, out)
    return out


def height(node):
    return 0 if node is None else 1 + max(height(node.left), height(node.right))


root = None
for v in values:
    root = insert(root, v)

print("in-order (sorted):", ", ".join(str(v) for v in inorder(root)))
print("height:", height(root), "- balanced would be", math.ceil(math.log2(len(values) + 1)))
print("search(" + str(searchFor) + "):", search(root, searchFor))
`,
  },
  bench: {
    typescript: `breakstep.bench({
  input: (n) => {
    // Keyed by the option: sorted input degenerates the tree into a list.
    const src = {
      sorted: () => Array.from({ length: n }, (_, i) => i),
      random: () => breakstep.randomInts(n, n * 4, 11),
    }[shape]();
    let tree: TreeNode | null = null;
    for (const v of src) tree = insert(tree, v);
    return tree;
  },
  // Search for a value that is not present: a full root-to-leaf descent.
  run: (tree) => search(tree as TreeNode | null, -1),
  sizes: [16, 32, 64, 128, 256, 512, 1024],
});
`,
    python: `def _build_tree(n):
    src = list(range(n)) if shape == "sorted" else breakstep.random_ints(n, n * 4, 11)
    tree = None
    for v in src:
        tree = insert(tree, v)
    return tree


breakstep.bench(
    input=_build_tree,
    # Search for a value that is not present: a full root-to-leaf descent.
    run=lambda tree: search(tree, -1),
    sizes=[16, 32, 64, 128, 256, 512],
)
`,
  },
  instrumented: {
    typescript: `// Binary Search Tree.
//
// Every insert and lookup walks one root-to-leaf path, so the cost is the
// tree's HEIGHT — not its size. Insert shuffled data and the height is
// ~log₂(n). Insert sorted data and the tree becomes a linked list with extra
// steps. Switch the "shape" parameter and re-run Analyze to watch the fitted
// curve move from O(log n) to O(n).

interface TreeNode {
  value: number;
  left: TreeNode | null;
  right: TreeNode | null;
}

const values = breakstep.param<number[]>('values', [50, 30, 70]);
const searchFor = breakstep.param<number>('search', 40);
const shape = breakstep.param<string>('shape', 'random');

function insert(root: TreeNode | null, value: number): TreeNode {
  if (root === null) return { value, left: null, right: null };
  if (value < root.value) root.left = insert(root.left, value);
  else if (value > root.value) root.right = insert(root.right, value);
  return root; // duplicates are ignored
}

function search(root: TreeNode | null, want: number): boolean {
  let node = root;
  const path: number[] = [];

  while (node !== null) {
    path.push(node.value);
    const here = node;

    // Factory form — the path highlight is O(depth) to build, and charging
    // that to every step would make the descent look like O(log² n).
    breakstep.show(root, () => ({
      label: \`at \${here.value} — go \${want === here.value ? 'nowhere, found it' : want < here.value ? 'left' : 'right'}\`,
      highlight: {
        ...Object.fromEntries(path.map((v) => [String(v), 'visited' as const])),
        [String(here.value)]: want === here.value ? ('match' as const) : ('active' as const),
      },
      meta: { depth: path.length, path: path.join(' → ') },
    }));

    if (want === node.value) return true;
    node = want < node.value ? node.left : node.right;
  }

  return false;
}

/** In-order traversal of a BST yields the values in sorted order. */
function inorder(node: TreeNode | null, out: number[] = []): number[] {
  if (node === null) return out;
  inorder(node.left, out);
  out.push(node.value);
  inorder(node.right, out);
  return out;
}

function height(node: TreeNode | null): number {
  return node === null ? 0 : 1 + Math.max(height(node.left), height(node.right));
}

let root: TreeNode | null = null;
for (const v of values) {
  root = insert(root, v);
  breakstep.show(root, { label: \`insert \${v}\`, highlight: { [String(v)]: 'active' } });
}

breakstep.show(root, { label: 'Complete tree' });
breakstep.log('in-order (sorted):', inorder(root).join(', '));
breakstep.log('height:', height(root), '— perfectly balanced would be', Math.ceil(Math.log2(values.length + 1)));
breakstep.log(\`search(\${searchFor}) →\`, search(root, searchFor));

breakstep.bench({
  input: (n) => {
    const source = shape === 'sorted'
      ? Array.from({ length: n }, (_, i) => i)
      : breakstep.randomInts(n, n * 4, 11);
    let tree: TreeNode | null = null;
    for (const v of source) tree = insert(tree, v);
    return tree;
  },
  // Search for a value that is not present: a full root-to-leaf descent.
  run: (tree) => search(tree as TreeNode | null, -1),
  sizes: [16, 32, 64, 128, 256, 512, 1024],
});
`,
    python: `# Binary Search Tree.
#
# Every insert and lookup walks one root-to-leaf path, so the cost is the
# tree's HEIGHT - not its size. Insert shuffled data and the height is
# ~log2(n). Insert sorted data and the tree becomes a linked list with extra
# steps. Switch the "shape" parameter and re-run Analyze to watch the fitted
# curve move from O(log n) to O(n).

import math

values = breakstep.param('values', [50, 30, 70])
search_for = breakstep.param('search', 40)
shape = breakstep.param('shape', 'random')


class TreeNode:
    def __init__(self, value):
        self.value = value
        self.left = None
        self.right = None


def insert(root, value):
    if root is None:
        return TreeNode(value)
    if value < root.value:
        root.left = insert(root.left, value)
    elif value > root.value:
        root.right = insert(root.right, value)
    return root  # duplicates are ignored


def search(root, want):
    node = root
    path = []

    while node is not None:
        path.append(node.value)
        here = node

        # Factory form - the path highlight is O(depth) to build, and charging
        # that to every step would make the descent look like O(log^2 n).
        def frame():
            direction = ("nowhere, found it" if want == here.value
                         else ("left" if want < here.value else "right"))
            highlight = {str(v): "visited" for v in path}
            highlight[str(here.value)] = "match" if want == here.value else "active"
            return {
                "label": f"at {here.value} - go {direction}",
                "highlight": highlight,
                "meta": {"depth": len(path), "path": " -> ".join(str(v) for v in path)},
            }

        breakstep.show(root, frame)

        if want == node.value:
            return True
        node = node.left if want < node.value else node.right

    return False


def inorder(node, out=None):
    """In-order traversal of a BST yields the values in sorted order."""
    if out is None:
        out = []
    if node is None:
        return out
    inorder(node.left, out)
    out.append(node.value)
    inorder(node.right, out)
    return out


def height(node):
    return 0 if node is None else 1 + max(height(node.left), height(node.right))


root = None
for v in values:
    root = insert(root, v)
    breakstep.show(root, label=f"insert {v}", highlight={str(v): "active"})

breakstep.show(root, label="Complete tree")
print("in-order (sorted):", ", ".join(str(v) for v in inorder(root)))
print("height:", height(root), "- perfectly balanced would be",
      math.ceil(math.log2(len(values) + 1)))
print(f"search({search_for}) ->", search(root, search_for))


def build_tree(n):
    source = list(range(n)) if shape == "sorted" else breakstep.random_ints(n, n * 4, 11)
    tree = None
    for v in source:
        tree = insert(tree, v)
    return tree


breakstep.bench(
    input=build_tree,
    # Search for a value that is not present: a full root-to-leaf descent.
    run=lambda tree: search(tree, -1),
    sizes=[16, 32, 64, 128, 256, 512],
)
`,
  },
};

export const trie: Template = {
  id: 'example-trie',
  title: 'Trie (Prefix Tree)',
  category: 'Worked examples',
  blurb: 'Lookups cost the length of the word — the dictionary size is irrelevant.',
  tags: ['trie', 'string', 'prefix'],
  expected: { time: 'O(n)', space: 'O(n)' },
  params: [
    {
      name: 'words',
      label: 'Words to insert',
      type: 'stringArray',
      default: ['cat', 'car', 'card', 'care', 'dog', 'do', 'done'],
    },
    { name: 'prefix', label: 'Prefix to complete', type: 'string', default: 'car' },
  ],
  code: {
    typescript: `// Trie - a tree keyed by character, one edge per letter.
//
// The headline property: searching costs O(m) where m is the length of the
// WORD, not the number of words stored. A 500,000-word dictionary looks up
// "car" in three steps, exactly like a three-word one.

const words = ['cat', 'car', 'card', 'care', 'dog', 'do', 'done'];
const prefix = 'car';

class TrieNode {
  children = new Map<string, TrieNode>();
  isEnd = false;
}

const root = new TrieNode();

function insert(word: string): void {
  let node = root;

  for (const ch of word) {
    if (!node.children.has(ch)) node.children.set(ch, new TrieNode());
    node = node.children.get(ch)!;
  }

  node.isEnd = true;
}

function walk(word: string): TrieNode | null {
  let node = root;

  for (const ch of word) {
    const next = node.children.get(ch);
    if (!next) return null;
    node = next;
  }

  return node;
}

function contains(word: string): boolean {
  return walk(word)?.isEnd === true;
}

/** Every word under a prefix - the autocomplete primitive. */
function completions(start: string): string[] {
  const node = walk(start);
  if (!node) return [];

  const out: string[] = [];
  const collect = (current: TrieNode, acc: string) => {
    if (current.isEnd) out.push(acc);
    for (const [ch, child] of current.children) collect(child, acc + ch);
  };

  collect(node, start);
  return out;
}

for (const word of words) insert(word);

console.log(words.length, 'words stored');
console.log('completions of "' + prefix + '":', completions(prefix).join(', ') || '(nothing)');
console.log('contains("' + words[0] + '"):', contains(words[0]));
`,
    python: `# Trie - a tree keyed by character, one edge per letter.
#
# The headline property: searching costs O(m) where m is the length of the
# WORD, not the number of words stored. A 500,000-word dictionary looks up
# "car" in three steps, exactly like a three-word one.

words = ['cat', 'car', 'card', 'care', 'dog', 'do', 'done']
prefix = 'car'


class TrieNode:
    def __init__(self):
        self.children = {}
        self.is_end = False


root = TrieNode()


def insert(word):
    node = root

    for ch in word:
        if ch not in node.children:
            node.children[ch] = TrieNode()
        node = node.children[ch]

    node.is_end = True


def walk(word):
    node = root

    for ch in word:
        node = node.children.get(ch)
        if node is None:
            return None

    return node


def contains(word):
    node = walk(word)
    return node is not None and node.is_end


def completions(start):
    """Every word under a prefix - the autocomplete primitive."""
    node = walk(start)
    if node is None:
        return []

    out = []

    def collect(current, acc):
        if current.is_end:
            out.append(acc)
        for ch, child in current.children.items():
            collect(child, acc + ch)

    collect(node, start)
    return out


for word in words:
    insert(word)

print(len(words), "words stored")
print('completions of "' + prefix + '":', ", ".join(completions(prefix)) or "(nothing)")
print('contains("' + words[0] + '"):', contains(words[0]))
`,
  },
  bench: {
    typescript: `breakstep.bench({
  // n words of a fixed length: lookup cost should NOT grow with n.
  input: (n) => Array.from({ length: n }, (_, i) => i.toString(36).padStart(6, 'a')),
  run: (dict) => {
    for (const w of dict as string[]) insert(w);
    return contains('zzzzzz');
  },
  sizes: [64, 128, 256, 512, 1024, 2048],
});
`,
    python: `def _bench_run(dictionary):
    for w in dictionary:
        insert(w)
    return contains("zzzzzz")


breakstep.bench(
    # n words of a fixed length: lookup cost should NOT grow with n.
    input=lambda n: [format(i, "06x") for i in range(n)],
    run=_bench_run,
    sizes=[64, 128, 256, 512, 1024],
)
`,
  },
  instrumented: {
    typescript: `// Trie — a tree keyed by character, one edge per letter.
//
// The headline property: searching costs O(m) where m is the length of the
// WORD, not the number of words stored. A 500,000-word dictionary looks up
// "car" in three steps, exactly like a three-word one.

interface TrieNode {
  children: Map<string, TrieNode>;
  isEnd: boolean;
}

const words = breakstep.param<string[]>('words', ['cat', 'car']);
const prefix = breakstep.param<string>('prefix', 'ca');

const newNode = (): TrieNode => ({ children: new Map(), isEnd: false });
const root = newNode();

function insert(word: string): void {
  let node = root;
  for (const ch of word) {
    if (!node.children.has(ch)) node.children.set(ch, newNode());
    node = node.children.get(ch)!;
  }
  node.isEnd = true;
}

function walk(word: string): TrieNode | null {
  let node = root;
  for (const ch of word) {
    const next = node.children.get(ch);
    if (!next) return null;
    node = next;
  }
  return node;
}

const contains = (word: string) => walk(word)?.isEnd === true;

/** Every word under a prefix — the autocomplete primitive. */
function completions(start: string): string[] {
  const node = walk(start);
  if (!node) return [];
  const out: string[] = [];

  const collect = (current: TrieNode, acc: string) => {
    if (current.isEnd) out.push(acc);
    for (const [ch, child] of current.children) collect(child, acc + ch);
  };

  collect(node, start);
  return out;
}

for (const word of words) {
  insert(word);
  breakstep.show(root, {
    label: \`insert "\${word}"\`,
    highlight: Object.fromEntries(
      word.split('').map((_, i) => [word.slice(0, i + 1), 'active' as const]),
    ),
  });
}

breakstep.show(root, { label: \`\${words.length} words stored\` });

const found = completions(prefix);
breakstep.show(root, {
  label: \`completions of "\${prefix}"\`,
  highlight: {
    ...Object.fromEntries(prefix.split('').map((_, i) => [prefix.slice(0, i + 1), 'active' as const])),
    ...Object.fromEntries(found.map((w) => [w, 'match' as const])),
  },
});

breakstep.log(\`"\${prefix}" completes to:\`, found.join(', ') || '(nothing)');
breakstep.log('contains("' + words[0] + '"):', contains(words[0]));

breakstep.bench({
  input: (n) => {
    // n words of a fixed length: lookup cost should NOT grow with n.
    const dict: string[] = [];
    for (let i = 0; i < n; i++) dict.push(i.toString(36).padStart(6, 'a'));
    return dict;
  },
  run: (dict) => {
    for (const w of dict as string[]) insert(w);
    return contains('zzzzzz');
  },
  sizes: [64, 128, 256, 512, 1024, 2048],
});
`,
    python: `# Trie - a tree keyed by character, one edge per letter.
#
# The headline property: searching costs O(m) where m is the length of the
# WORD, not the number of words stored. A 500,000-word dictionary looks up
# "car" in three steps, exactly like a three-word one.

words = breakstep.param('words', ['cat', 'car'])
prefix = breakstep.param('prefix', 'ca')


class TrieNode:
    def __init__(self):
        self.children = {}
        self.is_end = False


root = TrieNode()


def insert(word):
    node = root
    for ch in word:
        if ch not in node.children:
            node.children[ch] = TrieNode()
        node = node.children[ch]
    node.is_end = True


def walk(word):
    node = root
    for ch in word:
        node = node.children.get(ch)
        if node is None:
            return None
    return node


def contains(word):
    node = walk(word)
    return node is not None and node.is_end


def completions(start):
    """Every word under a prefix - the autocomplete primitive."""
    node = walk(start)
    if node is None:
        return []
    out = []

    def collect(current, acc):
        if current.is_end:
            out.append(acc)
        for ch, child in current.children.items():
            collect(child, acc + ch)

    collect(node, start)
    return out


for word in words:
    insert(word)
    breakstep.show(root, label=f'insert "{word}"',
             highlight={word[:i + 1]: "active" for i in range(len(word))})

breakstep.show(root, label=f"{len(words)} words stored")

found = completions(prefix)
highlight = {prefix[:i + 1]: "active" for i in range(len(prefix))}
highlight.update({w: "match" for w in found})
breakstep.show(root, label=f'completions of "{prefix}"', highlight=highlight)

print(f'"{prefix}" completes to:', ", ".join(found) or "(nothing)")
print(f'contains("{words[0]}"):', contains(words[0]))


def build_dict(n):
    # n words of a fixed length: lookup cost should NOT grow with n.
    return [format(i, "06x") for i in range(n)]


def bench_run(dictionary):
    for w in dictionary:
        insert(w)
    return contains("zzzzzz")


breakstep.bench(input=build_dict, run=bench_run, sizes=[64, 128, 256, 512, 1024])
`,
  },
};

export const heap: Template = {
  id: 'example-heap',
  title: 'Binary Heap / Priority Queue',
  category: 'Worked examples',
  blurb: 'An array that behaves like a tree: O(log n) push and pop.',
  tags: ['heap', 'priority-queue', 'array'],
  expected: { time: 'O(n log n)', space: 'O(n)' },
  params: [
    { name: 'values', label: 'Values to push', type: 'numberArray', default: [42, 17, 88, 5, 63, 29, 71, 12] },
    { name: 'k', label: 'Report the k smallest', type: 'number', default: 3, min: 1, max: 20 },
  ],
  code: {
    typescript: `// Binary min-heap, stored in a flat array.
//
// The tree structure is implied by arithmetic, not pointers:
//   parent(i) = (i - 1) >> 1     left(i) = 2i + 1     right(i) = 2i + 2
// Push appends then "sifts up"; pop swaps in the last element then "sifts
// down". Both walk one root-to-leaf path, so both are O(log n).

const values = [42, 17, 88, 5, 63, 29, 71, 12];
const k = 3;

class MinHeap {
  items: number[] = [];

  push(value: number): void {
    this.items.push(value);
    let i = this.items.length - 1;

    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent] <= this.items[i]) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
  }

  pop(): number | undefined {
    if (this.items.length === 0) return undefined;

    const top = this.items[0];
    const last = this.items.pop()!;

    if (this.items.length > 0) {
      this.items[0] = last;
      this.siftDown(0);
    }

    return top;
  }

  siftDown(start: number): void {
    let i = start;
    const n = this.items.length;

    for (;;) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let smallest = i;

      if (left < n && this.items[left] < this.items[smallest]) smallest = left;
      if (right < n && this.items[right] < this.items[smallest]) smallest = right;
      if (smallest === i) break;

      [this.items[i], this.items[smallest]] = [this.items[smallest], this.items[i]];
      i = smallest;
    }
  }
}

const heap = new MinHeap();
for (const v of values) heap.push(v);

const smallest: number[] = [];
for (let i = 0; i < Math.min(k, values.length); i++) smallest.push(heap.pop()!);

console.log(k, 'smallest:', smallest.join(', '));
console.log('heap array is not sorted - only the root is guaranteed:', heap.items.join(', '));
`,
    python: `# Binary min-heap, stored in a flat list.
#
# The tree structure is implied by arithmetic, not pointers:
#   parent(i) = (i - 1) // 2     left(i) = 2i + 1     right(i) = 2i + 2
# Push appends then "sifts up"; pop swaps in the last element then "sifts
# down". Both walk one root-to-leaf path, so both are O(log n).

values = [42, 17, 88, 5, 63, 29, 71, 12]
k = 3


class MinHeap:
    def __init__(self):
        self.items = []

    def push(self, value):
        self.items.append(value)
        i = len(self.items) - 1

        while i > 0:
            parent = (i - 1) // 2
            if self.items[parent] <= self.items[i]:
                break
            self.items[parent], self.items[i] = self.items[i], self.items[parent]
            i = parent

    def pop(self):
        if not self.items:
            return None

        top = self.items[0]
        last = self.items.pop()

        if self.items:
            self.items[0] = last
            self.sift_down(0)

        return top

    def sift_down(self, start):
        i = start
        n = len(self.items)

        while True:
            left, right = 2 * i + 1, 2 * i + 2
            smallest = i

            if left < n and self.items[left] < self.items[smallest]:
                smallest = left
            if right < n and self.items[right] < self.items[smallest]:
                smallest = right
            if smallest == i:
                break

            self.items[i], self.items[smallest] = self.items[smallest], self.items[i]
            i = smallest


heap = MinHeap()
for v in values:
    heap.push(v)

smallest = [heap.pop() for _ in range(min(k, len(values)))]

print(k, "smallest:", ", ".join(str(v) for v in smallest))
print("heap list is not sorted - only the root is guaranteed:", heap.items)
`,
  },
  bench: {
    typescript: `breakstep.bench({
  input: (n) => breakstep.randomInts(n, 100000, 5),
  run: (arr: number[]) => {
    const h = new MinHeap();
    for (const v of arr) h.push(v);   // n x O(log n)
    while (h.items.length) h.pop();   // n x O(log n)
    return h;
  },
  sizes: [32, 64, 128, 256, 512, 1024, 2048],
});
`,
    python: `def _bench_run(arr):
    h = MinHeap()
    for v in arr:
        h.push(v)   # n x O(log n)
    while h.items:
        h.pop()     # n x O(log n)
    return h


breakstep.bench(
    input=lambda n: breakstep.random_ints(n, 100000, 5),
    run=_bench_run,
    sizes=[32, 64, 128, 256, 512, 1024],
)
`,
  },
  instrumented: {
    typescript: `// Binary min-heap, stored in a flat array.
//
// The tree structure is implied by arithmetic, not pointers:
//   parent(i) = (i - 1) >> 1     left(i) = 2i + 1     right(i) = 2i + 2
// Push appends then "sifts up"; pop swaps in the last element then "sifts
// down". Both walk one root-to-leaf path, so both are O(log n).

const values = breakstep.param<number[]>('values', [42, 17, 88, 5]);
const k = breakstep.param<number>('k', 3);

class MinHeap {
  items: number[] = [];

  push(value: number): void {
    this.items.push(value);
    let i = this.items.length - 1;

    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent] <= this.items[i]) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }

    breakstep.show(this.items, {
      as: 'heap',
      heapType: 'min',
      label: \`push \${value}\`,
      highlight: { [i]: 'active' },
      meta: { size: this.items.length, min: this.items[0] },
    });
  }

  pop(): number | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop()!;

    if (this.items.length > 0) {
      this.items[0] = last;
      this.siftDown(0);
    }

    breakstep.show(this.items, {
      as: 'heap',
      heapType: 'min',
      label: \`pop \${top}\`,
      meta: { size: this.items.length, newMin: this.items[0] },
    });
    return top;
  }

  private siftDown(start: number): void {
    let i = start;
    const n = this.items.length;

    for (;;) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let smallest = i;

      if (left < n && this.items[left] < this.items[smallest]) smallest = left;
      if (right < n && this.items[right] < this.items[smallest]) smallest = right;
      if (smallest === i) break;

      [this.items[i], this.items[smallest]] = [this.items[smallest], this.items[i]];
      i = smallest;
    }
  }
}

const heap = new MinHeap();
for (const v of values) heap.push(v);

const smallest: number[] = [];
for (let i = 0; i < Math.min(k, values.length); i++) smallest.push(heap.pop()!);

breakstep.log(\`\${k} smallest:\`, smallest.join(', '));
breakstep.log('heap array is not sorted — only the root is guaranteed:', heap.items.join(', '));

breakstep.bench({
  input: (n) => breakstep.randomInts(n, 100000, 5),
  run: (arr: number[]) => {
    const h = new MinHeap();
    for (const v of arr) h.push(v);        // n × O(log n)
    while (h.items.length) h.pop();        // n × O(log n)
    return h;
  },
  sizes: [32, 64, 128, 256, 512, 1024, 2048],
});
`,
    python: `# Binary min-heap, stored in a flat list.
#
# The tree structure is implied by arithmetic, not pointers:
#   parent(i) = (i - 1) // 2     left(i) = 2i + 1     right(i) = 2i + 2
# Push appends then "sifts up"; pop swaps in the last element then "sifts
# down". Both walk one root-to-leaf path, so both are O(log n).

values = breakstep.param('values', [42, 17, 88, 5])
k = breakstep.param('k', 3)


class MinHeap:
    def __init__(self):
        self.items = []

    def push(self, value):
        self.items.append(value)
        i = len(self.items) - 1

        while i > 0:
            parent = (i - 1) // 2
            if self.items[parent] <= self.items[i]:
                break
            self.items[parent], self.items[i] = self.items[i], self.items[parent]
            i = parent

        breakstep.show(self.items, kind="heap", heapType="min", label=f"push {value}",
                 highlight={i: "active"},
                 meta={"size": len(self.items), "min": self.items[0]})

    def pop(self):
        if not self.items:
            return None
        top = self.items[0]
        last = self.items.pop()

        if self.items:
            self.items[0] = last
            self._sift_down(0)

        breakstep.show(self.items, kind="heap", heapType="min", label=f"pop {top}",
                 meta={"size": len(self.items)})
        return top

    def _sift_down(self, start):
        i = start
        n = len(self.items)

        while True:
            left, right = 2 * i + 1, 2 * i + 2
            smallest = i

            if left < n and self.items[left] < self.items[smallest]:
                smallest = left
            if right < n and self.items[right] < self.items[smallest]:
                smallest = right
            if smallest == i:
                break

            self.items[i], self.items[smallest] = self.items[smallest], self.items[i]
            i = smallest


heap = MinHeap()
for v in values:
    heap.push(v)

smallest = [heap.pop() for _ in range(min(k, len(values)))]

print(f"{k} smallest:", ", ".join(str(v) for v in smallest))
print("heap list is not sorted - only the root is guaranteed:", heap.items)


def bench_run(arr):
    h = MinHeap()
    for v in arr:
        h.push(v)      # n x O(log n)
    while h.items:
        h.pop()        # n x O(log n)
    return h


breakstep.bench(
    input=lambda n: breakstep.random_ints(n, 100000, 5),
    run=bench_run,
    sizes=[32, 64, 128, 256, 512, 1024],
)
`,
  },
};
