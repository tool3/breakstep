import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DebugPanel } from './DebugPanel';
import type { DebuggerState } from '@/hooks/useDebugger';
import type { DebugStep } from '@/types/debug';

const STEP: DebugStep = {
  id: 3,
  line: 12,
  kind: 'entry',
  fn: 'insert',
  depth: 2,
  scope: { value: 7, node: { val: 7 }, seen: [1, 2] },
  stack: [
    { label: 'main', depth: 1 },
    { label: 'insert', depth: 2 },
  ],
  frame: 4,
};

function state(overrides: Partial<DebuggerState> = {}): DebuggerState {
  return {
    active: true,
    steps: [STEP, { ...STEP, id: 4, kind: 'statement', line: 13 }],
    index: 0,
    step: STEP,
    functions: [
      { name: 'insert', qualified: 'Tree.insert', line: 12 },
      { name: 'search', qualified: 'Tree.search', line: 20 },
    ],
    breakFunctions: new Set(),
    breakpoints: new Set(),
    playing: false,
    frameIndex: 4,
    begin: vi.fn(),
    end: vi.fn(),
    seek: vi.fn(),
    run: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    toggleFunction: vi.fn(),
    setAllFunctions: vi.fn(),
    toggleBreakpoint: vi.fn(),
    clearBreakpoints: vi.fn(),
    ...overrides,
  };
}

describe('DebugPanel', () => {
  it('explains itself before anything has been recorded', () => {
    render(<DebugPanel debug={state({ active: false })} onGoToLine={vi.fn()} onStop={vi.fn()} />);
    expect(screen.getByText(/Press Debug to record a run/)).toBeInTheDocument();
  });

  it('offers the whole transport', () => {
    render(<DebugPanel debug={state()} onGoToLine={vi.fn()} onStop={vi.fn()} />);
    for (const name of ['Step back', 'Play', 'Step over', 'Step into', 'Step out', 'Restart']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });

  it('issues the matching command for each control', async () => {
    const user = userEvent.setup();
    const debug = state({ index: 1 });
    render(<DebugPanel debug={debug} onGoToLine={vi.fn()} onStop={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Step back' }));
    expect(debug.run).toHaveBeenCalledWith('stepBack');

    await user.click(screen.getByRole('button', { name: 'Restart' }));
    expect(debug.run).toHaveBeenCalledWith('restart');
  });

  it('shows where the run is paused, and jumps the editor there', async () => {
    const user = userEvent.setup();
    const onGoToLine = vi.fn();
    render(<DebugPanel debug={state()} onGoToLine={onGoToLine} onStop={vi.fn()} />);

    const position = screen.getByRole('button', { name: /entry\s+insert · line 12/ });
    expect(position).toBeInTheDocument();

    await user.click(position);
    expect(onGoToLine).toHaveBeenCalledWith(12);
  });

  it('lists the variables in scope at this step', () => {
    render(<DebugPanel debug={state()} onGoToLine={vi.fn()} onStop={vi.fn()} />);
    expect(screen.getByText('value')).toBeInTheDocument();
    expect(screen.getByText('seen')).toBeInTheDocument();
    expect(screen.getByText('node')).toBeInTheDocument();
  });

  it('shows the call stack innermost first', () => {
    const { container } = render(
      <DebugPanel debug={state()} onGoToLine={vi.fn()} onStop={vi.fn()} />,
    );
    const stack = container.querySelector('[class*="stack"]')!;
    const rows = [...stack.querySelectorAll('code')].map((el) => el.textContent);
    expect(rows).toEqual(['insert', 'main']);
  });

  it('gives every function its own switch, off by default', async () => {
    const user = userEvent.setup();
    const debug = state();
    render(<DebugPanel debug={debug} onGoToLine={vi.fn()} onStop={vi.fn()} />);

    const insert = screen.getByRole('switch', { name: 'Break on entry to Tree.insert' });
    expect(insert).toHaveAttribute('aria-checked', 'false');

    await user.click(insert);
    expect(debug.toggleFunction).toHaveBeenCalledWith('Tree.insert');
  });

  it('turns all the switches on or off in one go', async () => {
    const user = userEvent.setup();
    const debug = state();
    render(<DebugPanel debug={debug} onGoToLine={vi.fn()} onStop={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'all' }));
    expect(debug.setAllFunctions).toHaveBeenCalledWith(true);
    await user.click(screen.getByRole('button', { name: 'none' }));
    expect(debug.setAllFunctions).toHaveBeenCalledWith(false);
  });

  it('lists line breakpoints only once there are some', async () => {
    const user = userEvent.setup();
    expect(
      render(<DebugPanel debug={state()} onGoToLine={vi.fn()} onStop={vi.fn()} />).container.textContent,
    ).not.toContain('Breakpoints');

    const debug = state({ breakpoints: new Set([31]) });
    render(<DebugPanel debug={debug} onGoToLine={vi.fn()} onStop={vi.fn()} />);
    expect(screen.getByText('Breakpoints')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'clear' }));
    expect(debug.clearBreakpoints).toHaveBeenCalled();
  });

  it('leaves the debugger on request', async () => {
    const user = userEvent.setup();
    const onStop = vi.fn();
    render(<DebugPanel debug={state()} onGoToLine={vi.fn()} onStop={onStop} />);
    await user.click(screen.getByRole('button', { name: 'Stop debugging' }));
    expect(onStop).toHaveBeenCalled();
  });
});
