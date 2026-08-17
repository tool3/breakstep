import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useWorkspace } from './useWorkspace';
import { THEMES, useTheme } from './useTheme';
import {
  STORAGE_PREFIX,
  readStored,
  removeStored,
  useLocalStorage,
  writeStored,
} from './useLocalStorage';
import { DEFAULT_TEMPLATE_ID, defaultParams, getTemplate, templateSource } from '@/templates';

/**
 * The engine talks to Web Workers, which jsdom does not provide. The transport
 * is covered end to end by `scripts/smoke.mjs` in a real browser; here it is
 * replaced so the state machine around it can be tested in isolation.
 */
const runMock = vi.fn();
const benchMock = vi.fn();
const cancelMock = vi.fn();
const disposeMock = vi.fn();

vi.mock('@/engine/runner', () => ({
  createEngine: () => ({
    run: runMock,
    bench: benchMock,
    cancel: cancelMock,
    dispose: disposeMock,
  }),
  PYTHON_BENCH_SIZES: [8, 16, 32],
}));

const doneResult = {
  status: 'done' as const,
  logs: [{ level: 'log' as const, text: 'hi', at: 1 }],
  frames: [{ id: 0, label: 'f', view: { kind: 'raw' as const, value: 1 } }],
  durationMs: 5,
  operations: 42,
};

beforeEach(() => {
  // Node 26 defines its own inert `localStorage` global that shadows jsdom's,
  // so always go through `window` — exactly as the hook itself does.
  window.localStorage.clear();
  vi.clearAllMocks();
  runMock.mockResolvedValue(doneResult);
  benchMock.mockResolvedValue({
    samples: [{ n: 8, operations: 8, ms: 1 }],
    ranking: [],
    best: 'O(n)',
    confidence: 0.9,
  });
});

describe('useLocalStorage', () => {
  it('round-trips a value', () => {
    writeStored('k', { a: 1 });
    expect(readStored('k', null)).toEqual({ a: 1 });
    removeStored('k');
    expect(readStored('k', 'fallback')).toBe('fallback');
  });

  it('namespaces its keys', () => {
    writeStored('theme', 'dark');
    expect(window.localStorage.getItem(`${STORAGE_PREFIX}theme`)).toBe('"dark"');
  });

  it('falls back when the stored value is corrupt', () => {
    window.localStorage.setItem(`${STORAGE_PREFIX}broken`, '{not json');
    expect(readStored('broken', 'safe')).toBe('safe');
  });

  it('persists updates from the hook', () => {
    const { result } = renderHook(() => useLocalStorage('count', 0));
    act(() => result.current[1](7));
    expect(result.current[0]).toBe(7);
    expect(readStored('count', 0)).toBe(7);
  });

  it('supports functional updates', () => {
    const { result } = renderHook(() => useLocalStorage('count', 1));
    act(() => result.current[1]((prev) => prev + 4));
    expect(result.current[0]).toBe(5);
  });
});

describe('useTheme', () => {
  it('defaults to midnight and writes the document attribute', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('graphite');
    expect(result.current.isDark).toBe(true);
    expect(document.documentElement.dataset.theme).toBe('graphite');
  });

  it('selects any of the shipped themes', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme('midnight'));
    expect(result.current.theme).toBe('midnight');
    expect(result.current.isDark).toBe(true);
    expect(document.documentElement.dataset.theme).toBe('midnight');
    expect(readStored('theme', 'graphite')).toBe('midnight');
  });

  it('toggles between the dark default and light', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.toggle());
    expect(result.current.theme).toBe('light');
    expect(result.current.isDark).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.theme).toBe('graphite');
  });

  it.each(['dark', 'slate'])('falls back to the default for a retired theme (%s)', (stored) => {
    // 'dark' came from an early build; 'slate' was replaced by Graphite. Either
    // one left in storage must not leave the app with no tokens.
    writeStored('theme', stored);
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('graphite');
  });

  it('keeps a theme colour for every entry', () => {
    for (const t of THEMES) {
      expect(t.chrome).toMatch(/^#[0-9a-f]{6}$/i);
      expect(t.label.length).toBeGreaterThan(0);
    }
  });
});

describe('useWorkspace', () => {
  it('starts on the default template with its pristine source', () => {
    const { result } = renderHook(() => useWorkspace());
    expect(result.current.templateId).toBe(DEFAULT_TEMPLATE_ID);
    expect(result.current.language).toBe('typescript');
    expect(result.current.code).toBe(templateSource(getTemplate(DEFAULT_TEMPLATE_ID), 'typescript'));
    expect(result.current.params).toEqual(defaultParams(getTemplate(DEFAULT_TEMPLATE_ID)));
    expect(result.current.isDirty).toBe(false);
  });

  it('marks the workspace dirty once the code is edited', () => {
    const { result } = renderHook(() => useWorkspace());
    act(() => result.current.setCode('// mine'));
    expect(result.current.code).toBe('// mine');
    expect(result.current.isDirty).toBe(true);
  });

  it('restores edits when returning to a template', () => {
    const { result } = renderHook(() => useWorkspace());
    act(() => result.current.setCode('// edited'));
    act(() => result.current.selectTemplate('trie'));
    expect(result.current.code).not.toBe('// edited');
    act(() => result.current.selectTemplate(DEFAULT_TEMPLATE_ID));
    expect(result.current.code).toBe('// edited');
  });

  it('keeps edits separate per language', () => {
    const { result } = renderHook(() => useWorkspace());
    act(() => result.current.setCode('// ts version'));
    act(() => result.current.setLanguage('python'));
    expect(result.current.code).toBe(templateSource(getTemplate(DEFAULT_TEMPLATE_ID), 'python'));
    act(() => result.current.setLanguage('typescript'));
    expect(result.current.code).toBe('// ts version');
  });

  it('restores the pristine source on reset', () => {
    const { result } = renderHook(() => useWorkspace());
    act(() => result.current.setCode('// edited'));
    act(() => result.current.resetCode());
    expect(result.current.isDirty).toBe(false);
    expect(result.current.code).toBe(templateSource(getTemplate(DEFAULT_TEMPLATE_ID), 'typescript'));
  });

  it('updates and resets parameters', () => {
    const { result } = renderHook(() => useWorkspace());
    act(() => result.current.setParam('target', 99));
    expect(result.current.params.target).toBe(99);
    act(() => result.current.resetParams());
    expect(result.current.params).toEqual(defaultParams(getTemplate(DEFAULT_TEMPLATE_ID)));
  });

  it('runs and stores frames, logs and status', async () => {
    const { result } = renderHook(() => useWorkspace());
    act(() => result.current.run());
    await waitFor(() => expect(result.current.status).toBe('done'));

    expect(runMock).toHaveBeenCalledOnce();
    expect(result.current.frames).toHaveLength(1);
    expect(result.current.logs[0].text).toBe('hi');
    expect(result.current.result?.operations).toBe(42);
  });

  it('reports an error status when the run fails', async () => {
    runMock.mockResolvedValue({
      status: 'error',
      logs: [],
      frames: [],
      durationMs: 1,
      error: { message: 'boom' },
    });
    const { result } = renderHook(() => useWorkspace());
    act(() => result.current.run());
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.result?.error?.message).toBe('boom');
  });

  it('shows the static verdict immediately, then the empirical one', async () => {
    const { result } = renderHook(() => useWorkspace());
    act(() => result.current.analyze());

    // Static analysis is synchronous, so it must be present before the sweep.
    expect(result.current.analysis?.static.time).toBe('O(n)');
    expect(result.current.analyzing).toBe(true);

    await waitFor(() => expect(result.current.analyzing).toBe(false));
    expect(result.current.analysis?.empirical?.best).toBe('O(n)');
    expect(result.current.analysisStale).toBe(false);
  });

  it('marks the analysis stale when the code changes', async () => {
    const { result } = renderHook(() => useWorkspace());
    act(() => result.current.analyze());
    await waitFor(() => expect(result.current.analysisStale).toBe(false));
    act(() => result.current.setCode('// changed'));
    expect(result.current.analysisStale).toBe(true);
  });

  it('marks the analysis stale when a parameter changes', async () => {
    const { result } = renderHook(() => useWorkspace());
    act(() => result.current.analyze());
    await waitFor(() => expect(result.current.analysisStale).toBe(false));
    act(() => result.current.setParam('target', 1));
    expect(result.current.analysisStale).toBe(true);
  });

  it('clears previous results when the template changes', async () => {
    const { result } = renderHook(() => useWorkspace());
    act(() => result.current.run());
    await waitFor(() => expect(result.current.frames).toHaveLength(1));

    act(() => result.current.selectTemplate('heap'));
    expect(result.current.frames).toHaveLength(0);
    expect(result.current.logs).toHaveLength(0);
    expect(result.current.result).toBeNull();
    expect(result.current.analysis).toBeNull();
  });

  it('reports preparing while Python boots', () => {
    runMock.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useWorkspace());
    act(() => result.current.setLanguage('python'));
    act(() => result.current.run());
    expect(result.current.status).toBe('preparing');
  });

  it('surfaces worker progress messages', async () => {
    runMock.mockImplementation(async (options: { onProgress?: (u: unknown) => void }) => {
      options.onProgress?.({ detail: 'Downloading Python runtime…' });
      return new Promise(() => {});
    });
    const { result } = renderHook(() => useWorkspace());
    act(() => result.current.run());
    await waitFor(() => expect(result.current.detail).toBe('Downloading Python runtime…'));
  });

  it('cancels an in-flight run', () => {
    runMock.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useWorkspace());
    act(() => result.current.run());
    act(() => result.current.cancel());
    expect(cancelMock).toHaveBeenCalledOnce();
    expect(result.current.status).toBe('cancelled');
  });

  it('disposes the workers on unmount', () => {
    const { unmount } = renderHook(() => useWorkspace());
    unmount();
    expect(disposeMock).toHaveBeenCalledOnce();
  });

  it('remembers the template and language across sessions', () => {
    const first = renderHook(() => useWorkspace());
    act(() => first.result.current.selectTemplate('graph'));
    act(() => first.result.current.setLanguage('python'));
    first.unmount();

    const second = renderHook(() => useWorkspace());
    expect(second.result.current.templateId).toBe('graph');
    expect(second.result.current.language).toBe('python');
  });
});
