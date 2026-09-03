import { memo } from 'react';
import type { MatrixView } from '@/types/viz';
import { stateClass } from './Cell';
import { formatValue } from './format';
import styles from './viz.module.scss';

export const MatrixViz = memo(function MatrixViz({ view }: { view: MatrixView }) {
  const { rows } = view;
  const cols = Math.max(0, ...rows.map((r) => r.length));

  if (rows.length === 0) {
    return (
      <div className={styles.canvas}>
        <span className={styles.caption}>empty matrix</span>
      </div>
    );
  }

  const widest = Math.max(rows.length, cols);
  const size = widest > 28 ? 18 : widest > 20 ? 24 : widest > 14 ? 30 : widest > 9 ? 38 : 44;
  const fontSize = size < 24 ? 9 : size < 34 ? 10 : 12;
  const showLabels = size >= 30;

  return (
    <div className={styles.canvas}>
      <div className={styles.scrollArea}>
        <div>
          {showLabels && (
            <div className={styles.matrixRow} aria-hidden="true">
              <span className={styles.rowLabel} />
              {Array.from({ length: cols }, (_, c) => (
                <span key={c} className={styles.index} style={{ width: size, textAlign: 'center' }}>
                  {c}
                </span>
              ))}
            </div>
          )}
          <div className={styles.matrix} role="grid" aria-label={`${rows.length} by ${cols} matrix`}>
            {rows.map((row, r) => (
              <div key={r} className={styles.matrixRow} role="row">
                {showLabels && <span className={styles.rowLabel}>{r}</span>}
                {row.map((cell, c) => (
                  <div
                    key={c}
                    role="gridcell"
                    aria-label={`row ${r}, column ${c}: ${formatValue(cell.value, 24)}`}
                    className={[styles.cell, stateClass(cell.state)].filter(Boolean).join(' ')}
                    style={{ minWidth: size, width: size, height: size, fontSize }}
                  >
                    {formatValue(cell.value, size < 30 ? 3 : 6)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <span className={styles.caption}>
        {rows.length} × {cols}
      </span>
    </div>
  );
});
