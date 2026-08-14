import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Visualizer, VIEW_LABEL } from './Visualizer';
import { layoutGraph, layoutTree, heapToTree, trieToTreeNode, trimToRadius } from './layout';
import { formatCount, formatDuration, formatValue } from './format';
import { normalize } from '@/engine/normalize';
import type { TreeNode, VizKind } from '@/types/viz';

describe('Visualizer dispatch', () => {
  it('names every view kind', () => {
    const kinds: VizKind[] = [
      'array',
      'matrix',
      'linkedList',
      'tree',
      'graph',
      'trie',
      'heap',
      'hashmap',
      'callstack',
      'raw',
    ];
    for (const kind of kinds) expect(VIEW_LABEL[kind]).toBeTruthy();
  });
});

describe('ArrayViz', () => {
  it('renders values with index labels', () => {
    render(<Visualizer view={normalize([10, 20, 30])} />);
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('exposes highlight state in the accessible name', () => {
    render(<Visualizer view={normalize([1, 2], { highlight: { 0: 'match' } })} />);
    expect(screen.getByLabelText(/index 0: 1 \(match\)/)).toBeInTheDocument();
  });

  it('renders pointer labels above the array', () => {
    render(<Visualizer view={normalize([1, 2, 3], { pointers: { lo: 0, hi: 2 } })} />);
    expect(screen.getByText('lo')).toBeInTheDocument();
    expect(screen.getByText('hi')).toBeInTheDocument();
  });

  it('flags a pointer that ran off the end', () => {
    render(<Visualizer view={normalize([1, 2], { pointers: { i: 5 } })} />);
    expect(screen.getByText(/out of range/)).toBeInTheDocument();
  });

  it('labels a stack top and bottom', () => {
    render(<Visualizer view={normalize([1, 2], { as: 'stack' })} />);
    expect(screen.getByText('top of stack')).toBeInTheDocument();
    expect(screen.getByText('bottom')).toBeInTheDocument();
  });

  it('handles an empty array without crashing', () => {
    render(<Visualizer view={normalize([])} />);
    expect(screen.getByText(/empty/)).toBeInTheDocument();
  });
});

describe('MatrixViz', () => {
  it('renders every cell and reports the dimensions', () => {
    render(
      <Visualizer
        view={normalize([
          [1, 2, 3],
          [4, 5, 6],
        ])}
      />,
    );
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('2 × 3')).toBeInTheDocument();
  });

  it('gives each cell a row/column accessible name', () => {
    render(<Visualizer view={normalize([[7]])} />);
    expect(screen.getByLabelText('row 0, column 0: 7')).toBeInTheDocument();
  });
});

describe('LinkedListViz', () => {
  const list = { val: 1, next: { val: 2, next: null } };

  it('renders nodes with a null terminator', () => {
    render(<Visualizer view={normalize(list)} />);
    expect(screen.getByText('head')).toBeInTheDocument();
    expect(screen.getByText('null')).toBeInTheDocument();
    expect(screen.getByText('2 nodes')).toBeInTheDocument();
  });

  it('announces a cycle instead of a terminator', () => {
    const a: Record<string, unknown> = { val: 1 };
    const b: Record<string, unknown> = { val: 2 };
    a.next = b;
    b.next = a;
    render(<Visualizer view={normalize(a)} />);
    expect(screen.getByText(/back to node/)).toBeInTheDocument();
    expect(screen.getByText(/contains a cycle/)).toBeInTheDocument();
  });

  it('renders an empty list', () => {
    render(<Visualizer view={normalize({ head: null })} />);
    expect(screen.getByText(/empty list/)).toBeInTheDocument();
  });
});

describe('TreeViz', () => {
  it('renders nodes and reports the height', () => {
    const tree = {
      value: 5,
      left: { value: 3, left: null, right: null },
      right: { value: 8, left: null, right: null },
    };
    const { container } = render(<Visualizer view={normalize(tree)} />);
    // The node label and the summary line both say "5"; scope to the SVG.
    const labels = [...container.querySelectorAll('svg text')].map((t) => t.textContent);
    expect(labels).toEqual(expect.arrayContaining(['5', '3', '8']));
    expect(screen.getByText('3 nodes · height 2')).toBeInTheDocument();
  });

  it('renders an empty tree', () => {
    render(<Visualizer view={normalize({ root: null })} />);
    expect(screen.getByText(/empty tree/)).toBeInTheDocument();
  });
});

describe('GraphViz', () => {
  it('reports node and edge counts and the direction', () => {
    render(<Visualizer view={normalize({ a: ['b'], b: ['a'] })} />);
    expect(screen.getByText('2 nodes · 1 edges · undirected')).toBeInTheDocument();
  });

  it('draws a labelled node per vertex', () => {
    const { container } = render(<Visualizer view={normalize({ a: ['b'], b: ['a'] })} />);
    expect(container.querySelectorAll('circle')).toHaveLength(2);
  });
});

describe('TrieViz', () => {
  it('counts complete words', () => {
    const node = (isEnd: boolean, children: Record<string, unknown> = {}) => ({ isEnd, children });
    const root = node(false, { a: node(false, { t: node(true) }) });
    render(<Visualizer view={normalize(root)} />);
    expect(screen.getByText(/1 word · 2 nodes/)).toBeInTheDocument();
  });
});

describe('HeapViz', () => {
  it('renders both the tree and the backing array', () => {
    render(<Visualizer view={normalize([1, 3, 5, 7], { as: 'heap' })} />);
    expect(screen.getByText(/root is the smallest element/)).toBeInTheDocument();
    expect(screen.getByText('backing array')).toBeInTheDocument();
    expect(screen.getByLabelText('Heap backing array')).toBeInTheDocument();
  });
});

describe('HashMapViz', () => {
  it('reports entry and bucket counts', () => {
    render(<Visualizer view={normalize({ a: 1, b: 2 })} />);
    expect(screen.getByText(/2 entries/)).toBeInTheDocument();
    expect(screen.getByText('a')).toBeInTheDocument();
  });
});

describe('CallStackViz', () => {
  it('renders one row per frame, deepest first', () => {
    const view = normalize(
      [
        { label: 'f(0)', depth: 0 },
        { label: 'f(1)', depth: 1 },
      ],
      { as: 'callstack' },
    );
    render(<Visualizer view={view} />);
    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('f(1)')).toBeInTheDocument();
    expect(screen.getByText(/max depth reached 2/)).toBeInTheDocument();
  });

  it('renders an empty stack', () => {
    render(<Visualizer view={normalize([], { as: 'callstack' })} />);
    expect(screen.getByText(/call stack empty/)).toBeInTheDocument();
  });
});

describe('RawViz', () => {
  it('pretty-prints a value with no structural match', () => {
    render(<Visualizer view={{ kind: 'raw', value: { a: 1 } }} />);
    expect(screen.getByText(/"a": 1/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Layout maths
// ---------------------------------------------------------------------------

describe('layoutTree', () => {
  const leaf = (id: string, value: number): TreeNode => ({ id, value, children: [null, null] });

  it('returns nothing for an empty tree', () => {
    expect(layoutTree(null, true).nodes).toHaveLength(0);
  });

  it('places children below and on the correct side of the parent', () => {
    const root: TreeNode = {
      id: 'r',
      value: 5,
      children: [leaf('l', 3), leaf('r2', 8)],
    };
    const { nodes, edges } = layoutTree(root, true);
    const byId = new Map(nodes.map((n) => [n.node.id, n]));
    expect(byId.get('l')!.x).toBeLessThan(byId.get('r')!.x);
    expect(byId.get('r2')!.x).toBeGreaterThan(byId.get('r')!.x);
    expect(byId.get('l')!.y).toBeGreaterThan(byId.get('r')!.y);
    expect(edges).toHaveLength(2);
  });

  it('reserves a column for a null slot so a lopsided tree looks lopsided', () => {
    const root: TreeNode = { id: 'r', value: 1, children: [null, leaf('c', 2)] };
    const { nodes } = layoutTree(root, true);
    const byId = new Map(nodes.map((n) => [n.node.id, n]));
    expect(byId.get('c')!.x).toBeGreaterThan(byId.get('r')!.x);
  });

  it('centres an n-ary parent over its children', () => {
    const root: TreeNode = {
      id: 'r',
      value: 'x',
      children: [
        { id: 'a', value: 1, children: [] },
        { id: 'b', value: 2, children: [] },
        { id: 'c', value: 3, children: [] },
      ],
    };
    const { nodes } = layoutTree(root, false);
    const byId = new Map(nodes.map((n) => [n.node.id, n]));
    expect(byId.get('r')!.x).toBeCloseTo(byId.get('b')!.x, 0);
  });

  it('is deterministic across calls', () => {
    const root: TreeNode = { id: 'r', value: 1, children: [leaf('a', 2), leaf('b', 3)] };
    expect(layoutTree(root, true)).toEqual(layoutTree(root, true));
  });
});

describe('layoutGraph', () => {
  const nodes = [
    { id: 'a', label: 'a' },
    { id: 'b', label: 'b' },
    { id: 'c', label: 'c' },
  ];
  const edges = [
    { from: 'a', to: 'b' },
    { from: 'b', to: 'c' },
  ];

  it('positions every node inside the viewBox', () => {
    const layout = layoutGraph(nodes, edges);
    expect(layout.nodes).toHaveLength(3);
    for (const n of layout.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(layout.width);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeLessThanOrEqual(layout.height);
    }
  });

  it('is deterministic — the picture must not jitter between frames', () => {
    expect(layoutGraph(nodes, edges)).toEqual(layoutGraph(nodes, edges));
  });

  it('separates nodes rather than stacking them', () => {
    const layout = layoutGraph(nodes, edges);
    const [a, b] = layout.nodes;
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(20);
  });

  it('honours an explicitly pinned position', () => {
    const layout = layoutGraph([{ id: 'x', label: 'x', x: 0.5, y: 0.5 }], []);
    expect(layout.nodes[0].x).toBeCloseTo(layout.width / 2, 0);
  });

  it('handles an empty graph', () => {
    expect(layoutGraph([], []).nodes).toHaveLength(0);
  });
});

describe('layout helpers', () => {
  it('projects a heap array into a binary tree by index arithmetic', () => {
    const tree = heapToTree([1, 2, 3], [undefined, undefined, undefined])!;
    expect(tree.value).toBe(1);
    expect(tree.children[0]?.value).toBe(2);
    expect(tree.children[1]?.value).toBe(3);
  });

  it('returns null for an empty heap', () => {
    expect(heapToTree([], [])).toBeNull();
  });

  it('projects a trie node into a tree node', () => {
    const node = trieToTreeNode({
      id: 'r',
      char: '',
      terminal: false,
      children: [{ id: 'a', char: 'a', terminal: true, children: [] }],
    });
    expect(node.value).toBe('•');
    expect(node.children[0]?.value).toBe('a');
    expect(node.children[0]?.note).toBe('●');
  });

  it('trims an edge back to the node border', () => {
    const t = trimToRadius(0, 0, 100, 0, 10);
    expect(t.x1).toBeCloseTo(10);
    expect(t.x2).toBeCloseTo(90);
  });

  it('leaves a zero-length edge alone', () => {
    expect(trimToRadius(5, 5, 5, 5, 10)).toEqual({ x1: 5, y1: 5, x2: 5, y2: 5 });
  });
});

describe('formatting', () => {
  it('shortens values to fit a cell', () => {
    expect(formatValue(42)).toBe('42');
    expect(formatValue(null)).toBe('∅');
    expect(formatValue(true)).toBe('T');
    expect(formatValue('averylongstring')).toBe('averylo…');
    expect(formatValue([1, 2, 3])).toBe('[3]');
    expect(formatValue(1 / 3)).toBe('0.333');
    expect(formatValue(Infinity)).toBe('∞');
  });

  it('compacts large counts', () => {
    expect(formatCount(950)).toBe('950');
    expect(formatCount(12_400)).toBe('12.4k');
    expect(formatCount(3_200_000)).toBe('3.2M');
  });

  it('formats durations by magnitude', () => {
    expect(formatDuration(0.5)).toBe('0.50 ms');
    expect(formatDuration(12.34)).toBe('12.3 ms');
    expect(formatDuration(2500)).toBe('2.50 s');
  });
});
