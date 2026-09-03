import { readStored, writeStored } from '@/hooks/useLocalStorage';
import type {
  Submission,
  SubmissionDraft,
  SubmissionQuery,
  SubmissionStore,
} from './types';

export const SUBMISSION_SCHEMA = 1;

const KEY = 'submissions';

export const LOCAL_OWNER = 'local';

export const MAX_PER_PROBLEM = 25;
export const MAX_TOTAL = 300;

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

export function submissionStore(): SubmissionStore {
  return store;
}

export function setSubmissionStore(next: SubmissionStore): void {
  store = next;
}
