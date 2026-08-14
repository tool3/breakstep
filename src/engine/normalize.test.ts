import { describe, expect, it } from 'vitest';
import { normalize, nodeValue, stringHash, looksLikeAdjacency } from './normalize';
import type {
  ArrayView,
  GraphView,
  HashMapView,
  HeapView,
  LinkedListView,
  MatrixView,
  TreeView,
  TrieView,
} from '@/types/viz';

describe('normalize — shape detection', () => {
  it('renders a flat array as an array view with index labels', () => {
    const view = normalize([1, 2, 3]) as ArrayView;
    expect(view.kind).toBe('array');
    expect(view.items.map((c) => c.value)).toEqual([1, 2, 3]);
    expect(view.showIndices).toBe(true);
  });

  it('renders an array of arrays as a matrix', () => {
    const view = normalize([
      [1, 2],
      [3, 4],
    ]) as MatrixView;
    expect(view.kind).toBe('matrix');
    expect(view.rows).toHaveLength(2);
    expect(view.rows[1][1].value).toBe(4);
  });

  it('does not treat a ragged array as a matrix', () => {
    const view = normalize([[1, 2], 3]);
    expect(view.kind).toBe('array');
  });

  it('follows a `next` chain into a linked list', () => {
    const list = { val: 1, next: { val: 2, next: { val: 3, next: null } } };
    const view = normalize(list) as LinkedListView;
    expect(view.kind).toBe('linkedList');
    expect(view.nodes.map((n) => n.value)).toEqual([1, 2, 3]);
    expect(view.nodes[0].next).toBe(1);
    expect(view.nodes[2].next).toBeNull();
    expect(view.cyclic).toBe(false);
  });

  it('detects a cycle instead of recursing forever', () => {
    const a: Record<string, unknown> = { val: 1 };
    const b: Record<string, unknown> = { val: 2 };
    const c: Record<string, unknown> = { val: 3 };
    a.next = b;
    b.next = c;
    c.next = b; // loops back

    const view = normalize(a) as LinkedListView;
    expect(view.cyclic).toBe(true);
    expect(view.nodes).toHaveLength(3);
    expect(view.nodes[2].next).toBe(1);
  });

  it('reads left/right as a binary tree', () => {
    const tree = {
      value: 5,
      left: { value: 3, left: null, right: null },
      right: { value: 8, left: null, right: null },
    };
    const view = normalize(tree) as TreeView;
    expect(view.kind).toBe('tree');
    expect(view.binary).toBe(true);
    expect(view.root?.value).toBe(5);
    expect(view.root?.children[0]?.value).toBe(3);
    expect(view.root?.children[1]?.value).toBe(8);
  });

  it('keeps null slots so binary trees stay aligned', () => {
    const tree = { value: 1, left: null, right: { value: 2, left: null, right: null } };
    const view = normalize(tree) as TreeView;
    expect(view.root?.children[0]).toBeNull();
    expect(view.root?.children[1]?.value).toBe(2);
  });

  it('recognizes a trie by its terminal flag plus a child map', () => {
    const node = (isEnd: boolean, children: Record<string, unknown> = {}) => ({ isEnd, children });
    const root = node(false, { c: node(false, { a: node(false, { t: node(true) }) }) });

    const view = normalize(root) as TrieView;
    expect(view.kind).toBe('trie');
    expect(view.root.children[0].char).toBe('c');
    expect(view.root.children[0].children[0].children[0].terminal).toBe(true);
  });

  it('builds a graph from an adjacency map', () => {
    const view = normalize({ a: ['b'], b: ['a', 'c'], c: ['b'] }) as GraphView;
    expect(view.kind).toBe('graph');
    expect(view.nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'c']);
    // Mutual links collapse into undirected edges.
    expect(view.directed).toBe(false);
    expect(view.edges).toHaveLength(2);
  });

  it('keeps a one-way adjacency map directed', () => {
    const view = normalize({ a: ['b', 'c'], b: ['c'], c: [] }) as GraphView;
    expect(view.directed).toBe(true);
    expect(view.edges).toHaveLength(3);
  });

  it('builds a graph from an explicit nodes/edges object', () => {
    const view = normalize({
      nodes: ['x', 'y'],
      edges: [['x', 'y', 4]],
      directed: true,
    }) as GraphView;
    expect(view.nodes).toHaveLength(2);
    expect(view.edges[0].weight).toBe(4);
  });

  it('routes a plain object into the hash map view', () => {
    const view = normalize({ alpha: 1, beta: 2 }) as HashMapView;
    expect(view.kind).toBe('hashmap');
    const entries = view.buckets.flatMap((b) => b.entries);
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.key).sort()).toEqual(['alpha', 'beta']);
  });

  it('routes a Map with non-adjacency values into the hash map view', () => {
    const view = normalize(new Map([['k', 1]])) as HashMapView;
    expect(view.kind).toBe('hashmap');
  });

  it('unwraps container classes to their payload', () => {
    class LinkedList {
      head = { val: 7, next: null };
    }
    const view = normalize(new LinkedList()) as LinkedListView;
    expect(view.kind).toBe('linkedList');
    expect(view.nodes[0].value).toBe(7);
  });

  it('treats an explicitly empty container as an empty structure', () => {
    expect(normalize({ head: null }).kind).toBe('linkedList');
    expect(normalize({ root: null }).kind).toBe('tree');
  });

  it('falls back to a raw view for primitives', () => {
    expect(normalize(42)).toEqual({ kind: 'raw', value: 42 });
    expect(normalize('hi')).toEqual({ kind: 'raw', value: 'hi' });
  });
});

describe('normalize — explicit `as` override', () => {
  it('forces a stack variant', () => {
    const view = normalize([1, 2, 3], { as: 'stack' }) as ArrayView;
    expect(view.variant).toBe('stack');
  });

  it('forces a heap and infers min vs max ordering', () => {
    const min = normalize([1, 3, 5, 7], { as: 'heap' }) as HeapView;
    expect(min.heapType).toBe('min');
    const max = normalize([9, 7, 5, 1], { as: 'heap' }) as HeapView;
    expect(max.heapType).toBe('max');
  });

  it('respects an explicit heapType over inference', () => {
    const view = normalize([1, 3, 5], { as: 'heap', heapType: 'max' }) as HeapView;
    expect(view.heapType).toBe('max');
  });

  it('builds a call stack only when asked', () => {
    const entries = [
      { label: 'f(0)', depth: 0 },
      { label: 'f(1)', depth: 1 },
    ];
    expect(normalize(entries).kind).not.toBe('callstack');
    const forced = normalize(entries, { as: 'callstack' });
    expect(forced.kind).toBe('callstack');
  });
});

describe('normalize — highlights and pointers', () => {
  it('applies an array of indices as `active`', () => {
    const view = normalize([1, 2, 3], { highlight: [0, 2] }) as ArrayView;
    expect(view.items[0].state).toBe('active');
    expect(view.items[1].state).toBeUndefined();
    expect(view.items[2].state).toBe('active');
  });

  it('applies a per-index state record', () => {
    const view = normalize([1, 2, 3], { highlight: { 1: 'match' } }) as ArrayView;
    expect(view.items[1].state).toBe('match');
  });

  it('accepts "row,col" keys for matrices', () => {
    const view = normalize(
      [
        [1, 2],
        [3, 4],
      ],
      { highlight: { '1,0': 'compare' } },
    ) as MatrixView;
    expect(view.rows[1][0].state).toBe('compare');
  });

  it('carries pointers through to the view', () => {
    const view = normalize([1, 2, 3], { pointers: { lo: 0, hi: 2 } }) as ArrayView;
    expect(view.pointers).toEqual([
      { name: 'lo', index: 0 },
      { name: 'hi', index: 2 },
    ]);
  });
});

describe('normalize — safety limits', () => {
  it('caps a very long array', () => {
    const view = normalize(Array.from({ length: 5000 }, (_, i) => i)) as ArrayView;
    expect(view.items.length).toBeLessThanOrEqual(400);
  });

  it('caps an extremely long linked list', () => {
    let head: Record<string, unknown> = { val: 0, next: null };
    for (let i = 1; i < 2000; i++) head = { val: i, next: head };
    const view = normalize(head) as LinkedListView;
    expect(view.nodes.length).toBeLessThanOrEqual(500);
  });
});

describe('helpers', () => {
  it('pulls the conventional value key off a node', () => {
    expect(nodeValue({ val: 3, next: null })).toBe(3);
    expect(nodeValue({ value: 'x' })).toBe('x');
    expect(nodeValue({ data: 9 })).toBe(9);
    expect(nodeValue(5)).toBe(5);
  });

  it('hashes deterministically so buckets do not jump between frames', () => {
    expect(stringHash('abc')).toBe(stringHash('abc'));
    expect(stringHash('abc')).not.toBe(stringHash('abd'));
  });

  it('rejects a map of unrelated lists as an adjacency list', () => {
    expect(looksLikeAdjacency({ a: [1, 2], b: [3] })).toBe(false);
    expect(looksLikeAdjacency({ a: ['b'], b: ['a'] })).toBe(true);
  });
});

describe('normalize — hand-written structure classes', () => {
  it('draws a class called Stack as a stack', () => {
    class Stack {
      items = [1, 2, 3];
    }
    const view = normalize(new Stack()) as ArrayView;
    expect(view.kind).toBe('array');
    expect(view.variant).toBe('stack');
  });

  it('draws a class called Queue as a queue', () => {
    class Queue {
      items = ['a', 'b'];
    }
    expect((normalize(new Queue()) as ArrayView).variant).toBe('queue');
  });

  it('shows only the live window of a head-index queue', () => {
    class Queue {
      items = [1, 2, 3, 4, 5];
      head = 2;
    }
    const view = normalize(new Queue()) as ArrayView;
    expect(view.items.map((c) => c.value)).toEqual([3, 4, 5]);
  });

  it('takes the ordering from MinHeap / MaxHeap class names', () => {
    class MinHeap {
      items = [5, 9, 7];
    }
    class MaxHeap {
      items = [5, 1, 3];
    }
    expect((normalize(new MinHeap()) as HeapView).heapType).toBe('min');
    expect((normalize(new MaxHeap()) as HeapView).heapType).toBe('max');
  });

  it('draws a real bucket table with its actual collisions', () => {
    class HashMap {
      buckets: [string, number][][] = [
        [],
        [
          ['a', 1],
          ['q', 9],
        ],
        [],
        [['b', 2]],
      ];
      size = 3;
    }

    const view = normalize(new HashMap()) as HashMapView;
    expect(view.kind).toBe('hashmap');
    expect(view.synthetic).toBe(false);
    expect(view.buckets).toHaveLength(4);
    // Bucket 1 holds a genuine collision.
    expect(view.buckets[1].entries.map((e) => e.key)).toEqual(['a', 'q']);
    expect(view.buckets[3].entries[0].value).toBe(2);
  });

  it('accepts {key, value} entry objects in buckets', () => {
    const table = { buckets: [[{ key: 'x', value: 7 }], [], []] };
    const view = normalize(table) as HashMapView;
    expect(view.buckets[0].entries[0]).toMatchObject({ key: 'x', value: 7 });
  });

  it('reads an adjacency map whose neighbours are Sets', () => {
    const graph = new Map([
      ['a', new Set(['b'])],
      ['b', new Set(['a'])],
    ]);
    const view = normalize(graph) as GraphView;
    expect(view.kind).toBe('graph');
    expect(view.nodes.map((n) => n.id).sort()).toEqual(['a', 'b']);
  });

  it('unwraps a Graph class holding its adjacency in a Map of Sets', () => {
    class Graph {
      adjacency = new Map([
        ['a', new Set(['b', 'c'])],
        ['b', new Set(['a'])],
        ['c', new Set(['a'])],
      ]);
    }
    const view = normalize(new Graph()) as GraphView;
    expect(view.kind).toBe('graph');
    expect(view.nodes).toHaveLength(3);
  });

  it('still treats a plain array of arrays as a matrix', () => {
    expect(normalize([[1, 2], [3, 4]]).kind).toBe('matrix');
  });
});
