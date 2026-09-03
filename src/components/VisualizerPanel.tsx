import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Select, Slider, Tooltip } from 'antd';
import {
  CaretRightOutlined,
  PauseOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { Visualizer, VIEW_LABEL } from './visualizers/Visualizer';
import type { Frame } from '@/types/viz';
import type { RunStatus } from '@/types';
import styles from './VisualizerPanel.module.scss';

const SPEEDS = [
  { label: '0.25×', value: 1600 },
  { label: '0.5×', value: 800 },
  { label: '1×', value: 400 },
  { label: '2×', value: 200 },
  { label: '4×', value: 100 },
  { label: '8×', value: 50 },
];

const LEGEND: { state: string; label: string; color: string; bg: string }[] = [
  { state: 'active', label: 'current', color: 'var(--breakstep-accent)', bg: 'var(--breakstep-accent-soft)' },
  { state: 'compare', label: 'comparing', color: 'var(--breakstep-amber)', bg: 'var(--breakstep-amber-soft)' },
  { state: 'visited', label: 'visited', color: 'var(--breakstep-violet)', bg: 'var(--breakstep-violet-soft)' },
  { state: 'match', label: 'match / done', color: 'var(--breakstep-mint)', bg: 'var(--breakstep-mint-soft)' },
  { state: 'sorted', label: 'sorted', color: 'var(--breakstep-mint)', bg: 'var(--breakstep-mint-soft)' },
  { state: 'error', label: 'error', color: 'var(--breakstep-red)', bg: 'var(--breakstep-red-soft)' },
];

const LEGEND_SCAN_LIMIT = 80;

function statesUsed(frames: Frame[]): Set<string> {
  const found = new Set<string>();

  const walk = (node: unknown, depth: number) => {
    if (node === null || typeof node !== 'object' || depth > 8) return;

    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }

    for (const [key, value] of Object.entries(node)) {
      if (key === 'state' && typeof value === 'string') found.add(value);
      else walk(value, depth + 1);
    }
  };

  for (const frame of frames.slice(0, LEGEND_SCAN_LIMIT)) walk(frame.view, 0);
  return found;
}

interface Props {
  frames: Frame[];
  status: RunStatus;
  compact?: boolean;
  pinnedFrame?: number | null;
  following?: boolean;
  onRun: () => void;
}

export function VisualizerPanel({ frames, status, compact, pinnedFrame, following, onRun }: Props) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [delay, setDelay] = useState(400);
  const timer = useRef<number | null>(null);
  const wasRunning = useRef(false);

  const total = frames.length;
  const clampedIndex = Math.min(index, Math.max(total - 1, 0));
  const frame: Frame | undefined = frames[clampedIndex];

  useEffect(() => {
    if (status === 'running' || status === 'preparing') {
      wasRunning.current = true;
      setIndex(0);
      setPlaying(false);
      return;
    }
    if (wasRunning.current && status === 'done') {
      wasRunning.current = false;
      setIndex(0);
      setPlaying(!following && total > 1);
    }
  }, [status, total, following]);

  useEffect(() => {
    if (pinnedFrame === null || pinnedFrame === undefined) return;
    setPlaying(false);
    setIndex(pinnedFrame);
  }, [pinnedFrame]);

  useEffect(() => {
    if (!playing || total === 0) return;

    timer.current = window.setTimeout(() => {
      setIndex((prev) => {
        if (prev >= total - 1) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, delay);

    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [playing, index, delay, total]);

  const step = useCallback(
    (by: number) => {
      setPlaying(false);
      setIndex((prev) => Math.min(Math.max(prev + by, 0), Math.max(total - 1, 0)));
    },
    [total],
  );

  const restart = useCallback(() => {
    setIndex(0);
    setPlaying(total > 1);
  }, [total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
      if (target?.closest('.monaco-editor')) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        step(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        step(-1);
      } else if (e.key === ' ' && total > 0) {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, total]);

  const legend = useMemo(() => {
    const used = statesUsed(frames);
    return LEGEND.filter((item) => used.has(item.state));
  }, [frames]);

  const metaEntries = useMemo(
    () => Object.entries(frame?.meta ?? {}).slice(0, compact ? 3 : 6),
    [frame?.meta, compact],
  );

  if (total === 0) {
    const busy = status === 'running' || status === 'preparing';
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>
          <span className={styles.emptyTitle}>
            {busy ? 'Running…' : 'Nothing to visualize yet'}
          </span>
          <p className={styles.emptyHint}>
            Call <code>breakstep.show(value)</code> anywhere in your code to capture a frame. The shape of
            the value picks the visualizer — an array draws as an array, a <code>{'{val, next}'}</code>{' '}
            chain draws as a linked list, an adjacency map draws as a graph.
          </p>
          {!busy && (
            <Button
              type="primary"
              icon={<CaretRightOutlined />}
              onClick={onRun}
              aria-label="Run the code"
            >
              Run the code
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.kind}>{frame ? VIEW_LABEL[frame.view.kind] : ''}</span>
        {following && <span className={styles.following}>following the debugger</span>}
        <span className={styles.label} title={frame?.label}>
          {frame?.label}
        </span>
        {metaEntries.length > 0 && (
          <div className={styles.meta}>
            {metaEntries.map(([key, value]) => (
              <span key={key} className={styles.metaItem}>
                {key} <b>{String(value)}</b>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className={styles.stage}>{frame && <Visualizer view={frame.view} />}</div>

      {legend.length > 0 && (
        <div className={styles.legend} aria-label="Colour key">
          {legend.map((item) => (
            <span key={item.state} className={styles.legendItem}>
              <span
                className={styles.swatch}
                style={{ background: item.bg, borderColor: item.color }}
              />
              {item.label}
            </span>
          ))}
        </div>
      )}

      <div className={styles.controls}>
        <Tooltip title="Previous step (←)">
          <Button
            size="small"
            icon={<StepBackwardOutlined />}
            onClick={() => step(-1)}
            disabled={clampedIndex === 0}
            aria-label="Previous step"
          />
        </Tooltip>

        <Tooltip title={playing ? 'Pause (space)' : 'Play (space)'}>
          <Button
            size="small"
            type="primary"
            icon={playing ? <PauseOutlined /> : <CaretRightOutlined />}
            onClick={() => (clampedIndex >= total - 1 ? restart() : setPlaying((p) => !p))}
            aria-label={playing ? 'Pause' : 'Play'}
          />
        </Tooltip>

        <Tooltip title="Next step (→)">
          <Button
            size="small"
            icon={<StepForwardOutlined />}
            onClick={() => step(1)}
            disabled={clampedIndex >= total - 1}
            aria-label="Next step"
          />
        </Tooltip>

        <Tooltip title="Back to the first frame">
          <Button size="small" icon={<UndoOutlined />} onClick={restart} aria-label="Restart" />
        </Tooltip>

        <div className={styles.scrubber}>
          <Slider
            min={0}
            max={Math.max(total - 1, 0)}
            value={clampedIndex}
            onChange={(v) => {
              setPlaying(false);
              setIndex(v);
            }}
            tooltip={{ formatter: (v) => frames[v ?? 0]?.label ?? '' }}
            aria-label="Timeline"
          />
        </div>

        {!compact && (
          <Select
            size="small"
            className={styles.speed}
            value={delay}
            onChange={setDelay}
            options={SPEEDS}
            aria-label="Playback speed"
          />
        )}

        <span className={styles.counter}>
          {clampedIndex + 1} / {total}
        </span>
      </div>
    </div>
  );
}
