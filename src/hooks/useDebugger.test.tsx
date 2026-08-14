import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDebugger } from './useDebugger';
import type { DebugStep, FunctionInfo, StepKind } from '@/types/debug';

/** A tiny recording: top level calls `outer`, which calls `inner`. */
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
  act(() => hook.result.current.begin(make(), FUNCTIONS));
  return hook;
}

describe('useDebugger', () => {
  it('is inactive until a recording arrives', () => {
    const { result } = renderHook(() => useDebugger());
    expect(result.current.active).toBe(false);
    expect(result.current.step).toBeNull();

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
    act(() => result.current.seek(2)); // inside outer, before the inner call
    act(() => result.current.run('stepOver'));
    // Everything belonging to `inner` is skipped.
    expect(result.current.step?.line).toBe(6);
    expect(result.current.step?.depth).toBe(1);
  });

  it('finishes the current function when stepping out', () => {
    const { result } = setup();
    act(() => result.current.seek(4)); // deep inside inner
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

  it('stops at a function whose switch is on', () => {
    const { result } = setup();
    act(() => result.current.toggleFunction('outer'));
    act(() => result.current.run('continue'));
    expect(result.current.step?.fn).toBe('outer');
    expect(result.current.step?.kind).toBe('entry');
  });

  it('matches a method switch against the bare name the run recorded', () => {
    const { result } = setup();
    // The list says `Helper.inner`; the recording only ever saw `inner`.
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

  it('restarts to the first step', () => {
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
