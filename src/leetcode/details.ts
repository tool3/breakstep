/**
 * Per-problem runnable data, loaded a shard at a time.
 *
 * This is the interface of a problem — the function it wants and the example
 * cases it publishes — vendored by `scripts/fetch-problem-details.mjs`. It is
 * split into shards of a hundred-odd problems so that opening one problem
 * downloads about forty kilobytes rather than the whole set.
 *
 * The statement itself is not here and never will be: that is LeetCode's
 * writing. This is the data you need to *run* the thing.
 */

export interface ProblemCase {
  /** One literal per parameter, exactly as LeetCode publishes it. */
  input: string[];
  /** The answer the statement gives for that input, as a literal. */
  expected: string;
}

export interface ProblemDetail {
  /** The function LeetCode expects, e.g. `twoSum`. */
  fn: string;
  /** `[name, leetcodeType]`, in signature order. */
  params: [string, string][];
  /**
   * The return type, or `void` for an in-place problem — one judged on its
   * argument after the call, which leaves a driver nothing to print.
   */
  returns: string;
  cases: ProblemCase[];
}

interface Manifest {
  fetchedAt: string;
  shardSize: number;
  shards: number[];
  count: number;
}

/**
 * Vite turns this into one lazy chunk per shard, so nothing is fetched until a
 * problem in that range is actually opened.
 */
const SHARD_LOADERS = import.meta.glob<Record<string, ProblemDetail>>('./details/*.json', {
  import: 'default',
});

const loaded = new Map<number, Promise<Record<string, ProblemDetail>>>();
let manifest: Promise<Manifest | null> | null = null;

function loadManifest(): Promise<Manifest | null> {
  if (!manifest) {
    manifest = import('./details/manifest.json')
      .then((mod) => (mod.default ?? mod) as unknown as Manifest)
      .catch(() => null);
  }
  return manifest;
}

function loadShard(shard: number): Promise<Record<string, ProblemDetail>> {
  const existing = loaded.get(shard);
  if (existing) return existing;

  const loader = SHARD_LOADERS[`./details/${shard}.json`];
  const pending = loader
    ? loader().then((mod) => mod ?? {})
    : Promise.resolve({} as Record<string, ProblemDetail>);

  loaded.set(shard, pending);
  return pending;
}

/**
 * The runnable data for one problem, or null if there is none.
 *
 * Null is a normal answer: premium problems have nothing published to take,
 * and a few free ones state their examples in a shape nothing can parse.
 */
export async function loadDetail(slug: string, number: number): Promise<ProblemDetail | null> {
  const meta = await loadManifest();
  if (!meta) return null;

  const shard = Math.floor(number / meta.shardSize);
  const payload = await loadShard(shard);
  return payload[slug] ?? null;
}

/** How many problems ship with runnable examples, for the UI to state plainly. */
export async function detailCount(): Promise<number> {
  return (await loadManifest())?.count ?? 0;
}
