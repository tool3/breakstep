/**
 * Refresh the offline LeetCode problem index.
 *
 * This is a maintenance script, not part of the build: it is run by hand, and
 * its output is committed. The app itself never calls leetcode.com — that is
 * the whole point. What gets vendored is public catalogue metadata (number,
 * title, slug, difficulty, topic tags), which is what lets Breakstep recognise
 * any pasted link and recommend a technique. Problem statements and solutions
 * are LeetCode's content and are deliberately *not* fetched or stored.
 *
 * Usage: node scripts/fetch-problem-index.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'leetcode', 'problemIndex.json');
const PAGE = 100;
const ENDPOINT = 'https://leetcode.com/graphql';

const QUERY = `query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
  problemsetQuestionList: questionList(categorySlug: $categorySlug, limit: $limit, skip: $skip, filters: $filters) {
    total: totalNum
    questions: data { questionFrontendId title titleSlug difficulty isPaidOnly topicTags { slug } }
  }
}`;

async function page(skip) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (breakstep problem-index refresh)',
      Referer: 'https://leetcode.com/problemset/all/',
    },
    body: JSON.stringify({
      query: QUERY,
      variables: { categorySlug: '', limit: PAGE, skip, filters: {} },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} at skip=${skip}`);
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors).slice(0, 200));
  return json.data.problemsetQuestionList;
}

const DIFFICULTY = { Easy: 0, Medium: 1, Hard: 2 };

const all = [];
let total = Infinity;

for (let skip = 0; skip < total; skip += PAGE) {
  const chunk = await page(skip);
  total = chunk.total;
  all.push(...chunk.questions);
  process.stdout.write(`\r  ${all.length} / ${total}`);
  // Deliberately unhurried: this runs once in a while, by a person.
  await new Promise((r) => setTimeout(r, 250));
}
process.stdout.write('\n');

all.sort((a, b) => Number(a.questionFrontendId) - Number(b.questionFrontendId));

// Topic slugs repeat across thousands of problems, so they are interned and
// referenced by index. That alone roughly halves the file.
const topics = [];
const topicIndex = new Map();
const internTopic = (slug) => {
  if (!topicIndex.has(slug)) {
    topicIndex.set(slug, topics.length);
    topics.push(slug);
  }
  return topicIndex.get(slug);
};

/**
 * One row per problem: [number, slug, title, difficulty, paidOnly, ...topics].
 * The title is dropped when it is just the slug title-cased, which is the
 * common case — the app can reconstruct it.
 */
const titleFromSlug = (slug) =>
  slug
    .split('-')
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');

const rows = all.map((q) => {
  const title = titleFromSlug(q.titleSlug) === q.title ? 0 : q.title;
  return [
    Number(q.questionFrontendId),
    q.titleSlug,
    title,
    DIFFICULTY[q.difficulty] ?? 1,
    q.isPaidOnly ? 1 : 0,
    ...q.topicTags.map((t) => internTopic(t.slug)),
  ];
});

const payload = {
  fetchedAt: new Date().toISOString().slice(0, 10),
  count: rows.length,
  topics,
  rows,
};

writeFileSync(OUT, JSON.stringify(payload));
const kb = (JSON.stringify(payload).length / 1024).toFixed(0);
console.log(`wrote ${rows.length} problems, ${topics.length} topics, ${kb} kB → ${OUT}`);
