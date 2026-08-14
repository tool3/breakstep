import type { Template } from '@/types';

export const hashMap: Template = {
  id: 'hashmap',
  title: 'Hash Map',
  category: 'Data structures',
  blurb: 'Buckets, collisions and resizing — the machinery behind "O(1) on average".',
  tags: ['hashmap', 'hashing', 'buckets', 'collisions'],
  expected: { time: 'O(n)', space: 'O(n)' },
  params: [
    {
      name: 'keys',
      label: 'Keys to insert',
      type: 'stringArray',
      default: ['red', 'green', 'blue', 'cyan', 'magenta', 'yellow', 'black', 'white'],
    },
    {
      name: 'capacity',
      binds: 'initialCapacity',
      label: 'Initial bucket count',
      type: 'number',
      default: 8,
      min: 2,
      max: 64,
      help: 'Shrink it to force collisions; grow it to spread the keys out.',
    },
  ],
  code: {
    typescript: `// Hash map with separate chaining.
//
// The promise is O(1) average lookup, and the word "average" is doing real
// work. A key is hashed to a bucket index; if two keys land in the same bucket
// they form a chain, and a lookup has to walk it. With a good hash and a load
// factor kept under ~0.75, chains stay about one element long — so the average
// holds even though the worst case is O(n).
//
// Shrink the bucket count in the Parameters panel to force collisions, and
// watch the chains grow in the visualization.

const keys = ['red', 'green', 'blue', 'cyan', 'magenta', 'yellow', 'black', 'white'];
const initialCapacity = 8;

type Entry<V> = [string, V];

class HashMap<V> {
  buckets: Entry<V>[][];
  size = 0;

  constructor(capacity: number) {
    this.buckets = Array.from({ length: Math.max(2, capacity) }, () => []);
  }

  /** djb2 — cheap, well spread, and deterministic across runs. */
  private hash(key: string): number {
    let h = 5381;
    for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
    return h % this.buckets.length;
  }

  set(key: string, value: V): void {
    const chain = this.buckets[this.hash(key)];

    for (const entry of chain) {
      if (entry[0] === key) {
        entry[1] = value; // overwrite in place
        return;
      }
    }

    chain.push([key, value]);
    this.size++;

    // Load factor above 0.75: double the buckets and rehash everything.
    if (this.size > this.buckets.length * 0.75) this.resize();
  }

  get(key: string): V | undefined {
    for (const [k, v] of this.buckets[this.hash(key)]) {
      if (k === key) return v;
    }
    return undefined;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): boolean {
    const chain = this.buckets[this.hash(key)];
    const index = chain.findIndex(([k]) => k === key);
    if (index === -1) return false;

    chain.splice(index, 1);
    this.size--;
    return true;
  }

  keys(): string[] {
    return this.buckets.flatMap((chain) => chain.map(([k]) => k));
  }

  /** The rehash is O(n), but it happens rarely enough to amortise to O(1). */
  private resize(): void {
    const old = this.buckets;
    this.buckets = Array.from({ length: old.length * 2 }, () => []);
    this.size = 0;

    for (const chain of old) {
      for (const [k, v] of chain) this.set(k, v);
    }
  }

  /** How evenly the hash spread the keys — 1 chain per key is perfect. */
  longestChain(): number {
    return Math.max(0, ...this.buckets.map((chain) => chain.length));
  }
}

const map = new HashMap<number>(initialCapacity);
keys.forEach((key, index) => map.set(key, index));

console.log('size           ->', map.size);
console.log('buckets        ->', map.buckets.length);
console.log('longest chain  ->', map.longestChain());
console.log('get("blue")    ->', map.get('blue'));
console.log('has("purple")  ->', map.has('purple'));

map.set('blue', 99);
console.log('after overwrite, get("blue") ->', map.get('blue'), '(size still', map.size + ')');

console.log('delete("red")  ->', map.delete('red'));
console.log('keys           ->', map.keys().join(', '));
`,
    python: `# Hash map with separate chaining.
#
# The promise is O(1) average lookup, and the word "average" is doing real
# work. A key is hashed to a bucket index; if two keys land in the same bucket
# they form a chain, and a lookup has to walk it. With a good hash and a load
# factor kept under ~0.75, chains stay about one element long - so the average
# holds even though the worst case is O(n).
#
# Shrink the bucket count in the Parameters panel to force collisions, and
# watch the chains grow in the visualization.

keys = ['red', 'green', 'blue', 'cyan', 'magenta', 'yellow', 'black', 'white']
initialCapacity = 8


class HashMap:
    def __init__(self, capacity):
        self.buckets = [[] for _ in range(max(2, capacity))]
        self.size = 0

    def _hash(self, key):
        """djb2 - cheap, well spread, and deterministic across runs."""
        h = 5381
        for ch in key:
            h = ((h << 5) + h + ord(ch)) & 0xFFFFFFFF
        return h % len(self.buckets)

    def set(self, key, value):
        chain = self.buckets[self._hash(key)]

        for entry in chain:
            if entry[0] == key:
                entry[1] = value  # overwrite in place
                return

        chain.append([key, value])
        self.size += 1

        # Load factor above 0.75: double the buckets and rehash everything.
        if self.size > len(self.buckets) * 0.75:
            self._resize()

    def get(self, key):
        for k, v in self.buckets[self._hash(key)]:
            if k == key:
                return v
        return None

    def has(self, key):
        return self.get(key) is not None

    def delete(self, key):
        chain = self.buckets[self._hash(key)]
        for i, entry in enumerate(chain):
            if entry[0] == key:
                chain.pop(i)
                self.size -= 1
                return True
        return False

    def keys(self):
        return [k for chain in self.buckets for k, _ in chain]

    def _resize(self):
        """The rehash is O(n), but rare enough to amortise to O(1)."""
        old = self.buckets
        self.buckets = [[] for _ in range(len(old) * 2)]
        self.size = 0

        for chain in old:
            for k, v in chain:
                self.set(k, v)

    def longest_chain(self):
        """How evenly the hash spread the keys - 1 per chain is perfect."""
        return max([len(chain) for chain in self.buckets] + [0])


hash_map = HashMap(initialCapacity)
for index, key in enumerate(keys):
    hash_map.set(key, index)

print("size           ->", hash_map.size)
print("buckets        ->", len(hash_map.buckets))
print("longest chain  ->", hash_map.longest_chain())
print('get("blue")    ->', hash_map.get("blue"))
print('has("purple")  ->', hash_map.has("purple"))

hash_map.set("blue", 99)
print('after overwrite, get("blue") ->', hash_map.get("blue"),
      "(size still " + str(hash_map.size) + ")")

print('delete("red")  ->', hash_map.delete("red"))
print("keys           ->", ", ".join(hash_map.keys()))
`,
  },
  bench: {
    typescript: `breakstep.bench({
  input: (n) => Array.from({ length: n }, (_, i) => 'key' + i),
  run: (arr: string[]) => {
    const m = new HashMap<number>(8);
    for (let i = 0; i < arr.length; i++) m.set(arr[i], i);  // amortised O(1)
    for (const k of arr) m.get(k);                          // O(1) each
    return m.size;
  },
});
`,
    python: `def _bench(arr):
    m = HashMap(8)
    for i, k in enumerate(arr):
        m.set(k, i)   # amortised O(1)
    for k in arr:
        m.get(k)      # O(1) each
    return m.size


breakstep.bench(input=lambda n: ["key" + str(i) for i in range(n)], run=_bench)
`,
  },
  instrumented: {
    typescript: `// Hash map — the same structure, drawn explicitly.
//
// Showing \`this\` rather than \`this.buckets\` lets Breakstep read the real bucket
// array, so the picture is the map's actual collision structure and not a
// re-hash into invented buckets.

const keys = breakstep.param<string[]>('keys', ['red', 'green', 'blue']);
const initialCapacity = breakstep.param<number>('capacity', 8);

type Entry = [string, number];

class HashMap {
  buckets: Entry[][];
  size = 0;

  constructor(capacity: number) {
    this.buckets = Array.from({ length: Math.max(2, capacity) }, () => []);
  }

  hash(key: string): number {
    let h = 5381;
    for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
    return h % this.buckets.length;
  }

  set(key: string, value: number): void {
    const index = this.hash(key);
    const chain = this.buckets[index];

    for (const entry of chain) {
      if (entry[0] === key) {
        entry[1] = value;
        breakstep.show(this, { label: \`set("\${key}") — overwrote in bucket \${index}\`, highlight: { [key]: 'match' } });
        return;
      }
    }

    chain.push([key, value]);
    this.size++;

    breakstep.show(this, {
      label: \`set("\${key}") → bucket \${index}\${chain.length > 1 ? ' (collision)' : ''}\`,
      highlight: { [key]: chain.length > 1 ? 'compare' : 'active' },
      meta: { size: this.size, buckets: this.buckets.length, chain: chain.length },
    });

    if (this.size > this.buckets.length * 0.75) this.resize();
  }

  get(key: string): number | undefined {
    const index = this.hash(key);
    for (const [k, v] of this.buckets[index]) {
      if (k === key) {
        breakstep.show(this, { label: \`get("\${key}") → \${v}\`, highlight: { [key]: 'match' } });
        return v;
      }
    }
    breakstep.show(this, { label: \`get("\${key}") → miss\` });
    return undefined;
  }

  resize(): void {
    const old = this.buckets;
    this.buckets = Array.from({ length: old.length * 2 }, () => []);
    this.size = 0;
    for (const chain of old) {
      for (const [k, v] of chain) this.set(k, v);
    }
    breakstep.show(this, {
      label: \`resize → \${this.buckets.length} buckets\`,
      meta: { size: this.size },
    });
  }

  keys(): string[] {
    return this.buckets.flatMap((chain) => chain.map(([k]) => k));
  }
}

const map = new HashMap(initialCapacity);
keys.forEach((key, index) => map.set(key, index));

breakstep.log('size    ->', map.size);
breakstep.log('buckets ->', map.buckets.length);
breakstep.log('get     ->', map.get(keys[0]));
breakstep.log('keys    ->', map.keys().join(', '));

breakstep.bench({
  input: (n) => Array.from({ length: n }, (_, i) => 'key' + i),
  run: (arr: string[]) => {
    const m = new HashMap(8);
    for (let i = 0; i < arr.length; i++) m.set(arr[i], i);
    for (const k of arr) m.get(k);
    return m.size;
  },
});
`,
    python: `# Hash map - the same structure, drawn explicitly.
#
# Showing \`self\` rather than \`self.buckets\` lets Breakstep read the real bucket
# list, so the picture is the map's actual collision structure and not a
# re-hash into invented buckets.

keys = breakstep.param('keys', ['red', 'green', 'blue'])
initialCapacity = breakstep.param('capacity', 8)


class HashMap:
    def __init__(self, capacity):
        self.buckets = [[] for _ in range(max(2, capacity))]
        self.size = 0

    def hash(self, key):
        h = 5381
        for ch in key:
            h = ((h << 5) + h + ord(ch)) & 0xFFFFFFFF
        return h % len(self.buckets)

    def set(self, key, value):
        index = self.hash(key)
        chain = self.buckets[index]

        for entry in chain:
            if entry[0] == key:
                entry[1] = value
                breakstep.show(self, label=f'set("{key}") - overwrote in bucket {index}',
                         highlight={key: "match"})
                return

        chain.append([key, value])
        self.size += 1

        collided = " (collision)" if len(chain) > 1 else ""
        breakstep.show(self, label=f'set("{key}") -> bucket {index}{collided}',
                 highlight={key: "compare" if len(chain) > 1 else "active"},
                 meta={"size": self.size, "buckets": len(self.buckets), "chain": len(chain)})

        if self.size > len(self.buckets) * 0.75:
            self.resize()

    def get(self, key):
        index = self.hash(key)
        for k, v in self.buckets[index]:
            if k == key:
                breakstep.show(self, label=f'get("{key}") -> {v}', highlight={key: "match"})
                return v
        breakstep.show(self, label=f'get("{key}") -> miss')
        return None

    def resize(self):
        old = self.buckets
        self.buckets = [[] for _ in range(len(old) * 2)]
        self.size = 0
        for chain in old:
            for k, v in chain:
                self.set(k, v)
        breakstep.show(self, label=f"resize -> {len(self.buckets)} buckets",
                 meta={"size": self.size})

    def keys(self):
        return [k for chain in self.buckets for k, _ in chain]


hash_map = HashMap(initialCapacity)
for index, key in enumerate(keys):
    hash_map.set(key, index)

breakstep.log("size    ->", hash_map.size)
breakstep.log("buckets ->", len(hash_map.buckets))
breakstep.log("get     ->", hash_map.get(keys[0]))
breakstep.log("keys    ->", ", ".join(hash_map.keys()))


def _bench(arr):
    m = HashMap(8)
    for i, k in enumerate(arr):
        m.set(k, i)
    for k in arr:
        m.get(k)
    return m.size


breakstep.bench(input=lambda n: ["key" + str(i) for i in range(n)], run=_bench)
`,
  },
};
