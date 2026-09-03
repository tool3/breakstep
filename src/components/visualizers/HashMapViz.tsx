import { memo } from 'react';
import type { HashMapView } from '@/types/viz';
import { stateClass } from './Cell';
import { formatFull, formatValue } from './format';
import styles from './viz.module.scss';

export const HashMapViz = memo(function HashMapViz({ view }: { view: HashMapView }) {
  const { buckets } = view;
  const total = buckets.reduce((sum, b) => sum + b.entries.length, 0);
  const collisions = buckets.filter((b) => b.entries.length > 1).length;

  if (total === 0) {
    return (
      <div className={styles.canvas}>
        <span className={styles.caption}>empty map</span>
      </div>
    );
  }

  return (
    <div className={styles.canvas}>
      <div className={styles.scrollArea}>
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 260 }}
          role="list"
          aria-label={`Hash map with ${total} entries in ${buckets.length} buckets`}
        >
          {buckets.map((bucket) => (
            <div key={bucket.index} className={styles.bucket} role="listitem">
              <span className={styles.bucketIndex}>{bucket.index}</span>
              {bucket.entries.length === 0 ? (
                <span className={styles.emptyBucket}>—</span>
              ) : (
                bucket.entries.map((entry, i) => (
                  <div
                    key={i}
                    className={[styles.entry, stateClass(entry.state)].filter(Boolean).join(' ')}
                    title={`${formatFull(entry.key)} → ${formatFull(entry.value)}`}
                  >
                    <span className={styles.entryKey}>{formatValue(entry.key, 10)}</span>
                    <span className={styles.entrySep}>→</span>
                    <span>{formatValue(entry.value, 10)}</span>
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      </div>
      <span className={styles.caption}>
        {total} entries · {buckets.length} buckets
        {collisions > 0 && ` · ${collisions} bucket${collisions === 1 ? '' : 's'} with a collision`}
      </span>
      {view.synthetic && (
        <span className={styles.caption} style={{ textTransform: 'none' }}>
          Buckets are illustrative — the real engine picks its own layout.
        </span>
      )}
    </div>
  );
});
