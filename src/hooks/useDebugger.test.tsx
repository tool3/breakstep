import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDebugger } from './useDebugger';
import type { DebugStep, FunctionInfo, StepKind } from '@/types/debug';

function make(): DebugStep[] {
  const at = (id: number, line: number, kind: StepKind, depth: number, fn?: string): DebugStep => ({
    id,
    line,
    kind,
    depth,
    fn,
    scope: { i: id },
    stack: fn ? [{ label: fn, depth }] : [],
    frame: id,
  });

  return [
    at(0, 1, 'statement', 0),
    at(1, 2, 'entry', 1, 'outer'),
    at(2, 3, 'statement', 1, 'outer'),
    at(3, 4, 'entry', 2, 'inner'),
    at(4, 5, 'statement', 2, 'inner'),
    at(5, 4, 'exit', 2, 'inner'),
    at(6, 6, 'statement', 1, 'outer'),
    at(7, 2, 'exit', 1, 'outer'),
    at(8, 9, 'statement', 0),
  ];
}

const FUNCTIONS: FunctionInfo[] = [
  { name: 'outer', qualified: 'outer', line: 2 },
  { name: 'inner', qualified: 'Helper.inner', line: 4 },
];

function setup() {
  const hook = renderHook(() => useDebugger());
  act(() => hook.result.current.setStepEveryLine(true));
  act(() => hook.result.current.begin(make(), FUNCTIONS));
  return hook;
}

function setupRunning(prepare?: (state: ReturnType<typeof useDebugger>) => void) {
  const hook = renderHook(() => useDebugger());
  if (prepare) act(() => prepare(hook.result.current));
  act(() => hook.result.current.begin(make(), FUNCTIONS));
  return hook;
}

describe('useDebugger', () => {
  it('is inactive until a recording arrives', () => {
    const { result } = renderHook(() => useDebugger());
    expect(result.current.active).toBe(false);
    expect(result.current.step).toBeNull();

    act(() => result.current.setStepEveryLine(true));
    act(() => result.current.begin(make(), FUNCTIONS));
    expect(result.current.active).toBe(true);
    expect(result.current.step?.line).toBe(1);
  });

  it('stays inactive when the recording is empty', () => {
    const { result } = renderHook(() => useDebugger());
    act(() => result.current.begin([], FUNCTIONS));
    expect(result.current.active).toBe(false);
  });

  it('steps into calls one step at a time', () => {
    const { result } = setup();
    act(() => result.current.run('stepInto'));
    expect(result.current.step?.kind).toBe('entry');
    act(() => result.current.run('stepInto'));
    expect(result.current.step?.line).toBe(3);
  });

  it('runs a call to completion when stepping over', () => {
    const { result } = setup();
    act(() => result.current.seek(2));
    act(() => result.current.run('stepOver'));
    expect(result.current.step?.line).toBe(6);
    expect(result.current.step?.depth).toBe(1);
  });

  it('finishes the current function when stepping out', () => {
    const { result } = setup();
    act(() => result.current.seek(4));
    act(() => result.current.run('stepOut'));
    expect(result.current.step?.depth).toBeLessThan(2);
  });

  it('walks backwards, which a live debugger cannot', () => {
    const { result } = setup();
    act(() => result.current.seek(5));
    act(() => result.current.run('stepBack'));
    expect(result.current.index).toBe(4);
  });

  it('clamps every command to the recording', () => {
    const { result } = setup();
    act(() => result.current.run('stepBack'));
    expect(result.current.index).toBe(0);

    act(() => result.current.seek(999));
    expect(result.current.index).toBe(8);
    act(() => result.current.run('stepInto'));
    expect(result.current.index).toBe(8);
  });

  it('runs to the end when no function has its switch on', () => {
    const { result } = setup();
    act(() => result.current.run('continue'));
    expect(result.current.index).toBe(8);
  });

  it('stops at a function whose switch was on before the session began', () => {
    const { result } = setupRunning((state) => state.toggleFunction('outer'));
    expect(result.current.step?.fn).toBe('outer');
    expect(result.current.outcome).toBe('paused');
  });

  it('stops at a function whose switch is on', () => {
    const { result } = setup();
    act(() => result.current.toggleFunction('outer'));
    act(() => result.current.run('continue'));
    expect(result.current.step?.fn).toBe('outer');
    expect(result.current.step?.kind).toBe('entry');
  });

  it('matches a method switch against the bare name the run recorded', () => {
    const { result } = setup();
    act(() => result.current.toggleFunction('Helper.inner'));
    act(() => result.current.run('continue'));
    expect(result.current.step?.fn).toBe('inner');
    expect(result.current.index).toBe(3);
  });

  it('turns every switch on and off at once', () => {
    const { result } = setup();
    act(() => result.current.setAllFunctions(true));
    expect(result.current.breakFunctions.size).toBe(2);
    act(() => result.current.setAllFunctions(false));
    expect(result.current.breakFunctions.size).toBe(0);
  });

  it('stops at a line breakpoint regardless of the switches', () => {
    const { result } = setup();
    act(() => result.current.toggleBreakpoint(6));
    act(() => result.current.run('continue'));
    expect(result.current.step?.line).toBe(6);

    act(() => result.current.clearBreakpoints());
    act(() => result.current.run('restart'));
    act(() => result.current.run('continue'));
    expect(result.current.index).toBe(8);
  });

  it('toggles a breakpoint off again', () => {
    const { result } = setup();
    act(() => result.current.toggleBreakpoint(6));
    act(() => result.current.toggleBreakpoint(6));
    expect(result.current.breakpoints.size).toBe(0);
  });

  it('reports the frame the visualizer should show', () => {
    const { result } = setup();
    act(() => result.current.seek(4));
    expect(result.current.frameIndex).toBe(4);
  });

  it('restarts to the first step in every-line mode', () => {
    const { result } = setup();
    act(() => result.current.seek(7));
    act(() => result.current.run('restart'));
    expect(result.current.index).toBe(0);
  });

  it('drops the recording when the session ends', () => {
    const { result } = setup();
    act(() => result.current.end());
    expect(result.current.active).toBe(false);
    expect(result.current.steps).toHaveLength(0);
    expect(result.current.step).toBeNull();
  });

  it('stops playing as soon as a command is issued', () => {
    const { result } = setup();
    act(() => result.current.play());
    expect(result.current.playing).toBe(true);
    act(() => result.current.run('stepInto'));
    expect(result.current.playing).toBe(false);
  });
});

describe('starting a session behaves like F5', () => {
  it('runs to the first breakpoint rather than the first line', () => {
    const { result } = setupRunning((state) => state.toggleBreakpoint(6));
    expect(result.current.step?.line).toBe(6);
    expect(result.current.outcome).toBe('paused');
  });

  it('runs to the end when nothing is set, and stays open there', () => {
    const { result } = setupRunning();
    expect(result.current.outcome).toBe('completed');
    expect(result.current.index).toBe(8);
    expect(result.current.active).toBe(true);
    act(() => result.current.run('stepBack'));
    expect(result.current.index).toBe(7);
  });

  it('parks on the first step when asked to show every line', () => {
    const { result } = setupRunning((state) => state.setStepEveryLine(true));
    expect(result.current.index).toBe(0);
    expect(result.current.outcome).toBe('paused');
  });

  it('restarts by running to the first breakpoint again', () => {
    const { result } = setupRunning((state) => state.toggleBreakpoint(6));
    act(() => result.current.seek(8));
    act(() => result.current.run('restart'));
    expect(result.current.step?.line).toBe(6);
  });

  it('says it completed once continue finds nothing more', () => {
    const { result } = setupRunning((state) => state.toggleBreakpoint(2));
    expect(result.current.outcome).toBe('paused');
    act(() => result.current.run('continue'));
    act(() => result.current.run('continue'));
    expect(result.current.outcome).toBe('completed');
    expect(result.current.index).toBe(8);
  });
});

describe('conditional and disabled breakpoints', () => {
  it('stops only where the condition holds', () => {
    const { result } = setupRunning((state) => {
      state.toggleBreakpoint(4);
      state.setBreakpointCondition(4, 'i > 3');
    });

    expect(result.current.index).toBe(5);
  });

  it('treats a condition it cannot answer as no stop at all', () => {
    const { result } = setupRunning((state) => {
      state.toggleBreakpoint(4);
      state.setBreakpointCondition(4, 'nothingHere.deep');
    });
    expect(result.current.outcome).toBe('completed');
  });

  it('ignores a disabled breakpoint but remembers it', () => {
    const { result } = setupRunning((state) => {
      state.toggleBreakpoint(6);
      state.setBreakpointEnabled(6, false);
    });

    expect(result.current.outcome).toBe('completed');
    expect(result.current.breakpoints.get(6)).toEqual({ line: 6, enabled: false });

    act(() => result.current.setBreakpointEnabled(6, true));
    act(() => result.current.run('restart'));
    expect(result.current.step?.line).toBe(6);
  });

  it('creates a breakpoint when a condition is set on a bare line', () => {
    const { result } = setupRunning();
    act(() => result.current.setBreakpointCondition(3, 'i >= 0'));
    expect(result.current.breakpoints.get(3)).toEqual({
      line: 3,
      enabled: true,
      condition: 'i >= 0',
    });
  });

  it('drops the condition when it is cleared, leaving the breakpoint', () => {
    const { result } = setupRunning((state) => state.setBreakpointCondition(3, 'i > 1'));
    act(() => result.current.setBreakpointCondition(3, '   '));
    expect(result.current.breakpoints.get(3)).toEqual({ line: 3, enabled: true });
  });
});

describe('watch expressions', () => {
  it('answers against the scope of wherever the cursor is', () => {
    const { result } = setup();
    act(() => result.current.addWatch('i * 2'));
    act(() => result.current.seek(4));

    expect(result.current.watch).toEqual(['i * 2']);
    expect(result.current.evaluate('i * 2')).toEqual({ value: 8 });
  });

  it('reports what it cannot answer instead of throwing', () => {
    const { result } = setup();
    expect(result.current.evaluate('missing.value').error).toBeTruthy();
    expect(result.current.evaluate('=== nonsense').error).toBeTruthy();
  });

  it('does not add the same expression twice, and removes it', () => {
    const { result } = setup();
    act(() => result.current.addWatch('i'));
    act(() => result.current.addWatch('i'));
    act(() => result.current.addWatch('   '));
    expect(result.current.watch).toEqual(['i']);

    act(() => result.current.removeWatch('i'));
    expect(result.current.watch).toEqual([]);
  });
});

describe('what the session says it is doing', () => {
  it('is paused again the moment you step out of a completed run', () => {
    const { result } = setupRunning();
    expect(result.current.outcome).toBe('completed');

    act(() => result.current.run('stepBack'));
    expect(result.current.outcome).toBe('paused');
  });

  it('is paused after scrubbing the timeline', () => {
    const { result } = setupRunning();
    act(() => result.current.seek(3));
    expect(result.current.outcome).toBe('paused');
  });

  it('completes when stepping over runs off the end of the recording', () => {
    const { result } = setupRunning((state) => state.toggleBreakpoint(9));
    expect(result.current.step?.line).toBe(9);
    act(() => result.current.run('stepOver'));
    expect(result.current.outcome).toBe('completed');
  });
});

