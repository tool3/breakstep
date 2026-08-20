import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DebugPanel } from './DebugPanel';
import { DebugToolbar } from './DebugToolbar';
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
    breakpoints: new Map(),
    outcome: 'paused',
    stepEveryLine: false,
    watch: [],
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
    setBreakpointEnabled: vi.fn(),
    setBreakpointCondition: vi.fn(),
    removeBreakpoint: vi.fn(),
    clearBreakpoints: vi.fn(),
    setStepEveryLine: vi.fn(),
    addWatch: vi.fn(),
    removeWatch: vi.fn(),
    evaluate: vi.fn().mockReturnValue({ value: 42 }),
    ...overrides,
  };
}

describe('DebugPanel', () => {
  it('explains itself before anything has been recorded', () => {
    render(<DebugPanel debug={state({ active: false })} onGoToLine={vi.fn()} onStop={vi.fn()} />);
    expect(screen.getByText(/Press Debug to record a run/)).toBeInTheDocument();
  });

  it('says where the session is paused, and jumps the editor there', async () => {
    const user = userEvent.setup();
    const onGoToLine = vi.fn();
    render(<DebugPanel debug={state()} onGoToLine={onGoToLine} onStop={vi.fn()} />);

    const position = screen.getByRole('button', { name: /Paused on line 12/ });
    await user.click(position);
    expect(onGoToLine).toHaveBeenCalledWith(12);
  });

  it('says when the run finished without hitting anything', () => {
    render(
      <DebugPanel
        debug={state({ outcome: 'completed' })}
        onGoToLine={vi.fn()}
        onStop={vi.fn()}
      />,
    );
    expect(screen.getByText(/Ran to completion/)).toBeInTheDocument();
    expect(screen.getByText(/no breakpoints were set/)).toBeInTheDocument();
  });

  it('offers the every-line mode the debugger used to be', async () => {
    const user = userEvent.setup();
    const debug = state();
    render(<DebugPanel debug={debug} onGoToLine={vi.fn()} onStop={vi.fn()} />);

    await user.click(screen.getByRole('switch', { name: 'Show every line' }));
    expect(debug.setStepEveryLine).toHaveBeenCalledWith(true);
  });

  it('lists the variables in scope at this step', () => {
    render(<DebugPanel debug={state()} onGoToLine={vi.fn()} onStop={vi.fn()} />);
    for (const name of ['value', 'seen', 'node']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it('shows the call stack innermost first', () => {
    const { container } = render(
      <DebugPanel debug={state()} onGoToLine={vi.fn()} onStop={vi.fn()} />,
    );
    const stack = container.querySelector('[class*="stack"]')!;
    expect([...stack.querySelectorAll('code')].map((el) => el.textContent)).toEqual([
      'insert',
      'main',
    ]);
  });

  it('collapses a section and brings it back', async () => {
    const user = userEvent.setup();
    render(<DebugPanel debug={state()} onGoToLine={vi.fn()} onStop={vi.fn()} />);

    expect(screen.getByText('value')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Variables/ }));
    expect(screen.queryByText('value')).not.toBeInTheDocument();
  });

  it('watches an expression and evaluates it where the cursor is', async () => {
    const user = userEvent.setup();
    const debug = state({ watch: ['node.val'] });
    render(<DebugPanel debug={debug} onGoToLine={vi.fn()} onStop={vi.fn()} />);

    expect(screen.getByText('node.val')).toBeInTheDocument();
    expect(debug.evaluate).toHaveBeenCalledWith('node.val');

    await user.type(
      screen.getByRole('textbox', { name: 'Add a watch expression' }),
      'seen.length{Enter}',
    );
    expect(debug.addWatch).toHaveBeenCalledWith('seen.length');
  });

  it('shows what a watch expression could not answer', () => {
    const debug = state({
      watch: ['nope'],
      evaluate: vi.fn().mockReturnValue({ error: 'nope is not defined' }),
    });
    render(<DebugPanel debug={debug} onGoToLine={vi.fn()} onStop={vi.fn()} />);
    expect(screen.getByText('nope is not defined')).toBeInTheDocument();
  });

  it('lists breakpoints with a checkbox that disables rather than deletes', async () => {
    const user = userEvent.setup();
    const debug = state({
      breakpoints: new Map([
        [31, { line: 31, enabled: true }],
        [40, { line: 40, enabled: false, condition: 'lo > 4' }],
      ]),
    });
    render(<DebugPanel debug={debug} onGoToLine={vi.fn()} onStop={vi.fn()} />);

    expect(screen.getByText('when lo > 4')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Breakpoint on line 31 enabled' }));
    expect(debug.setBreakpointEnabled).toHaveBeenCalledWith(31, false);

    await user.click(
      screen.getByRole('button', { name: 'Remove the breakpoint on line 31' }),
    );
    expect(debug.removeBreakpoint).toHaveBeenCalledWith(31);
  });

  it('folds the per-function switches into the same list', async () => {
    const user = userEvent.setup();
    const debug = state();
    render(<DebugPanel debug={debug} onGoToLine={vi.fn()} onStop={vi.fn()} />);

    const entry = screen.getByRole('checkbox', { name: 'Break on entry to Tree.insert' });
    expect(entry).not.toBeChecked();
    await user.click(entry);
    expect(debug.toggleFunction).toHaveBeenCalledWith('Tree.insert');
  });

  it('leaves Stop to the transport rather than offering a second one', () => {
    render(<DebugPanel debug={state()} onGoToLine={vi.fn()} onStop={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Stop debugging' })).not.toBeInTheDocument();
  });

  it('carries its own transport on a phone, where the editor is another tab', () => {
    const { container } = render(
      <DebugPanel debug={state()} onGoToLine={vi.fn()} onStop={vi.fn()} compact />,
    );
    const toolbar = within(container).getByRole('toolbar', { name: 'Debug controls' });
    expect(within(toolbar).getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });
});

describe('DebugToolbar', () => {
  it('offers the whole transport', () => {
    render(<DebugToolbar debug={state()} onStop={vi.fn()} />);
    for (const name of [
      'Step back',
      'Continue',
      'Step over',
      'Step into',
      'Step out',
      'Restart',
      'Stop debugging',
    ]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('issues the matching command for each control', async () => {
    const user = userEvent.setup();
    const debug = state({ index: 1 });
    render(<DebugToolbar debug={debug} onStop={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Step back' }));
    expect(debug.run).toHaveBeenCalledWith('stepBack');

    await user.click(screen.getByRole('button', { name: 'Restart' }));
    expect(debug.run).toHaveBeenCalledWith('restart');
  });

  it('shows where the session is, for when the panel is elsewhere', () => {
    render(<DebugToolbar debug={state()} onStop={vi.fn()} />);
    expect(screen.getByText('line 12')).toBeInTheDocument();

    render(<DebugToolbar debug={state({ outcome: 'completed' })} onStop={vi.fn()} />);
    expect(screen.getByText('ran to completion')).toBeInTheDocument();
  });

  it('leaves the debugger on request', async () => {
    const user = userEvent.setup();
    const onStop = vi.fn();
    render(<DebugToolbar debug={state()} onStop={onStop} />);
    await user.click(screen.getByRole('button', { name: 'Stop debugging' }));
    expect(onStop).toHaveBeenCalled();
  });
});
