import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Empty, Segmented, Tooltip } from 'antd';
import { ClearOutlined, CopyOutlined } from '@ant-design/icons';
import { formatDuration } from './visualizers/format';
import type { LogEntry, RunResult, RunStatus } from '@/types';
import styles from './OutputPanel.module.scss';

interface Props {
  logs: LogEntry[];
  result: RunResult | null;
  status: RunStatus;
  detail: string;
  onGoToLine: (line: number) => void;
}

type Filter = 'all' | 'log' | 'warn' | 'error';

export function OutputPanel({ logs, result, status, detail, onGoToLine }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [cleared, setCleared] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedToBottom = useRef(true);

  const visible = useMemo(
    () => (filter === 'all' ? logs : logs.filter((l) => l.level === filter)),
    [logs, filter],
  );

  useEffect(() => {
    if (pinnedToBottom.current) {
      bottomRef.current?.scrollIntoView({ block: 'end' });
    }
  }, [visible.length]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    pinnedToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  const counts = useMemo(
    () => ({
      all: logs.length,
      log: logs.filter((l) => l.level === 'log' || l.level === 'info').length,
      warn: logs.filter((l) => l.level === 'warn').length,
      error: logs.filter((l) => l.level === 'error').length,
    }),
    [logs],
  );

  const copyAll = () => {
    void navigator.clipboard?.writeText(visible.map((l) => l.text).join('\n'));
  };

  const busy = status === 'running' || status === 'preparing';

  const ranButDidNothing =
    status === 'done' &&
    !result?.error &&
    logs.length === 0 &&
    (result?.frames.length ?? 0) === 0;

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <Segmented<Filter>
          size="small"
          value={filter}
          onChange={setFilter}
          options={[
            { label: `All ${counts.all}`, value: 'all' },
            { label: `Logs ${counts.log}`, value: 'log' },
            { label: `Warn ${counts.warn}`, value: 'warn' },
            { label: `Errors ${counts.error}`, value: 'error' },
          ]}
        />
        <div className={styles.toolbarRight}>
          <Tooltip title="Copy output">
            <Button
              size="small"
              type="text"
              icon={<CopyOutlined />}
              onClick={copyAll}
              disabled={visible.length === 0}
              aria-label="Copy output"
            />
          </Tooltip>
          <Tooltip title="Clear the panel (does not re-run)">
            <Button
              size="small"
              type="text"
              icon={<ClearOutlined />}
              onClick={() => setCleared(logs.length)}
              aria-label="Clear output"
            />
          </Tooltip>
        </div>
      </div>

      <div className={styles.scroll} ref={scrollRef} onScroll={onScroll}>
        {busy && detail && <div className={styles.detail}>{detail}</div>}

        {visible.slice(cleared > visible.length ? visible.length : 0).length === 0 && !result?.error ? (
          <div className={styles.empty}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                busy
                  ? 'Running…'
                  : ranButDidNothing
                    ? 'Your code ran, but nothing happened — nothing printed and nothing drawn. Did anything call your function?'
                    : 'No output yet — call console.log() or breakstep.log() and press Run.'
              }
            />
          </div>
        ) : (
          <ol className={styles.list}>
            {visible.map((entry, i) => (
              <li key={i} className={`${styles.line} ${styles[entry.level] ?? ''}`}>
                <span className={styles.time}>{entry.at}ms</span>
                <span className={styles.text}>{entry.text}</span>
              </li>
            ))}
          </ol>
        )}

        {result?.error && (
          <div className={styles.error} role="alert">
            <div className={styles.errorHead}>
              {result.error.line !== undefined ? (
                <button
                  type="button"
                  className={styles.errorLink}
                  onClick={() => onGoToLine(result.error!.line!)}
                >
                  line {result.error.line}
                  {result.error.column !== undefined ? `:${result.error.column}` : ''}
                </button>
              ) : (
                <span className={styles.errorBadge}>error</span>
              )}
              <span>{result.error.message}</span>
            </div>
            {result.error.stack && (
              <details className={styles.stack}>
                <summary>stack trace</summary>
                <pre>{result.error.stack}</pre>
              </details>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {result && (
        <div className={styles.status}>
          <span className={result.status === 'done' ? styles.ok : styles.bad}>
            {result.status === 'done' ? '✓ finished' : '✕ failed'}
          </span>
          <span>{formatDuration(result.durationMs)}</span>
          {result.operations !== undefined && (
            <Tooltip title="Basic operations counted by instrumenting your code. This figure includes work done to build visualization frames — the Analyze tab excludes it.">
              <span>{result.operations.toLocaleString()} ops</span>
            </Tooltip>
          )}
          {result.frames.length > 0 && <span>{result.frames.length} frames</span>}
        </div>
      )}
    </div>
  );
}
