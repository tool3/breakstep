import { useState, type ReactNode } from 'react';
import { Button, Empty, Popconfirm, Tooltip } from 'antd';
import {
  CheckCircleFilled,
  CloseCircleFilled,
  CloudUploadOutlined,
  DeleteOutlined,
  LoadingOutlined,
  QuestionCircleOutlined,
  UndoOutlined,
  WarningFilled,
} from '@ant-design/icons';
import type { LeetProblem } from '@/leetcode/types';
import type { Submission, Verdict } from '@/submissions/types';
import styles from './SubmissionsPanel.module.scss';

interface Props {
  /** The problem being solved, or null when an ordinary template is open. */
  problem: LeetProblem | null;
  /** Attempts at this problem, newest first. */
  items: Submission[];
  loading: boolean;
  /** True while a submission is in flight. */
  judging: boolean;
  onSubmit: () => void;
  /** Put a past attempt's code back in the editor. */
  onRestore: (submission: Submission) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onFindProblem: () => void;
}

/** How each verdict reads, in one place, so nothing describes it differently. */
export const VERDICT: Record<Verdict, { label: string; tone: string; icon: ReactNode }> = {
  accepted: { label: 'Accepted', tone: 'pass', icon: <CheckCircleFilled /> },
  'wrong-answer': { label: 'Wrong answer', tone: 'fail', icon: <CloseCircleFilled /> },
  'runtime-error': { label: 'Runtime error', tone: 'error', icon: <WarningFilled /> },
  unjudged: { label: 'Not judged', tone: 'unknown', icon: <QuestionCircleOutlined /> },
};

/**
 * The verdict as a single glyph, for tab labels and list rows.
 *
 * Shape as well as colour: a tick and a cross are still different marks in
 * greyscale, and roughly one reader in twelve needs them to be.
 */
export function VerdictDot({ verdict, title }: { verdict: Verdict; title?: string }) {
  const meta = VERDICT[verdict];
  return (
    <span
      className={styles.dot}
      data-tone={meta.tone}
      title={title ?? meta.label}
      aria-label={meta.label}
    >
      {meta.icon}
    </span>
  );
}

/**
 * `4.0 µs`, `0.42 ms`, `13 ms` — precision where it means something, no further.
 *
 * Three calls on an example-sized input really can land under ten microseconds,
 * and `<0.01 ms` tells you nothing about which of two solutions was quicker.
 */
export function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms === 0) return '0 ms';
  if (ms < 0.01) return `${(ms * 1000).toFixed(1)} µs`;
  if (ms < 10) return `${ms.toFixed(2)} ms`;
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['second', 1000],
  ['minute', 60_000],
  ['hour', 3_600_000],
  ['day', 86_400_000],
];

/** `just now`, `4 min ago`, then the date once it stops being recent. */
export function formatWhen(iso: string, now = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return iso;

  const elapsed = now - then;
  if (elapsed < 45_000) return 'just now';
  if (elapsed >= 6 * 86_400_000) {
    return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  const format = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'narrow' });
  let unit: Intl.RelativeTimeFormatUnit = 'second';
  let size = 1000;
  for (const [candidate, ms] of UNITS) {
    if (elapsed >= ms) {
      unit = candidate;
      size = ms;
    }
  }
  return format.format(-Math.round(elapsed / size), unit);
}

const LANGUAGE_LABEL: Record<string, string> = {
  typescript: 'TS',
  javascript: 'JS',
  python: 'PY',
};

function Metric({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className={styles.metric} title={title}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue}>{value}</span>
    </div>
  );
}

/**
 * What happened when you submitted, and what happened every time before.
 *
 * A verdict is only worth something if you can see what it was decided on, so
 * the cases are here in full — the call, the published answer, and what the code
 * actually returned. The history below it is the record of the problem, and any
 * row can be put back in the editor.
 */
export function SubmissionsPanel({
  problem,
  items,
  loading,
  judging,
  onSubmit,
  onRestore,
  onRemove,
  onClear,
  onFindProblem,
}: Props) {
  /** Which attempt the detail is showing. Defaults to the newest. */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null;

  if (!problem) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Submissions belong to a problem. Open one and your attempts are recorded here."
          />
          <Button onClick={onFindProblem}>Find a problem</Button>
        </div>
      </div>
    );
  }

  const meta = selected ? VERDICT[selected.verdict] : null;

  return (
    <div className={styles.panel}>
      <div className={styles.actions}>
        <Tooltip title="Run the published examples and record the verdict">
          <Button
            className={styles.submit}
            size="small"
            type="primary"
            icon={judging ? <LoadingOutlined /> : <CloudUploadOutlined />}
            disabled={judging}
            onClick={onSubmit}
          >
            {judging ? 'Judging…' : 'Submit'}
          </Button>
        </Tooltip>

        <span className={styles.count}>
          {items.length === 0
            ? 'no attempts yet'
            : `${items.length} attempt${items.length === 1 ? '' : 's'}`}
        </span>

        {items.length > 0 && (
          <Popconfirm
            title="Forget every attempt at this problem?"
            okText="Forget them"
            cancelText="Keep"
            onConfirm={onClear}
          >
            <Button size="small" type="text" icon={<DeleteOutlined />}>
              Clear
            </Button>
          </Popconfirm>
        )}
      </div>

      <div className={styles.scroll}>
        {!selected && (
          <div className={styles.blank}>
            {loading ? (
              'Reading your history…'
            ) : (
              <>
                <p className={styles.blankLead}>Nothing submitted yet.</p>
                <p className={styles.blankBody}>
                  Submit runs your code against the example cases LeetCode publishes for this
                  problem and compares every answer — so the verdict is the same question the judge
                  asks, not a guess from what got printed. Run stays a scratchpad: nothing is
                  recorded until you submit.
                </p>
              </>
            )}
          </div>
        )}

        {selected && meta && (
          <>
            <section className={styles.verdict} data-tone={meta.tone}>
              <div className={styles.verdictHead}>
                <span className={styles.verdictIcon}>{meta.icon}</span>
                <h3 className={styles.verdictLabel}>{meta.label}</h3>
                {selected.total > 0 && (
                  <span className={styles.verdictScore}>
                    {selected.passed}/{selected.total} cases
                  </span>
                )}
                <span className={styles.verdictWhen}>{formatWhen(selected.submittedAt)}</span>
              </div>

              <div className={styles.metrics}>
                <Metric
                  label="run time"
                  value={formatMs(selected.runtimeMs)}
                  title="Time spent on the judged cases alone, with tracing off"
                />
                <Metric
                  label="whole file"
                  value={formatMs(selected.totalMs)}
                  title="Everything the file did, including its own example driver"
                />
                {selected.operations !== undefined && (
                  <Metric
                    label="operations"
                    value={selected.operations.toLocaleString()}
                    title="Counted basic operations — the same number on any machine"
                  />
                )}
                <Metric
                  label="time"
                  value={selected.complexity.time}
                  title="Static estimate, read off the code"
                />
                <Metric
                  label="space"
                  value={selected.complexity.space}
                  title="Static estimate, read off the code"
                />
                {selected.empirical && (
                  <Metric
                    label="measured"
                    value={selected.empirical.time}
                    title="Fitted from the Analyze sweep that was current when you submitted"
                  />
                )}
                {selected.entry && (
                  <Metric
                    label="called"
                    value={`${selected.entry}()`}
                    title="The function the judge called — resolved from your file, not assumed"
                  />
                )}
                <Metric label="language" value={LANGUAGE_LABEL[selected.language] ?? selected.language} />
              </div>

              {selected.error && <p className={styles.error}>{selected.error}</p>}
              {selected.note && <p className={styles.note}>{selected.note}</p>}
            </section>

            {selected.cases.length > 0 && (
              <section className={styles.section}>
                <h4 className={styles.heading}>Cases</h4>
                <ul className={styles.cases}>
                  {selected.cases.map((outcome, i) => (
                    <li
                      key={`${outcome.label}-${i}`}
                      className={styles.case}
                      data-passed={outcome.passed}
                    >
                      <span className={styles.caseMark}>
                        {outcome.passed ? <CheckCircleFilled /> : <CloseCircleFilled />}
                      </span>
                      <div className={styles.caseBody}>
                        <code className={styles.caseIn}>{outcome.label}</code>
                        {outcome.error ? (
                          <span className={styles.caseError}>threw: {outcome.error}</span>
                        ) : outcome.passed ? (
                          <code className={styles.caseOut}>→ {outcome.got}</code>
                        ) : (
                          <>
                            <code className={styles.caseExpected}>
                              expected {outcome.expected}
                            </code>
                            <code className={styles.caseGot}>got {outcome.got}</code>
                          </>
                        )}
                        {outcome.unordered && (
                          <span className={styles.caseNote}>matched once order was ignored</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {items.length > 0 && (
          <section className={styles.section}>
            <h4 className={styles.heading}>History</h4>
            <ul className={styles.history}>
              {items.map((item) => (
                <li key={item.id}>
                  <div className={styles.row} data-selected={item.id === selected?.id}>
                    <button
                      type="button"
                      className={styles.rowButton}
                      onClick={() => setSelectedId(item.id)}
                      aria-current={item.id === selected?.id}
                    >
                      <VerdictDot verdict={item.verdict} />
                      <span className={styles.rowLabel}>{VERDICT[item.verdict].label}</span>
                      <span className={styles.rowScore}>
                        {item.total > 0 ? `${item.passed}/${item.total}` : '—'}
                      </span>
                      <span className={styles.rowTime}>{formatMs(item.runtimeMs)}</span>
                      <span className={styles.rowClass}>{item.complexity.time}</span>
                      <span className={styles.rowLang}>
                        {LANGUAGE_LABEL[item.language] ?? item.language}
                      </span>
                      <span className={styles.rowWhen}>{formatWhen(item.submittedAt)}</span>
                    </button>

                    <Tooltip title="Put this attempt's code back in the editor">
                      <Button
                        size="small"
                        type="text"
                        icon={<UndoOutlined />}
                        onClick={() => onRestore(item)}
                        aria-label={`Restore the code from this ${VERDICT[item.verdict].label.toLowerCase()} attempt`}
                      />
                    </Tooltip>
                    <Tooltip title="Forget this attempt">
                      <Button
                        size="small"
                        type="text"
                        icon={<DeleteOutlined />}
                        onClick={() => onRemove(item.id)}
                        aria-label="Delete this attempt"
                      />
                    </Tooltip>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
