/**
 * The debugger, driven over a recorded run.
 *
 * Because the recording already exists by the time this hook sees it, every
 * command is a search through an array rather than a round trip to a paused
 * runtime. That is what makes `stepBack` possible at all, and it is why the
 * controls stay responsive on a phone.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DebugStep, FunctionInfo, StepCommand } from '@/types/debug';

export interface DebuggerState {
  /** True once a debug run has been recorded and handed over. */
  active: boolean;
  steps: DebugStep[];
  index: number;
  step: DebugStep | null;
  functions: FunctionInfo[];

  /** Functions whose entry the debugger should stop at — the per-function switches. */
  breakFunctions: Set<string>;
  /** Line numbers with a breakpoint, set from the editor gutter. */
  breakpoints: Set<number>;

  /** Auto-advancing until the next break. */
  playing: boolean;
  /** The frame the visualizer should show at this point in the recording. */
  frameIndex: number | null;

  begin: (steps: DebugStep[], functions: FunctionInfo[]) => void;
  end: () => void;
  seek: (index: number) => void;
  run: (command: StepCommand) => void;
  play: () => void;
  pause: () => void;
  toggleFunction: (qualified: string) => void;
  setAllFunctions: (on: boolean) => void;
  toggleBreakpoint: (line: number) => void;
  clearBreakpoints: () => void;
}

const PLAY_INTERVAL_MS = 220;

export function useDebugger(): DebuggerState {
  const [steps, setSteps] = useState<DebugStep[]>([]);
  const [functions, setFunctions] = useState<FunctionInfo[]>([]);
  const [index, setIndex] = useState(0);
  const [active, setActive] = useState(false);
  const [playing, setPlaying] = useState(false);

  const [breakFunctions, setBreakFunctions] = useState<Set<string>>(new Set());
  const [breakpoints, setBreakpoints] = useState<Set<number>>(new Set());

  const timer = useRef<number | null>(null);

  const step = steps[index] ?? null;

  /**
   * Should the debugger stop here?
   *
   * A function only breaks when its switch is on — that is the whole point of
   * the switches. With everything off, `continue` runs to the end and the
   * visualizer simply plays through, which is the default the user sees.
   */
  const isBreak = useCallback(
    (candidate: DebugStep): boolean => {
      if (breakpoints.has(candidate.line)) return true;
      if (candidate.kind !== 'entry' || !candidate.fn) return false;

      if (breakFunctions.has(candidate.fn)) return true;
      // Methods are listed as `Class.method`; the recording only knows `method`.
      return [...breakFunctions].some((name) => name.endsWith(`.${candidate.fn}`));
    },
    [breakFunctions, breakpoints],
  );

  const begin = useCallback((next: DebugStep[], fns: FunctionInfo[]) => {
    setSteps(next);
    setFunctions(fns);
    setIndex(0);
    setActive(next.length > 0);
    setPlaying(false);
  }, []);

  const end = useCallback(() => {
    setActive(false);
    setPlaying(false);
    setSteps([]);
    setIndex(0);
  }, []);

  const seek = useCallback(
    (next: number) => {
      setPlaying(false);
      const total = steps.length;
      setIndex(total === 0 ? 0 : Math.min(Math.max(next, 0), total - 1));
    },
    [steps.length],
  );

  const run = useCallback(
    (command: StepCommand) => {
      setPlaying(false);
      setIndex((current) => {
        const total = steps.length;
        if (total === 0) return 0;

        const here = steps[current];
        const clamp = (n: number) => Math.min(Math.max(n, 0), total - 1);

        switch (command) {
          case 'restart':
            return 0;

          case 'stepBack':
            return clamp(current - 1);

          case 'stepInto':
            return clamp(current + 1);

          case 'stepOver': {
            // Skip anything deeper than here: a call runs to completion.
            for (let i = current + 1; i < total; i++) {
              if (steps[i].depth <= here.depth) return i;
            }
            return total - 1;
          }

          case 'stepOut': {
            for (let i = current + 1; i < total; i++) {
              if (steps[i].depth < here.depth) return i;
            }
            return total - 1;
          }

          case 'continue': {
            for (let i = current + 1; i < total; i++) {
              if (isBreak(steps[i])) return i;
            }
            return total - 1;
          }

          default:
            return current;
        }
      });
    },
    [steps, isBreak],
  );

  const play = useCallback(() => setPlaying(true), []);
  const pause = useCallback(() => setPlaying(false), []);

  // Auto-advance, stopping at the next break the way a real "continue" would.
  useEffect(() => {
    if (!playing || steps.length === 0) return;

    timer.current = window.setTimeout(() => {
      setIndex((current) => {
        const next = current + 1;
        if (next >= steps.length) {
          setPlaying(false);
          return current;
        }
        if (isBreak(steps[next])) setPlaying(false);
        return next;
      });
    }, PLAY_INTERVAL_MS);

    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [playing, index, steps, isBreak]);

  const toggleFunction = useCallback((qualified: string) => {
    setBreakFunctions((prev) => {
      const next = new Set(prev);
      if (next.has(qualified)) next.delete(qualified);
      else next.add(qualified);
      return next;
    });
  }, []);

  const setAllFunctions = useCallback(
    (on: boolean) => {
      setBreakFunctions(on ? new Set(functions.map((f) => f.qualified)) : new Set());
    },
    [functions],
  );

  const toggleBreakpoint = useCallback((line: number) => {
    setBreakpoints((prev) => {
      const next = new Set(prev);
      if (next.has(line)) next.delete(line);
      else next.add(line);
      return next;
    });
  }, []);

  const clearBreakpoints = useCallback(() => setBreakpoints(new Set()), []);

  /**
   * The picture as of this step. Statement steps carry the frame index of the
   * last picture drawn, so the canvas holds still while you walk lines and
   * moves when the structure does.
   */
  const frameIndex = useMemo(() => step?.frame ?? null, [step]);

  /**
   * Memoised, because this object is a dependency of half the app's callbacks.
   *
   * A fresh literal every render gave every one of them a new identity, which in
   * turn defeated `EditorPanel`'s memo — so a run streaming its frames in, or a
   * scrub of the timeline, re-rendered the editor along with everything else.
   * Every function below is a `useCallback`, so this only changes when something
   * about the recording actually has.
   */
  return useMemo(
    () => ({
      active,
      steps,
      index,
      step,
      functions,
      breakFunctions,
      breakpoints,
      playing,
      frameIndex,
      begin,
      end,
      seek,
      run,
      play,
      pause,
      toggleFunction,
      setAllFunctions,
      toggleBreakpoint,
      clearBreakpoints,
    }),
    [
      active,
      steps,
      index,
      step,
      functions,
      breakFunctions,
      breakpoints,
      playing,
      frameIndex,
      begin,
      end,
      seek,
      run,
      play,
      pause,
      toggleFunction,
      setAllFunctions,
      toggleBreakpoint,
      clearBreakpoints,
    ],
  );
}
