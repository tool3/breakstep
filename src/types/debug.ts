
export type StepKind =
  | 'entry'
  | 'exit'
  | 'loop'
  | 'statement';

export interface StackFrame {
  label: string;
  depth: number;
}

export interface DebugStep {
  id: number;
  line: number;
  kind: StepKind;
  fn?: string;
  depth: number;
  scope: Record<string, unknown>;
  stack: StackFrame[];
  frame?: number;
}

export interface FunctionInfo {
  name: string;
  line: number;
  qualified: string;
}

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

export interface LineBreakpoint {
  line: number;
  enabled: boolean;
  condition?: string;
}

export type DebugOutcome = 'paused' | 'completed';

export interface EvalResult {
  value?: unknown;
  error?: string;
}
