/**
 * What a submission is, and how submissions are stored.
 *
 * There are no accounts here: submissions live in the browser. That is a
 * deliberate first step rather than the shape of the thing, so the store is an
 * async interface with a `localStorage` implementation behind it — every read
 * and write returns a promise, ids are assigned by the store rather than by the
 * caller, and queries are the ones a server would expose as endpoints. Swapping
 * in an HTTP-backed store is a single `setSubmissionStore` call; nothing that
 * renders a submission has to change.
 */
import type { ComplexityClass, Language } from '@/types';

/** The outcome of judging a submission. */
export type Verdict =
  /** Every case matched. */
  | 'accepted'
  /** The code ran, and at least one case produced the wrong answer. */
  | 'wrong-answer'
  /** The code threw, hit the operation guard, or blew the timeout. */
  | 'runtime-error'
  /** Nothing to judge against — no published cases and no expected output. */
  | 'unjudged';

/** One published example, run. */
export interface CaseOutcome {
  /** The call, as the reader would write it: `nums = [2,7,11,15], target = 9`. */
  label: string;
  /** LeetCode's published answer, as a literal. */
  expected: string;
  /** What the submitted code produced, as a literal. */
  got: string;
  passed: boolean;
  /**
   * True when the values matched only once order was ignored.
   *
   * Set-valued answers — subsets, group anagrams — are graded this way by
   * LeetCode too, but the run is flagged rather than quietly accepted, because
   * a problem that *does* ask for a specific order would also pass.
   */
  unordered?: boolean;
  /** Present when this case threw rather than returning. */
  error?: string;
}

/**
 * A judged, recorded attempt.
 *
 * `id` is assigned by the store. Everything else is what the client knew at the
 * moment of submitting, so a record stays readable even after the problem, the
 * catalogue or the analyzer has moved on.
 */
export interface Submission {
  id: string;
  /** Bumped when this shape changes; records from another version are dropped. */
  schema: number;
  /**
   * Whose submission this is. There is one account today — the browser — and
   * this is the field a real one drops into.
   */
  owner: string;

  problemSlug: string;
  problemNumber: number;
  problemTitle: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  language: Language;
  /** ISO 8601, from the client clock. A server would stamp its own. */
  submittedAt: string;

  verdict: Verdict;
  passed: number;
  total: number;
  cases: CaseOutcome[];

  /** The function the judge called, when it called one. */
  entry?: string;
  /** Milliseconds spent running the judged cases alone, excluding the file's own driver. */
  runtimeMs: number;
  /** Milliseconds for the whole file, driver included. */
  totalMs: number;
  /** Instrumented basic operations, machine independent (JS/TS only). */
  operations?: number;

  /** The static estimate, which is instant and therefore always present. */
  complexity: { time: ComplexityClass; space: ComplexityClass; confidence: number };
  /** The measured growth curve, when the Analyze sweep had already run on this code. */
  empirical?: { time: ComplexityClass; confidence: number };

  /** The buffer as submitted, so an attempt can be read or restored later. */
  code: string;
  /** Set when the run failed outright rather than answering wrongly. */
  error?: string;
  /** Why there was nothing to judge, for `unjudged`. */
  note?: string;
}

/** A submission before the store has given it an id. */
export type SubmissionDraft = Omit<Submission, 'id'>;

export interface SubmissionQuery {
  problemSlug?: string;
  /** Newest first, so a limit keeps the most recent. */
  limit?: number;
}

/**
 * Where submissions live.
 *
 * Async throughout, including the local implementation, so that the day this
 * points at a service the call sites are already written for it.
 */
export interface SubmissionStore {
  /** Newest first. */
  list(query?: SubmissionQuery): Promise<Submission[]>;
  save(draft: SubmissionDraft): Promise<Submission>;
  remove(id: string): Promise<void>;
  clear(query?: SubmissionQuery): Promise<void>;
  /** Slugs with at least one accepted submission — what the solved ticks read. */
  solved(): Promise<string[]>;
}
