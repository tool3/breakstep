import { useMemo, useState } from 'react';
import { Alert, Button, Drawer, Input, Tag, Tooltip } from 'antd';
import { BulbOutlined, CodeOutlined, EyeOutlined, LinkOutlined } from '@ant-design/icons';
import { PROBLEMS, problemsByPattern } from '@/leetcode/catalogue';
import { recommend } from '@/leetcode/recommend';
import { PATTERN_LABEL, type LeetProblem, type PatternId, type Technique } from '@/leetcode/types';
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
  /** Open the pattern template that teaches this technique. */
  onOpenPattern: (pattern: PatternId) => void;
}

const DIFFICULTY_COLOR = { Easy: 'green', Medium: 'gold', Hard: 'red' } as const;

function TechniqueCard({
  technique,
  onOpenPattern,
}: {
  technique: Technique;
  onOpenPattern: (pattern: PatternId) => void;
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
        onClick={() => onOpenPattern(technique.pattern)}
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
  onOpenPattern,
}: Props) {
  const [input, setInput] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [browsing, setBrowsing] = useState<LeetProblem | null>(null);

  const result = useMemo(() => (submitted ? recommend(submitted) : null), [submitted]);

  // What the body shows: a pasted result wins, otherwise whatever was browsed.
  const problem = result?.problem ?? browsing ?? null;
  const techniques = result?.problem
    ? result.techniques
    : problem
      ? [...problem.techniques].sort((a, b) => a.rank - b.rank)
      : (result?.techniques ?? []);

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
            Nothing leaves your browser — Breakstep matches the link against its own catalogue of{' '}
            {PROBLEMS.length} problems.
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
                  : `Not in the catalogue: ${result.slug}`
              }
              description={result.note}
            />
          </div>
        )}

        {/* --- The recommendation ------------------------------------------ */}
        {techniques.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.heading}>
              {problem ? 'Recommended technique' : 'Likely technique'}
              {techniques.length > 1 && <span className={styles.count}>{techniques.length}</span>}
            </h3>
            <ul className={styles.techniques}>
              {techniques.map((technique) => (
                <TechniqueCard
                  key={technique.pattern}
                  technique={technique}
                  onOpenPattern={onOpenPattern}
                />
              ))}
            </ul>
          </section>
        )}

        {/* --- The problem itself ------------------------------------------ */}
        {problem && (
          <>
            <section className={styles.section}>
              <div className={styles.problemHead}>
                <span className={styles.number}>{problem.number}</span>
                <h3 className={styles.problemTitle}>{problem.title}</h3>
                <Tag color={DIFFICULTY_COLOR[problem.difficulty]}>{problem.difficulty}</Tag>
              </div>

              <p className={styles.prompt}>{problem.prompt}</p>

              <div className={styles.topics}>
                {problem.topics.map((topic) => (
                  <span key={topic} className={styles.topic}>
                    {topic}
                  </span>
                ))}
              </div>
            </section>

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

            <div className={styles.actions}>
              <Tooltip title="Put the starter code and the example datasets in the editor">
                <Button type="primary" icon={<CodeOutlined />} onClick={() => onLoad(problem)}>
                  Load the problem
                </Button>
              </Tooltip>
              <Tooltip title="Replace the editor with a worked solution in the current language">
                <Button icon={<EyeOutlined />} onClick={() => onReveal(problem)}>
                  Reveal the solution
                </Button>
              </Tooltip>
              <span className={styles.langHint}>in {language}</span>
            </div>
          </>
        )}

        {/* --- Browse ------------------------------------------------------- */}
        <section className={styles.section}>
          <h3 className={styles.heading}>Or pick one by technique</h3>
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
