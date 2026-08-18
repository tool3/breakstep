/**
 * The submission store, backed by `localStorage`.
 *
 * One key holds the whole list, newest first. That is the right shape for the
 * amount of data involved — a few hundred records — and it keeps the promise of
 * the interface honest: `list`, `save` and `clear` are the three calls a service
 * would implement, and nothing above this file knows which one it is talking to.
 *
 * Retention is capped, because `localStorage` is a five-megabyte budget shared
 * with the editor buffers: the newest attempts per problem are kept and the rest
 * fall off the end.
 */
import { readStored, writeStored } from '@/hooks/useLocalStorage';
import type {
  Submission,
  SubmissionDraft,
  SubmissionQuery,
  SubmissionStore,
} from './types';

/** Bumped when `Submission` changes shape; older records are discarded. */
export const SUBMISSION_SCHEMA = 1;

const KEY = 'submissions';

/** The only owner there is until there are accounts. */
export const LOCAL_OWNER = 'local';

export const MAX_PER_PROBLEM = 25;
export const MAX_TOTAL = 300;

/** Long enough for any solution, short enough that the quota survives. */
export const MAX_CODE_CHARS = 20_000;

interface Envelope {
  version: number;
  items: Submission[];
}

function newId(): string {
  const random = globalThis.crypto?.randomUUID?.();
  if (random) return random;
  return `s_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function read(): Submission[] {
  const envelope = readStored<Envelope | null>(KEY, null);
  if (!envelope || envelope.version !== SUBMISSION_SCHEMA) return [];
  return Array.isArray(envelope.items) ? envelope.items : [];
}

function write(items: Submission[]): void {
  writeStored<Envelope>(KEY, { version: SUBMISSION_SCHEMA, items });
}

/**
 * Trim to the retention caps.
 *
 * Per-problem first, so a session spent hammering one problem cannot evict the
 * record of every other problem you have solved.
 */
export function applyCaps(items: Submission[]): Submission[] {
  const perProblem = new Map<string, number>();
  const kept: Submission[] = [];

  for (const item of items) {
    const seen = perProblem.get(item.problemSlug) ?? 0;
    if (seen >= MAX_PER_PROBLEM) continue;
    perProblem.set(item.problemSlug, seen + 1);
    kept.push(item);
    if (kept.length >= MAX_TOTAL) break;
  }

  return kept;
}

function matches(item: Submission, query?: SubmissionQuery): boolean {
  return !query?.problemSlug || item.problemSlug === query.problemSlug;
}

export function createLocalSubmissionStore(): SubmissionStore {
  return {
    async list(query) {
      const items = read().filter((item) => matches(item, query));
      return query?.limit === undefined ? items : items.slice(0, query.limit);
    },

    async save(draft: SubmissionDraft) {
      const submission: Submission = {
        ...draft,
        id: newId(),
        schema: SUBMISSION_SCHEMA,
        code: draft.code.slice(0, MAX_CODE_CHARS),
      };
      write(applyCaps([submission, ...read()]));
      return submission;
    },

    async remove(id) {
      write(read().filter((item) => item.id !== id));
    },

    async clear(query) {
      write(query?.problemSlug ? read().filter((item) => !matches(item, query)) : []);
    },

    async solved() {
      const slugs = new Set<string>();
      for (const item of read()) {
        if (item.verdict === 'accepted') slugs.add(item.problemSlug);
      }
      return [...slugs];
    },
  };
}

let store: SubmissionStore = createLocalSubmissionStore();

/** The store the app reads and writes. */
export function submissionStore(): SubmissionStore {
  return store;
}

/**
 * Point the app at a different store.
 *
 * This is the seam: a service-backed implementation of `SubmissionStore` is
 * installed here at startup and every panel keeps working unchanged.
 */
export function setSubmissionStore(next: SubmissionStore): void {
  store = next;
}
