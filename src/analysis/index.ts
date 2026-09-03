import type { Language, StaticComplexity } from '@/types';
import { analyzeJs } from './staticJs';
import { analyzePython } from './staticPy';
import { stripTypes } from '@/engine/transpile';

export * from './fit';
export { analyzeJs } from './staticJs';
export { analyzePython } from './staticPy';
export { compareComplexity, maxComplexity } from './staticJs';

export function analyzeStatic(source: string, language: Language): StaticComplexity {
  if (language === 'python') return analyzePython(source);
  if (language === 'typescript') {
    const stripped = stripTypes(source);
    if (!stripped.ok) {
      return {
        time: 'unknown',
        space: 'unknown',
        confidence: 0,
        notes: [stripped.error ?? 'Could not compile TypeScript.'],
        maxLoopDepth: 0,
        recursion: { detected: false, functions: [] },
      };
    }
    return analyzeJs(stripped.code);
  }
  return analyzeJs(source);
}
