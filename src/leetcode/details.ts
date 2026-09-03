
export interface ProblemCase {
  input: string[];
  expected: string;
}

export interface ProblemDetail {
  fn: string;
  params: [string, string][];
  returns: string;
  cases: ProblemCase[];
}

interface Manifest {
  fetchedAt: string;
  shardSize: number;
  shards: number[];
  count: number;
}

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

export async function loadDetail(slug: string, number: number): Promise<ProblemDetail | null> {
  const meta = await loadManifest();
  if (!meta) return null;

  const shard = Math.floor(number / meta.shardSize);
  const payload = await loadShard(shard);
  return payload[slug] ?? null;
}

export async function detailCount(): Promise<number> {
  return (await loadManifest())?.count ?? 0;
}
