import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { BREAKPOINTS, useLayout } from './useLayout';

/** Resize the jsdom window and fire the event the hook listens for. */
function resize(width: number, height: number, coarse = false) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('coarse') ? coarse : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  }));
  window.dispatchEvent(new Event('resize'));
}

/** The hook debounces through rAF; jsdom needs a tick to run it. */
async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
}

afterEach(() => {
  resize(1280, 800);
});

describe('useLayout', () => {
  it.each([
    ['iPhone SE', 375, 667, 'compact'],
    ['Galaxy S8', 360, 740, 'compact'],
    ['iPhone 14', 390, 844, 'compact'],
    ['iPhone 14 Pro Max', 430, 932, 'compact'],
    ['Surface Duo', 540, 720, 'compact'],
    ['iPad mini portrait', 744, 1133, 'stacked'],
    ['iPad portrait', 820, 1180, 'stacked'],
    ['iPad Pro 12.9 portrait', 1024, 1366, 'desktop'],
    ['iPad landscape', 1180, 820, 'desktop'],
    ['Laptop', 1440, 900, 'desktop'],
    ['Ultrawide', 2560, 1080, 'desktop'],
  ])('%s (%ix%i) uses the %s layout', async (_name, width, height, expected) => {
    resize(width, height);
    const { result } = renderHook(() => useLayout());
    await settle();
    expect(result.current.mode).toBe(expected);
  });

  it('falls back to compact on a short viewport, however wide', async () => {
    // A phone in landscape: plenty of width, no height to split.
    resize(844, 390);
    const { result } = renderHook(() => useLayout());
    await settle();
    expect(result.current.mode).toBe('compact');
  });

  it('reacts to a rotation', async () => {
    resize(390, 844);
    const { result } = renderHook(() => useLayout());
    await settle();
    expect(result.current.mode).toBe('compact');

    resize(1180, 820);
    await settle();
    expect(result.current.mode).toBe('desktop');
  });

  it('reports a coarse pointer when the device has one', async () => {
    resize(390, 844, true);
    const { result } = renderHook(() => useLayout());
    await settle();
    expect(result.current.coarsePointer).toBe(true);
  });

  it('exposes the breakpoints it decided with', () => {
    expect(BREAKPOINTS.sideBySide).toBeGreaterThan(BREAKPOINTS.stacked);
    expect(BREAKPOINTS.minSplitHeight).toBeGreaterThan(0);
  });

  it('places the boundaries exactly where documented', async () => {
    const { result, rerender } = renderHook(() => useLayout());

    resize(BREAKPOINTS.sideBySide, 900);
    await settle();
    rerender();
    expect(result.current.mode).toBe('desktop');

    resize(BREAKPOINTS.sideBySide - 1, 900);
    await settle();
    rerender();
    expect(result.current.mode).toBe('stacked');

    resize(BREAKPOINTS.stacked - 1, 900);
    await settle();
    rerender();
    expect(result.current.mode).toBe('compact');
  });
});
