import { useEffect, useState } from 'react';

export type LayoutMode = 'desktop' | 'stacked' | 'compact';

export const BREAKPOINTS = {
  sideBySide: 1024,
  stacked: 700,
  minSplitHeight: 560,
} as const;

export interface LayoutInfo {
  mode: LayoutMode;
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
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setInfo(measure()));
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);

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
