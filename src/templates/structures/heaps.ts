import type { Template } from '@/types';

export const minHeap: Template = {
  id: 'min-heap',
  title: 'Min Heap',
  category: 'Data structures',
  blurb: 'An array that behaves like a tree: the smallest element is always at index 0.',
  tags: ['heap', 'min-heap', 'array', 'tree'],
  expected: { time: 'O(n log n)', space: 'O(n)' },
  params: [
    { name: 'values', label: 'Values to push', type: 'numberArray', default: [42, 17, 88, 5, 63, 29, 71, 12] },
  ],
  code: {
    typescript: `// Binary min-heap, stored in a flat array.
//
// There are no pointers here. The tree is implied by arithmetic:
//
//   parent(i) = (i - 1) >> 1     left(i) = 2i + 1     right(i) = 2i + 2
//
// The only invariant is that every parent is ≤ both children. That is much
// weaker than being sorted — which is exactly why it is cheap to maintain.
// Push appends and sifts *up*; pop moves the last element to the root and sifts
// *down*. Both walk one root-to-leaf path, so both are O(log n).

const values = [42, 17, 88, 5, 63, 29, 71, 12];

class MinHeap {
  items: number[] = [];

  push(value: number): void {
    this.items.push(value);
    this.siftUp(this.items.length - 1);
  }

  /** Remove and return the smallest element. */
  pop(): number | undefined {
    if (this.items.length === 0) return undefined;

    const smallest = this.items[0];
    const last = this.items.pop()!;

    if (this.items.length > 0) {
      this.items[0] = last;
      this.siftDown(0);
    }

    return smallest;
  }

  /** The smallest element, without removing it — O(1). */
  peek(): number | undefined {
    return this.items[0];
  }

  size(): number {
    return this.items.length;
  }

  private siftUp(start: number): void {
    let i = start;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent] <= this.items[i]) break;
      this.swap(parent, i);
      i = parent;
    }
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

      this.swap(i, smallest);
      i = smallest;
    }
  }

  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
  }
}

const heap = new MinHeap();
for (const value of values) heap.push(value);

console.log('backing array ->', heap.items.join(', '));
console.log('peek()        ->', heap.peek());
console.log('size()        ->', heap.size());

const sorted: number[] = [];
while (heap.size() > 0) sorted.push(heap.pop()!);

console.log('popped in order ->', sorted.join(', '));
console.log('note: the array was never sorted — only the root was ever guaranteed.');
`,
    python: `# Binary min-heap, stored in a flat list.
#
# There are no pointers here. The tree is implied by arithmetic:
#
#   parent(i) = (i - 1) // 2     left(i) = 2i + 1     right(i) = 2i + 2
#
# The only invariant is that every parent is <= both children. That is much
# weaker than being sorted - which is exactly why it is cheap to maintain.
# Push appends and sifts *up*; pop moves the last element to the root and sifts
# *down*. Both walk one root-to-leaf path, so both are O(log n).

values = [42, 17, 88, 5, 63, 29, 71, 12]


class MinHeap:
    def __init__(self):
        self.items = []

    def push(self, value):
        self.items.append(value)
        self._sift_up(len(self.items) - 1)

    def pop(self):
        """Remove and return the smallest element."""
        if not self.items:
            return None

        smallest = self.items[0]
        last = self.items.pop()

        if self.items:
            self.items[0] = last
            self._sift_down(0)

        return smallest

    def peek(self):
        """The smallest element, without removing it - O(1)."""
        return self.items[0] if self.items else None

    def size(self):
        return len(self.items)

    def _sift_up(self, start):
        i = start
        while i > 0:
            parent = (i - 1) // 2
            if self.items[parent] <= self.items[i]:
                break
            self._swap(parent, i)
            i = parent

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

            self._swap(i, smallest)
            i = smallest

    def _swap(self, a, b):
        self.items[a], self.items[b] = self.items[b], self.items[a]


heap = MinHeap()
for value in values:
    heap.push(value)

print("backing list ->", ", ".join(str(v) for v in heap.items))
print("peek()       ->", heap.peek())
print("size()       ->", heap.size())

ordered = []
while heap.size() > 0:
    ordered.append(heap.pop())

print("popped in order ->", ", ".join(str(v) for v in ordered))
print("note: the list was never sorted - only the root was ever guaranteed.")
`,
  },
  bench: {
    typescript: `breakstep.bench({
  input: (n) => breakstep.randomInts(n, 100000, 5),
  run: (arr: number[]) => {
    const h = new MinHeap();
    for (const v of arr) h.push(v);   // n × O(log n)
    while (h.size() > 0) h.pop();     // n × O(log n)
    return h;
  },
  sizes: [32, 64, 128, 256, 512, 1024, 2048],
});
`,
    python: `def _bench(arr):
    h = MinHeap()
    for v in arr:
        h.push(v)      # n x O(log n)
    while h.size() > 0:
        h.pop()        # n x O(log n)
    return h


breakstep.bench(input=lambda n: breakstep.random_ints(n, 100000, 5), run=_bench,
          sizes=[32, 64, 128, 256, 512, 1024])
`,
  },
  instrumented: {
    typescript: `// Min heap — the same structure, drawn explicitly.
//
// Breakstep reads the class name to pick the min ordering; \`heapType\` here is
// belt and braces.

const values = breakstep.param<number[]>('values', [42, 17, 88, 5, 63]);

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
      label: \`push(\${value}) — settled at index \${i}\`,
      highlight: { [i]: 'active' },
      meta: { size: this.items.length, min: this.items[0] },
    });
  }

  pop(): number | undefined {
    if (this.items.length === 0) return undefined;
    const smallest = this.items[0];
    const last = this.items.pop()!;

    if (this.items.length > 0) {
      this.items[0] = last;
      this.siftDown(0);
    }

    breakstep.show(this.items, {
      as: 'heap',
      heapType: 'min',
      label: \`pop() → \${smallest}\`,
      meta: { size: this.items.length, newMin: this.items[0] },
    });
    return smallest;
  }

  peek(): number | undefined {
    return this.items[0];
  }

  size(): number {
    return this.items.length;
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
for (const value of values) heap.push(value);

const sorted: number[] = [];
while (heap.size() > 0) sorted.push(heap.pop()!);
breakstep.log('popped in order ->', sorted.join(', '));

breakstep.bench({
  input: (n) => breakstep.randomInts(n, 100000, 5),
  run: (arr: number[]) => {
    const h = new MinHeap();
    for (const v of arr) h.push(v);
    while (h.size() > 0) h.pop();
    return h;
  },
  sizes: [32, 64, 128, 256, 512, 1024, 2048],
});
`,
    python: `# Min heap - the same structure, drawn explicitly.

values = breakstep.param('values', [42, 17, 88, 5, 63])


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

        breakstep.show(self.items, kind="heap", heapType="min",
                 label=f"push({value}) - settled at index {i}",
                 highlight={i: "active"},
                 meta={"size": len(self.items), "min": self.items[0]})

    def pop(self):
        if not self.items:
            return None
        smallest = self.items[0]
        last = self.items.pop()

        if self.items:
            self.items[0] = last
            self.sift_down(0)

        breakstep.show(self.items, kind="heap", heapType="min", label=f"pop() -> {smallest}",
                 meta={"size": len(self.items)})
        return smallest

    def peek(self):
        return self.items[0] if self.items else None

    def size(self):
        return len(self.items)

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
for value in values:
    heap.push(value)

ordered = []
while heap.size() > 0:
    ordered.append(heap.pop())
breakstep.log("popped in order ->", ", ".join(str(v) for v in ordered))


def _bench(arr):
    h = MinHeap()
    for v in arr:
        h.push(v)
    while h.size() > 0:
        h.pop()
    return h


breakstep.bench(input=lambda n: breakstep.random_ints(n, 100000, 5), run=_bench,
          sizes=[32, 64, 128, 256, 512, 1024])
`,
  },
};

export const maxHeap: Template = {
  id: 'max-heap',
  title: 'Max Heap',
  category: 'Data structures',
  blurb: 'The same structure with the comparison flipped — largest at the root.',
  tags: ['heap', 'max-heap', 'array', 'tree'],
  expected: { time: 'O(n log n)', space: 'O(n)' },
  params: [
    { name: 'values', label: 'Values to push', type: 'numberArray', default: [42, 17, 88, 5, 63, 29, 71, 12] },
    { name: 'k', label: 'Report the k largest', type: 'number', default: 3, min: 1, max: 20 },
  ],
  code: {
    typescript: `// Binary max-heap.
//
// Structurally identical to a min-heap; only the comparison flips. Every
// \`<=\` becomes \`>=\` and every "smallest" becomes "largest", and now the root
// holds the maximum. That symmetry is worth noticing: one heap implementation
// with a comparator parameter would cover both, which is exactly what a
// production priority queue does.
//
// Top-k is the classic use. Push everything, pop k times — and note that you
// never had to sort the other n − k elements.

const values = [42, 17, 88, 5, 63, 29, 71, 12];
const k = 3;

class MaxHeap {
  items: number[] = [];

  push(value: number): void {
    this.items.push(value);
    let i = this.items.length - 1;

    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent] >= this.items[i]) break;
      this.swap(parent, i);
      i = parent;
    }
  }

  /** Remove and return the largest element. */
  pop(): number | undefined {
    if (this.items.length === 0) return undefined;

    const largest = this.items[0];
    const last = this.items.pop()!;

    if (this.items.length > 0) {
      this.items[0] = last;
      this.siftDown(0);
    }

    return largest;
  }

  peek(): number | undefined {
    return this.items[0];
  }

  size(): number {
    return this.items.length;
  }

  private siftDown(start: number): void {
    let i = start;
    const n = this.items.length;

    for (;;) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let largest = i;

      if (left < n && this.items[left] > this.items[largest]) largest = left;
      if (right < n && this.items[right] > this.items[largest]) largest = right;
      if (largest === i) break;

      this.swap(i, largest);
      i = largest;
    }
  }

  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
  }
}

const heap = new MaxHeap();
for (const value of values) heap.push(value);

console.log('backing array ->', heap.items.join(', '));
console.log('peek()        ->', heap.peek());

const top: number[] = [];
for (let i = 0; i < Math.min(k, values.length); i++) top.push(heap.pop()!);

console.log(k + ' largest ->', top.join(', '));
console.log('still in the heap ->', heap.size(), 'elements, never sorted');
`,
    python: `# Binary max-heap.
#
# Structurally identical to a min-heap; only the comparison flips. Every
# \`<=\` becomes \`>=\` and every "smallest" becomes "largest", and now the root
# holds the maximum. That symmetry is worth noticing: one heap implementation
# with a comparator parameter would cover both, which is exactly what a
# production priority queue does.
#
# Top-k is the classic use. Push everything, pop k times - and note that you
# never had to sort the other n - k elements.

values = [42, 17, 88, 5, 63, 29, 71, 12]
k = 3


class MaxHeap:
    def __init__(self):
        self.items = []

    def push(self, value):
        self.items.append(value)
        i = len(self.items) - 1

        while i > 0:
            parent = (i - 1) // 2
            if self.items[parent] >= self.items[i]:
                break
            self._swap(parent, i)
            i = parent

    def pop(self):
        """Remove and return the largest element."""
        if not self.items:
            return None

        largest = self.items[0]
        last = self.items.pop()

        if self.items:
            self.items[0] = last
            self._sift_down(0)

        return largest

    def peek(self):
        return self.items[0] if self.items else None

    def size(self):
        return len(self.items)

    def _sift_down(self, start):
        i = start
        n = len(self.items)

        while True:
            left, right = 2 * i + 1, 2 * i + 2
            largest = i

            if left < n and self.items[left] > self.items[largest]:
                largest = left
            if right < n and self.items[right] > self.items[largest]:
                largest = right
            if largest == i:
                break

            self._swap(i, largest)
            i = largest

    def _swap(self, a, b):
        self.items[a], self.items[b] = self.items[b], self.items[a]


heap = MaxHeap()
for value in values:
    heap.push(value)

print("backing list ->", ", ".join(str(v) for v in heap.items))
print("peek()       ->", heap.peek())

top = [heap.pop() for _ in range(min(k, len(values)))]

print(str(k) + " largest ->", ", ".join(str(v) for v in top))
print("still in the heap ->", heap.size(), "elements, never sorted")
`,
  },
  bench: {
    typescript: `breakstep.bench({
  input: (n) => breakstep.randomInts(n, 100000, 6),
  run: (arr: number[]) => {
    const h = new MaxHeap();
    for (const v of arr) h.push(v);
    while (h.size() > 0) h.pop();
    return h;
  },
  sizes: [32, 64, 128, 256, 512, 1024, 2048],
});
`,
    python: `def _bench(arr):
    h = MaxHeap()
    for v in arr:
        h.push(v)
    while h.size() > 0:
        h.pop()
    return h


breakstep.bench(input=lambda n: breakstep.random_ints(n, 100000, 6), run=_bench,
          sizes=[32, 64, 128, 256, 512, 1024])
`,
  },
  instrumented: {
    typescript: `// Max heap — the same structure, drawn explicitly.

const values = breakstep.param<number[]>('values', [42, 17, 88, 5, 63]);
const k = breakstep.param<number>('k', 3);

class MaxHeap {
  items: number[] = [];

  push(value: number): void {
    this.items.push(value);
    let i = this.items.length - 1;

    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent] >= this.items[i]) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }

    breakstep.show(this.items, {
      as: 'heap',
      heapType: 'max',
      label: \`push(\${value}) — settled at index \${i}\`,
      highlight: { [i]: 'active' },
      meta: { size: this.items.length, max: this.items[0] },
    });
  }

  pop(): number | undefined {
    if (this.items.length === 0) return undefined;
    const largest = this.items[0];
    const last = this.items.pop()!;

    if (this.items.length > 0) {
      this.items[0] = last;
      this.siftDown(0);
    }

    breakstep.show(this.items, {
      as: 'heap',
      heapType: 'max',
      label: \`pop() → \${largest}\`,
      meta: { size: this.items.length },
    });
    return largest;
  }

  size(): number {
    return this.items.length;
  }

  siftDown(start: number): void {
    let i = start;
    const n = this.items.length;

    for (;;) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let largest = i;

      if (left < n && this.items[left] > this.items[largest]) largest = left;
      if (right < n && this.items[right] > this.items[largest]) largest = right;
      if (largest === i) break;

      [this.items[i], this.items[largest]] = [this.items[largest], this.items[i]];
      i = largest;
    }
  }
}

const heap = new MaxHeap();
for (const value of values) heap.push(value);

const top: number[] = [];
for (let i = 0; i < Math.min(k, values.length); i++) top.push(heap.pop()!);
breakstep.log(k + ' largest ->', top.join(', '));

breakstep.bench({
  input: (n) => breakstep.randomInts(n, 100000, 6),
  run: (arr: number[]) => {
    const h = new MaxHeap();
    for (const v of arr) h.push(v);
    while (h.size() > 0) h.pop();
    return h;
  },
  sizes: [32, 64, 128, 256, 512, 1024, 2048],
});
`,
    python: `# Max heap - the same structure, drawn explicitly.

values = breakstep.param('values', [42, 17, 88, 5, 63])
k = breakstep.param('k', 3)


class MaxHeap:
    def __init__(self):
        self.items = []

    def push(self, value):
        self.items.append(value)
        i = len(self.items) - 1

        while i > 0:
            parent = (i - 1) // 2
            if self.items[parent] >= self.items[i]:
                break
            self.items[parent], self.items[i] = self.items[i], self.items[parent]
            i = parent

        breakstep.show(self.items, kind="heap", heapType="max",
                 label=f"push({value}) - settled at index {i}",
                 highlight={i: "active"},
                 meta={"size": len(self.items), "max": self.items[0]})

    def pop(self):
        if not self.items:
            return None
        largest = self.items[0]
        last = self.items.pop()

        if self.items:
            self.items[0] = last
            self.sift_down(0)

        breakstep.show(self.items, kind="heap", heapType="max", label=f"pop() -> {largest}",
                 meta={"size": len(self.items)})
        return largest

    def size(self):
        return len(self.items)

    def sift_down(self, start):
        i = start
        n = len(self.items)

        while True:
            left, right = 2 * i + 1, 2 * i + 2
            largest = i

            if left < n and self.items[left] > self.items[largest]:
                largest = left
            if right < n and self.items[right] > self.items[largest]:
                largest = right
            if largest == i:
                break

            self.items[i], self.items[largest] = self.items[largest], self.items[i]
            i = largest


heap = MaxHeap()
for value in values:
    heap.push(value)

top = [heap.pop() for _ in range(min(k, len(values)))]
breakstep.log(str(k) + " largest ->", ", ".join(str(v) for v in top))


def _bench(arr):
    h = MaxHeap()
    for v in arr:
        h.push(v)
    while h.size() > 0:
        h.pop()
    return h


breakstep.bench(input=lambda n: breakstep.random_ints(n, 100000, 6), run=_bench,
          sizes=[32, 64, 128, 256, 512, 1024])
`,
  },
};

export const priorityQueue: Template = {
  id: 'priority-queue',
  title: 'Priority Queue',
  category: 'Data structures',
  blurb: 'A heap keyed by priority — with the tie-break that makes it stable.',
  tags: ['heap', 'priority-queue', 'scheduling'],
  expected: { time: 'O(n log n)', space: 'O(n)' },
  params: [
    {
      name: 'tasks',
      label: 'Tasks (name:priority)',
      type: 'stringArray',
      default: ['deploy:3', 'lint:5', 'hotfix:1', 'test:2', 'docs:9', 'build:2'],
    },
  ],
  code: {
    typescript: `// Priority queue, built on a binary min-heap.
//
// A plain queue serves in arrival order. A priority queue serves the most
// urgent item first — which is the same heap as before, comparing a priority
// field instead of the value.
//
// The subtlety worth knowing: a heap is *not* stable. Two items with equal
// priority can come out in either order, because sifting swaps them freely.
// The fix is a monotonically increasing insertion counter as a tie-break, and
// that is what makes this a queue rather than just a heap.

const tasks = ['deploy:3', 'lint:5', 'hotfix:1', 'test:2', 'docs:9', 'build:2'];

interface Entry<T> {
  value: T;
  priority: number;
  /** Insertion order, so equal priorities keep FIFO behaviour. */
  seq: number;
}

class PriorityQueue<T> {
  items: Entry<T>[] = [];
  private counter = 0;

  /** Lower priority number = served sooner. */
  enqueue(value: T, priority: number): void {
    this.items.push({ value, priority, seq: this.counter++ });
    this.siftUp(this.items.length - 1);
  }

  dequeue(): T | undefined {
    if (this.items.length === 0) return undefined;

    const top = this.items[0];
    const last = this.items.pop()!;

    if (this.items.length > 0) {
      this.items[0] = last;
      this.siftDown(0);
    }

    return top.value;
  }

  peek(): T | undefined {
    return this.items[0]?.value;
  }

  size(): number {
    return this.items.length;
  }

  /** Priority first, then insertion order — that second term buys stability. */
  private before(a: Entry<T>, b: Entry<T>): boolean {
    if (a.priority !== b.priority) return a.priority < b.priority;
    return a.seq < b.seq;
  }

  private siftUp(start: number): void {
    let i = start;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.before(this.items[i], this.items[parent])) break;
      this.swap(parent, i);
      i = parent;
    }
  }

  private siftDown(start: number): void {
    let i = start;
    const n = this.items.length;

    for (;;) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let best = i;

      if (left < n && this.before(this.items[left], this.items[best])) best = left;
      if (right < n && this.before(this.items[right], this.items[best])) best = right;
      if (best === i) break;

      this.swap(i, best);
      i = best;
    }
  }

  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
  }
}

const queue = new PriorityQueue<string>();

for (const task of tasks) {
  const [name, priority] = task.split(':');
  queue.enqueue(name, Number(priority));
}

console.log('size()  ->', queue.size());
console.log('peek()  ->', queue.peek(), '(most urgent)');

const served: string[] = [];
while (queue.size() > 0) served.push(queue.dequeue()!);

console.log('served  ->', served.join(' → '));
console.log('note: test and build both had priority 2 and kept their arrival order.');
`,
    python: `# Priority queue, built on a binary min-heap.
#
# A plain queue serves in arrival order. A priority queue serves the most
# urgent item first - which is the same heap as before, comparing a priority
# field instead of the value.
#
# The subtlety worth knowing: a heap is *not* stable. Two items with equal
# priority can come out in either order, because sifting swaps them freely.
# The fix is a monotonically increasing insertion counter as a tie-break, and
# that is what makes this a queue rather than just a heap.

tasks = ['deploy:3', 'lint:5', 'hotfix:1', 'test:2', 'docs:9', 'build:2']


class PriorityQueue:
    def __init__(self):
        self.items = []
        self.counter = 0

    def enqueue(self, value, priority):
        """Lower priority number = served sooner."""
        self.items.append({"value": value, "priority": priority, "seq": self.counter})
        self.counter += 1
        self._sift_up(len(self.items) - 1)

    def dequeue(self):
        if not self.items:
            return None

        top = self.items[0]
        last = self.items.pop()

        if self.items:
            self.items[0] = last
            self._sift_down(0)

        return top["value"]

    def peek(self):
        return self.items[0]["value"] if self.items else None

    def size(self):
        return len(self.items)

    def _before(self, a, b):
        """Priority first, then insertion order - that second term is stability."""
        if a["priority"] != b["priority"]:
            return a["priority"] < b["priority"]
        return a["seq"] < b["seq"]

    def _sift_up(self, start):
        i = start
        while i > 0:
            parent = (i - 1) // 2
            if not self._before(self.items[i], self.items[parent]):
                break
            self._swap(parent, i)
            i = parent

    def _sift_down(self, start):
        i = start
        n = len(self.items)

        while True:
            left, right = 2 * i + 1, 2 * i + 2
            best = i

            if left < n and self._before(self.items[left], self.items[best]):
                best = left
            if right < n and self._before(self.items[right], self.items[best]):
                best = right
            if best == i:
                break

            self._swap(i, best)
            i = best

    def _swap(self, a, b):
        self.items[a], self.items[b] = self.items[b], self.items[a]


queue = PriorityQueue()

for task in tasks:
    name, priority = task.split(":")
    queue.enqueue(name, int(priority))

print("size()  ->", queue.size())
print("peek()  ->", queue.peek(), "(most urgent)")

served = []
while queue.size() > 0:
    served.append(queue.dequeue())

print("served  ->", " -> ".join(served))
print("note: test and build both had priority 2 and kept their arrival order.")
`,
  },
  bench: {
    typescript: `breakstep.bench({
  input: (n) => breakstep.randomInts(n, 1000, 7),
  run: (arr: number[]) => {
    const q = new PriorityQueue<number>();
    for (const v of arr) q.enqueue(v, v);
    while (q.size() > 0) q.dequeue();
    return q;
  },
  sizes: [32, 64, 128, 256, 512, 1024, 2048],
});
`,
    python: `def _bench(arr):
    q = PriorityQueue()
    for v in arr:
        q.enqueue(v, v)
    while q.size() > 0:
        q.dequeue()
    return q


breakstep.bench(input=lambda n: breakstep.random_ints(n, 1000, 7), run=_bench,
          sizes=[32, 64, 128, 256, 512, 1024])
`,
  },
  instrumented: {
    typescript: `// Priority queue — the same structure, drawn explicitly.
//
// The heap cells show each entry's \`value\`; the meta badges carry the priority.

const tasks = breakstep.param<string[]>('tasks', ['deploy:3', 'lint:5', 'hotfix:1']);

interface Entry {
  value: string;
  priority: number;
  seq: number;
}

class PriorityQueue {
  items: Entry[] = [];
  counter = 0;

  enqueue(value: string, priority: number): void {
    this.items.push({ value, priority, seq: this.counter++ });
    let i = this.items.length - 1;

    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.before(this.items[i], this.items[parent])) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }

    breakstep.show(this.items, {
      as: 'heap',
      heapType: 'min',
      label: \`enqueue(\${value}, p=\${priority})\`,
      highlight: { [i]: 'active' },
      meta: { size: this.items.length, next: this.items[0].value },
    });
  }

  dequeue(): string | undefined {
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
      label: \`dequeue() → \${top.value} (p=\${top.priority})\`,
      meta: { size: this.items.length },
    });
    return top.value;
  }

  size(): number {
    return this.items.length;
  }

  before(a: Entry, b: Entry): boolean {
    if (a.priority !== b.priority) return a.priority < b.priority;
    return a.seq < b.seq;
  }

  siftDown(start: number): void {
    let i = start;
    const n = this.items.length;

    for (;;) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let best = i;

      if (left < n && this.before(this.items[left], this.items[best])) best = left;
      if (right < n && this.before(this.items[right], this.items[best])) best = right;
      if (best === i) break;

      [this.items[i], this.items[best]] = [this.items[best], this.items[i]];
      i = best;
    }
  }
}

const queue = new PriorityQueue();

for (const task of tasks) {
  const [name, priority] = task.split(':');
  queue.enqueue(name, Number(priority));
}

const served: string[] = [];
while (queue.size() > 0) served.push(queue.dequeue()!);
breakstep.log('served ->', served.join(' → '));

breakstep.bench({
  input: (n) => breakstep.randomInts(n, 1000, 7),
  run: (arr: number[]) => {
    const q = new PriorityQueue();
    for (const v of arr) q.enqueue(String(v), v);
    while (q.size() > 0) q.dequeue();
    return q;
  },
  sizes: [32, 64, 128, 256, 512, 1024, 2048],
});
`,
    python: `# Priority queue - the same structure, drawn explicitly.

tasks = breakstep.param('tasks', ['deploy:3', 'lint:5', 'hotfix:1'])


class PriorityQueue:
    def __init__(self):
        self.items = []
        self.counter = 0

    def enqueue(self, value, priority):
        self.items.append({"value": value, "priority": priority, "seq": self.counter})
        self.counter += 1
        i = len(self.items) - 1

        while i > 0:
            parent = (i - 1) // 2
            if not self.before(self.items[i], self.items[parent]):
                break
            self.items[parent], self.items[i] = self.items[i], self.items[parent]
            i = parent

        breakstep.show(self.items, kind="heap", heapType="min",
                 label=f"enqueue({value}, p={priority})",
                 highlight={i: "active"},
                 meta={"size": len(self.items), "next": self.items[0]["value"]})

    def dequeue(self):
        if not self.items:
            return None
        top = self.items[0]
        last = self.items.pop()

        if self.items:
            self.items[0] = last
            self.sift_down(0)

        breakstep.show(self.items, kind="heap", heapType="min",
                 label=f"dequeue() -> {top['value']} (p={top['priority']})",
                 meta={"size": len(self.items)})
        return top["value"]

    def size(self):
        return len(self.items)

    def before(self, a, b):
        if a["priority"] != b["priority"]:
            return a["priority"] < b["priority"]
        return a["seq"] < b["seq"]

    def sift_down(self, start):
        i = start
        n = len(self.items)

        while True:
            left, right = 2 * i + 1, 2 * i + 2
            best = i

            if left < n and self.before(self.items[left], self.items[best]):
                best = left
            if right < n and self.before(self.items[right], self.items[best]):
                best = right
            if best == i:
                break

            self.items[i], self.items[best] = self.items[best], self.items[i]
            i = best


queue = PriorityQueue()

for task in tasks:
    name, priority = task.split(":")
    queue.enqueue(name, int(priority))

served = []
while queue.size() > 0:
    served.append(queue.dequeue())
breakstep.log("served ->", " -> ".join(served))


def _bench(arr):
    q = PriorityQueue()
    for v in arr:
        q.enqueue(str(v), v)
    while q.size() > 0:
        q.dequeue()
    return q


breakstep.bench(input=lambda n: breakstep.random_ints(n, 1000, 7), run=_bench,
          sizes=[32, 64, 128, 256, 512, 1024])
`,
  },
};
