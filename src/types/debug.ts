/**
 * The recorded-execution model behind the debugger.
 *
 * Breakstep does not attach a live debugger to the worker — it records every
 * step as the program runs and then lets you walk the recording. That buys two
 * things a live debugger cannot give you: stepping *backwards*, and identical
 * behaviour for JavaScript and Python without two separate debug protocols.
 * What it gives up is mutating a variable mid-run, which is not what this app
 * is for.
 */

export type StepKind =
  /** A function was entered. */
  | 'entry'
  /** A function returned or threw. */
  | 'exit'
  /** A loop body began another iteration. */
  | 'loop'
  /** An ordinary statement is about to run. */
  | 'statement';

export interface StackFrame {
  label: string;
  depth: number;
}

/** One recorded moment: where execution was, and what every binding held. */
export interface DebugStep {
  id: number;
  /** 1-based line in the user's source. */
  line: number;
  kind: StepKind;
  /** Function name for `entry` / `exit`, and the enclosing function otherwise. */
  fn?: string;
  /** Call depth at this moment; 0 is top level. */
  depth: number;
  /** Every binding readable here, already made structured-clone safe. */
  scope: Record<string, unknown>;
  stack: StackFrame[];
  /**
   * Index into `RunResult.frames` of the picture as of this step. The debugger
   * cursor and the visualizer timeline are the same timeline.
   */
  frame?: number;
}

/** A function found in the source, so the panel can offer a switch per function. */
export interface FunctionInfo {
  name: string;
  line: number;
  /** Methods report as `Class.method` for readability. */
  qualified: string;
}

/** Everything the debugger UI needs about the current position. */
export interface DebugCursor {
  step: DebugStep | null;
  index: number;
  total: number;
}

export type StepCommand =
  | 'continue'
  | 'stepOver'
  | 'stepInto'
  | 'stepOut'
  | 'stepBack'
  | 'restart';

/**
 * A breakpoint on a line, modelled the way VS Code models one.
 *
 * `enabled` is separate from existence so a breakpoint can be switched off
 * without losing where it was — and `condition` is evaluated at *replay* time
 * against the scope recorded at that step, which is why it can be added, edited
 * or removed after the run is already over.
 */
export interface LineBreakpoint {
  line: number;
  enabled: boolean;
  /** Break only when this expression is truthy in the scope recorded there. */
  condition?: string;
}

/**
 * How a session came to rest: stopped somewhere, or ran out of program.
 *
 * A recorded run that hits no breakpoint still leaves the whole recording
 * behind, so `completed` is a state you can step *backwards* out of rather than
 * a session that has to end.
 */
export type DebugOutcome = 'paused' | 'completed';

/** The result of evaluating a watch expression or a breakpoint condition. */
export interface EvalResult {
  value?: unknown;
  error?: string;
}
