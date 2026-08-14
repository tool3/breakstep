/**
 * TypeScript → JavaScript, in the browser, with no tsc in the bundle.
 *
 * Sucrase only strips types (no type-checking, no downlevelling), which is
 * exactly right here: Monaco already surfaces type errors in the gutter, and we
 * target modern browsers, so anything beyond erasure is wasted bytes.
 */
import { transform } from 'sucrase';

export interface TranspileResult {
  ok: boolean;
  code: string;
  error?: string;
  /** 1-based line of the syntax error, when Sucrase reports one. */
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

/** Prepare source for execution: erase types for TS, pass JS straight through. */
export function toRunnableJs(source: string, language: 'typescript' | 'javascript'): TranspileResult {
  return language === 'typescript' ? stripTypes(source) : { ok: true, code: source };
}
