import { memo } from 'react';
import type { CellState } from '@/types/viz';
import { formatFull, formatValue } from './format';
import styles from './viz.module.scss';

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

const WHITESPACE_MARK: Record<string, string> = {
  ' ': '·',
  '\t': '⇥',
  '\n': '⏎',
};

export const Cell = memo(function Cell({ value, state, index, note, small }: CellProps) {
  const whitespace = typeof value === 'string' ? WHITESPACE_MARK[value] : undefined;
  const display = whitespace ?? formatValue(value);
  const full = formatFull(value);

  return (
    <div className={styles.slot}>
      <div
        className={[
          styles.cell,
          small ? styles.small : '',
          whitespace ? styles.whitespace : '',
          stateClass(state),
        ]
          .filter(Boolean)
          .join(' ')}
        title={display === full ? undefined : full}
        role="gridcell"
        aria-label={`${index !== undefined ? `index ${index}: ` : ''}${
          whitespace ? 'space' : full
        }${state ? ` (${state})` : ''}`}
      >
        {display}
      </div>
      {note !== undefined && <span className={styles.note}>{note}</span>}
      {index !== undefined && <span className={styles.index}>{index}</span>}
    </div>
  );
});
