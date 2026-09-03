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
  currentSlug: string | null;
  solvedSlugs?: Set<string>;
  compact?: boolean;
  onClose: () => void;
  onLoad: (problem: LeetProblem) => void;
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
  const [generated, setGenerated] = useState<LeetProblem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [runnable, setRunnable] = useState(0);

  useEffect(() => {
    if (!open || index) return;
    let live = true;
    loadProblemIndex()
      .then((loaded) => {
        if (live) setIndex(loaded);
      })
      .catch(() => {
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

  const openable = result?.problem ?? generated ?? null;

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

  const solved = PROBLEMS.reduce((count, p) => count + (solvedSlugs?.has(p.slug) ? 1 : 0), 0);

  const techniques = result?.techniques ?? [];
  const indexed = result?.indexed;
  const headline = indexed
    ? { number: indexed.number, title: indexed.title, difficulty: indexed.difficulty }
    : null;

  const submit = (value: string) => {
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
                    ?
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
