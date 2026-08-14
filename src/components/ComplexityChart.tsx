import { useId, useMemo, useState } from 'react';
import { GROWTH_MODELS } from '@/analysis/fit';
import type { BenchmarkSample, ComplexityClass } from '@/types';
import { formatCount } from './visualizers/format';
import styles from './ComplexityChart.module.scss';

interface Props {
  samples: BenchmarkSample[];
  /** The winning class — drawn as a fitted reference curve behind the data. */
  best: ComplexityClass;
  coefficient: number;
  /** Optional second curve for comparison, e.g. the static analyzer's guess. */
  compare?: { cls: ComplexityClass; coefficient: number } | null;
}

const PAD = { top: 18, right: 18, bottom: 34, left: 56 };
const WIDTH = 520;
const HEIGHT = 260;

/**
 * Operation count vs input size, on log–log axes.
 *
 * Log–log is not decoration: on these axes every polynomial is a straight line
 * whose *slope* is its exponent, so "is this linear or quadratic?" becomes a
 * question about the angle of the line rather than about the shape of a curve
 * that runs off the top of the chart.
 */
export function ComplexityChart({ samples, best, coefficient, compare }: Props) {
  const clipId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const usable = samples.filter((s) => s.n > 0 && Number.isFinite(s.operations));

  const scales = useMemo(() => {
    if (usable.length === 0) return null;

    const xs = usable.map((s) => Math.log10(s.n));
    // log10(0) is -Infinity; a zero-op sample sits on the floor of the chart.
    const ys = usable.map((s) => Math.log10(Math.max(s.operations, 1)));

    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMin = Math.min(...ys, 0);
    const yMax = Math.max(...ys);

    const xSpan = Math.max(xMax - xMin, 0.3);
    const ySpan = Math.max(yMax - yMin, 0.5);

    const plotW = WIDTH - PAD.left - PAD.right;
    const plotH = HEIGHT - PAD.top - PAD.bottom;

    return {
      x: (n: number) => PAD.left + ((Math.log10(n) - xMin) / xSpan) * plotW,
      y: (ops: number) =>
        PAD.top + plotH - ((Math.log10(Math.max(ops, 1)) - yMin) / ySpan) * plotH,
      xMin,
      xMax,
      yMin,
      yMax,
      plotW,
      plotH,
    };
  }, [usable]);

  if (!scales || usable.length < 2) {
    return <p className={styles.empty}>Not enough samples to plot.</p>;
  }

  /** Sample a fitted model densely enough to look like a smooth curve. */
  const curveFor = (cls: ComplexityClass, coef: number): string => {
    const model = GROWTH_MODELS.find((m) => m.cls === cls);
    if (!model || !Number.isFinite(coef) || coef <= 0) return '';
    const nMin = Math.pow(10, scales.xMin);
    const nMax = Math.pow(10, scales.xMax);
    const points: string[] = [];
    for (let i = 0; i <= 60; i++) {
      const n = nMin * Math.pow(nMax / nMin, i / 60);
      const ops = coef * model.fn(n);
      if (!Number.isFinite(ops)) continue;
      points.push(`${scales.x(n).toFixed(2)},${scales.y(ops).toFixed(2)}`);
    }
    return points.length ? `M ${points.join(' L ')}` : '';
  };

  const bestCurve = curveFor(best, coefficient);
  const compareCurve = compare ? curveFor(compare.cls, compare.coefficient) : '';

  // One gridline per decade on each axis.
  const xTicks = decadeTicks(scales.xMin, scales.xMax);
  const yTicks = decadeTicks(scales.yMin, scales.yMax);
  const hovered = hover !== null ? usable[hover] : null;

  return (
    <figure className={styles.figure}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Operations against input size on logarithmic axes; measured growth is ${best}`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={PAD.left} y={PAD.top} width={scales.plotW} height={scales.plotH} />
          </clipPath>
        </defs>

        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line
              className={styles.grid}
              x1={PAD.left}
              y1={scales.y(Math.pow(10, t))}
              x2={WIDTH - PAD.right}
              y2={scales.y(Math.pow(10, t))}
            />
            <text
              className={styles.axisLabel}
              x={PAD.left - 8}
              y={scales.y(Math.pow(10, t))}
              textAnchor="end"
              dominantBaseline="central"
            >
              {formatCount(Math.pow(10, t))}
            </text>
          </g>
        ))}

        {xTicks.map((t) => (
          <g key={`x${t}`}>
            <line
              className={styles.grid}
              x1={scales.x(Math.pow(10, t))}
              y1={PAD.top}
              x2={scales.x(Math.pow(10, t))}
              y2={HEIGHT - PAD.bottom}
            />
            <text
              className={styles.axisLabel}
              x={scales.x(Math.pow(10, t))}
              y={HEIGHT - PAD.bottom + 15}
              textAnchor="middle"
            >
              {formatCount(Math.pow(10, t))}
            </text>
          </g>
        ))}

        <g clipPath={`url(#${clipId})`}>
          {compareCurve && <path className={styles.compareCurve} d={compareCurve} />}
          {bestCurve && <path className={styles.fitCurve} d={bestCurve} />}
          <path
            className={styles.dataLine}
            d={`M ${usable.map((s) => `${scales.x(s.n).toFixed(2)},${scales.y(s.operations).toFixed(2)}`).join(' L ')}`}
          />
        </g>

        {usable.map((s, i) => (
          <circle
            key={s.n}
            className={hover === i ? styles.pointActive : styles.point}
            cx={scales.x(s.n)}
            cy={scales.y(s.operations)}
            r={hover === i ? 5.5 : 4}
            onMouseEnter={() => setHover(i)}
          >
            <title>{`n = ${s.n}: ${s.operations.toLocaleString()} ops, ${s.ms.toFixed(2)} ms`}</title>
          </circle>
        ))}

        <text className={styles.axisTitle} x={PAD.left + scales.plotW / 2} y={HEIGHT - 4}>
          input size n →
        </text>
        <text
          className={styles.axisTitle}
          transform={`translate(12, ${PAD.top + scales.plotH / 2}) rotate(-90)`}
        >
          operations →
        </text>
      </svg>

      <figcaption className={styles.caption}>
        <span className={styles.legendRow}>
          <span className={styles.swatchData} /> measured
          <span className={styles.swatchFit} /> fitted {best}
          {compare && (
            <>
              <span className={styles.swatchCompare} /> {compare.cls}
            </>
          )}
        </span>
        <span className={styles.hint}>
          {hovered
            ? `n = ${hovered.n} → ${hovered.operations.toLocaleString()} ops in ${hovered.ms.toFixed(2)} ms`
            : 'Log–log axes: a straight line means a power law, and its slope is the exponent.'}
        </span>
      </figcaption>
    </figure>
  );
}

/** Integer powers of ten spanning the range, capped so the axis stays legible. */
function decadeTicks(min: number, max: number): number[] {
  const lo = Math.floor(min);
  const hi = Math.ceil(max);
  const span = hi - lo;
  const stride = span > 8 ? Math.ceil(span / 6) : 1;
  const out: number[] = [];
  for (let t = lo; t <= hi; t += stride) out.push(t);
  return out;
}
