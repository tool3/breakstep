import type { Template } from '@/types';

export const linkedListReverse: Template = {
  id: 'example-linked-list',
  title: 'Linked List — Reverse',
  category: 'Worked examples',
  blurb: 'Rewire `next` pointers in place with three references and no extra memory.',
  tags: ['linked-list', 'pointers', 'in-place'],
  expected: { time: 'O(n)', space: 'O(1)' },
  params: [
    {
      name: 'values',
      label: 'Node values',
      type: 'numberArray',
      default: [1, 2, 3, 4, 5, 6],
    },
  ],
  code: {
    typescript: `// Reverse a singly linked list in place.
//
// Three references and nothing else: \`prev\` holds the already-reversed part,
// \`curr\` is the node being rewired, \`next\` saves the rest of the list before
// the link is destroyed. Forget to save \`next\` and the tail is gone forever.

const values = [1, 2, 3, 4, 5, 6];

class ListNode {
  val: number;
  next: ListNode | null;

  constructor(val: number, next: ListNode | null = null) {
    this.val = val;
    this.next = next;
  }
}

function build(vals: number[]): ListNode | null {
  let head: ListNode | null = null;
  for (let i = vals.length - 1; i >= 0; i--) head = new ListNode(vals[i], head);
  return head;
}

function reverse(head: ListNode | null): ListNode | null {
  let prev: ListNode | null = null;
  let curr = head;

  while (curr !== null) {
    const next: ListNode | null = curr.next; // save before we break the link
    curr.next = prev;                        // rewire
    prev = curr;                             // advance
    curr = next;
  }

  return prev;
}

function toArray(head: ListNode | null): number[] {
  const out: number[] = [];
  for (let node = head; node !== null; node = node.next) out.push(node.val);
  return out;
}

const head = build(values);
console.log('original:', toArray(head).join(' -> '));

const reversed = reverse(head);
console.log('reversed:', toArray(reversed).join(' -> '));
`,
    python: `# Reverse a singly linked list in place.
#
# Three references and nothing else: \`prev\` holds the already-reversed part,
# \`curr\` is the node being rewired, \`nxt\` saves the rest of the list before
# the link is destroyed. Forget to save \`nxt\` and the tail is gone forever.

values = [1, 2, 3, 4, 5, 6]


class ListNode:
    def __init__(self, val, next=None):
        self.val = val
        self.next = next


def build(vals):
    head = None
    for v in reversed(vals):
        head = ListNode(v, head)
    return head


def reverse(head):
    prev = None
    curr = head

    while curr is not None:
        nxt = curr.next   # save before we break the link
        curr.next = prev  # rewire
        prev = curr       # advance
        curr = nxt

    return prev


def to_list(head):
    out = []
    node = head
    while node is not None:
        out.append(node.val)
        node = node.next
    return out


head = build(values)
print("original:", " -> ".join(str(v) for v in to_list(head)))

reversed_head = reverse(head)
print("reversed:", " -> ".join(str(v) for v in to_list(reversed_head)))
`,
  },
  bench: {
    typescript: `breakstep.bench({
  input: (n) => build(Array.from({ length: n }, (_, i) => i)),
  run: (list) => reverse(list as ListNode | null),
});
`,
    python: `breakstep.bench(
    input=lambda n: build(list(range(n))),
    run=reverse,
)
`,
  },
  instrumented: {
    typescript: `// Reverse a singly linked list in place.
//
// Three references and nothing else: \`prev\` holds the already-reversed part,
// \`curr\` is the node being rewired, \`next\` saves the rest of the list before
// the link is destroyed. Forget to save \`next\` and the tail is gone forever.

interface ListNode {
  val: number;
  next: ListNode | null;
}

const values = breakstep.param<number[]>('values', [1, 2, 3, 4, 5]);

function build(vals: number[]): ListNode | null {
  let head: ListNode | null = null;
  for (let i = vals.length - 1; i >= 0; i--) head = { val: vals[i], next: head };
  return head;
}

function reverse(head: ListNode | null): ListNode | null {
  let prev: ListNode | null = null;
  let curr = head;
  let step = 0;

  while (curr !== null) {
    const next: ListNode | null = curr.next; // save before we break the link
    curr.next = prev;                        // rewire
    prev = curr;                             // advance
    curr = next;

    step++;
    // \`prev\` is the head of the reversed prefix; showing it visualises progress.
    breakstep.show(prev, {
      label: \`step \${step}: reversed prefix\`,
      highlight: { 0: 'active' },
      meta: { reversed: step, remaining: values.length - step },
    });
  }

  return prev;
}

const head = build(values);
breakstep.show(head, { label: 'Original list' });

const reversed = reverse(head);
breakstep.show(reversed, { label: 'Reversed list', highlight: { 0: 'match' } });

const out: number[] = [];
for (let node = reversed; node; node = node.next) out.push(node.val);
breakstep.log('result:', out.join(' → '));

breakstep.bench({
  input: (n) => build(Array.from({ length: n }, (_, i) => i)),
  run: (list) => reverse(list as ListNode | null),
});
`,
    python: `# Reverse a singly linked list in place.
#
# Three references and nothing else: \`prev\` holds the already-reversed part,
# \`curr\` is the node being rewired, \`nxt\` saves the rest of the list before
# the link is destroyed. Forget to save \`nxt\` and the tail is gone forever.

values = breakstep.param('values', [1, 2, 3, 4, 5])


class ListNode:
    def __init__(self, val, next=None):
        self.val = val
        self.next = next


def build(vals):
    head = None
    for v in reversed(vals):
        head = ListNode(v, head)
    return head


def reverse(head):
    prev = None
    curr = head
    step = 0

    while curr is not None:
        nxt = curr.next   # save before we break the link
        curr.next = prev  # rewire
        prev = curr       # advance
        curr = nxt

        step += 1
        # \`prev\` is the head of the reversed prefix; showing it visualises progress.
        breakstep.show(prev, label=f"step {step}: reversed prefix",
                 highlight={0: "active"},
                 meta={"reversed": step, "remaining": len(values) - step})

    return prev


head = build(values)
breakstep.show(head, label="Original list")

reversed_head = reverse(head)
breakstep.show(reversed_head, label="Reversed list", highlight={0: "match"})

out = []
node = reversed_head
while node:
    out.append(node.val)
    node = node.next
print("result:", " -> ".join(str(v) for v in out))

breakstep.bench(
    input=lambda n: build(list(range(n))),
    run=reverse,
)
`,
  },
};

export const linkedListCycle: Template = {
  id: 'example-linked-list-cycle',
  title: 'Linked List — Cycle Detection',
  category: 'Worked examples',
  blurb: "Floyd's tortoise and hare: find a loop with O(1) memory.",
  tags: ['linked-list', 'two-pointers', 'cycle'],
  expected: { time: 'O(n)', space: 'O(1)' },
  params: [
    {
      name: 'length',
      // `length` is a DOM global, so the constant cannot use that name at the
      // top level without shadowing `window.length`.
      binds: 'nodeCount',
      label: 'List length',
      type: 'number',
      default: 9,
      min: 3,
      max: 40,
    },
    {
      name: 'cycleAt',
      label: 'Cycle entry index',
      type: 'number',
      default: 4,
      min: -1,
      max: 39,
      help: 'Set to -1 for a list with no cycle at all.',
    },
  ],
  code: {
    typescript: `// Floyd's cycle detection - "tortoise and hare".
//
// The hare moves twice as fast. If there is a loop, the gap between them
// shrinks by exactly one node per step, so they must eventually collide.
// A visited-set solution also works but costs O(n) memory; this costs none.

const nodeCount = 9;
const cycleAt = 4;

class ListNode {
  val: number;
  next: ListNode | null = null;

  constructor(val: number) {
    this.val = val;
  }
}

function buildWithCycle(n: number, entry: number): ListNode | null {
  const nodes = Array.from({ length: n }, (_, i) => new ListNode(i));
  for (let i = 0; i < n - 1; i++) nodes[i].next = nodes[i + 1];
  if (entry >= 0 && entry < n) nodes[n - 1].next = nodes[entry];
  return nodes[0] ?? null;
}

function findCycleEntry(head: ListNode | null): ListNode | null {
  let slow = head;
  let fast = head;

  while (fast !== null && fast.next !== null) {
    slow = slow!.next;
    fast = fast.next.next;

    if (slow === fast) {
      // Phase 2: reset one pointer to the head; they meet at the cycle entry.
      let entry = head;
      while (entry !== slow) {
        entry = entry!.next;
        slow = slow!.next;
      }
      return entry;
    }
  }

  return null;
}

const head = buildWithCycle(nodeCount, cycleAt);
const entry = findCycleEntry(head);
console.log(entry ? 'cycle enters at node ' + entry.val : 'acyclic');
`,
    python: `# Floyd's cycle detection - "tortoise and hare".
#
# The hare moves twice as fast. If there is a loop, the gap between them
# shrinks by exactly one node per step, so they must eventually collide.
# A visited-set solution also works but costs O(n) memory; this costs none.

nodeCount = 9
cycleAt = 4


class ListNode:
    def __init__(self, val):
        self.val = val
        self.next = None


def build_with_cycle(n, entry):
    nodes = [ListNode(i) for i in range(n)]
    for i in range(n - 1):
        nodes[i].next = nodes[i + 1]
    if 0 <= entry < n:
        nodes[n - 1].next = nodes[entry]
    return nodes[0] if nodes else None


def find_cycle_entry(head):
    slow = fast = head

    while fast is not None and fast.next is not None:
        slow = slow.next
        fast = fast.next.next

        if slow is fast:
            # Phase 2: reset one pointer to the head; they meet at the entry.
            entry = head
            while entry is not slow:
                entry = entry.next
                slow = slow.next
            return entry

    return None


head = build_with_cycle(nodeCount, cycleAt)
entry = find_cycle_entry(head)
print("cycle enters at node " + str(entry.val) if entry else "acyclic")
`,
  },
  bench: {
    typescript: `breakstep.bench({
  input: (n) => buildWithCycle(n, Math.floor(n / 2)),
  run: (list) => findCycleEntry(list as ListNode | null),
});
`,
    python: `breakstep.bench(
    input=lambda n: build_with_cycle(n, n // 2),
    run=find_cycle_entry,
)
`,
  },
  instrumented: {
    typescript: `// Floyd's cycle detection — "tortoise and hare".
//
// The hare moves twice as fast. If there is a loop, the gap between them
// shrinks by exactly one node per step, so they must eventually collide.
// A visited-set solution also works but costs O(n) memory; this costs none.

interface ListNode {
  val: number;
  next: ListNode | null;
}

const nodeCount = breakstep.param<number>('length', 9);
const cycleAt = breakstep.param<number>('cycleAt', 4);

function buildWithCycle(n: number, entry: number): ListNode | null {
  const nodes: ListNode[] = Array.from({ length: n }, (_, i) => ({ val: i, next: null }));
  for (let i = 0; i < n - 1; i++) nodes[i].next = nodes[i + 1];
  if (entry >= 0 && entry < n) nodes[n - 1].next = nodes[entry];
  return nodes[0] ?? null;
}

function hasCycle(head: ListNode | null): ListNode | null {
  let slow = head;
  let fast = head;
  let step = 0;

  while (fast !== null && fast.next !== null) {
    slow = slow!.next;
    fast = fast.next.next;
    step++;

    breakstep.show(head, {
      label: \`step \${step}: slow=\${slow?.val ?? '∅'} fast=\${fast?.val ?? '∅'}\`,
      highlight: {
        ...(slow ? { [String(slow.val)]: 'active' as const } : {}),
        ...(fast ? { [String(fast.val)]: 'compare' as const } : {}),
      },
      meta: { step, slow: slow?.val, fast: fast?.val },
    });

    if (slow === fast) {
      // Phase 2: reset one pointer to the head; they meet at the cycle entry.
      let entry = head;
      while (entry !== slow) {
        entry = entry!.next;
        slow = slow!.next;
      }
      breakstep.show(head, {
        label: \`Cycle enters at node \${entry!.val}\`,
        highlight: { [String(entry!.val)]: 'match' },
      });
      return entry;
    }
  }

  breakstep.show(head, { label: 'No cycle — fast reached the end' });
  return null;
}

const head = buildWithCycle(nodeCount, cycleAt);
breakstep.show(head, { label: cycleAt >= 0 ? \`List with a cycle at \${cycleAt}\` : 'Straight list' });

const entry = hasCycle(head);
breakstep.log(entry ? \`cycle entry: node \${entry.val}\` : 'acyclic');

breakstep.bench({
  input: (n) => buildWithCycle(n, Math.floor(n / 2)),
  run: (list) => hasCycle(list as ListNode | null),
});
`,
    python: `# Floyd's cycle detection - "tortoise and hare".
#
# The hare moves twice as fast. If there is a loop, the gap between them
# shrinks by exactly one node per step, so they must eventually collide.
# A visited-set solution also works but costs O(n) memory; this costs none.

length = breakstep.param('length', 9)
cycle_at = breakstep.param('cycleAt', 4)


class ListNode:
    def __init__(self, val):
        self.val = val
        self.next = None


def build_with_cycle(n, entry):
    nodes = [ListNode(i) for i in range(n)]
    for i in range(n - 1):
        nodes[i].next = nodes[i + 1]
    if 0 <= entry < n:
        nodes[n - 1].next = nodes[entry]
    return nodes[0] if nodes else None


def has_cycle(head):
    slow = fast = head
    step = 0

    while fast is not None and fast.next is not None:
        slow = slow.next
        fast = fast.next.next
        step += 1

        highlight = {}
        if slow:
            highlight[str(slow.val)] = "active"
        if fast:
            highlight[str(fast.val)] = "compare"

        breakstep.show(
            head,
            label=f"step {step}: slow={slow.val if slow else '-'} fast={fast.val if fast else '-'}",
            highlight=highlight,
            meta={"step": step},
        )

        if slow is fast:
            # Phase 2: reset one pointer to the head; they meet at the cycle entry.
            entry = head
            while entry is not slow:
                entry = entry.next
                slow = slow.next
            breakstep.show(head, label=f"Cycle enters at node {entry.val}",
                     highlight={str(entry.val): "match"})
            return entry

    breakstep.show(head, label="No cycle - fast reached the end")
    return None


head = build_with_cycle(nodeCount, cycle_at)
breakstep.show(head, label=f"List with a cycle at {cycle_at}" if cycle_at >= 0 else "Straight list")

entry = has_cycle(head)
print(f"cycle entry: node {entry.val}" if entry else "acyclic")

breakstep.bench(
    input=lambda n: build_with_cycle(n, n // 2),
    run=has_cycle,
)
`,
  },
};

export const stackQueue: Template = {
  id: 'example-stack-queue',
  title: 'Stack & Queue',
  category: 'Worked examples',
  blurb: 'LIFO bracket matching next to a FIFO task queue.',
  tags: ['stack', 'queue', 'parsing'],
  expected: { time: 'O(n)', space: 'O(n)' },
  params: [
    { name: 'expression', label: 'Bracket expression', type: 'string', default: '{[()()]}([])' },
    { name: 'tasks', label: 'Queue tasks', type: 'stringArray', default: ['fetch', 'parse', 'render', 'commit'] },
  ],
  code: {
    typescript: `// A stack and a queue, side by side - the difference is only which end
// you take from.

const expression = '{[()()]}([])';
const tasks = ['fetch', 'parse', 'render', 'commit'];

const PAIRS: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

// --- Stack: LIFO. Push openers, pop on closers. ---------------------------
function validBrackets(s: string): boolean {
  const stack: string[] = [];

  for (const ch of s) {
    if (ch === '(' || ch === '[' || ch === '{') {
      stack.push(ch);
    } else if (PAIRS[ch]) {
      if (stack.pop() !== PAIRS[ch]) return false;
    }
  }

  return stack.length === 0;
}

// --- Queue: FIFO. Enqueue at the back, dequeue from the front. ------------
function drainQueue(items: string[]): string[] {
  const queue = [...items];
  const done: string[] = [];

  while (queue.length > 0) {
    // \`shift()\` is O(n) in a real array - a production queue uses a ring
    // buffer or a head index. Fine here; Analyze will call it out.
    done.push(queue.shift()!);
  }

  return done;
}

console.log('brackets balanced:', validBrackets(expression));
console.log('processed order:', drainQueue(tasks).join(' -> '));
`,
    python: `# A stack and a queue, side by side - the difference is only which end
# you take from.

from collections import deque

expression = '{[()()]}([])'
tasks = ['fetch', 'parse', 'render', 'commit']

PAIRS = {')': '(', ']': '[', '}': '{'}


# --- Stack: LIFO. Push openers, pop on closers. ---------------------------
def valid_brackets(s):
    stack = []

    for ch in s:
        if ch in '([{':
            stack.append(ch)
        elif ch in PAIRS:
            if not stack or stack.pop() != PAIRS[ch]:
                return False

    return len(stack) == 0


# --- Queue: FIFO. Enqueue at the back, dequeue from the front. ------------
def drain_queue(items):
    queue = deque(items)
    done = []

    while queue:
        # \`popleft()\` is O(1); \`list.pop(0)\` would be O(n) per call.
        done.append(queue.popleft())

    return done


print("brackets balanced:", valid_brackets(expression))
print("processed order:", " -> ".join(drain_queue(tasks)))
`,
  },
  bench: {
    typescript: `breakstep.bench({
  input: (n) => '('.repeat(n) + ')'.repeat(n),
  run: (s) => validBrackets(s as string),
});
`,
    python: `breakstep.bench(
    input=lambda n: "(" * n + ")" * n,
    run=valid_brackets,
)
`,
  },
  instrumented: {
    typescript: `// A stack and a queue, side by side — the difference is only which end
// you take from.

const expression = breakstep.param<string>('expression', '{[()]}');
const tasks = breakstep.param<string[]>('tasks', ['a', 'b', 'c']);

const PAIRS: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

// --- Stack: LIFO. Push openers, pop on closers. ---------------------------
function validBrackets(s: string): boolean {
  const stack: string[] = [];

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (ch === '(' || ch === '[' || ch === '{') {
      stack.push(ch);
      breakstep.show(stack, { as: 'stack', label: \`push '\${ch}'\`, highlight: [stack.length - 1] });
    } else if (PAIRS[ch]) {
      const top = stack.pop();
      if (top !== PAIRS[ch]) {
        breakstep.show(stack, { as: 'stack', label: \`'\${ch}' does not close '\${top ?? '∅'}'\` });
        return false;
      }
      breakstep.show(stack, { as: 'stack', label: \`pop for '\${ch}'\`, meta: { depth: stack.length } });
    }
  }

  breakstep.show(stack, { as: 'stack', label: stack.length === 0 ? 'Balanced — stack empty' : 'Unclosed brackets remain' });
  return stack.length === 0;
}

// --- Queue: FIFO. Enqueue at the back, dequeue from the front. ------------
function drainQueue(items: string[]): string[] {
  const queue = [...items];
  const done: string[] = [];

  breakstep.show(queue, { as: 'queue', label: 'Initial queue' });

  while (queue.length > 0) {
    // \`shift()\` is O(n) in a real array — a production queue uses a ring buffer
    // or a head index. Fine here; the static analyzer will call it out.
    const task = queue.shift()!;
    done.push(task);
    breakstep.show(queue, {
      as: 'queue',
      label: \`dequeue "\${task}"\`,
      meta: { processed: done.length, waiting: queue.length },
    });
  }

  return done;
}

breakstep.log('brackets balanced:', validBrackets(expression));
breakstep.log('processed order:', drainQueue(tasks).join(' → '));

breakstep.bench({
  input: (n) => '('.repeat(n) + ')'.repeat(n),
  run: (s) => validBrackets(s as string),
});
`,
    python: `# A stack and a queue, side by side - the difference is only which end
# you take from.

from collections import deque

expression = breakstep.param('expression', '{[()]}')
tasks = breakstep.param('tasks', ['a', 'b', 'c'])

PAIRS = {')': '(', ']': '[', '}': '{'}


# --- Stack: LIFO. Push openers, pop on closers. ---------------------------
def valid_brackets(s):
    stack = []

    for ch in s:
        if ch in '([{':
            stack.append(ch)
            breakstep.show(stack, kind="stack", label=f"push '{ch}'",
                     highlight=[len(stack) - 1])
        elif ch in PAIRS:
            top = stack.pop() if stack else None
            if top != PAIRS[ch]:
                breakstep.show(stack, kind="stack",
                         label=f"'{ch}' does not close '{top or '-'}'")
                return False
            breakstep.show(stack, kind="stack", label=f"pop for '{ch}'",
                     meta={"depth": len(stack)})

    breakstep.show(stack, kind="stack",
             label="Balanced - stack empty" if not stack else "Unclosed brackets remain")
    return len(stack) == 0


# --- Queue: FIFO. Enqueue at the back, dequeue from the front. ------------
def drain_queue(items):
    queue = deque(items)
    done = []

    breakstep.show(list(queue), kind="queue", label="Initial queue")

    while queue:
        # \`deque.popleft()\` is O(1); \`list.pop(0)\` would be O(n) per call.
        task = queue.popleft()
        done.append(task)
        breakstep.show(list(queue), kind="queue", label=f'dequeue "{task}"',
                 meta={"processed": len(done), "waiting": len(queue)})

    return done


print("brackets balanced:", valid_brackets(expression))
print("processed order:", " -> ".join(drain_queue(tasks)))

breakstep.bench(
    input=lambda n: "(" * n + ")" * n,
    run=valid_brackets,
)
`,
  },
};

export const hashMap: Template = {
  id: 'example-hash-map',
  title: 'Hash Map — Two Sum',
  category: 'Worked examples',
  blurb: 'Trade O(n) memory for O(n) time: one pass, constant-time lookups.',
  tags: ['hashmap', 'array', 'space-time-tradeoff'],
  expected: { time: 'O(n)', space: 'O(n)' },
  params: [
    { name: 'nums', label: 'Numbers', type: 'numberArray', default: [11, 4, 20, 7, 15, 2, 9] },
    { name: 'target', label: 'Target sum', type: 'number', default: 22, min: -1000, max: 1000 },
  ],
  code: {
    typescript: `// Two Sum with a hash map - the classic space-for-time trade.
//
// The nested-loop version is O(n^2). Remembering what we have already seen
// turns the inner search into a single O(1) probe, at the cost of a table
// that grows with the input. That trade is the whole lesson.

const nums = [11, 4, 20, 7, 15, 2, 9];
const target = 22;

function twoSum(arr: number[], want: number): [number, number] | null {
  const seen = new Map<number, number>(); // value -> index

  for (let i = 0; i < arr.length; i++) {
    const need = want - arr[i];

    if (seen.has(need)) return [seen.get(need)!, i];
    seen.set(arr[i], i);
  }

  return null;
}

console.log('indices:', twoSum(nums, target));
`,
    python: `# Two Sum with a hash map - the classic space-for-time trade.
#
# The nested-loop version is O(n^2). Remembering what we have already seen
# turns the inner search into a single O(1) probe, at the cost of a table
# that grows with the input. That trade is the whole lesson.

nums = [11, 4, 20, 7, 15, 2, 9]
target = 22


def two_sum(arr, want):
    seen = {}  # value -> index

    for i, value in enumerate(arr):
        need = want - value

        if need in seen:
            return (seen[need], i)
        seen[value] = i

    return None


print("indices:", two_sum(nums, target))
`,
  },
  bench: {
    typescript: `breakstep.bench({
  input: (n) => Array.from({ length: n }, (_, i) => i),
  run: (arr: number[]) => twoSum(arr, -1), // never found = full scan
});
`,
    python: `breakstep.bench(
    input=lambda n: list(range(n)),
    run=lambda arr: two_sum(arr, -1),  # never found = full scan
)
`,
  },
  instrumented: {
    typescript: `// Two Sum with a hash map — the classic space-for-time trade.
//
// The nested-loop version is O(n²). Remembering what we have already seen
// turns the inner search into a single O(1) probe, at the cost of a table
// that grows with the input. That trade is the whole lesson.

const nums = breakstep.param<number[]>('nums', [11, 4, 20, 7]);
const target = breakstep.param<number>('target', 22);

function twoSum(arr: number[], want: number): [number, number] | null {
  const seen = new Map<number, number>(); // value → index

  for (let i = 0; i < arr.length; i++) {
    const need = want - arr[i];

    if (seen.has(need)) {
      const j = seen.get(need)!;
      breakstep.show(arr, {
        label: \`\${arr[j]} + \${arr[i]} = \${want}\`,
        highlight: { [i]: 'match', [j]: 'match' },
      });
      return [j, i];
    }

    seen.set(arr[i], i);
    breakstep.show(seen, {
      label: \`store \${arr[i]} → \${i}, still need \${need}\`,
      highlight: { [String(arr[i])]: 'active' },
      meta: { i, value: arr[i], need, tableSize: seen.size },
    });
  }

  return null;
}

const found = twoSum(nums, target);
breakstep.log('indices:', found);

breakstep.bench({
  input: (n) => Array.from({ length: n }, (_, i) => i),
  run: (arr: number[]) => twoSum(arr, -1), // never found = full scan
});
`,
    python: `# Two Sum with a hash map - the classic space-for-time trade.
#
# The nested-loop version is O(n^2). Remembering what we have already seen
# turns the inner search into a single O(1) probe, at the cost of a table
# that grows with the input. That trade is the whole lesson.

nums = breakstep.param('nums', [11, 4, 20, 7])
target = breakstep.param('target', 22)


def two_sum(arr, want):
    seen = {}  # value -> index

    for i, value in enumerate(arr):
        need = want - value

        if need in seen:
            j = seen[need]
            breakstep.show(arr, label=f"{arr[j]} + {value} = {want}",
                     highlight={i: "match", j: "match"})
            return (j, i)

        seen[value] = i
        breakstep.show(seen, label=f"store {value} -> {i}, still need {need}",
                 highlight={str(value): "active"},
                 meta={"i": i, "value": value, "need": need, "tableSize": len(seen)})

    return None


print("indices:", two_sum(nums, target))

breakstep.bench(
    input=lambda n: list(range(n)),
    run=lambda arr: two_sum(arr, -1),  # never found = full scan
)
`,
  },
};
