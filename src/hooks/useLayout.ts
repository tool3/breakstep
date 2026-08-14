import { useEffect, useState } from 'react';

/**
 * How the app arranges itself.
 *
 *   desktop  — editor and panels side by side, the full IDE
 *   stacked  — editor above, panels below (tablet portrait: narrow but tall)
 *   compact  — one pane at a time with a bottom tab bar (phones, and any
 *              viewport too short to usefully split, such as a phone in
 *              landscape)
 *
 * Height matters as much as width: a 844×390 phone in landscape is wide enough
 * for a side-by-side split and far too short to survive one.
 */
export type LayoutMode = 'desktop' | 'stacked' | 'compact';

export const BREAKPOINTS = {
  /** Below this, a side-by-side split leaves neither pane usable. */
  sideBySide: 1024,
  /** Below this, even a stacked split is too cramped — go single-pane. */
  stacked: 700,
  /** Any shorter than this and two stacked panes are both unusable. */
  minSplitHeight: 560,
} as const;

export interface LayoutInfo {
  mode: LayoutMode;
  /** True on touch-primary devices, where hit targets must grow. */
  coarsePointer: boolean;
  width: number;
  height: number;
}

function measure(): LayoutInfo {
  if (typeof window === 'undefined') {
    return { mode: 'desktop', coarsePointer: false, width: 1280, height: 800 };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;

  const mode: LayoutMode =
    width < BREAKPOINTS.stacked || height < BREAKPOINTS.minSplitHeight
      ? 'compact'
      : width < BREAKPOINTS.sideBySide
        ? 'stacked'
        : 'desktop';

  return {
    mode,
    coarsePointer: window.matchMedia?.('(pointer: coarse)').matches ?? false,
    width,
    height,
  };
}

export function useLayout(): LayoutInfo {
  const [info, setInfo] = useState<LayoutInfo>(measure);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      // Orientation changes fire a burst of resizes; settle on the last one.
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setInfo(measure()));
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);

    // iOS reports stale dimensions until the visual viewport settles.
    window.visualViewport?.addEventListener('resize', update);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);

  return info;
}
