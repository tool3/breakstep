import { Button, InputNumber, Select, Slider, Switch, Tooltip, Input } from 'antd';
import { InfoCircleOutlined, UndoOutlined } from '@ant-design/icons';
import type { EditorMode, ParamSpec, ParamValues, Template } from '@/types';
import { bindingName } from '@/engine/paramBinding';
import styles from './ParamsPanel.module.scss';

interface Props {
  template: Template;
  values: ParamValues;
  mode: EditorMode;
  /** Parameters whose backing constant still exists in the source. */
  bound?: Set<string>;
  onChange: (name: string, value: unknown) => void;
  onReset: () => void;
}

/** Parse "1, 2, 3" into numbers, ignoring anything that isn't one. */
export function parseNumberArray(text: string): number[] {
  return text
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n));
}

export function parseStringArray(text: string): string[] {
  return text
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * The knobs. Values reach user code through `breakstep.param(name)`, so changing one
 * and pressing Run re-runs the same algorithm against different data — which is
 * the fastest way to see a BST degenerate or a sort's best case disappear.
 */
export function ParamsPanel({ template, values, mode, bound, onChange, onReset }: Props) {
  if (template.params.length === 0) {
    return (
      <div className={styles.panel}>
        <p className={styles.none}>This template takes no parameters.</p>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Parameters</span>
        <Tooltip title="Restore every parameter to the template default">
          <Button size="small" type="text" icon={<UndoOutlined />} onClick={onReset}>
            Reset
          </Button>
        </Tooltip>
      </div>

      <div className={styles.fields}>
        {template.params.map((param) => (
          <Field
            key={param.name}
            param={param}
            value={values[param.name]}
            disabled={bound !== undefined && !bound.has(param.name)}
            onChange={(v) => onChange(param.name, v)}
          />
        ))}
      </div>

      {mode === 'clean' ? (
        <p className={styles.hint}>
          These edit the constants in your code directly — what you read is exactly what runs.
        </p>
      ) : (
        <p className={styles.hint}>
          Read these in your code with <code>breakstep.param('{template.params[0].name}')</code>.
        </p>
      )}
    </div>
  );
}

function Field({
  param,
  value,
  disabled,
  onChange,
}: {
  param: ParamSpec;
  value: unknown;
  disabled?: boolean;
  onChange: (value: unknown) => void;
}) {
  return (
    <div className={disabled ? `${styles.field} ${styles.unbound}` : styles.field}>
      <label className={styles.label} htmlFor={`param-${param.name}`}>
        {param.label}
        {param.help && (
          <Tooltip title={param.help}>
            <InfoCircleOutlined className={styles.info} />
          </Tooltip>
        )}
        {disabled && (
          <Tooltip
            title={`No top-level \`${bindingName(param)}\` constant in the code, so there is nothing to edit. Add it back, or reset the code.`}
          >
            <span className={styles.unboundTag}>unbound</span>
          </Tooltip>
        )}
      </label>
      <div className={styles.control}>
        {renderControl(param, value, onChange, disabled)}
      </div>
    </div>
  );
}

function renderControl(
  param: ParamSpec,
  value: unknown,
  onChange: (v: unknown) => void,
  disabled?: boolean,
) {
  const id = `param-${param.name}`;

  switch (param.type) {
    case 'number': {
      const min = param.min ?? 0;
      const max = param.max ?? 100;
      const useSlider = max - min <= 200;
      return useSlider ? (
        <div className={styles.sliderRow}>
          <Slider
            id={id}
            min={min}
            max={max}
            step={param.step ?? 1}
            value={Number(value)}
            onChange={onChange}
            className={styles.slider}
            disabled={disabled}
          />
          <InputNumber
            size="small"
            min={min}
            max={max}
            step={param.step ?? 1}
            value={Number(value)}
            onChange={(v) => onChange(v ?? min)}
            className={styles.number}
            aria-label={param.label}
            disabled={disabled}
          />
        </div>
      ) : (
        <InputNumber
          id={id}
          size="small"
          min={min}
          max={max}
          step={param.step ?? 1}
          value={Number(value)}
          onChange={(v) => onChange(v ?? min)}
          style={{ width: '100%' }}
          disabled={disabled}
        />
      );
    }

    case 'boolean':
      return (
        <Switch id={id} checked={Boolean(value)} onChange={onChange} size="small" disabled={disabled} />
      );

    case 'select':
      return (
        <Select
          id={id}
          size="small"
          value={value as string}
          onChange={onChange}
          options={param.options}
          style={{ width: '100%' }}
          disabled={disabled}
        />
      );

    case 'numberArray':
      return (
        <Input
          id={id}
          size="small"
          value={Array.isArray(value) ? (value as number[]).join(', ') : ''}
          onChange={(e) => onChange(parseNumberArray(e.target.value))}
          placeholder="1, 2, 3"
          disabled={disabled}
        />
      );

    case 'stringArray':
      return (
        <Input
          id={id}
          size="small"
          value={Array.isArray(value) ? (value as string[]).join(', ') : ''}
          onChange={(e) => onChange(parseStringArray(e.target.value))}
          placeholder="alpha, beta"
          disabled={disabled}
        />
      );

    case 'string':
    default:
      return (
        <Input
          id={id}
          size="small"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      );
  }
}
