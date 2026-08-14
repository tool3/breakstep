import type { Template } from '@/types';

export const binarySearchTree: Template = {
  id: 'bst',
  title: 'Binary Search Tree',
  category: 'Data structures',
  blurb: 'Ordered by construction: insert, search, min/max, delete, in-order walk.',
  tags: ['tree', 'bst', 'ordered', 'recursion'],
  expected: { time: 'O(n log n)', space: 'O(n)' },
  params: [
    {
      name: 'values',
      label: 'Values to insert',
      type: 'numberArray',
      default: [50, 30, 70, 20, 40, 60, 80],
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
      name: 'remove',
      binds: 'removeValue',
      label: 'Value to delete',
      type: 'number',
      default: 30,
      min: 0,
      max: 200,
      help: 'Deleting a node with two children is the interesting case.',
    },
  ],
  code: {
    typescript: `// Binary search tree.
//
// One invariant does all the work: everything in the left subtree is smaller
// than the node, everything in the right subtree is larger. That makes search,
// insert and delete a single root-to-leaf walk — so they cost the tree's
// HEIGHT, not its size.
//
// Height is the catch. Shuffled input gives ~log₂(n); already-sorted input
// gives a linked list with extra steps. Self-balancing trees (AVL, red-black)
// exist entirely to stop that from happening.

const values = [50, 30, 70, 20, 40, 60, 80];
const searchFor = 40;
const removeValue = 30;

class TreeNode {
  value: number;
  left: TreeNode | null = null;
  right: TreeNode | null = null;

  constructor(value: number) {
    this.value = value;
  }
}

class BST {
  root: TreeNode | null = null;
  size = 0;

  insert(value: number): void {
    const before = this.size;
    this.root = this.insertInto(this.root, value);
    if (this.size !== before) return; // counted inside
  }

  private insertInto(node: TreeNode | null, value: number): TreeNode {
    if (node === null) {
      this.size++;
      return new TreeNode(value);
    }

    if (value < node.value) node.left = this.insertInto(node.left, value);
    else if (value > node.value) node.right = this.insertInto(node.right, value);
    // Equal values are ignored: a set, not a multiset.

    return node;
  }

  /** Iterative on purpose — search needs no stack. */
  contains(value: number): boolean {
    let node = this.root;
    while (node !== null) {
      if (value === node.value) return true;
      node = value < node.value ? node.left : node.right;
    }
    return false;
  }

  min(): number | undefined {
    let node = this.root;
    while (node?.left) node = node.left;
    return node?.value;
  }

  max(): number | undefined {
    let node = this.root;
    while (node?.right) node = node.right;
    return node?.value;
  }

  height(node: TreeNode | null = this.root): number {
    if (node === null) return 0;
    return 1 + Math.max(this.height(node.left), this.height(node.right));
  }

  /** In-order traversal visits a BST in sorted order — that is the proof it works. */
  inorder(node: TreeNode | null = this.root, out: number[] = []): number[] {
    if (node === null) return out;
    this.inorder(node.left, out);
    out.push(node.value);
    this.inorder(node.right, out);
    return out;
  }

  delete(value: number): void {
    this.root = this.deleteFrom(this.root, value);
  }

  private deleteFrom(node: TreeNode | null, value: number): TreeNode | null {
    if (node === null) return null;

    if (value < node.value) {
      node.left = this.deleteFrom(node.left, value);
      return node;
    }
    if (value > node.value) {
      node.right = this.deleteFrom(node.right, value);
      return node;
    }

    // Found it. Zero or one child: splice the node out.
    this.size--;
    if (node.left === null) return node.right;
    if (node.right === null) return node.left;

    // Two children: replace the value with its in-order successor — the
    // smallest value in the right subtree — then delete that successor.
    let successor = node.right;
    while (successor.left !== null) successor = successor.left;

    node.value = successor.value;
    this.size++; // the recursive call below decrements again
    node.right = this.deleteFrom(node.right, successor.value);
    return node;
  }
}

const tree = new BST();
for (const value of values) tree.insert(value);

console.log('in-order (sorted) ->', tree.inorder().join(', '));
console.log('size    ->', tree.size);
console.log('height  ->', tree.height(), '(perfectly balanced would be', Math.ceil(Math.log2(values.length + 1)) + ')');
console.log('min/max ->', tree.min(), '/', tree.max());
console.log('contains(' + searchFor + ') ->', tree.contains(searchFor));

tree.delete(removeValue);
console.log('after delete(' + removeValue + ') ->', tree.inorder().join(', '));
console.log('still sorted, still a valid BST.');
`,
    python: `# Binary search tree.
#
# One invariant does all the work: everything in the left subtree is smaller
# than the node, everything in the right subtree is larger. That makes search,
# insert and delete a single root-to-leaf walk - so they cost the tree's
# HEIGHT, not its size.
#
# Height is the catch. Shuffled input gives ~log2(n); already-sorted input
# gives a linked list with extra steps. Self-balancing trees (AVL, red-black)
# exist entirely to stop that from happening.

import math

values = [50, 30, 70, 20, 40, 60, 80]
searchFor = 40
removeValue = 30


class TreeNode:
    def __init__(self, value):
        self.value = value
        self.left = None
        self.right = None


class BST:
    def __init__(self):
        self.root = None
        self.size = 0

    def insert(self, value):
        self.root = self._insert_into(self.root, value)

    def _insert_into(self, node, value):
        if node is None:
            self.size += 1
            return TreeNode(value)

        if value < node.value:
            node.left = self._insert_into(node.left, value)
        elif value > node.value:
            node.right = self._insert_into(node.right, value)
        # Equal values are ignored: a set, not a multiset.

        return node

    def contains(self, value):
        """Iterative on purpose - search needs no stack."""
        node = self.root
        while node is not None:
            if value == node.value:
                return True
            node = node.left if value < node.value else node.right
        return False

    def min(self):
        node = self.root
        while node is not None and node.left is not None:
            node = node.left
        return node.value if node else None

    def max(self):
        node = self.root
        while node is not None and node.right is not None:
            node = node.right
        return node.value if node else None

    def height(self, node="root"):
        if node == "root":
            node = self.root
        if node is None:
            return 0
        return 1 + max(self.height(node.left), self.height(node.right))

    def inorder(self, node="root", out=None):
        """In-order traversal visits a BST in sorted order - the proof it works."""
        if node == "root":
            node = self.root
        if out is None:
            out = []
        if node is None:
            return out
        self.inorder(node.left, out)
        out.append(node.value)
        self.inorder(node.right, out)
        return out

    def delete(self, value):
        self.root = self._delete_from(self.root, value)

    def _delete_from(self, node, value):
        if node is None:
            return None

        if value < node.value:
            node.left = self._delete_from(node.left, value)
            return node
        if value > node.value:
            node.right = self._delete_from(node.right, value)
            return node

        # Found it. Zero or one child: splice the node out.
        self.size -= 1
        if node.left is None:
            return node.right
        if node.right is None:
            return node.left

        # Two children: replace the value with its in-order successor - the
        # smallest value in the right subtree - then delete that successor.
        successor = node.right
        while successor.left is not None:
            successor = successor.left

        node.value = successor.value
        self.size += 1  # the recursive call below decrements again
        node.right = self._delete_from(node.right, successor.value)
        return node


tree = BST()
for value in values:
    tree.insert(value)

print("in-order (sorted) ->", ", ".join(str(v) for v in tree.inorder()))
print("size    ->", tree.size)
print("height  ->", tree.height(), "(perfectly balanced would be",
      str(math.ceil(math.log2(len(values) + 1))) + ")")
print("min/max ->", tree.min(), "/", tree.max())
print("contains(" + str(searchFor) + ") ->", tree.contains(searchFor))

tree.delete(removeValue)
print("after delete(" + str(removeValue) + ") ->", ", ".join(str(v) for v in tree.inorder()))
print("still sorted, still a valid BST.")
`,
  },
  bench: {
    typescript: `breakstep.bench({
  input: (n) => breakstep.randomInts(n, n * 4, 11),
  run: (arr: number[]) => {
    const t = new BST();
    for (const v of arr) t.insert(v);   // n × O(height)
    return t.contains(-1);
  },
  sizes: [16, 32, 64, 128, 256, 512, 1024],
});
`,
    python: `def _bench(arr):
    t = BST()
    for v in arr:
        t.insert(v)     # n x O(height)
    return t.contains(-1)


breakstep.bench(input=lambda n: breakstep.random_ints(n, n * 4, 11), run=_bench,
          sizes=[16, 32, 64, 128, 256, 512])
`,
  },
  instrumented: {
    typescript: `// Binary search tree — the same structure, drawn explicitly.

const values = breakstep.param<number[]>('values', [50, 30, 70, 20, 40]);
const searchFor = breakstep.param<number>('search', 40);
const removeValue = breakstep.param<number>('remove', 30);

class TreeNode {
  value: number;
  left: TreeNode | null = null;
  right: TreeNode | null = null;
  constructor(value: number) {
    this.value = value;
  }
}

class BST {
  root: TreeNode | null = null;
  size = 0;

  insert(value: number): void {
    this.root = this.insertInto(this.root, value);
    breakstep.show(this.root, {
      label: \`insert(\${value})\`,
      highlight: { [String(value)]: 'match' },
      meta: { size: this.size, height: this.height() },
    });
  }

  insertInto(node: TreeNode | null, value: number): TreeNode {
    if (node === null) {
      this.size++;
      return new TreeNode(value);
    }
    if (value < node.value) node.left = this.insertInto(node.left, value);
    else if (value > node.value) node.right = this.insertInto(node.right, value);
    return node;
  }

  contains(value: number): boolean {
    let node = this.root;
    const path: number[] = [];

    while (node !== null) {
      path.push(node.value);
      const here = node;
      breakstep.show(this.root, () => ({
        label: \`at \${here.value} — go \${value === here.value ? 'nowhere, found it' : value < here.value ? 'left' : 'right'}\`,
        highlight: {
          ...Object.fromEntries(path.map((v) => [String(v), 'visited' as const])),
          [String(here.value)]: value === here.value ? ('match' as const) : ('active' as const),
        },
        meta: { depth: path.length },
      }));

      if (value === node.value) return true;
      node = value < node.value ? node.left : node.right;
    }
    return false;
  }

  height(node: TreeNode | null = this.root): number {
    if (node === null) return 0;
    return 1 + Math.max(this.height(node.left), this.height(node.right));
  }

  inorder(node: TreeNode | null = this.root, out: number[] = []): number[] {
    if (node === null) return out;
    this.inorder(node.left, out);
    out.push(node.value);
    this.inorder(node.right, out);
    return out;
  }

  delete(value: number): void {
    this.root = this.deleteFrom(this.root, value);
    breakstep.show(this.root, { label: \`delete(\${value})\`, meta: { size: this.size } });
  }

  deleteFrom(node: TreeNode | null, value: number): TreeNode | null {
    if (node === null) return null;
    if (value < node.value) {
      node.left = this.deleteFrom(node.left, value);
      return node;
    }
    if (value > node.value) {
      node.right = this.deleteFrom(node.right, value);
      return node;
    }

    this.size--;
    if (node.left === null) return node.right;
    if (node.right === null) return node.left;

    let successor = node.right;
    while (successor.left !== null) successor = successor.left;
    node.value = successor.value;
    this.size++;
    node.right = this.deleteFrom(node.right, successor.value);
    return node;
  }
}

const tree = new BST();
for (const value of values) tree.insert(value);

breakstep.log('in-order ->', tree.inorder().join(', '));
breakstep.log('contains(' + searchFor + ') ->', tree.contains(searchFor));

tree.delete(removeValue);
breakstep.log('after delete ->', tree.inorder().join(', '));

breakstep.bench({
  input: (n) => breakstep.randomInts(n, n * 4, 11),
  run: (arr: number[]) => {
    const t = new BST();
    for (const v of arr) t.insert(v);
    return t.contains(-1);
  },
  sizes: [16, 32, 64, 128, 256, 512, 1024],
});
`,
    python: `# Binary search tree - the same structure, drawn explicitly.

values = breakstep.param('values', [50, 30, 70, 20, 40])
searchFor = breakstep.param('search', 40)
removeValue = breakstep.param('remove', 30)


class TreeNode:
    def __init__(self, value):
        self.value = value
        self.left = None
        self.right = None


class BST:
    def __init__(self):
        self.root = None
        self.size = 0

    def insert(self, value):
        self.root = self._insert_into(self.root, value)
        breakstep.show(self.root, label=f"insert({value})",
                 highlight={str(value): "match"},
                 meta={"size": self.size, "height": self.height()})

    def _insert_into(self, node, value):
        if node is None:
            self.size += 1
            return TreeNode(value)
        if value < node.value:
            node.left = self._insert_into(node.left, value)
        elif value > node.value:
            node.right = self._insert_into(node.right, value)
        return node

    def contains(self, value):
        node = self.root
        path = []

        while node is not None:
            path.append(node.value)
            here = node

            def frame():
                direction = ("nowhere, found it" if value == here.value
                             else ("left" if value < here.value else "right"))
                highlight = {str(v): "visited" for v in path}
                highlight[str(here.value)] = "match" if value == here.value else "active"
                return {
                    "label": f"at {here.value} - go {direction}",
                    "highlight": highlight,
                    "meta": {"depth": len(path)},
                }

            breakstep.show(self.root, frame)

            if value == node.value:
                return True
            node = node.left if value < node.value else node.right
        return False

    def height(self, node="root"):
        if node == "root":
            node = self.root
        if node is None:
            return 0
        return 1 + max(self.height(node.left), self.height(node.right))

    def inorder(self, node="root", out=None):
        if node == "root":
            node = self.root
        if out is None:
            out = []
        if node is None:
            return out
        self.inorder(node.left, out)
        out.append(node.value)
        self.inorder(node.right, out)
        return out

    def delete(self, value):
        self.root = self._delete_from(self.root, value)
        breakstep.show(self.root, label=f"delete({value})", meta={"size": self.size})

    def _delete_from(self, node, value):
        if node is None:
            return None
        if value < node.value:
            node.left = self._delete_from(node.left, value)
            return node
        if value > node.value:
            node.right = self._delete_from(node.right, value)
            return node

        self.size -= 1
        if node.left is None:
            return node.right
        if node.right is None:
            return node.left

        successor = node.right
        while successor.left is not None:
            successor = successor.left
        node.value = successor.value
        self.size += 1
        node.right = self._delete_from(node.right, successor.value)
        return node


tree = BST()
for value in values:
    tree.insert(value)

breakstep.log("in-order ->", ", ".join(str(v) for v in tree.inorder()))
breakstep.log("contains(" + str(searchFor) + ") ->", tree.contains(searchFor))

tree.delete(removeValue)
breakstep.log("after delete ->", ", ".join(str(v) for v in tree.inorder()))


def _bench(arr):
    t = BST()
    for v in arr:
        t.insert(v)
    return t.contains(-1)


breakstep.bench(input=lambda n: breakstep.random_ints(n, n * 4, 11), run=_bench,
          sizes=[16, 32, 64, 128, 256, 512])
`,
  },
};

export const trie: Template = {
  id: 'trie',
  title: 'Trie',
  category: 'Data structures',
  blurb: 'A tree keyed by character: lookup costs the word length, not the dictionary size.',
  tags: ['trie', 'prefix-tree', 'string'],
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
    typescript: `// Trie (prefix tree).
//
// One edge per character, so a word is a path from the root. The headline
// property: \`search("car")\` costs three steps whether the trie holds three
// words or five hundred thousand — the dictionary size never enters the cost.
//
// The price is memory. A hash set of words is smaller; a trie earns its keep
// when you need *prefix* queries, which a hash set cannot answer at all.
//
// \`isEnd\` is the subtlety: "car" is both a stored word and a prefix of "card",
// so a node needs a flag saying "a word ends here" separate from having children.

const words = ['cat', 'car', 'card', 'care', 'dog', 'do', 'done'];
const prefix = 'car';

class TrieNode {
  children = new Map<string, TrieNode>();
  isEnd = false;
}

class Trie {
  root = new TrieNode();
  size = 0;

  insert(word: string): void {
    let node = this.root;

    for (const ch of word) {
      if (!node.children.has(ch)) node.children.set(ch, new TrieNode());
      node = node.children.get(ch)!;
    }

    if (!node.isEnd) {
      node.isEnd = true;
      this.size++;
    }
  }

  /** Walk the path for a string; null if it falls off the trie. */
  private walk(text: string): TrieNode | null {
    let node = this.root;
    for (const ch of text) {
      const next = node.children.get(ch);
      if (next === undefined) return null;
      node = next;
    }
    return node;
  }

  /** Is this exact word stored? */
  search(word: string): boolean {
    return this.walk(word)?.isEnd === true;
  }

  /** Is anything stored under this prefix? */
  startsWith(text: string): boolean {
    return this.walk(text) !== null;
  }

  /** Every word under a prefix — the autocomplete primitive. */
  wordsWithPrefix(text: string): string[] {
    const start = this.walk(text);
    if (start === null) return [];

    const out: string[] = [];
    const collect = (node: TrieNode, acc: string) => {
      if (node.isEnd) out.push(acc);
      for (const [ch, child] of node.children) collect(child, acc + ch);
    };

    collect(start, text);
    return out;
  }
}

const trie = new Trie();
for (const word of words) trie.insert(word);

console.log('words stored     ->', trie.size);
console.log('search("car")    ->', trie.search('car'));
console.log('search("ca")     ->', trie.search('ca'), '(a prefix, not a word)');
console.log('startsWith("ca") ->', trie.startsWith('ca'));
console.log('completions of "' + prefix + '" ->', trie.wordsWithPrefix(prefix).join(', ') || '(none)');
console.log('completions of "z"   ->', trie.wordsWithPrefix('z').join(', ') || '(none)');
`,
    python: `# Trie (prefix tree).
#
# One edge per character, so a word is a path from the root. The headline
# property: \`search("car")\` costs three steps whether the trie holds three
# words or five hundred thousand - the dictionary size never enters the cost.
#
# The price is memory. A set of words is smaller; a trie earns its keep when
# you need *prefix* queries, which a set cannot answer at all.
#
# \`is_end\` is the subtlety: "car" is both a stored word and a prefix of "card",
# so a node needs a flag saying "a word ends here" separate from having children.

words = ['cat', 'car', 'card', 'care', 'dog', 'do', 'done']
prefix = 'car'


class TrieNode:
    def __init__(self):
        self.children = {}
        self.is_end = False


class Trie:
    def __init__(self):
        self.root = TrieNode()
        self.size = 0

    def insert(self, word):
        node = self.root

        for ch in word:
            if ch not in node.children:
                node.children[ch] = TrieNode()
            node = node.children[ch]

        if not node.is_end:
            node.is_end = True
            self.size += 1

    def _walk(self, text):
        """Walk the path for a string; None if it falls off the trie."""
        node = self.root
        for ch in text:
            node = node.children.get(ch)
            if node is None:
                return None
        return node

    def search(self, word):
        """Is this exact word stored?"""
        node = self._walk(word)
        return node is not None and node.is_end

    def starts_with(self, text):
        """Is anything stored under this prefix?"""
        return self._walk(text) is not None

    def words_with_prefix(self, text):
        """Every word under a prefix - the autocomplete primitive."""
        start = self._walk(text)
        if start is None:
            return []

        out = []

        def collect(node, acc):
            if node.is_end:
                out.append(acc)
            for ch, child in node.children.items():
                collect(child, acc + ch)

        collect(start, text)
        return out


trie = Trie()
for word in words:
    trie.insert(word)

print("words stored      ->", trie.size)
print('search("car")     ->', trie.search("car"))
print('search("ca")      ->', trie.search("ca"), "(a prefix, not a word)")
print('starts_with("ca") ->', trie.starts_with("ca"))
print('completions of "' + prefix + '" ->', ", ".join(trie.words_with_prefix(prefix)) or "(none)")
print('completions of "z"   ->', ", ".join(trie.words_with_prefix("z")) or "(none)")
`,
  },
  bench: {
    typescript: `breakstep.bench({
  // n words of a fixed length: the lookup should NOT grow with n.
  input: (n) => Array.from({ length: n }, (_, i) => i.toString(36).padStart(6, 'a')),
  run: (dict) => {
    const t = new Trie();
    for (const w of dict as string[]) t.insert(w);
    return t.search('zzzzzz');
  },
  sizes: [64, 128, 256, 512, 1024, 2048],
});
`,
    python: `def _bench(dictionary):
    t = Trie()
    for w in dictionary:
        t.insert(w)
    return t.search("zzzzzz")


# n words of a fixed length: the lookup should NOT grow with n.
breakstep.bench(input=lambda n: [format(i, "06x") for i in range(n)], run=_bench,
          sizes=[64, 128, 256, 512, 1024])
`,
  },
  instrumented: {
    typescript: `// Trie — the same structure, drawn explicitly.
//
// Trie highlights are keyed by the PREFIX string that reaches a node, which is
// how a whole path lights up in one call.

const words = breakstep.param<string[]>('words', ['cat', 'car', 'card']);
const prefix = breakstep.param<string>('prefix', 'car');

class TrieNode {
  children = new Map<string, TrieNode>();
  isEnd = false;
}

class Trie {
  root = new TrieNode();
  size = 0;

  insert(word: string): void {
    let node = this.root;
    for (const ch of word) {
      if (!node.children.has(ch)) node.children.set(ch, new TrieNode());
      node = node.children.get(ch)!;
    }
    if (!node.isEnd) {
      node.isEnd = true;
      this.size++;
    }

    breakstep.show(this.root, () => ({
      label: \`insert("\${word}")\`,
      highlight: Object.fromEntries(
        word.split('').map((_, i) => [word.slice(0, i + 1), 'active' as const]),
      ),
      meta: { words: this.size },
    }));
  }

  walk(text: string): TrieNode | null {
    let node = this.root;
    for (const ch of text) {
      const next = node.children.get(ch);
      if (next === undefined) return null;
      node = next;
    }
    return node;
  }

  search(word: string): boolean {
    return this.walk(word)?.isEnd === true;
  }

  wordsWithPrefix(text: string): string[] {
    const start = this.walk(text);
    if (start === null) return [];

    const out: string[] = [];
    const collect = (node: TrieNode, acc: string) => {
      if (node.isEnd) out.push(acc);
      for (const [ch, child] of node.children) collect(child, acc + ch);
    };
    collect(start, text);

    breakstep.show(this.root, () => ({
      label: \`completions of "\${text}"\`,
      highlight: {
        ...Object.fromEntries(text.split('').map((_, i) => [text.slice(0, i + 1), 'active' as const])),
        ...Object.fromEntries(out.map((w) => [w, 'match' as const])),
      },
      meta: { found: out.length },
    }));
    return out;
  }
}

const trie = new Trie();
for (const word of words) trie.insert(word);

breakstep.log('words stored ->', trie.size);
breakstep.log('search("' + words[0] + '") ->', trie.search(words[0]));
breakstep.log('completions ->', trie.wordsWithPrefix(prefix).join(', ') || '(none)');

breakstep.bench({
  input: (n) => Array.from({ length: n }, (_, i) => i.toString(36).padStart(6, 'a')),
  run: (dict) => {
    const t = new Trie();
    for (const w of dict as string[]) t.insert(w);
    return t.search('zzzzzz');
  },
  sizes: [64, 128, 256, 512, 1024, 2048],
});
`,
    python: `# Trie - the same structure, drawn explicitly.

words = breakstep.param('words', ['cat', 'car', 'card'])
prefix = breakstep.param('prefix', 'car')


class TrieNode:
    def __init__(self):
        self.children = {}
        self.is_end = False


class Trie:
    def __init__(self):
        self.root = TrieNode()
        self.size = 0

    def insert(self, word):
        node = self.root
        for ch in word:
            if ch not in node.children:
                node.children[ch] = TrieNode()
            node = node.children[ch]
        if not node.is_end:
            node.is_end = True
            self.size += 1

        breakstep.show(self.root, lambda: {
            "label": f'insert("{word}")',
            "highlight": {word[:i + 1]: "active" for i in range(len(word))},
            "meta": {"words": self.size},
        })

    def walk(self, text):
        node = self.root
        for ch in text:
            node = node.children.get(ch)
            if node is None:
                return None
        return node

    def search(self, word):
        node = self.walk(word)
        return node is not None and node.is_end

    def words_with_prefix(self, text):
        start = self.walk(text)
        if start is None:
            return []

        out = []

        def collect(node, acc):
            if node.is_end:
                out.append(acc)
            for ch, child in node.children.items():
                collect(child, acc + ch)

        collect(start, text)

        def frame():
            highlight = {text[:i + 1]: "active" for i in range(len(text))}
            highlight.update({w: "match" for w in out})
            return {
                "label": f'completions of "{text}"',
                "highlight": highlight,
                "meta": {"found": len(out)},
            }

        breakstep.show(self.root, frame)
        return out


trie = Trie()
for word in words:
    trie.insert(word)

breakstep.log("words stored ->", trie.size)
breakstep.log('search("' + words[0] + '") ->', trie.search(words[0]))
breakstep.log("completions ->", ", ".join(trie.words_with_prefix(prefix)) or "(none)")


def _bench(dictionary):
    t = Trie()
    for w in dictionary:
        t.insert(w)
    return t.search("zzzzzz")


breakstep.bench(input=lambda n: [format(i, "06x") for i in range(n)], run=_bench,
          sizes=[64, 128, 256, 512, 1024])
`,
  },
};
