import { memo } from 'react';
import type { CellState } from '@/types/viz';
import { formatFull, formatValue } from './format';
import styles from './viz.module.scss';

/** One `CellState` → one class, shared by every HTML-based visualizer. */
export const STATE_CLASS: Record<CellState, string> = {
  default: '',
  active: styles.stateActive,
  compare: styles.stateCompare,
  visited: styles.stateVisited,
  match: styles.stateMatch,
  sorted: styles.stateSorted,
  muted: styles.stateMuted,
  error: styles.stateError,
};

/** SVG equivalent, for the tree/graph/trie visualizers. */
export const NODE_STATE_CLASS: Record<CellState, string> = {
  default: '',
  active: styles.nodeActive,
  compare: styles.nodeCompare,
  visited: styles.nodeVisited,
  match: styles.nodeMatch,
  sorted: styles.nodeMatch,
  muted: styles.nodeMuted,
  error: styles.nodeError,
};

export function stateClass(state: CellState | undefined): string {
  return state ? STATE_CLASS[state] : '';
}

export function nodeStateClass(state: CellState | undefined): string {
  return state ? NODE_STATE_CLASS[state] : '';
}

interface CellProps {
  value: unknown;
  state?: CellState;
  index?: number;
  note?: string;
  small?: boolean;
}

export const Cell = memo(function Cell({ value, state, index, note, small }: CellProps) {
  const display = formatValue(value);
  const full = formatFull(value);

  return (
    <div className={styles.slot}>
      <div
        className={[styles.cell, small ? styles.small : '', stateClass(state)].filter(Boolean).join(' ')}
        // The truncated display is unreadable for long values; the title is the
        // escape hatch, and it doubles as the accessible name.
        title={display === full ? undefined : full}
        role="gridcell"
        aria-label={`${index !== undefined ? `index ${index}: ` : ''}${full}${state ? ` (${state})` : ''}`}
      >
        {display}
      </div>
      {note !== undefined && <span className={styles.note}>{note}</span>}
      {index !== undefined && <span className={styles.index}>{index}</span>}
    </div>
  );
});
