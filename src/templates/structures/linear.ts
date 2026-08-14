import type { Template } from '@/types';

export const stack: Template = {
  id: 'stack',
  title: 'Stack',
  category: 'Data structures',
  blurb: 'Last in, first out. Every operation touches one end, so all are O(1).',
  tags: ['stack', 'lifo', 'array'],
  expected: { time: 'O(n)', space: 'O(n)' },
  params: [
    { name: 'values', label: 'Values to push', type: 'numberArray', default: [3, 7, 1, 9, 4] },
  ],
  code: {
    typescript: `// Stack — last in, first out.
//
// Every operation touches only the end of the array, so push, pop and peek are
// all O(1). That single restriction is the whole value: undo history, call
// frames, bracket matching and depth-first search are all stacks in disguise.

const values = [3, 7, 1, 9, 4];

class Stack<T> {
  private items: T[] = [];

  /** Add to the top. */
  push(value: T): void {
    this.items.push(value);
  }

  /** Remove and return the top, or undefined when empty. */
  pop(): T | undefined {
    return this.items.pop();
  }

  /** Look at the top without removing it. */
  peek(): T | undefined {
    return this.items[this.items.length - 1];
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  size(): number {
    return this.items.length;
  }

  toArray(): T[] {
    return [...this.items];
  }
}

const stack = new Stack<number>();
for (const value of values) stack.push(value);

console.log('bottom → top:', stack.toArray().join(', '));
console.log('peek()  ->', stack.peek());
console.log('pop()   ->', stack.pop());
console.log('pop()   ->', stack.pop());
console.log('peek()  ->', stack.peek());
console.log('size()  ->', stack.size());
console.log('isEmpty() ->', stack.isEmpty());

// Draining a stack reverses it — the cheapest reverse there is.
const drained: number[] = [];
while (!stack.isEmpty()) drained.push(stack.pop()!);
console.log('drained ->', drained.join(', '));
`,
    python: `# Stack - last in, first out.
#
# Every operation touches only the end of the list, so push, pop and peek are
# all O(1). That single restriction is the whole value: undo history, call
# frames, bracket matching and depth-first search are all stacks in disguise.

values = [3, 7, 1, 9, 4]


class Stack:
    def __init__(self):
        self.items = []

    def push(self, value):
        """Add to the top."""
        self.items.append(value)

    def pop(self):
        """Remove and return the top, or None when empty."""
        return self.items.pop() if self.items else None

    def peek(self):
        """Look at the top without removing it."""
        return self.items[-1] if self.items else None

    def is_empty(self):
        return len(self.items) == 0

    def size(self):
        return len(self.items)

    def to_list(self):
        return list(self.items)


stack = Stack()
for value in values:
    stack.push(value)

print("bottom -> top:", ", ".join(str(v) for v in stack.to_list()))
print("peek()  ->", stack.peek())
print("pop()   ->", stack.pop())
print("pop()   ->", stack.pop())
print("peek()  ->", stack.peek())
print("size()  ->", stack.size())
print("is_empty() ->", stack.is_empty())

# Draining a stack reverses it - the cheapest reverse there is.
drained = []
while not stack.is_empty():
    drained.append(stack.pop())
print("drained ->", ", ".join(str(v) for v in drained))
`,
  },
  bench: {
    typescript: `breakstep.bench({
  input: (n) => breakstep.randomInts(n, 1000, 4),
  run: (arr: number[]) => {
    const s = new Stack<number>();
    for (const v of arr) s.push(v);
    while (!s.isEmpty()) s.pop();
    return s;
  },
});
`,
    python: `def _bench(arr):
    s = Stack()
    for v in arr:
        s.push(v)
    while not s.is_empty():
        s.pop()
    return s


breakstep.bench(input=lambda n: breakstep.random_ints(n, 1000, 4), run=_bench)
`,
  },
  instrumented: {
    typescript: `// Stack — the same structure, drawn explicitly.
//
// \`breakstep.show(..., { as: 'stack' })\` forces the vertical layout; without the
// override BCS reads the class name and reaches the same conclusion.

const values = breakstep.param<number[]>('values', [3, 7, 1, 9, 4]);

class Stack<T> {
  items: T[] = [];

  push(value: T): void {
    this.items.push(value);
    breakstep.show(this.items, {
      as: 'stack',
      label: \`push(\${value})\`,
      highlight: { [this.items.length - 1]: 'active' },
      meta: { size: this.items.length },
    });
  }

  pop(): T | undefined {
    const value = this.items.pop();
    breakstep.show(this.items, {
      as: 'stack',
      label: \`pop() → \${value}\`,
      meta: { size: this.items.length },
    });
    return value;
  }

  peek(): T | undefined {
    return this.items[this.items.length - 1];
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  size(): number {
    return this.items.length;
  }
}

const stack = new Stack<number>();
for (const value of values) stack.push(value);

breakstep.log('peek() ->', stack.peek());
breakstep.log('pop()  ->', stack.pop());
breakstep.log('size() ->', stack.size());

const drained: number[] = [];
while (!stack.isEmpty()) drained.push(stack.pop()!);
breakstep.log('drained ->', drained.join(', '));

breakstep.bench({
  input: (n) => breakstep.randomInts(n, 1000, 4),
  run: (arr: number[]) => {
    const s = new Stack<number>();
    for (const v of arr) s.push(v);
    while (!s.isEmpty()) s.pop();
    return s;
  },
});
`,
    python: `# Stack - the same structure, drawn explicitly.
#
# \`kind="stack"\` forces the vertical layout; without the override BCS reads the
# class name and reaches the same conclusion.

values = breakstep.param('values', [3, 7, 1, 9, 4])


class Stack:
    def __init__(self):
        self.items = []

    def push(self, value):
        self.items.append(value)
        breakstep.show(self.items, kind="stack", label=f"push({value})",
                 highlight={len(self.items) - 1: "active"},
                 meta={"size": len(self.items)})

    def pop(self):
        value = self.items.pop() if self.items else None
        breakstep.show(self.items, kind="stack", label=f"pop() -> {value}",
                 meta={"size": len(self.items)})
        return value

    def peek(self):
        return self.items[-1] if self.items else None

    def is_empty(self):
        return len(self.items) == 0

    def size(self):
        return len(self.items)


stack = Stack()
for value in values:
    stack.push(value)

breakstep.log("peek() ->", stack.peek())
breakstep.log("pop()  ->", stack.pop())
breakstep.log("size() ->", stack.size())

drained = []
while not stack.is_empty():
    drained.append(stack.pop())
breakstep.log("drained ->", ", ".join(str(v) for v in drained))


def _bench(arr):
    s = Stack()
    for v in arr:
        s.push(v)
    while not s.is_empty():
        s.pop()
    return s


breakstep.bench(input=lambda n: breakstep.random_ints(n, 1000, 4), run=_bench)
`,
  },
};

export const queue: Template = {
  id: 'queue',
  title: 'Queue',
  category: 'Data structures',
  blurb: 'First in, first out — with the head index that keeps dequeue O(1).',
  tags: ['queue', 'fifo', 'array'],
  expected: { time: 'O(n)', space: 'O(n)' },
  params: [
    {
      name: 'values',
      label: 'Values to enqueue',
      type: 'stringArray',
      default: ['fetch', 'parse', 'render', 'commit', 'flush'],
    },
  ],
  code: {
    typescript: `// Queue — first in, first out.
//
// The obvious implementation dequeues with \`shift()\`, which re-indexes the
// whole array on every call: O(n) each, O(n²) to drain. Keeping a head index
// instead makes dequeue O(1); the consumed prefix is reclaimed only when it is
// worth the copy. That trade — a little wasted space for a lot of time — is the
// entire lesson.

const values = ['fetch', 'parse', 'render', 'commit', 'flush'];

class Queue<T> {
  private items: T[] = [];
  private head = 0;

  /** Add to the back. */
  enqueue(value: T): void {
    this.items.push(value);
  }

  /** Remove and return the front, or undefined when empty. */
  dequeue(): T | undefined {
    if (this.head >= this.items.length) return undefined;

    const value = this.items[this.head];
    this.head++;

    // Reclaim the dead prefix once it is more than half the array.
    if (this.head > 16 && this.head * 2 >= this.items.length) {
      this.items = this.items.slice(this.head);
      this.head = 0;
    }

    return value;
  }

  /** Look at the front without removing it. */
  front(): T | undefined {
    return this.items[this.head];
  }

  isEmpty(): boolean {
    return this.size() === 0;
  }

  size(): number {
    return this.items.length - this.head;
  }

  toArray(): T[] {
    return this.items.slice(this.head);
  }
}

const queue = new Queue<string>();
for (const value of values) queue.enqueue(value);

console.log('front → back:', queue.toArray().join(', '));
console.log('front()   ->', queue.front());
console.log('dequeue() ->', queue.dequeue());
console.log('dequeue() ->', queue.dequeue());
console.log('front()   ->', queue.front());
console.log('size()    ->', queue.size());

const order: string[] = [];
while (!queue.isEmpty()) order.push(queue.dequeue()!);
console.log('served in order ->', order.join(' → '));
`,
    python: `# Queue - first in, first out.
#
# The obvious implementation dequeues with \`list.pop(0)\`, which re-indexes the
# whole list on every call: O(n) each, O(n^2) to drain. Keeping a head index
# instead makes dequeue O(1); the consumed prefix is reclaimed only when it is
# worth the copy. That trade - a little wasted space for a lot of time - is the
# entire lesson.

values = ['fetch', 'parse', 'render', 'commit', 'flush']


class Queue:
    def __init__(self):
        self.items = []
        self.head = 0

    def enqueue(self, value):
        """Add to the back."""
        self.items.append(value)

    def dequeue(self):
        """Remove and return the front, or None when empty."""
        if self.head >= len(self.items):
            return None

        value = self.items[self.head]
        self.head += 1

        # Reclaim the dead prefix once it is more than half the list.
        if self.head > 16 and self.head * 2 >= len(self.items):
            self.items = self.items[self.head:]
            self.head = 0

        return value

    def front(self):
        """Look at the front without removing it."""
        return self.items[self.head] if self.head < len(self.items) else None

    def is_empty(self):
        return self.size() == 0

    def size(self):
        return len(self.items) - self.head

    def to_list(self):
        return self.items[self.head:]


queue = Queue()
for value in values:
    queue.enqueue(value)

print("front -> back:", ", ".join(queue.to_list()))
print("front()   ->", queue.front())
print("dequeue() ->", queue.dequeue())
print("dequeue() ->", queue.dequeue())
print("front()   ->", queue.front())
print("size()    ->", queue.size())

order = []
while not queue.is_empty():
    order.append(queue.dequeue())
print("served in order ->", " -> ".join(order))
`,
  },
  bench: {
    typescript: `breakstep.bench({
  input: (n) => Array.from({ length: n }, (_, i) => 'task' + i),
  run: (arr: string[]) => {
    const q = new Queue<string>();
    for (const v of arr) q.enqueue(v);
    while (!q.isEmpty()) q.dequeue();
    return q;
  },
});
`,
    python: `def _bench(arr):
    q = Queue()
    for v in arr:
        q.enqueue(v)
    while not q.is_empty():
        q.dequeue()
    return q


breakstep.bench(input=lambda n: ["task" + str(i) for i in range(n)], run=_bench)
`,
  },
  instrumented: {
    typescript: `// Queue — the same structure, drawn explicitly.

const values = breakstep.param<string[]>('values', ['fetch', 'parse', 'render']);

class Queue<T> {
  items: T[] = [];
  head = 0;

  enqueue(value: T): void {
    this.items.push(value);
    breakstep.show(this.items.slice(this.head), {
      as: 'queue',
      label: \`enqueue(\${String(value)})\`,
      meta: { size: this.size() },
    });
  }

  dequeue(): T | undefined {
    if (this.head >= this.items.length) return undefined;
    const value = this.items[this.head];
    this.head++;

    breakstep.show(this.items.slice(this.head), {
      as: 'queue',
      label: \`dequeue() → \${String(value)}\`,
      meta: { size: this.size(), served: value },
    });
    return value;
  }

  front(): T | undefined {
    return this.items[this.head];
  }

  isEmpty(): boolean {
    return this.size() === 0;
  }

  size(): number {
    return this.items.length - this.head;
  }
}

const queue = new Queue<string>();
for (const value of values) queue.enqueue(value);

breakstep.log('front()   ->', queue.front());
breakstep.log('dequeue() ->', queue.dequeue());
breakstep.log('size()    ->', queue.size());

const order: string[] = [];
while (!queue.isEmpty()) order.push(queue.dequeue()!);
breakstep.log('served in order ->', order.join(' → '));

breakstep.bench({
  input: (n) => Array.from({ length: n }, (_, i) => 'task' + i),
  run: (arr: string[]) => {
    const q = new Queue<string>();
    for (const v of arr) q.enqueue(v);
    while (!q.isEmpty()) q.dequeue();
    return q;
  },
});
`,
    python: `# Queue - the same structure, drawn explicitly.

values = breakstep.param('values', ['fetch', 'parse', 'render'])


class Queue:
    def __init__(self):
        self.items = []
        self.head = 0

    def enqueue(self, value):
        self.items.append(value)
        breakstep.show(self.items[self.head:], kind="queue", label=f"enqueue({value})",
                 meta={"size": self.size()})

    def dequeue(self):
        if self.head >= len(self.items):
            return None
        value = self.items[self.head]
        self.head += 1
        breakstep.show(self.items[self.head:], kind="queue", label=f"dequeue() -> {value}",
                 meta={"size": self.size(), "served": value})
        return value

    def front(self):
        return self.items[self.head] if self.head < len(self.items) else None

    def is_empty(self):
        return self.size() == 0

    def size(self):
        return len(self.items) - self.head


queue = Queue()
for value in values:
    queue.enqueue(value)

breakstep.log("front()   ->", queue.front())
breakstep.log("dequeue() ->", queue.dequeue())
breakstep.log("size()    ->", queue.size())

order = []
while not queue.is_empty():
    order.append(queue.dequeue())
breakstep.log("served in order ->", " -> ".join(order))


def _bench(arr):
    q = Queue()
    for v in arr:
        q.enqueue(v)
    while not q.is_empty():
        q.dequeue()
    return q


breakstep.bench(input=lambda n: ["task" + str(i) for i in range(n)], run=_bench)
`,
  },
};

export const linkedList: Template = {
  id: 'linked-list',
  title: 'Linked List',
  category: 'Data structures',
  blurb: 'Nodes joined by references: O(1) insert at a known point, O(n) to find it.',
  tags: ['linked-list', 'pointers', 'nodes'],
  expected: { time: 'O(n)', space: 'O(n)' },
  params: [
    { name: 'values', label: 'Values to append', type: 'numberArray', default: [10, 20, 30, 40] },
    { name: 'target', label: 'Value to find', type: 'number', default: 30, min: 0, max: 200 },
  ],
  code: {
    typescript: `// Singly linked list.
//
// An array stores elements next to each other, so it can jump to index k
// instantly but must shift everything to insert in the middle. A linked list
// makes the opposite trade: inserting is O(1) once you hold the node, but
// *reaching* that node costs a walk. Keeping a tail reference buys back O(1)
// append without changing anything else.

const values = [10, 20, 30, 40];
const target = 30;

class ListNode<T> {
  value: T;
  next: ListNode<T> | null = null;

  constructor(value: T) {
    this.value = value;
  }
}

class LinkedList<T> {
  head: ListNode<T> | null = null;
  tail: ListNode<T> | null = null;
  length = 0;

  /** Append — O(1) thanks to the tail reference. */
  push(value: T): void {
    const node = new ListNode(value);
    if (this.tail === null) this.head = node;
    else this.tail.next = node;
    this.tail = node;
    this.length++;
  }

  /** Prepend — always O(1). */
  unshift(value: T): void {
    const node = new ListNode(value);
    node.next = this.head;
    this.head = node;
    if (this.tail === null) this.tail = node;
    this.length++;
  }

  /** The node at an index, or null. O(n): there is no random access. */
  nodeAt(index: number): ListNode<T> | null {
    if (index < 0 || index >= this.length) return null;
    let node = this.head;
    for (let i = 0; i < index; i++) node = node!.next;
    return node;
  }

  /** Insert after walking to the position — the walk is the expensive part. */
  insertAt(index: number, value: T): boolean {
    if (index === 0) {
      this.unshift(value);
      return true;
    }
    const previous = this.nodeAt(index - 1);
    if (previous === null) return false;

    const node = new ListNode(value);
    node.next = previous.next;
    previous.next = node;
    if (node.next === null) this.tail = node;
    this.length++;
    return true;
  }

  removeAt(index: number): T | undefined {
    if (index < 0 || index >= this.length) return undefined;

    if (index === 0) {
      const removed = this.head!;
      this.head = removed.next;
      if (this.head === null) this.tail = null;
      this.length--;
      return removed.value;
    }

    const previous = this.nodeAt(index - 1)!;
    const removed = previous.next!;
    previous.next = removed.next;
    if (removed === this.tail) this.tail = previous;
    this.length--;
    return removed.value;
  }

  indexOf(value: T): number {
    let index = 0;
    for (let node = this.head; node !== null; node = node.next) {
      if (node.value === value) return index;
      index++;
    }
    return -1;
  }

  toArray(): T[] {
    const out: T[] = [];
    for (let node = this.head; node !== null; node = node.next) out.push(node.value);
    return out;
  }
}

const list = new LinkedList<number>();
for (const value of values) list.push(value);

console.log('contents      ->', list.toArray().join(' → '));
console.log('length        ->', list.length);
console.log('indexOf(' + target + ')  ->', list.indexOf(target));

list.unshift(5);
console.log('after unshift ->', list.toArray().join(' → '));

list.insertAt(3, 25);
console.log('after insert  ->', list.toArray().join(' → '));

console.log('removeAt(0)   ->', list.removeAt(0));
console.log('final         ->', list.toArray().join(' → '));
`,
    python: `# Singly linked list.
#
# A list stores elements next to each other, so it can jump to index k
# instantly but must shift everything to insert in the middle. A linked list
# makes the opposite trade: inserting is O(1) once you hold the node, but
# *reaching* that node costs a walk. Keeping a tail reference buys back O(1)
# append without changing anything else.

values = [10, 20, 30, 40]
target = 30


class ListNode:
    def __init__(self, value):
        self.value = value
        self.next = None


class LinkedList:
    def __init__(self):
        self.head = None
        self.tail = None
        self.length = 0

    def push(self, value):
        """Append - O(1) thanks to the tail reference."""
        node = ListNode(value)
        if self.tail is None:
            self.head = node
        else:
            self.tail.next = node
        self.tail = node
        self.length += 1

    def unshift(self, value):
        """Prepend - always O(1)."""
        node = ListNode(value)
        node.next = self.head
        self.head = node
        if self.tail is None:
            self.tail = node
        self.length += 1

    def node_at(self, index):
        """The node at an index, or None. O(n): there is no random access."""
        if index < 0 or index >= self.length:
            return None
        node = self.head
        for _ in range(index):
            node = node.next
        return node

    def insert_at(self, index, value):
        """Insert after walking to the position - the walk is the cost."""
        if index == 0:
            self.unshift(value)
            return True

        previous = self.node_at(index - 1)
        if previous is None:
            return False

        node = ListNode(value)
        node.next = previous.next
        previous.next = node
        if node.next is None:
            self.tail = node
        self.length += 1
        return True

    def remove_at(self, index):
        if index < 0 or index >= self.length:
            return None

        if index == 0:
            removed = self.head
            self.head = removed.next
            if self.head is None:
                self.tail = None
            self.length -= 1
            return removed.value

        previous = self.node_at(index - 1)
        removed = previous.next
        previous.next = removed.next
        if removed is self.tail:
            self.tail = previous
        self.length -= 1
        return removed.value

    def index_of(self, value):
        index = 0
        node = self.head
        while node is not None:
            if node.value == value:
                return index
            node = node.next
            index += 1
        return -1

    def to_list(self):
        out = []
        node = self.head
        while node is not None:
            out.append(node.value)
            node = node.next
        return out


linked = LinkedList()
for value in values:
    linked.push(value)

print("contents      ->", " -> ".join(str(v) for v in linked.to_list()))
print("length        ->", linked.length)
print("index_of(" + str(target) + ")  ->", linked.index_of(target))

linked.unshift(5)
print("after unshift ->", " -> ".join(str(v) for v in linked.to_list()))

linked.insert_at(3, 25)
print("after insert  ->", " -> ".join(str(v) for v in linked.to_list()))

print("remove_at(0)  ->", linked.remove_at(0))
print("final         ->", " -> ".join(str(v) for v in linked.to_list()))
`,
  },
  bench: {
    typescript: `breakstep.bench({
  input: (n) => Array.from({ length: n }, (_, i) => i),
  run: (arr: number[]) => {
    const l = new LinkedList<number>();
    for (const v of arr) l.push(v);      // O(1) each
    return l.indexOf(-1);                // one full walk
  },
});
`,
    python: `def _bench(arr):
    l = LinkedList()
    for v in arr:
        l.push(v)          # O(1) each
    return l.index_of(-1)  # one full walk


breakstep.bench(input=lambda n: list(range(n)), run=_bench)
`,
  },
  instrumented: {
    typescript: `// Singly linked list — the same structure, drawn explicitly.

const values = breakstep.param<number[]>('values', [10, 20, 30, 40]);
const target = breakstep.param<number>('target', 30);

class ListNode<T> {
  value: T;
  next: ListNode<T> | null = null;
  constructor(value: T) {
    this.value = value;
  }
}

class LinkedList<T> {
  head: ListNode<T> | null = null;
  tail: ListNode<T> | null = null;
  length = 0;

  push(value: T): void {
    const node = new ListNode(value);
    if (this.tail === null) this.head = node;
    else this.tail.next = node;
    this.tail = node;
    this.length++;

    breakstep.show(this.head, { label: \`push(\${String(value)})\`, meta: { length: this.length } });
  }

  unshift(value: T): void {
    const node = new ListNode(value);
    node.next = this.head;
    this.head = node;
    if (this.tail === null) this.tail = node;
    this.length++;

    breakstep.show(this.head, {
      label: \`unshift(\${String(value)})\`,
      highlight: { 0: 'match' },
      meta: { length: this.length },
    });
  }

  indexOf(value: T): number {
    let index = 0;
    for (let node = this.head; node !== null; node = node.next) {
      breakstep.show(this.head, {
        label: \`compare \${String(node.value)}\`,
        highlight: { [index]: node.value === value ? 'match' : 'active' },
        pointers: { i: index },
      });
      if (node.value === value) return index;
      index++;
    }
    return -1;
  }

  toArray(): T[] {
    const out: T[] = [];
    for (let node = this.head; node !== null; node = node.next) out.push(node.value);
    return out;
  }
}

const list = new LinkedList<number>();
for (const value of values) list.push(value);

breakstep.log('contents     ->', list.toArray().join(' → '));
breakstep.log('indexOf(' + target + ') ->', list.indexOf(target));

list.unshift(5);
breakstep.log('after unshift ->', list.toArray().join(' → '));

breakstep.bench({
  input: (n) => Array.from({ length: n }, (_, i) => i),
  run: (arr: number[]) => {
    const l = new LinkedList<number>();
    for (const v of arr) l.push(v);
    return l.indexOf(-1);
  },
});
`,
    python: `# Singly linked list - the same structure, drawn explicitly.

values = breakstep.param('values', [10, 20, 30, 40])
target = breakstep.param('target', 30)


class ListNode:
    def __init__(self, value):
        self.value = value
        self.next = None


class LinkedList:
    def __init__(self):
        self.head = None
        self.tail = None
        self.length = 0

    def push(self, value):
        node = ListNode(value)
        if self.tail is None:
            self.head = node
        else:
            self.tail.next = node
        self.tail = node
        self.length += 1
        breakstep.show(self.head, label=f"push({value})", meta={"length": self.length})

    def unshift(self, value):
        node = ListNode(value)
        node.next = self.head
        self.head = node
        if self.tail is None:
            self.tail = node
        self.length += 1
        breakstep.show(self.head, label=f"unshift({value})", highlight={0: "match"},
                 meta={"length": self.length})

    def index_of(self, value):
        index = 0
        node = self.head
        while node is not None:
            breakstep.show(self.head, label=f"compare {node.value}",
                     highlight={index: "match" if node.value == value else "active"},
                     pointers={"i": index})
            if node.value == value:
                return index
            node = node.next
            index += 1
        return -1

    def to_list(self):
        out = []
        node = self.head
        while node is not None:
            out.append(node.value)
            node = node.next
        return out


linked = LinkedList()
for value in values:
    linked.push(value)

breakstep.log("contents     ->", " -> ".join(str(v) for v in linked.to_list()))
breakstep.log("index_of(" + str(target) + ") ->", linked.index_of(target))

linked.unshift(5)
breakstep.log("after unshift ->", " -> ".join(str(v) for v in linked.to_list()))


def _bench(arr):
    l = LinkedList()
    for v in arr:
        l.push(v)
    return l.index_of(-1)


breakstep.bench(input=lambda n: list(range(n)), run=_bench)
`,
  },
};

export const doublyLinkedList: Template = {
  id: 'doubly-linked-list',
  title: 'Doubly Linked List',
  category: 'Data structures',
  blurb: 'A back-pointer per node buys O(1) removal and backwards traversal.',
  tags: ['linked-list', 'doubly', 'deque'],
  expected: { time: 'O(n)', space: 'O(n)' },
  params: [
    { name: 'values', label: 'Values to append', type: 'numberArray', default: [1, 2, 3, 4, 5] },
  ],
  code: {
    typescript: `// Doubly linked list.
//
// One extra reference per node — \`prev\` — and three things become possible:
// walking backwards, popping from the back in O(1), and removing a node you
// already hold without first finding its predecessor. That last one is why
// LRU caches are always doubly linked: the hash map hands you the node, and
// removal has to be O(1) from there.
//
// The cost is honest: one more pointer per node, and every mutation has two
// links to keep consistent instead of one.

const values = [1, 2, 3, 4, 5];

class DListNode<T> {
  value: T;
  prev: DListNode<T> | null = null;
  next: DListNode<T> | null = null;

  constructor(value: T) {
    this.value = value;
  }
}

class DoublyLinkedList<T> {
  head: DListNode<T> | null = null;
  tail: DListNode<T> | null = null;
  length = 0;

  pushBack(value: T): DListNode<T> {
    const node = new DListNode(value);
    node.prev = this.tail;

    if (this.tail !== null) this.tail.next = node;
    else this.head = node;

    this.tail = node;
    this.length++;
    return node;
  }

  pushFront(value: T): DListNode<T> {
    const node = new DListNode(value);
    node.next = this.head;

    if (this.head !== null) this.head.prev = node;
    else this.tail = node;

    this.head = node;
    this.length++;
    return node;
  }

  popBack(): T | undefined {
    if (this.tail === null) return undefined;
    const node = this.tail;

    this.tail = node.prev;
    if (this.tail !== null) this.tail.next = null;
    else this.head = null;

    this.length--;
    return node.value;
  }

  popFront(): T | undefined {
    if (this.head === null) return undefined;
    const node = this.head;

    this.head = node.next;
    if (this.head !== null) this.head.prev = null;
    else this.tail = null;

    this.length--;
    return node.value;
  }

  /** Unlink a node you already hold — O(1), the whole point of \`prev\`. */
  remove(node: DListNode<T>): T {
    if (node.prev !== null) node.prev.next = node.next;
    else this.head = node.next;

    if (node.next !== null) node.next.prev = node.prev;
    else this.tail = node.prev;

    this.length--;
    return node.value;
  }

  find(value: T): DListNode<T> | null {
    for (let node = this.head; node !== null; node = node.next) {
      if (node.value === value) return node;
    }
    return null;
  }

  toArray(): T[] {
    const out: T[] = [];
    for (let node = this.head; node !== null; node = node.next) out.push(node.value);
    return out;
  }

  toArrayReverse(): T[] {
    const out: T[] = [];
    for (let node = this.tail; node !== null; node = node.prev) out.push(node.value);
    return out;
  }
}

const list = new DoublyLinkedList<number>();
for (const value of values) list.pushBack(value);

console.log('forwards   ->', list.toArray().join(' ⇄ '));
console.log('backwards  ->', list.toArrayReverse().join(' ⇄ '));
console.log('popBack()  ->', list.popBack());
console.log('popFront() ->', list.popFront());

const middle = list.find(3);
if (middle !== null) console.log('remove(3)  ->', list.remove(middle));

list.pushFront(0);
console.log('final      ->', list.toArray().join(' ⇄ '));
console.log('length     ->', list.length);
`,
    python: `# Doubly linked list.
#
# One extra reference per node - \`prev\` - and three things become possible:
# walking backwards, popping from the back in O(1), and removing a node you
# already hold without first finding its predecessor. That last one is why
# LRU caches are always doubly linked: the dict hands you the node, and
# removal has to be O(1) from there.
#
# The cost is honest: one more pointer per node, and every mutation has two
# links to keep consistent instead of one.

values = [1, 2, 3, 4, 5]


class DListNode:
    def __init__(self, value):
        self.value = value
        self.prev = None
        self.next = None


class DoublyLinkedList:
    def __init__(self):
        self.head = None
        self.tail = None
        self.length = 0

    def push_back(self, value):
        node = DListNode(value)
        node.prev = self.tail

        if self.tail is not None:
            self.tail.next = node
        else:
            self.head = node

        self.tail = node
        self.length += 1
        return node

    def push_front(self, value):
        node = DListNode(value)
        node.next = self.head

        if self.head is not None:
            self.head.prev = node
        else:
            self.tail = node

        self.head = node
        self.length += 1
        return node

    def pop_back(self):
        if self.tail is None:
            return None
        node = self.tail

        self.tail = node.prev
        if self.tail is not None:
            self.tail.next = None
        else:
            self.head = None

        self.length -= 1
        return node.value

    def pop_front(self):
        if self.head is None:
            return None
        node = self.head

        self.head = node.next
        if self.head is not None:
            self.head.prev = None
        else:
            self.tail = None

        self.length -= 1
        return node.value

    def remove(self, node):
        """Unlink a node you already hold - O(1), the whole point of prev."""
        if node.prev is not None:
            node.prev.next = node.next
        else:
            self.head = node.next

        if node.next is not None:
            node.next.prev = node.prev
        else:
            self.tail = node.prev

        self.length -= 1
        return node.value

    def find(self, value):
        node = self.head
        while node is not None:
            if node.value == value:
                return node
            node = node.next
        return None

    def to_list(self):
        out = []
        node = self.head
        while node is not None:
            out.append(node.value)
            node = node.next
        return out

    def to_list_reverse(self):
        out = []
        node = self.tail
        while node is not None:
            out.append(node.value)
            node = node.prev
        return out


linked = DoublyLinkedList()
for value in values:
    linked.push_back(value)

print("forwards   ->", " <-> ".join(str(v) for v in linked.to_list()))
print("backwards  ->", " <-> ".join(str(v) for v in linked.to_list_reverse()))
print("pop_back()  ->", linked.pop_back())
print("pop_front() ->", linked.pop_front())

middle = linked.find(3)
if middle is not None:
    print("remove(3)  ->", linked.remove(middle))

linked.push_front(0)
print("final      ->", " <-> ".join(str(v) for v in linked.to_list()))
print("length     ->", linked.length)
`,
  },
  bench: {
    typescript: `breakstep.bench({
  input: (n) => Array.from({ length: n }, (_, i) => i),
  run: (arr: number[]) => {
    const l = new DoublyLinkedList<number>();
    for (const v of arr) l.pushBack(v);   // O(1) each
    while (l.length > 0) l.popFront();    // O(1) each
    return l;
  },
});
`,
    python: `def _bench(arr):
    l = DoublyLinkedList()
    for v in arr:
        l.push_back(v)     # O(1) each
    while l.length > 0:
        l.pop_front()      # O(1) each
    return l


breakstep.bench(input=lambda n: list(range(n)), run=_bench)
`,
  },
  instrumented: {
    typescript: `// Doubly linked list — the same structure, drawn explicitly.
//
// BCS detects \`prev\` on its own and draws ⇄ connectors; nothing here forces it.

const values = breakstep.param<number[]>('values', [1, 2, 3, 4, 5]);

class DListNode<T> {
  value: T;
  prev: DListNode<T> | null = null;
  next: DListNode<T> | null = null;
  constructor(value: T) {
    this.value = value;
  }
}

class DoublyLinkedList<T> {
  head: DListNode<T> | null = null;
  tail: DListNode<T> | null = null;
  length = 0;

  pushBack(value: T): DListNode<T> {
    const node = new DListNode(value);
    node.prev = this.tail;
    if (this.tail !== null) this.tail.next = node;
    else this.head = node;
    this.tail = node;
    this.length++;

    breakstep.show(this.head, {
      label: \`pushBack(\${String(value)})\`,
      highlight: { [this.length - 1]: 'active' },
      meta: { length: this.length },
    });
    return node;
  }

  popFront(): T | undefined {
    if (this.head === null) return undefined;
    const node = this.head;
    this.head = node.next;
    if (this.head !== null) this.head.prev = null;
    else this.tail = null;
    this.length--;

    breakstep.show(this.head, {
      label: \`popFront() → \${String(node.value)}\`,
      meta: { length: this.length },
    });
    return node.value;
  }

  remove(node: DListNode<T>): T {
    if (node.prev !== null) node.prev.next = node.next;
    else this.head = node.next;
    if (node.next !== null) node.next.prev = node.prev;
    else this.tail = node.prev;
    this.length--;

    breakstep.show(this.head, {
      label: \`remove(\${String(node.value)}) — O(1), no search\`,
      meta: { length: this.length },
    });
    return node.value;
  }

  find(value: T): DListNode<T> | null {
    let index = 0;
    for (let node = this.head; node !== null; node = node.next) {
      breakstep.show(this.head, {
        label: \`find: at \${String(node.value)}\`,
        highlight: { [index]: 'compare' },
        pointers: { i: index },
      });
      if (node.value === value) return node;
      index++;
    }
    return null;
  }

  toArray(): T[] {
    const out: T[] = [];
    for (let node = this.head; node !== null; node = node.next) out.push(node.value);
    return out;
  }
}

const list = new DoublyLinkedList<number>();
for (const value of values) list.pushBack(value);

breakstep.log('forwards   ->', list.toArray().join(' ⇄ '));
breakstep.log('popFront() ->', list.popFront());

const middle = list.find(3);
if (middle !== null) breakstep.log('remove(3)  ->', list.remove(middle));

breakstep.bench({
  input: (n) => Array.from({ length: n }, (_, i) => i),
  run: (arr: number[]) => {
    const l = new DoublyLinkedList<number>();
    for (const v of arr) l.pushBack(v);
    while (l.length > 0) l.popFront();
    return l;
  },
});
`,
    python: `# Doubly linked list - the same structure, drawn explicitly.
#
# BCS detects \`prev\` on its own and draws <-> connectors; nothing here forces it.

values = breakstep.param('values', [1, 2, 3, 4, 5])


class DListNode:
    def __init__(self, value):
        self.value = value
        self.prev = None
        self.next = None


class DoublyLinkedList:
    def __init__(self):
        self.head = None
        self.tail = None
        self.length = 0

    def push_back(self, value):
        node = DListNode(value)
        node.prev = self.tail
        if self.tail is not None:
            self.tail.next = node
        else:
            self.head = node
        self.tail = node
        self.length += 1

        breakstep.show(self.head, label=f"push_back({value})",
                 highlight={self.length - 1: "active"}, meta={"length": self.length})
        return node

    def pop_front(self):
        if self.head is None:
            return None
        node = self.head
        self.head = node.next
        if self.head is not None:
            self.head.prev = None
        else:
            self.tail = None
        self.length -= 1

        breakstep.show(self.head, label=f"pop_front() -> {node.value}",
                 meta={"length": self.length})
        return node.value

    def remove(self, node):
        if node.prev is not None:
            node.prev.next = node.next
        else:
            self.head = node.next
        if node.next is not None:
            node.next.prev = node.prev
        else:
            self.tail = node.prev
        self.length -= 1

        breakstep.show(self.head, label=f"remove({node.value}) - O(1), no search",
                 meta={"length": self.length})
        return node.value

    def find(self, value):
        index = 0
        node = self.head
        while node is not None:
            breakstep.show(self.head, label=f"find: at {node.value}",
                     highlight={index: "compare"}, pointers={"i": index})
            if node.value == value:
                return node
            node = node.next
            index += 1
        return None

    def to_list(self):
        out = []
        node = self.head
        while node is not None:
            out.append(node.value)
            node = node.next
        return out


linked = DoublyLinkedList()
for value in values:
    linked.push_back(value)

breakstep.log("forwards   ->", " <-> ".join(str(v) for v in linked.to_list()))
breakstep.log("pop_front() ->", linked.pop_front())

middle = linked.find(3)
if middle is not None:
    breakstep.log("remove(3)  ->", linked.remove(middle))


def _bench(arr):
    l = DoublyLinkedList()
    for v in arr:
        l.push_back(v)
    while l.length > 0:
        l.pop_front()
    return l


breakstep.bench(input=lambda n: list(range(n)), run=_bench)
`,
  },
};
