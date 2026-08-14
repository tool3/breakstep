import { useMemo } from 'react';
import { Alert, Button, Progress, Tag, Tooltip } from 'antd';
import { ExperimentOutlined, ReloadOutlined } from '@ant-design/icons';
import { ComplexityChart } from './ComplexityChart';
import { compareComplexity } from '@/analysis';
import { GROWTH_MODELS, project } from '@/analysis/fit';
import { formatCount } from './visualizers/format';
import type { ComplexityClass, ComplexityReport, Template } from '@/types';
import styles from './ComplexityPanel.module.scss';

interface Props {
  report: ComplexityReport | null;
  analyzing: boolean;
  stale: boolean;
  detail: string;
  template: Template;
  onAnalyze: () => void;
}

/** Pretty-print `O(n^2)` with a real superscript. */
export function prettyClass(cls: ComplexityClass): string {
  return cls
    .replace('n^2 log n', 'n² log n')
    .replace('n^2', 'n²')
    .replace('n^3', 'n³')
    .replace('2^n', '2ⁿ')
    .replace('sqrt n', '√n');
}

function confidenceTone(confidence: number): 'success' | 'warning' | 'error' {
  if (confidence >= 0.7) return 'success';
  if (confidence >= 0.45) return 'warning';
  return 'error';
}

export function ComplexityPanel({ report, analyzing, stale, detail, template, onAnalyze }: Props) {
  const empirical = report?.empirical;

  const bestFit = useMemo(
    () => empirical?.ranking.find((r) => r.cls === empirical.best) ?? null,
    [empirical],
  );

  /**
   * Do the two methods agree? Disagreement is genuinely informative — the
   * static pass reads the worst case in the source, the sweep measures the path
   * the parameters actually took — so it gets surfaced rather than hidden.
   */
  const verdict = useMemo(() => {
    if (!report?.static || !empirical || empirical.best === 'unknown') return null;
    const diff = compareComplexity(report.static.time, empirical.best);
    if (diff === 0) return 'agree' as const;
    return diff > 0 ? ('static-higher' as const) : ('static-lower' as const);
  }, [report, empirical]);

  if (!report) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>
          <ExperimentOutlined className={styles.emptyIcon} />
          <span className={styles.emptyTitle}>Complexity analysis</span>
          <p className={styles.emptyHint}>
            Two independent answers to the same question. A static pass reads your source for loop
            nesting, logarithmic patterns and recurrences. Then a benchmark sweep runs your{' '}
            <code>breakstep.bench</code> harness at growing input sizes, counts basic operations and fits
            the growth curve.
          </p>
          <Button type="primary" icon={<ExperimentOutlined />} onClick={onAnalyze}>
            Analyze complexity
          </Button>
        </div>
      </div>
    );
  }

  const stat = report.static;

  return (
    <div className={styles.panel}>
      <div className={styles.scroll}>
        {stale && !analyzing && (
          <Alert
            type="info"
            showIcon
            className={styles.staleAlert}
            message="The code or parameters changed since this analysis."
            action={
              <Button size="small" icon={<ReloadOutlined />} onClick={onAnalyze}>
                Re-analyze
              </Button>
            }
          />
        )}

        {/* --- Headline verdicts ------------------------------------------ */}
        <section className={styles.section}>
          <div className={styles.verdicts}>
            <div className={styles.verdict}>
              <span className={styles.verdictLabel}>Measured time</span>
              <span className={styles.verdictValue}>
                {analyzing && !empirical ? '…' : prettyClass(empirical?.best ?? 'unknown')}
              </span>
              <span className={styles.verdictSub}>
                {empirical && empirical.best !== 'unknown'
                  ? `${Math.round(empirical.confidence * 100)}% confidence from ${empirical.samples.length} sizes`
                  : 'from the benchmark sweep'}
              </span>
            </div>

            <div className={styles.verdict}>
              <span className={styles.verdictLabel}>Static time</span>
              <span className={styles.verdictValue}>{prettyClass(stat.time)}</span>
              <span className={styles.verdictSub}>
                {Math.round(stat.confidence * 100)}% confidence from reading the source
              </span>
            </div>

            <div className={styles.verdict}>
              <span className={styles.verdictLabel}>Static space</span>
              <span className={styles.verdictValue}>{prettyClass(stat.space)}</span>
              <span className={styles.verdictSub}>
                {stat.recursion.detected ? 'includes the call stack' : 'allocations only'}
              </span>
            </div>

            {template.expected && (
              <div className={styles.verdict}>
                <span className={styles.verdictLabel}>Textbook answer</span>
                <span className={styles.verdictValue}>{prettyClass(template.expected.time)}</span>
                <span className={styles.verdictSub}>
                  space {prettyClass(template.expected.space)}
                </span>
              </div>
            )}
          </div>

          {verdict && (
            <Alert
              className={styles.verdictAlert}
              type={verdict === 'agree' ? 'success' : 'warning'}
              showIcon
              message={
                verdict === 'agree'
                  ? `Both methods agree: ${prettyClass(empirical!.best)}.`
                  : verdict === 'static-higher'
                    ? `The source allows ${prettyClass(stat.time)}, but this run measured ${prettyClass(empirical!.best)}.`
                    : `This run measured ${prettyClass(empirical!.best)} — worse than the ${prettyClass(stat.time)} the source suggested.`
              }
              description={
                verdict === 'static-higher'
                  ? 'Static analysis reports the worst case it can see. Your current parameters may be exercising an easier path — or an early exit is doing more work than the shape of the code implies.'
                  : verdict === 'static-lower'
                    ? 'Something costs more at runtime than it looks in the source — a built-in method with a hidden loop, a rehash, or an input shape that defeats an assumption.'
                    : undefined
              }
            />
          )}
        </section>

        {/* --- Static evidence -------------------------------------------- */}
        <section className={styles.section}>
          <h3 className={styles.heading}>What the source says</h3>
          <ul className={styles.notes}>
            {stat.notes.map((note, i) => (
              <li key={i} className={styles.note}>
                {renderInlineCode(note)}
              </li>
            ))}
          </ul>
          <div className={styles.tags}>
            <Tag color="blue">loop depth {stat.maxLoopDepth}</Tag>
            {stat.recursion.detected && (
              <Tag color="purple">
                recursive: {stat.recursion.functions.join(', ')}
                {stat.recursion.halving ? ' (halving)' : ''}
              </Tag>
            )}
            <Tooltip title="How much the heuristics agree. Low confidence means the empirical sweep is the one to trust.">
              <Tag color={confidenceTone(stat.confidence)}>
                confidence {Math.round(stat.confidence * 100)}%
              </Tag>
            </Tooltip>
          </div>
        </section>

        {/* --- Empirical sweep -------------------------------------------- */}
        <section className={styles.section}>
          <h3 className={styles.heading}>What the measurement says</h3>

          {analyzing && !empirical && (
            <div className={styles.progress}>
              <Progress percent={100} status="active" showInfo={false} size="small" />
              <span className={styles.progressText}>
                {detail || 'Sweeping input sizes and counting operations…'}
              </span>
            </div>
          )}

          {empirical?.error && (
            <Alert
              type="warning"
              showIcon
              message="The benchmark could not complete"
              description={empirical.error}
            />
          )}

          {empirical && empirical.samples.length >= 2 && bestFit && (
            <>
              <ComplexityChart
                samples={empirical.samples}
                best={empirical.best}
                coefficient={bestFit.coefficient}
                compare={
                  stat.time !== empirical.best && stat.time !== 'unknown'
                    ? {
                        cls: stat.time,
                        coefficient: coefficientFor(stat.time, empirical.samples),
                      }
                    : null
                }
              />

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                <caption className={styles.tableCaption}>
                  Operation counts are instrumented, not timed — so they are the same on a laptop and
                  a phone. Wall-clock time is shown for reference only.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">n</th>
                    <th scope="col">operations</th>
                    <th scope="col">ops / n</th>
                    <th scope="col">growth ×</th>
                    <th scope="col">time</th>
                  </tr>
                </thead>
                <tbody>
                    {empirical.samples.map((s, i) => {
                    const prev = empirical.samples[i - 1];
                    const growth = prev && prev.operations > 0 ? s.operations / prev.operations : null;
                    return (
                      <tr key={s.n}>
                        <td>{s.n}</td>
                        <td>{s.operations.toLocaleString()}</td>
                        <td>{(s.operations / s.n).toFixed(1)}</td>
                        <td>{growth ? `${growth.toFixed(2)}×` : '—'}</td>
                        <td>{s.ms.toFixed(2)} ms</td>
                      </tr>
                    );
                  })}
                  </tbody>
                </table>
              </div>

              <div className={styles.ranking}>
                <span className={styles.rankingTitle}>Candidate curves, best fit first</span>
                {empirical.ranking.slice(0, 5).map((fit) => (
                  <div key={fit.cls} className={styles.rankRow}>
                    <span className={styles.rankClass}>{prettyClass(fit.cls)}</span>
                    <div className={styles.rankBar}>
                      <div
                        className={fit.cls === empirical.best ? styles.rankFillBest : styles.rankFill}
                        style={{ width: `${Math.max(fit.r2, 0) * 100}%` }}
                      />
                    </div>
                    <span className={styles.rankScore}>{(fit.r2 * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>

              {empirical.best !== 'unknown' && (
                <div className={styles.projection}>
                  <span className={styles.projectionTitle}>Extrapolated from the fit</span>
                  <div className={styles.projectionGrid}>
                    {[1e3, 1e5, 1e6].map((n) => (
                      <div key={n} className={styles.projectionCell}>
                        <span className={styles.projectionN}>n = {formatCount(n)}</span>
                        <span className={styles.projectionOps}>
                          ≈ {formatCount(project(bestFit, n))} ops
                        </span>
                      </div>
                    ))}
                  </div>
                  <span className={styles.projectionNote}>
                    Straight-line extrapolation of the fitted curve. Real machines add cache misses
                    and allocation pressure that this cannot see.
                  </span>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <div className={styles.footer}>
        <Button
          type="primary"
          icon={<ExperimentOutlined />}
          loading={analyzing}
          onClick={onAnalyze}
          block
        >
          {analyzing ? detail || 'Analyzing…' : 'Re-run analysis'}
        </Button>
      </div>
    </div>
  );
}

/** Fit a coefficient for an arbitrary class so it can be drawn for comparison. */
function coefficientFor(cls: ComplexityClass, samples: { n: number; operations: number }[]): number {
  const model = GROWTH_MODELS.find((m) => m.cls === cls);
  if (!model || samples.length === 0) return 0;
  const ratios = samples.map((s) => s.operations / model.fn(s.n)).filter(Number.isFinite);
  if (ratios.length === 0) return 0;
  ratios.sort((a, b) => a - b);
  return ratios[ratios.length >> 1];
}

/** Render `backticked` spans in analyzer notes as inline code. */
function renderInlineCode(text: string) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) =>
    part.startsWith('`') && part.endsWith('`') ? (
      <code key={i}>{part.slice(1, -1)}</code>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}
