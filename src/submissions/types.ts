import type { ComplexityClass, Language } from '@/types';

export type Verdict =
  | 'accepted'
  | 'wrong-answer'
  | 'runtime-error'
  | 'unjudged';

export interface CaseOutcome {
  label: string;
  expected: string;
  got: string;
  passed: boolean;
  unordered?: boolean;
  error?: string;
}

export interface Submission {
  id: string;
  schema: number;
  owner: string;

  problemSlug: string;
  problemNumber: number;
  problemTitle: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  language: Language;
  submittedAt: string;

  verdict: Verdict;
  passed: number;
  total: number;
  cases: CaseOutcome[];

  entry?: string;
  runtimeMs: number;
  totalMs: number;
  operations?: number;

  complexity: { time: ComplexityClass; space: ComplexityClass; confidence: number };
  empirical?: { time: ComplexityClass; confidence: number };

  code: string;
  error?: string;
  note?: string;
}

export type SubmissionDraft = Omit<Submission, 'id'>;

export interface SubmissionQuery {
  problemSlug?: string;
  limit?: number;
}

export interface SubmissionStore {
  list(query?: SubmissionQuery): Promise<Submission[]>;
  save(draft: SubmissionDraft): Promise<Submission>;
  remove(id: string): Promise<void>;
  clear(query?: SubmissionQuery): Promise<void>;
  solved(): Promise<string[]>;
}
