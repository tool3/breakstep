export function formatValue(value: unknown, max = 8): string {
  if (value === null) return '∅';
  if (value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'T' : 'F';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return value > 0 ? '∞' : '-∞';
    if (Number.isInteger(value)) return String(value);
    return String(Number(value.toFixed(3)));
  }
  if (typeof value === 'string') return value.length > max ? `${value.slice(0, max - 1)}…` : value;
  if (Array.isArray(value)) return `[${value.length}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 1) return formatValue(entries[0][1], max);
    return `{${entries.length}}`;
  }
  return String(value);
}

export function formatFull(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return '∞';
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e4) return `${(value / 1e3).toFixed(1)}k`;
  return String(Math.round(value));
}

export function formatDuration(ms: number): string {
  if (ms < 1) return `${ms.toFixed(2)} ms`;
  if (ms < 1000) return `${ms.toFixed(1)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}
