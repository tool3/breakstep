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
  active: boolean;
  steps: DebugStep[];
  index: number;
  step: DebugStep | null;
  functions: FunctionInfo[];

  breakFunctions: Set<string>;
  breakpoints: Map<number, LineBreakpoint>;
  outcome: DebugOutcome;
  stepEveryLine: boolean;
  watch: string[];

  playing: boolean;
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
  setBreakpointEnabled: (line: number, enabled: boolean) => void;
  setBreakpointCondition: (line: number, condition?: string) => void;
  removeBreakpoint: (line: number) => void;
  clearBreakpoints: () => void;
  setStepEveryLine: (on: boolean) => void;
  addWatch: (expression: string) => void;
  removeWatch: (expression: string) => void;
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

  const isBreak = useCallback(
    (candidate: DebugStep): boolean => {
      const breakpoint = breakpoints.get(candidate.line);
      if (breakpoint?.enabled) {
        if (!breakpoint.condition) return true;
        if (conditionHolds(breakpoint.condition, candidate.scope)) return true;
      }
      if (candidate.kind !== 'entry' || !candidate.fn) return false;

      if (breakFunctions.has(candidate.fn)) return true;
      return [...breakFunctions].some((name) => name.endsWith(`.${candidate.fn}`));
    },
    [breakFunctions, breakpoints],
  );

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
      setOutcome('paused');
    },
    [steps.length],
  );

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

  const evaluate = useCallback(
    (expression: string) => evaluateIn(expression, step?.scope ?? null),
    [step],
  );

  const frameIndex = useMemo(() => step?.frame ?? null, [step]);

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
