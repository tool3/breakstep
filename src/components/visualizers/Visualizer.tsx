import { memo } from 'react';
import type { VizView } from '@/types/viz';
import { ArrayViz } from './ArrayViz';
import { CallStackViz } from './CallStackViz';
import { GraphViz } from './GraphViz';
import { HashMapViz } from './HashMapViz';
import { HeapViz } from './HeapViz';
import { LinkedListViz } from './LinkedListViz';
import { MatrixViz } from './MatrixViz';
import { TreeViz } from './TreeViz';
import { TrieViz } from './TrieViz';
import { formatFull } from './format';
import styles from './viz.module.scss';

/** Human-readable name per view kind, used in the frame header. */
export const VIEW_LABEL: Record<VizView['kind'], string> = {
  array: 'Array',
  matrix: 'Matrix',
  linkedList: 'Linked list',
  tree: 'Tree',
  graph: 'Graph',
  trie: 'Trie',
  heap: 'Heap',
  hashmap: 'Hash map',
  callstack: 'Call stack',
  raw: 'Value',
};

function RawViz({ value }: { value: unknown }) {
  return (
    <div className={styles.canvas}>
      <pre className={styles.raw}>{formatFull(value)}</pre>
    </div>
  );
}

/**
 * Single dispatch point from a normalized view to its renderer.
 *
 * The switch is exhaustive over `VizView['kind']`, so adding a structure is a
 * compile error until a visualizer exists for it.
 */
export const Visualizer = memo(function Visualizer({ view }: { view: VizView }) {
  switch (view.kind) {
    case 'array':
      return <ArrayViz view={view} />;
    case 'matrix':
      return <MatrixViz view={view} />;
    case 'linkedList':
      return <LinkedListViz view={view} />;
    case 'tree':
      return <TreeViz view={view} />;
    case 'graph':
      return <GraphViz view={view} />;
    case 'trie':
      return <TrieViz view={view} />;
    case 'heap':
      return <HeapViz view={view} />;
    case 'hashmap':
      return <HashMapViz view={view} />;
    case 'callstack':
      return <CallStackViz view={view} />;
    case 'raw':
      return <RawViz value={view.value} />;
  }
});
