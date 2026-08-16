/**
 * The control group for editor scrolling.
 *
 * Same Monaco version, same font, same file the app opens with — and nothing
 * else. If this scrolls smoothly and Breakstep does not, the difference is
 * ours and worth hunting. If both feel the same, the editor is doing what
 * Monaco does on this machine and the search moves elsewhere.
 *
 * Served by the dev server only; `vite build` builds index.html alone.
 */
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import 'monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import { getTemplate, templateSource } from '@/templates';

self.MonacoEnvironment = { getWorker: () => new editorWorker() };

// A long enough file that there is something to scroll through.
const code = [
  templateSource(getTemplate('bst'), 'typescript', 'clean'),
  templateSource(getTemplate('graph'), 'typescript', 'clean'),
  templateSource(getTemplate('trie'), 'typescript', 'clean'),
].join('\n\n');

monaco.editor.create(document.getElementById('host')!, {
  value: code,
  language: 'typescript',
  theme: 'vs-dark',
  fontSize: 13,
  lineHeight: 21,
  fontFamily: "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  minimap: { enabled: false },
  automaticLayout: true,
});
