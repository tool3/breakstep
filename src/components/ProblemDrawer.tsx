import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Drawer, Input, Tag, Tooltip } from 'antd';
import {
  ApartmentOutlined,
  BulbOutlined,
  CodeOutlined,
  ExportOutlined,
  EyeOutlined,
  LinkOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { PROBLEMS, problemsByPattern } from '@/leetcode/catalogue';
import { recommend } from '@/leetcode/recommend';
import { loadProblemIndex, type ProblemIndex } from '@/leetcode/problemIndex';
import { detailCount, loadDetail } from '@/leetcode/details';
import { synthesizeProblem, problemUrl } from '@/leetcode/synthesize';
import { tagLabel } from '@/leetcode/topics';
import { PATTERN_LABEL, type LeetProblem, type Technique } from '@/leetcode/types';
import { getTemplate } from '@/templates';
import type { Language } from '@/types';
import styles from './ProblemDrawer.module.scss';

interface Props {
  open: boolean;
  language: Language;
  /** The problem currently loaded in the editor, if any. */
  currentSlug: string | null;
  compact?: boolean;
  onClose: () => void;
  /** Put the starter code in the editor. */
  onLoad: (problem: LeetProblem) => void;
  /** Replace the editor buffer with the finished solution. */
  onReveal: (problem: LeetProblem) => void;
  /** Open a pattern or structure template by id. */
  onOpenTemplate: (templateId: string) => void;
}

const DIFFICULTY_COLOR = { Easy: 'green', Medium: 'gold', Hard: 'red' } as const;

function TechniqueCard({
  technique,
  onOpenTemplate,
}: {
  technique: Technique;
  onOpenTemplate: (templateId: string) => void;
}) {
  const known = technique.complexity.time !== 'unknown';

  return (
    <li className={styles.technique} data-rank={technique.rank}>
      <div className={styles.techniqueHead}>
        <span className={styles.rank}>{technique.rank === 1 ? 'reach for' : 'also works'}</span>
        <span className={styles.techniqueName}>{PATTERN_LABEL[technique.pattern]}</span>
        {known && (
          <span className={styles.techniqueCost}>
            {technique.complexity.time} time · {technique.complexity.space} space
          </span>
        )}
      </div>

      <p className={styles.techniqueWhy}>{technique.why}</p>

      <Button
        size="small"
        type="link"
        className={styles.patternLink}
        icon={<BulbOutlined />}
        onClick={() => onOpenTemplate(technique.pattern)}
      >
        Open the {PATTERN_LABEL[technique.pattern].toLowerCase()} template
      </Button>
    </li>
  );
}

export function ProblemDrawer({
  open,
  language,
  currentSlug,
  compact,
  onClose,
  onLoad,
  onReveal,
  onOpenTemplate,
}: Props) {
  const [input, setInput] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [browsing, setBrowsing] = useState<LeetProblem | null>(null);
  const [index, setIndex] = useState<ProblemIndex | null>(null);
  // Assembled from LeetCode's published interface when a problem is not one of
  // the ones written out here. Null while it loads, and for problems that have
  // nothing runnable to build from.
  const [generated, setGenerated] = useState<LeetProblem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [runnable, setRunnable] = useState(0);

  // ~300 kB of metadata, so it is fetched the first time the drawer opens and
  // never at all for someone who does not use this feature.
  useEffect(() => {
    if (!open || index) return;
    let live = true;
    loadProblemIndex()
      .then((loaded) => {
        if (live) setIndex(loaded);
      })
      .catch(() => {
        /* the keyword fallback still works without it */
      });
    void detailCount().then((count) => {
      if (live) setRunnable(count);
    });
    return () => {
      live = false;
    };
  }, [open, index]);

  const result = useMemo(
    () => (submitted ? recommend(submitted, index) : null),
    [submitted, index],
  );

  // A problem Breakstep knows of but does not carry: fetch its shard and build
  // something runnable out of the interface LeetCode publishes.
  useEffect(() => {
    setGenerated(null);
    const indexedProblem = result?.indexed;
    if (!indexedProblem || result?.problem) return;

    let live = true;
    setLoadingDetail(true);
    loadDetail(indexedProblem.slug, indexedProblem.number)
      .then((detail) => {
        if (!live) return;
        setGenerated(detail ? synthesizeProblem(indexedProblem, detail) : null);
      })
      .catch(() => undefined)
      .finally(() => {
        if (live) setLoadingDetail(false);
      });

    return () => {
      live = false;
    };
  }, [result]);

  // What the body shows: a pasted result wins — written out if Breakstep has
  // it, otherwise the runnable version — and failing that, whatever was browsed.
  const problem = result?.problem ?? generated ?? browsing ?? null;
  const written = problem !== null && problem.origin !== 'generated';
  const techniques = result
    ? result.techniques
    : problem
      ? [...problem.techniques].sort((a, b) => a.rank - b.rank)
      : [];

  const indexed = result?.indexed;
  const headline = problem
    ? { number: problem.number, title: problem.title, difficulty: problem.difficulty }
    : indexed
      ? { number: indexed.number, title: indexed.title, difficulty: indexed.difficulty }
      : null;

  const submit = (value: string) => {
    setBrowsing(null);
    setSubmitted(value);
  };

  return (
    <Drawer
      title="Solve a LeetCode problem"
      placement="right"
      width={compact ? '100%' : 520}
      open={open}
      onClose={onClose}
      styles={{ body: { padding: 0 } }}
    >
      <div className={styles.body}>
        <div className={styles.searchRow}>
          <Input.Search
            allowClear
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onSearch={submit}
            enterButton="Find"
            placeholder="https://leetcode.com/problems/two-sum/"
            prefix={<LinkOutlined />}
            aria-label="LeetCode problem URL"
          />
          <p className={styles.privacy}>
            Nothing leaves your browser: the link is matched against an offline index of{' '}
            {index ? `${index.size.toLocaleString()} problems (as of ${index.fetchedAt})` : 'every problem'}
            . {PROBLEMS.length} are written out here in full, with a solution to reveal
            {runnable > 0 && `; another ${(runnable - PROBLEMS.length).toLocaleString()} open with their
              published examples already wired up to run`}
            . Statements stay on LeetCode — they are LeetCode's writing.
          </p>
        </div>

        {result && result.source !== 'catalogue' && (
          <div className={styles.notice}>
            <Alert
              type={result.source === 'unrecognised' ? 'warning' : 'info'}
              showIcon
              message={
                result.source === 'unrecognised'
                  ? 'That link was not a problem link'
                  : result.source === 'indexed'
                    ? generated
                      ? 'Ready to run — statement on LeetCode'
                      : loadingDetail
                        ? 'Looking it up…'
                        : 'Breakstep knows this problem, but cannot build a runnable version'
                    : `Unknown problem: ${result.slug}`
              }
              description={
                result.source === 'indexed' && generated
                  ? "The examples below are LeetCode's own, already wired to a stub with the right signature. The statement is their writing, so it is not copied here — the link opens it."
                  : result.source === 'indexed' && !loadingDetail && !generated
                    ? 'Its examples are stated in a shape nothing can turn into a call — a design problem, or a parameter type with no obvious literal. Read it on LeetCode and start from a pattern template.'
                    : result.note
              }
            />
          </div>
        )}

        {/* --- Close matches, when nothing resolved ------------------------ */}
        {result && result.suggestions.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.heading}>Did you mean</h3>
            <ul className={styles.groupList}>
              {result.suggestions.map((s) => (
                <li key={s.slug}>
                  <button
                    type="button"
                    className={styles.groupItem}
                    onClick={() => {
                      setInput(s.slug);
                      submit(s.slug);
                    }}
                  >
                    <span className={styles.groupNumber}>{s.number}</span>
                    <span className={styles.groupTitle}>{s.title}</span>
                    <Tag
                      className={styles.groupTag}
                      color={DIFFICULTY_COLOR[s.difficulty]}
                      bordered={false}
                    >
                      {s.difficulty}
                    </Tag>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* --- The recommendation ------------------------------------------ */}
        {techniques.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.heading}>
              {result?.source === 'guess' ? 'Likely technique' : 'Recommended technique'}
              {techniques.length > 1 && <span className={styles.count}>{techniques.length}</span>}
            </h3>
            <ul className={styles.techniques}>
              {techniques.map((technique) => (
                <TechniqueCard
                  key={technique.pattern}
                  technique={technique}
                  onOpenTemplate={onOpenTemplate}
                />
              ))}
            </ul>

            {result && result.structures.length > 0 && (
              <div className={styles.structures}>
                <span className={styles.structuresLabel}>Structures it leans on</span>
                {result.structures.map((id) => (
                  <Button
                    key={id}
                    size="small"
                    icon={<ApartmentOutlined />}
                    onClick={() => onOpenTemplate(id)}
                  >
                    {getTemplate(id).title}
                  </Button>
                ))}
              </div>
            )}

            {result && result.unmapped.length > 0 && (
              <p className={styles.unmapped}>
                LeetCode also tags it {result.unmapped.map(tagLabel).join(', ')} — Breakstep has no
                template for {result.unmapped.length > 1 ? 'those' : 'that'} yet.
              </p>
            )}
          </section>
        )}

        {/* --- The problem itself ------------------------------------------ */}
        {headline && (
          <section className={styles.section}>
            <div className={styles.problemHead}>
              <span className={styles.number}>{headline.number}</span>
              <h3 className={styles.problemTitle}>{headline.title}</h3>
              <Tag color={DIFFICULTY_COLOR[headline.difficulty]}>{headline.difficulty}</Tag>
              {indexed?.paidOnly && (
                <Tag icon={<LockOutlined />} color="default">
                  Premium
                </Tag>
              )}
            </div>

            {problem && <p className={styles.prompt}>{problem.prompt}</p>}

            <div className={styles.topics}>
              {(indexed?.topics ?? problem?.topics ?? []).map((topic) => (
                <span key={topic} className={styles.topic}>
                  {topic}
                </span>
              ))}
            </div>

            {result?.slug && (
              <a
                className={styles.leetLink}
                href={problemUrl(result.slug)}
                target="_blank"
                rel="noreferrer noopener"
              >
                <ExportOutlined /> Read it on LeetCode
              </a>
            )}
          </section>
        )}

        {problem && (
          <>
            <section className={styles.section}>
              <h3 className={styles.heading}>Examples</h3>
              <ul className={styles.examples}>
                {problem.examples.map((example, i) => (
                  <li key={example.input} className={styles.example}>
                    <span className={styles.exampleLabel}>{i + 1}</span>
                    <div className={styles.exampleBody}>
                      <code className={styles.exampleIn}>{example.input}</code>
                      <code className={styles.exampleOut}>→ {example.output}</code>
                      {example.note && <span className={styles.exampleNote}>{example.note}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {problem.constraints.length > 0 && (
              <section className={styles.section}>
                <h3 className={styles.heading}>Constraints</h3>
                <ul className={styles.constraints}>
                  {problem.constraints.map((line) => (
                    <li key={line}>
                      <code>{line}</code>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className={styles.actions}>
              <Tooltip title="Put the starter code and the example datasets in the editor">
                <Button type="primary" icon={<CodeOutlined />} onClick={() => onLoad(problem)}>
                  Load the problem
                </Button>
              </Tooltip>
              {written ? (
                <Tooltip title="Replace the editor with a worked solution in the current language">
                  <Button icon={<EyeOutlined />} onClick={() => onReveal(problem)}>
                    Reveal the solution
                  </Button>
                </Tooltip>
              ) : (
                <span className={styles.noSolution}>
                  No solution to reveal — LeetCode publishes none to take, and this
                  one is not written out here.
                </span>
              )}
              <span className={styles.langHint}>in {language}</span>
            </div>
          </>
        )}

        {/* --- Browse ------------------------------------------------------- */}
        <section className={styles.section}>
          <h3 className={styles.heading}>
            Written out in full
            <span className={styles.count}>{PROBLEMS.length}</span>
          </h3>
          {problemsByPattern().map(({ pattern, problems }) => (
            <div key={pattern} className={styles.group}>
              <span className={styles.groupName}>{PATTERN_LABEL[pattern]}</span>
              <ul className={styles.groupList}>
                {problems.map((p) => (
                  <li key={p.slug}>
                    <button
                      type="button"
                      className={styles.groupItem}
                      aria-current={p.slug === problem?.slug}
                      data-active={p.slug === problem?.slug}
                      onClick={() => {
                        setSubmitted('');
                        setBrowsing(p);
                      }}
                    >
                      <span className={styles.groupNumber}>{p.number}</span>
                      <span className={styles.groupTitle}>{p.title}</span>
                      <Tag
                        className={styles.groupTag}
                        color={DIFFICULTY_COLOR[p.difficulty]}
                        bordered={false}
                      >
                        {p.difficulty}
                      </Tag>
                      {p.slug === currentSlug && (
                        <span className={styles.loadedDot} aria-label="loaded" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </div>
    </Drawer>
  );
}
