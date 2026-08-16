/**
 * Vendor the runnable part of every free LeetCode problem.
 *
 * A maintenance script, run by hand; its output is committed. What it takes is
 * deliberately narrow:
 *
 *   · `metaData` — the function name, its parameter names and types, and the
 *     return type. This is the problem's *interface*, and it is what lets
 *     Breakstep generate a starter signature and a driver.
 *   · the example cases — the inputs LeetCode publishes in `exampleTestcases`,
 *     and the matching expected outputs, read out of the statement as values.
 *
 * What it deliberately does not take is the statement itself. The prose is
 * LeetCode's copyrighted writing; the app links out for it. Data about the
 * problem — its signature, its example inputs and the answers to them — is what
 * you need in order to *run* something, and that is all this stores.
 *
 * Premium problems are skipped: their content is behind a paywall and this
 * makes no attempt to reach past it.
 *
 * Usage:
 *   node scripts/fetch-problem-details.mjs            # resume where it stopped
 *   node scripts/fetch-problem-details.mjs --limit 50 # a taste, for testing
 *   node scripts/fetch-problem-details.mjs --fresh    # ignore the cache
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const INDEX = join(ROOT, 'src', 'leetcode', 'problemIndex.json');
const OUT_DIR = join(ROOT, 'src', 'leetcode', 'details');
const CACHE = join(ROOT, 'node_modules', '.cache', 'breakstep-problem-details.json');

const ENDPOINT = 'https://leetcode.com/graphql';
const DELAY_MS = 180;
/** Problems per shard. Small enough that opening one is a small download. */
const SHARD_SIZE = 120;

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const LIMIT = Number(arg('--limit', Infinity));
const FRESH = process.argv.includes('--fresh');

const QUERY = `query q($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionFrontendId
    metaData
    exampleTestcases
    content
  }
}`;

// --- Reading the statement for values, not for words -------------------------

const ENTITIES = {
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&lt;': '<',
  '&gt;': '>',
  '&amp;': '&',
};

function plain(html) {
  return html
    .replace(/<sup>(.*?)<\/sup>/g, '^$1')
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;|&#39;|&apos;|&nbsp;|&lt;|&gt;|&amp;/g, (m) => ENTITIES[m])
    .replace(/\r/g, '');
}

/**
 * The expected answers, in order.
 *
 * Examples live either in `<pre>` blocks (the long-standing format) or in
 * `<div class="example-block">` (the newer one), so this reads whichever is
 * there and falls back to scanning the whole statement for `Output:` lines.
 */
function parseExpected(html) {
  if (!html) return [];

  const blocks = [
    ...[...html.matchAll(/<pre>([\s\S]*?)<\/pre>/g)].map((m) => m[1]),
    ...[...html.matchAll(/<div class="example-block">([\s\S]*?)<\/div>/g)].map((m) => m[1]),
  ];

  const readOutput = (text) => {
    const m = text.match(/Output:?\s*([\s\S]*?)(?=\n\s*(?:Explanation|Input)\b|$)/);
    return m ? m[1].trim().replace(/\s+/g, ' ') : null;
  };

  const found = blocks.map((b) => readOutput(plain(b))).filter((v) => v !== null && v !== '');
  if (found.length > 0) return found;

  // Neither format matched — read the flattened statement directly.
  const text = plain(html);
  return [...text.matchAll(/Output:?[ \t]*(.+)/g)].map((m) => m[1].trim()).filter(Boolean);
}

/**
 * Group the flat list of example inputs into one array per case.
 *
 * `exampleTestcases` is one value per line, cycling through the parameters, so
 * the parameter count is what tells you where a case ends.
 */
function groupCases(exampleTestcases, paramCount) {
  const lines = (exampleTestcases ?? '').split('\n').filter((l) => l.length > 0);
  if (paramCount < 1) return [];

  const cases = [];
  for (let i = 0; i + paramCount <= lines.length; i += paramCount) {
    cases.push(lines.slice(i, i + paramCount));
  }
  return cases;
}

// --- Fetching ----------------------------------------------------------------

async function fetchOne(slug) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (breakstep problem-details refresh)',
      Referer: `https://leetcode.com/problems/${slug}/`,
    },
    body: JSON.stringify({ query: QUERY, variables: { titleSlug: slug } }),
  });

  if (res.status === 429) return { retry: true };
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${slug}`);

  const json = await res.json();
  const q = json.data?.question;
  if (!q) return null;

  let meta = null;
  try {
    meta = q.metaData ? JSON.parse(q.metaData) : null;
  } catch {
    meta = null;
  }
  if (!meta?.name || !Array.isArray(meta.params)) return null;

  const inputs = groupCases(q.exampleTestcases, meta.params.length);
  const expected = parseExpected(q.content);

  return {
    fn: meta.name,
    params: meta.params.map((p) => [p.name, p.type]),
    // A void return means an in-place problem, judged on the argument after the
    // call rather than on a result; there is nothing for a driver to print, and
    // `canGenerate` reads exactly this. (LeetCode's own `manual` flag is not
    // used: it only says their judge compares output itself, and it is set on
    // plenty of perfectly ordinary problems.)
    returns: meta.return?.type ?? 'void',
    // Cases are only useful in pairs: an input with no expected answer cannot
    // be checked, and an answer with no input cannot be run.
    cases: inputs.slice(0, expected.length).map((input, i) => ({ input, expected: expected[i] })),
  };
}

// --- Main --------------------------------------------------------------------

const index = JSON.parse(readFileSync(INDEX, 'utf8'));
/** rows are [number, slug, title|0, difficulty, paidOnly, ...topicIds] */
const free = index.rows.filter((r) => r[4] === 0).map((r) => ({ number: r[0], slug: r[1] }));

mkdirSync(dirname(CACHE), { recursive: true });
let cache = {};
if (!FRESH && existsSync(CACHE)) {
  try {
    cache = JSON.parse(readFileSync(CACHE, 'utf8'));
  } catch {
    cache = {};
  }
}

const todo = free.filter((p) => !(p.slug in cache)).slice(0, LIMIT);
console.log(`${free.length} free problems, ${free.length - todo.length} already cached, fetching ${todo.length}`);

let done = 0;
let failed = 0;
const started = Date.now();

for (const problem of todo) {
  try {
    let detail = await fetchOne(problem.slug);
    if (detail?.retry) {
      console.log('\n  rate limited — waiting 30s');
      await new Promise((r) => setTimeout(r, 30_000));
      detail = await fetchOne(problem.slug);
    }
    cache[problem.slug] = detail?.retry ? null : detail;
  } catch (error) {
    failed++;
    cache[problem.slug] = null;
    if (failed % 20 === 1) console.log(`\n  ${problem.slug}: ${error.message}`);
  }

  done++;
  if (done % 25 === 0) {
    const rate = done / ((Date.now() - started) / 1000);
    const left = Math.round((todo.length - done) / rate);
    process.stdout.write(`\r  ${done}/${todo.length}  (~${Math.floor(left / 60)}m ${left % 60}s left)`);
    writeFileSync(CACHE, JSON.stringify(cache));
  }

  await new Promise((r) => setTimeout(r, DELAY_MS));
}
process.stdout.write('\n');
writeFileSync(CACHE, JSON.stringify(cache));

// --- Write the shards --------------------------------------------------------

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const usable = free.filter((p) => cache[p.slug]?.cases?.length > 0);
const shards = new Map();

for (const problem of usable) {
  const shard = Math.floor(problem.number / SHARD_SIZE);
  if (!shards.has(shard)) shards.set(shard, {});

  // Written out field by field so a stale key in the cache cannot leak into
  // the committed shards.
  const { fn, params, returns, cases } = cache[problem.slug];
  shards.get(shard)[problem.slug] = { fn, params, returns, cases };
}

let bytes = 0;
for (const [shard, payload] of shards) {
  const text = JSON.stringify(payload);
  bytes += text.length;
  writeFileSync(join(OUT_DIR, `${shard}.json`), text);
}

writeFileSync(
  join(OUT_DIR, 'manifest.json'),
  JSON.stringify({
    fetchedAt: new Date().toISOString().slice(0, 10),
    shardSize: SHARD_SIZE,
    shards: [...shards.keys()].sort((a, b) => a - b),
    count: usable.length,
  }),
);

console.log(
  `\nwrote ${usable.length} problems with runnable examples across ${shards.size} shards ` +
    `(${(bytes / 1024).toFixed(0)} kB, ${(bytes / 1024 / shards.size).toFixed(0)} kB each)`,
);
console.log(`${free.length - usable.length} free problems had no parsable example pair`);
