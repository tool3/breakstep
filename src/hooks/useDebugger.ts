/**
 * The debugger, driven over a recorded run.
 *
 * Because the recording already exists by the time this hook sees it, every
 * command is a search through an array rather than a round trip to a paused
 * runtime. That is what makes `stepBack` possible at all, and it is why the
 * controls stay responsive on a phone.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  DebugOutcome,
  DebugStep,
  EvalResult,
  FunctionInfo,
  LineBreakpoint,
  StepCommand,
} from '@/types/debug';
import { conditionHolds, evaluateIn } from './debugEval';

export interface DebuggerState {
  /** True once a debug run has been recorded and handed over. */
  active: boolean;
  steps: DebugStep[];
  index: number;
  step: DebugStep | null;
  functions: FunctionInfo[];

  /** Functions whose entry the debugger should stop at — the per-function switches. */
  breakFunctions: Set<string>;
  /** Breakpoints by line, set from the editor gutter. */
  breakpoints: Map<number, LineBreakpoint>;
  /**
   * Whether the session is resting on a breakpoint or ran out of program.
   *
   * A recording that hits nothing is not a failure and not the end of the
   * session: it is a completed run you can still walk backwards through.
   */
  outcome: DebugOutcome;
  /**
   * Stop on every recorded step instead of running to a breakpoint.
   *
   * Off by default, which is what makes this behave like a debugger. On, it is
   * the guided walk this app started as — worth keeping, because for someone
   * meeting recursion for the first time every line *is* the lesson.
   */
  stepEveryLine: boolean;
  /** Expressions shown against the current step's scope. */
  watch: string[];

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
  /** Switch a breakpoint off without forgetting where it was. */
  setBreakpointEnabled: (line: number, enabled: boolean) => void;
  /** Break there only when this holds. Passing undefined makes it unconditional. */
  setBreakpointCondition: (line: number, condition?: string) => void;
  removeBreakpoint: (line: number) => void;
  clearBreakpoints: () => void;
  setStepEveryLine: (on: boolean) => void;
  addWatch: (expression: string) => void;
  removeWatch: (expression: string) => void;
  /** Answer an expression against the scope recorded at the current step. */
  evaluate: (expression: string) => EvalResult;
}

const PLAY_INTERVAL_MS = 220;

export function useDebugger(): DebuggerState {
  const [steps, setSteps] = useState<DebugStep[]>([]);
  const [functions, setFunctions] = useState<FunctionInfo[]>([]);
  const [index, setIndex] = useState(0);
  const [active, setActive] = useState(false);
  const [playing, setPlaying] = useState(false);

  const [breakFunctions, setBreakFunctions] = useState<Set<string>>(new Set());
  const [breakpoints, setBreakpoints] = useState<Map<number, LineBreakpoint>>(new Map());
  const [outcome, setOutcome] = useState<DebugOutcome>('paused');
  const [stepEveryLine, setStepEveryLine] = useState(false);
  const [watch, setWatch] = useState<string[]>([]);

  const timer = useRef<number | null>(null);

  const step = steps[index] ?? null;

  /**
   * Should the debugger stop here?
   *
   * A disabled breakpoint is remembered and ignored; a conditional one is
   * answered against the scope recorded at that step. A function only breaks
   * when its switch is on.
   */
  const isBreak = useCallback(
    (candidate: DebugStep): boolean => {
      const breakpoint = breakpoints.get(candidate.line);
      if (breakpoint?.enabled) {
        // A condition is answered against the scope recorded *there*, and one
        // that cannot be answered never stops the run.
        if (!breakpoint.condition) return true;
        if (conditionHolds(breakpoint.condition, candidate.scope)) return true;
      }
      if (candidate.kind !== 'entry' || !candidate.fn) return false;

      if (breakFunctions.has(candidate.fn)) return true;
      // Methods are listed as `Class.method`; the recording only knows `method`.
      return [...breakFunctions].some((name) => name.endsWith(`.${candidate.fn}`));
    },
    [breakFunctions, breakpoints],
  );

  /**
   * Take a recording and behave like a debugger: run.
   *
   * The session does not open paused on line 1 — it opens wherever the program
   * first hits something you asked it to stop at, which is what F5 does
   * everywhere else. With nothing set it rests at the end of the recording and
   * says so, because the whole run is still there to walk backwards through.
   *
   * `stepEveryLine` is the exception, and the mode this app used to have as its
   * only behaviour: park on the first step and let the reader drive.
   */
  const begin = useCallback(
    (next: DebugStep[], fns: FunctionInfo[]) => {
      setSteps(next);
      setFunctions(fns);
      setActive(next.length > 0);
      setPlaying(false);

      if (next.length === 0) {
        setIndex(0);
        setOutcome('completed');
        return;
      }

      if (stepEveryLine) {
        setIndex(0);
        setOutcome('paused');
        return;
      }

      const first = next.findIndex((candidate) => isBreak(candidate));
      setIndex(first === -1 ? next.length - 1 : first);
      setOutcome(first === -1 ? 'completed' : 'paused');
    },
    [isBreak, stepEveryLine],
  );

  const end = useCallback(() => {
    setActive(false);
    setPlaying(false);
    setSteps([]);
    setIndex(0);
    setOutcome('paused');
  }, []);

  const seek = useCallback(
    (next: number) => {
      setPlaying(false);
      const total = steps.length;
      if (total === 0) {
        setIndex(0);
        return;
      }
      setIndex(Math.min(Math.max(next, 0), total - 1));
      // Landing somewhere by hand is being paused there, whatever came before.
      setOutcome('paused');
    },
    [steps.length],
  );

  /**
   * A step command.
   *
   * Computed against the current index rather than inside a state updater, so
   * that settling on a new position and recording *why* the session is resting
   * there happen together. Every command but `continue` leaves the session
   * paused — including stepping backwards out of a run that had reached the end,
   * which is no longer over the moment you move.
   */
  const run = useCallback(
    (command: StepCommand) => {
      setPlaying(false);

      const total = steps.length;
      if (total === 0) return;

      const here = steps[index];
      const clamp = (n: number) => Math.min(Math.max(n, 0), total - 1);

      const firstBreak = () => steps.findIndex((candidate) => isBreak(candidate));

      switch (command) {
        case 'restart': {
          // Restarting re-runs the recording, which means running to the first
          // breakpoint again rather than landing back on line 1.
          if (stepEveryLine) {
            setIndex(0);
            setOutcome('paused');
            return;
          }
          const first = firstBreak();
          setIndex(first === -1 ? total - 1 : first);
          setOutcome(first === -1 ? 'completed' : 'paused');
          return;
        }

        case 'continue': {
          for (let i = index + 1; i < total; i++) {
            if (isBreak(steps[i])) {
              setIndex(i);
              setOutcome('paused');
              return;
            }
          }
          setIndex(total - 1);
          setOutcome('completed');
          return;
        }

        case 'stepBack':
          setIndex(clamp(index - 1));
          setOutcome('paused');
          return;

        case 'stepInto':
          setIndex(clamp(index + 1));
          setOutcome('paused');
          return;

        case 'stepOver': {
          // Skip anything deeper than here: a call runs to completion.
          for (let i = index + 1; i < total; i++) {
            if (steps[i].depth <= here.depth) {
              setIndex(i);
              setOutcome('paused');
              return;
            }
          }
          setIndex(total - 1);
          setOutcome('completed');
          return;
        }

        case 'stepOut': {
          for (let i = index + 1; i < total; i++) {
            if (steps[i].depth < here.depth) {
              setIndex(i);
              setOutcome('paused');
              return;
            }
          }
          setIndex(total - 1);
          setOutcome('completed');
          return;
        }

        default:
          return;
      }
    },
    [steps, index, isBreak, stepEveryLine],
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
      const next = new Map(prev);
      if (next.has(line)) next.delete(line);
      else next.set(line, { line, enabled: true });
      return next;
    });
  }, []);

  const setBreakpointEnabled = useCallback((line: number, enabled: boolean) => {
    setBreakpoints((prev) => {
      const existing = prev.get(line);
      if (!existing) return prev;
      const next = new Map(prev);
      next.set(line, { ...existing, enabled });
      return next;
    });
  }, []);

  /**
   * Conditions can be set on a line that has no breakpoint yet — right-clicking
   * the gutter and typing an expression is how VS Code creates one.
   */
  const setBreakpointCondition = useCallback((line: number, condition?: string) => {
    setBreakpoints((prev) => {
      const next = new Map(prev);
      const existing = next.get(line) ?? { line, enabled: true };
      const trimmed = condition?.trim();
      next.set(line, { ...existing, condition: trimmed ? trimmed : undefined });
      return next;
    });
  }, []);

  const removeBreakpoint = useCallback((line: number) => {
    setBreakpoints((prev) => {
      if (!prev.has(line)) return prev;
      const next = new Map(prev);
      next.delete(line);
      return next;
    });
  }, []);

  const clearBreakpoints = useCallback(() => setBreakpoints(new Map()), []);

  const addWatch = useCallback((expression: string) => {
    const trimmed = expression.trim();
    if (!trimmed) return;
    setWatch((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
  }, []);

  const removeWatch = useCallback((expression: string) => {
    setWatch((prev) => prev.filter((item) => item !== expression));
  }, []);

  /** Watch expressions read the scope of wherever the cursor is now. */
  const evaluate = useCallback(
    (expression: string) => evaluateIn(expression, step?.scope ?? null),
    [step],
  );


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
      outcome,
      stepEveryLine,
      watch,
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
      setBreakpointEnabled,
      setBreakpointCondition,
      removeBreakpoint,
      clearBreakpoints,
      setStepEveryLine,
      addWatch,
      removeWatch,
      evaluate,
    }),
    [
      active,
      steps,
      index,
      step,
      functions,
      breakFunctions,
      breakpoints,
      outcome,
      stepEveryLine,
      watch,
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
      setBreakpointEnabled,
      setBreakpointCondition,
      removeBreakpoint,
      clearBreakpoints,
      setStepEveryLine,
      addWatch,
      removeWatch,
      evaluate,
    ],
  );
}
