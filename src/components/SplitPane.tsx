import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './SplitPane.module.scss';

interface Props {
  first: ReactNode;
  second: ReactNode;
  ratio: number;
  onRatioChange: (ratio: number) => void;
  direction?: 'horizontal' | 'vertical';
  min?: number;
  max?: number;
  stacked?: boolean;
}

export function SplitPane({
  first,
  second,
  ratio,
  onRatioChange,
  direction = 'horizontal',
  min = 20,
  max = 80,
  stacked = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const horizontal = direction === 'horizontal';

  const applyFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const pct = horizontal
        ? ((clientX - rect.left) / rect.width) * 100
        : ((clientY - rect.top) / rect.height) * 100;
      onRatioChange(Math.min(max, Math.max(min, pct)));
    },
    [horizontal, max, min, onRatioChange],
  );

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => applyFromPointer(e.clientX, e.clientY);
    const onUp = () => setDragging(false);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = horizontal ? 'col-resize' : 'row-resize';

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [dragging, applyFromPointer, horizontal]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2;
    const decrease = horizontal ? 'ArrowLeft' : 'ArrowUp';
    const increase = horizontal ? 'ArrowRight' : 'ArrowDown';

    if (e.key === decrease) {
      e.preventDefault();
      onRatioChange(Math.max(min, ratio - step));
    } else if (e.key === increase) {
      e.preventDefault();
      onRatioChange(Math.min(max, ratio + step));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onRatioChange(min);
    } else if (e.key === 'End') {
      e.preventDefault();
      onRatioChange(max);
    }
  };

  if (stacked) {
    return (
      <div className={styles.stacked}>
        <div className={styles.stackedPane}>{first}</div>
        <div className={styles.stackedPane}>{second}</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={horizontal ? styles.horizontal : styles.vertical}
      data-dragging={dragging || undefined}
    >
      <div className={styles.pane} style={{ flexBasis: `${ratio}%` }}>
        {first}
      </div>

      <div
        className={horizontal ? styles.dividerH : styles.dividerV}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
        }}
        onKeyDown={onKeyDown}
        onDoubleClick={() => onRatioChange(50)}
        role="separator"
        aria-orientation={horizontal ? 'vertical' : 'horizontal'}
        aria-valuenow={Math.round(ratio)}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-label="Resize panels"
        tabIndex={0}
      >
        <span className={styles.grip} aria-hidden="true" />
      </div>

      <div className={styles.pane} style={{ flexBasis: `${100 - ratio}%` }}>
        {second}
      </div>
    </div>
  );
}
