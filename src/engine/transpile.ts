import { transform } from 'sucrase';

export interface TranspileResult {
  ok: boolean;
  code: string;
  error?: string;
  line?: number;
}

export function stripTypes(source: string): TranspileResult {
  try {
    const { code } = transform(source, {
      transforms: ['typescript'],
      disableESTransforms: true,
      preserveDynamicImport: true,
    });
    return { ok: true, code };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const match = message.match(/\((\d+):(\d+)\)/);
    return {
      ok: false,
      code: source,
      error: message,
      line: match ? Number(match[1]) : undefined,
    };
  }
}

export function toRunnableJs(source: string, language: 'typescript' | 'javascript'): TranspileResult {
  return language === 'typescript' ? stripTypes(source) : { ok: true, code: source };
}
