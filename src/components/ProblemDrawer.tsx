import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Drawer, Input, Tag } from 'antd';
import { CheckCircleFilled, ExportOutlined, LinkOutlined, LockOutlined } from '@ant-design/icons';
import { StructureLinks, TechniqueCard, UnmappedTags } from './TechniqueCard';
import { PROBLEMS, problemsByPattern } from '@/leetcode/catalogue';
import { recommend } from '@/leetcode/recommend';
import { loadProblemIndex, type ProblemIndex } from '@/leetcode/problemIndex';
import { detailCount, loadDetail } from '@/leetcode/details';
import { synthesizeProblem, problemUrl } from '@/leetcode/synthesize';
import { PATTERN_LABEL, type LeetProblem } from '@/leetcode/types';
import styles from './ProblemDrawer.module.scss';

interface Props {
  open: boolean;
  /** The problem currently loaded in the editor, if any. */
  currentSlug: string | null;
  /** Problems with an accepted submission, marked so the list shows progress. */
  solvedSlugs?: Set<string>;
  compact?: boolean;
  onClose: () => void;
  /**
   * Open a problem in the editor. Everything about a loaded problem — its
   * statement, its examples, revealing the solution — lives in the problem
   * panel, so this drawer only has to find one and hand it over.
   */
  onLoad: (problem: LeetProblem) => void;
  /** Open a pattern or structure template by id. */
  onOpenTemplate: (templateId: string) => void;
}

const DIFFICULTY_COLOR = { Easy: 'green', Medium: 'gold', Hard: 'red' } as const;

export function ProblemDrawer({
  open,
  currentSlug,
  solvedSlugs,
  compact,
  onClose,
  onLoad,
  onOpenTemplate,
}: Props) {
  const [input, setInput] = useState('');
  const [submitted, setSubmitted] = useState('');
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

  // Written out here, or assembled from what LeetCode publishes — either way,
  // something that can be opened.
  const openable = result?.problem ?? generated ?? null;

  /*
   * Finding a problem and opening it are the same action.
   *
   * Pressing Find used to leave you on a summary with a Load button, which is
   * the same two-step-behind-a-one-step-affordance the list rows had. A problem
   * that can be opened is opened, and the problem panel takes it from there;
   * the drawer only has to say something when it *cannot* open one.
   *
   * Guarded on the slug and read through refs, because it must fire once per
   * problem found — not once per render. Depending on the callbacks directly
   * re-ran it whenever the parent re-rendered, which quietly reloaded the
   * starter over a solution someone had just revealed.
   */
  const openedRef = useRef<string | null>(null);
  const loadRef = useRef(onLoad);
  loadRef.current = onLoad;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!openable || openedRef.current === openable.slug) return;
    openedRef.current = openable.slug;
    loadRef.current(openable);
    closeRef.current();
  }, [openable]);

  /** How many of the written problems have an accepted submission. */
  const solved = PROBLEMS.reduce((count, p) => count + (solvedSlugs?.has(p.slug) ? 1 : 0), 0);

  const techniques = result?.techniques ?? [];
  const indexed = result?.indexed;
  const headline = indexed
    ? { number: indexed.number, title: indexed.title, difficulty: indexed.difficulty }
    : null;

  const submit = (value: string) => {
    // A fresh search may well be for the problem already open; let it reopen.
    openedRef.current = null;
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
          {/*
            Said where LeetCode's name is most present, rather than buried in an
            about box: this is the screen that could imply an association.
          */}
          <p className={styles.privacy}>
            Breakstep is not affiliated with or endorsed by LeetCode. LeetCode is a
            trademark of its owner, used here to say where a problem comes from.
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
                    ? // A problem that can be opened has been; this branch is
                      // only ever the ones that cannot.
                      loadingDetail
                      ? 'Looking it up…'
                      : 'Breakstep knows this problem, but cannot open it'
                    : `Unknown problem: ${result.slug}`
              }
              description={
                result.source === 'indexed' && !loadingDetail
                  ? 'Nothing it publishes can be turned into a call — a premium problem, a design problem, or a parameter type with no literal form. Read it on LeetCode and start from the pattern below.'
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

            <StructureLinks
              structures={result?.structures ?? []}
              onOpenTemplate={onOpenTemplate}
            />
            <UnmappedTags tags={result?.unmapped ?? []} />
          </section>
        )}

        {/* --- What it is, for a problem that cannot be opened -------------- */}
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

            <div className={styles.topics}>
              {(indexed?.topics ?? []).map((topic) => (
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

        {/* --- Browse ------------------------------------------------------- */}
        <section className={styles.section}>
          <h3 className={styles.heading}>
            Written out in full
            <span className={styles.count}>{PROBLEMS.length}</span>
            {solved > 0 && <span className={styles.solvedCount}>{solved} solved</span>}
            <span className={styles.headingHint}>click to open in the editor</span>
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
                      aria-current={p.slug === currentSlug}
                      data-active={p.slug === currentSlug}
                      // Clicking a problem opens it, which is what the row
                      // looks like it does. Everything about it then lives in
                      // the problem panel, beside the code.
                      onClick={() => {
                        setSubmitted('');
                        onLoad(p);
                        onClose();
                      }}
                    >
                      <span className={styles.groupNumber}>{p.number}</span>
                      <span className={styles.groupTitle}>{p.title}</span>
                      {solvedSlugs?.has(p.slug) && (
                        <CheckCircleFilled className={styles.solved} aria-label="solved" />
                      )}
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
